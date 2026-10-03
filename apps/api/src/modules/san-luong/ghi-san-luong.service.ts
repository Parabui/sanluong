import { Injectable, Logger } from '@nestjs/common';
import {
  dinhDangGio,
  type GhiSanLuong,
  type KetQuaDong,
  type KetQuaGhi,
  type NgayLamViec,
  type NguonSanLuong,
  thangCua,
  zKetQuaGhi,
} from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { NguCanhAudit } from '../../core/ngu-canh.js';
import { khoaChuyenNgay, khoaMaHangThang } from '../../core/prisma/khoa.js';
import { khoangNgay, ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { MaHangService } from '../ma-hang/ma-hang.service.js';
import { CuaSoNhapService } from './cua-so-nhap.service.js';

interface DongCu {
  id: string;
  so_luong: number;
  da_dieu_chinh: boolean;
}

/**
 * Ghi sản lượng — NƠI DUY NHẤT ghi bảng san_luong [CLAUDE.md #4] [TDD 8.2] [D7] [D16] [D19] [D25].
 * Nguồn APP (công nhân), SUA_WEB / NHAP_HO (F10, F19) — cùng khóa & kiểm tra.
 *
 * Thứ tự cố định: dedupe requestId TRONG transaction → khóa CHIA SẺ (CN, chuyền, ngày) → khóa CHIA SẺ (MH, mã hàng, tháng)
 * tăng dần → 1 CTE kiểm tra (phiên FOR SHARE, chốt, khóa tháng, sơ đồ ngày D) → upsert có điều kiện trong câu lệnh
 * → lịch sử (chỉ dòng có thay đổi) + 1 dòng audit → lưu kết quả request → COMMIT.
 */
@Injectable()
export class GhiSanLuongService {
  private readonly logger = new Logger(GhiSanLuongService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly cuaSo: CuaSoNhapService,
    private readonly maHang: MaHangService,
  ) {}

  async ghiApp(yc: GhiSanLuong, thietBiId: string, nguCanhGoc: NguCanhAudit): Promise<KetQuaGhi> {
    // Đường tắt (ngoài transaction): requestId đã xử lý xong → trả lại đúng kết quả cũ, không sinh lịch sử [D19]
    const cu = await this.prisma.requestDaXuLy.findUnique({ where: { chuTheId_requestId: { chuTheId: thietBiId, requestId: yc.requestId } } });
    if (cu?.ketQua) return zKetQuaGhi.parse(cu.ketQua);

    const tram = await this.prisma.tram.findUnique({ where: { id: yc.tramId }, select: { id: true, soTram: true, chuyenId: true } });
    if (!tram) throw new LoiNghiepVu('KHONG_TIM_THAY');
    const cdIds = [...new Set(yc.dong.map((d) => d.congDoanId))];
    if (cdIds.length !== yc.dong.length) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', { message: 'Một công đoạn chỉ được gửi một lần.' });
    const cd = await this.prisma.congDoan.findMany({ where: { id: { in: cdIds } }, select: { id: true, maHangId: true } });
    if (cd.length !== cdIds.length) throw new LoiNghiepVu('CONG_DOAN_KHONG_THUOC_SO_DO');

    // Cửa sổ nhập: hôm nay + ngày làm việc liền trước (chưa chốt kiểm lại dưới khóa) [D22]
    if (!(await this.cuaSo.ungVien()).includes(yc.ngay)) throw new LoiNghiepVu('NGAY_KHONG_MO_NHAP');

    return this.audit.giaoDich(async (tx) => {
      // ① Chống trùng TRONG transaction: request trùng đồng thời CHỜ ở INSERT đến khi bản đầu commit rồi DO NOTHING [D19]
      const giu = await tx.$queryRaw<{ x: number }[]>`
        INSERT INTO request_da_xu_ly (chu_the_id, request_id, loai_chu_the)
        VALUES (${thietBiId}::uuid, ${yc.requestId}::uuid, 'THIET_BI')
        ON CONFLICT DO NOTHING RETURNING 1 AS x`;
      if (!giu.length) {
        const r = await tx.requestDaXuLy.findUnique({ where: { chuTheId_requestId: { chuTheId: thietBiId, requestId: yc.requestId } } });
        if (r?.ketQua) return zKetQuaGhi.parse(r.ketQua);
        throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', { message: 'Yêu cầu đang được xử lý, vui lòng thử lại.' });
      }

      // ② Khóa — thứ tự CN → MH tăng dần (ma trận TDD 8.9); Lưu dùng khóa CHIA SẺ [D25]
      await khoaChuyenNgay(tx, tram.chuyenId, yc.ngay, 'CHIA_SE');
      await khoaMaHangThang(tx, cd.map((c) => ({ maHangId: c.maHangId, thang: thangCua(yc.ngay) })), 'CHIA_SE');

      // ③ Kiểm tra gộp 1 câu (giảm round-trip) — phiên giữ FOR SHARE để đăng xuất hộ / chuyển thiết bị chờ Lưu xong
      const { tu, den } = khoangNgay(yc.ngay);
      const [kt] = await tx.$queryRaw<{ nhan_vien_id: string | null; da_chot: boolean; cd_khoa: string[]; so_do: string[]; dang_gan: string[] }[]>`
        SELECT
          (SELECT p.nhan_vien_id FROM phien_tram p
            WHERE p.tram_id = ${tram.id}::uuid AND p.ngay_lam_viec = ${ngayDb(yc.ngay)} AND p.thiet_bi_id = ${thietBiId}::uuid
              AND p.dang_xuat_luc IS NULL FOR SHARE) AS nhan_vien_id,
          EXISTS (SELECT 1 FROM chot_ngay WHERE chuyen_id = ${tram.chuyenId}::uuid AND ngay_lam_viec = ${ngayDb(yc.ngay)}) AS da_chot,
          ARRAY(SELECT cd.id::text FROM cong_doan cd JOIN khoa_thang k ON k.ma_hang_id = cd.ma_hang_id
                 AND k.thang = ${thangCua(yc.ngay)} AND k.trang_thai = 'KHOA'
                WHERE cd.id = ANY(${cdIds}::uuid[])) AS cd_khoa,
          ARRAY(SELECT DISTINCT g.cong_doan_id::text FROM gan_cong_doan g
                WHERE g.tram_id = ${tram.id}::uuid AND g.hieu_luc_tu < ${den}
                  AND (g.hieu_luc_den IS NULL OR g.hieu_luc_den > ${tu})) AS so_do,
          ARRAY(SELECT g.cong_doan_id::text FROM gan_cong_doan g WHERE g.tram_id = ${tram.id}::uuid AND g.hieu_luc_den IS NULL) AS dang_gan`;

      if (!kt!.nhan_vien_id) throw await this.loiPhienKhongCon(tx, tram.id, tram.soTram, yc.ngay, thietBiId);
      if (kt!.da_chot) throw new LoiNghiepVu('NGAY_DA_CHOT', { message: 'Ngày đã chốt, liên hệ tổ trưởng.' });
      if (kt!.cd_khoa.length) throw new LoiNghiepVu('THANG_DA_KHOA');
      const soDo = new Set(kt!.so_do);
      if (cdIds.some((id) => !soDo.has(id))) throw new LoiNghiepVu('CONG_DOAN_KHONG_THUOC_SO_DO');
      const nhanVienId = kt!.nhan_vien_id;
      const dangGan = new Set(kt!.dang_gan);
      const nguCanh: NguCanhAudit = { ...nguCanhGoc, nguoiThucHienId: nhanVienId, thietBiId };

      // ④ Ghi từng dòng — điều kiện nằm TRONG câu lệnh (DB là hàng rào cuối)
      const now = this.clock.now();
      const smv = await this.maHang.smvTaiNgay(tx, cdIds, yc.ngay);
      const ketQua: KetQuaGhi['dong'] = [];
      const lichSu: { sanLuongId: string; soCu: number | null; soMoi: number; lucThietBi: Date | null }[] = [];
      for (const d of yc.dong) {
        const [hienCo] = await tx.$queryRaw<DongCu[]>`
          SELECT id, so_luong, da_dieu_chinh FROM san_luong
          WHERE ngay_lam_viec = ${ngayDb(yc.ngay)} AND tram_id = ${tram.id}::uuid
            AND cong_doan_id = ${d.congDoanId}::uuid AND nhan_vien_id = ${nhanVienId}::uuid
          FOR UPDATE`;
        if (hienCo && !hienCo.da_dieu_chinh && hienCo.so_luong === d.soLuong) {
          ketQua.push({ congDoanId: d.congDoanId, ketQua: 'KHONG_DOI', soHienTai: hienCo.so_luong });
          continue;
        }
        const lucThietBi = d.lucThietBi ? new Date(d.lucThietBi) : null;
        // Cờ ⚠: công đoạn đã gỡ khỏi trạm lúc lưu (vẫn thuộc sơ đồ ngày D nên vẫn nhận) [R 3.10]
        const canhBao = !dangGan.has(d.congDoanId);
        const ghi = await tx.$queryRaw<{ id: string; so_luong: number }[]>`
          INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, smv_snapshot, chuyen_tram_snapshot,
                                 nguon, canh_bao, cap_nhat_luc_server, cap_nhat_luc_thiet_bi, thu_tu_thiet_bi, thiet_bi_id)
          VALUES (${ngayDb(yc.ngay)}, ${tram.id}::uuid, ${d.congDoanId}::uuid, ${nhanVienId}::uuid, ${d.soLuong},
                  ${smv.get(d.congDoanId) ?? null}::numeric, ${tram.chuyenId}::uuid,
                  'APP', ${canhBao}, ${now}, ${lucThietBi}, ${d.thuTuThietBi}::bigint, ${thietBiId}::uuid)
          ON CONFLICT (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id) DO UPDATE
            SET so_luong = EXCLUDED.so_luong, nguon = 'APP', canh_bao = san_luong.canh_bao OR EXCLUDED.canh_bao,
                cap_nhat_luc_server = EXCLUDED.cap_nhat_luc_server, cap_nhat_luc_thiet_bi = EXCLUDED.cap_nhat_luc_thiet_bi,
                thu_tu_thiet_bi = EXCLUDED.thu_tu_thiet_bi, thiet_bi_id = EXCLUDED.thiet_bi_id, version = san_luong.version + 1
            WHERE san_luong.da_dieu_chinh = false
              AND (san_luong.thiet_bi_id IS DISTINCT FROM EXCLUDED.thiet_bi_id          -- [D16] khác thiết bị: phiên + khóa đã đảm bảo thứ tự
                   OR EXCLUDED.thu_tu_thiet_bi > san_luong.thu_tu_thiet_bi)              --   cùng thiết bị: chỉ nhận gói MỚI hơn
          RETURNING id, so_luong`;
        // ⚠ nhánh DO UPDATE KHÔNG sửa chuyen_tram_snapshot, smv_snapshot [CLAUDE.md #13]
        if (ghi.length) {
          ketQua.push({ congDoanId: d.congDoanId, ketQua: 'DA_LUU', soHienTai: ghi[0]!.so_luong });
          lichSu.push({ sanLuongId: ghi[0]!.id, soCu: hienCo?.so_luong ?? null, soMoi: d.soLuong, lucThietBi });
        } else {
          const lyDo: KetQuaDong = hienCo?.da_dieu_chinh ? 'O_DA_DIEU_CHINH' : 'GOI_CU_BO_QUA';
          if (lyDo === 'GOI_CU_BO_QUA') this.logger.warn({ tramId: tram.id, congDoanId: d.congDoanId, thietBiId }, 'Gói cũ đến sau gói mới — bỏ qua');
          ketQua.push({ congDoanId: d.congDoanId, ketQua: lyDo, soHienTai: hienCo?.so_luong ?? null });
        }
      }

      // ⑤ Lịch sử — 1 câu, CHỈ dòng có thay đổi (KHONG_DOI không ghi) + 1 dòng audit
      if (lichSu.length) {
        await tx.sanLuongLichSu.createMany({
          data: lichSu.map((l) => ({
            sanLuongId: l.sanLuongId, soCu: l.soCu, soMoi: l.soMoi, nguon: 'APP' as const,
            loaiNguoiThucHien: 'NHAN_VIEN' as const, nguoiThucHienId: nhanVienId, lucServer: now, lucThietBi: l.lucThietBi,
            thietBiId, requestId: yc.requestId,
          })),
        });
        await this.audit.ghi(tx, {
          hanhDong: 'GHI_SAN_LUONG', doiTuong: 'tram', doiTuongId: tram.id,
          moi: { ngay: yc.ngay, soDong: lichSu.length, requestId: yc.requestId },
        }, nguCanh);
      }

      // ⑥ Lưu kết quả để Thử lại cùng requestId nhận đúng kết quả cũ
      const kq: KetQuaGhi = { dong: ketQua, luc: now.toISOString() };
      await tx.requestDaXuLy.update({
        where: { chuTheId_requestId: { chuTheId: thietBiId, requestId: yc.requestId } },
        data: { ketQua: kq as object },
      });
      return kq;
    }, { ...nguCanhGoc, thietBiId });
  }

  // ── Web: Sửa ô (F10) · Nhập hộ (F19) [TDD 8.3] ──
  // Không kiểm phiên, không giới hạn cửa sổ nhập; ghi được sau khi chốt ngày, CHỈ bị chặn khi đã khóa mã hàng × tháng.

  private taiKhoanId(nguCanh: NguCanhAudit): string {
    if (!nguCanh.nguoiThucHienId) throw new LoiNghiepVu('CHUA_DANG_NHAP');
    return nguCanh.nguoiThucHienId;
  }

  private async kiemKhoaThang(tx: Tx, maHangId: string, ngay: NgayLamViec): Promise<void> {
    const k = await tx.khoaThang.findUnique({ where: { maHangId_thang: { maHangId, thang: thangCua(ngay) } }, select: { trangThai: true } });
    if (k?.trangThai === 'KHOA') throw new LoiNghiepVu('THANG_DA_KHOA');
  }

  /** "Dữ liệu đã bị [tên] thay đổi lúc hh:mm" — người / lúc của lần ghi gần nhất [F10] */
  private async loiDaThayDoi(tx: Tx, sanLuongId: string): Promise<LoiNghiepVu> {
    const [g] = await tx.$queryRaw<{ ten: string | null; luc: Date }[]>`
      SELECT COALESCE(tk.ho_ten, nv.ho_ten) AS ten, l.luc_server AS luc FROM san_luong_lich_su l
      LEFT JOIN tai_khoan tk ON l.loai_nguoi_thuc_hien = 'TAI_KHOAN' AND tk.id = l.nguoi_thuc_hien_id
      LEFT JOIN nhan_vien nv ON l.loai_nguoi_thuc_hien = 'NHAN_VIEN' AND nv.id = l.nguoi_thuc_hien_id
      WHERE l.san_luong_id = ${sanLuongId}::uuid ORDER BY l.luc_server DESC LIMIT 1`;
    return new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', {
      message: g ? `Dữ liệu đã bị ${g.ten ?? 'người khác'} thay đổi lúc ${dinhDangGio(g.luc)}, vui lòng tải lại.` : undefined,
    });
  }

  /**
   * PUT /api/bang-san-luong/o — tổ trưởng sửa ô (bắt buộc lý do) → Ô đã điều chỉnh, app không ghi đè được [R 5.4].
   * Số không đổi = xác nhận ô cảnh báo: bỏ cờ ⚠, vẫn ghi lịch sử kèm lý do (ô thành Ô đã điều chỉnh).
   */
  async suaWeb(dto: { sanLuongId: string; soLuong: number; lyDo: string; version: number }, nguCanh: NguCanhAudit): Promise<{ sanLuongId: string; soLuong: number; version: number }> {
    const taiKhoanId = this.taiKhoanId(nguCanh);
    const s = await this.prisma.sanLuong.findUnique({
      where: { id: dto.sanLuongId },
      select: { chuyenTramSnapshot: true, ngayLamViec: true, congDoan: { select: { maHangId: true } } },
    });
    if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY');
    const ngay = tuNgayDb(s.ngayLamViec);
    return this.audit.giaoDich(async (tx) => {
      await khoaChuyenNgay(tx, s.chuyenTramSnapshot, ngay, 'CHIA_SE');
      await khoaMaHangThang(tx, [{ maHangId: s.congDoan.maHangId, thang: thangCua(ngay) }], 'CHIA_SE');
      await this.kiemKhoaThang(tx, s.congDoan.maHangId, ngay);
      const [r] = await tx.$queryRaw<{ so_luong: number; version: number; nguon: NguonSanLuong; canh_bao: boolean; da_dieu_chinh: boolean }[]>`
        SELECT so_luong, version, nguon::text AS nguon, canh_bao, da_dieu_chinh FROM san_luong WHERE id = ${dto.sanLuongId}::uuid FOR UPDATE`;
      if (!r) throw new LoiNghiepVu('KHONG_TIM_THAY');
      if (r.version !== dto.version) throw await this.loiDaThayDoi(tx, dto.sanLuongId);
      const doiSo = r.so_luong !== dto.soLuong;
      // Ô đã điều chỉnh ⇔ nguồn NHAP_HO / SUA_WEB (ck_da_dieu_chinh) — xác nhận ô App cũng thành SUA_WEB
      const nguon: NguonSanLuong = !doiSo && (r.nguon === 'NHAP_HO' || r.nguon === 'SUA_WEB') ? r.nguon : 'SUA_WEB';
      const now = this.clock.now();
      const moi = await tx.sanLuong.update({
        where: { id: dto.sanLuongId },
        data: {
          soLuong: dto.soLuong, nguon, daDieuChinh: true, canhBao: false, capNhatBoiTaiKhoanId: taiKhoanId,
          capNhatLucServer: now, updatedAt: now, version: { increment: 1 },
        },
        select: { version: true },
      });
      await tx.sanLuongLichSu.create({
        data: { sanLuongId: dto.sanLuongId, soCu: r.so_luong, soMoi: dto.soLuong, nguon, lyDo: dto.lyDo, loaiNguoiThucHien: 'TAI_KHOAN', nguoiThucHienId: taiKhoanId, lucServer: now },
      });
      await this.audit.ghi(tx, {
        hanhDong: doiSo ? 'SUA_SAN_LUONG' : 'XAC_NHAN_SAN_LUONG', doiTuong: 'san_luong', doiTuongId: dto.sanLuongId,
        cu: { soLuong: r.so_luong, nguon: r.nguon, canhBao: r.canh_bao, daDieuChinh: r.da_dieu_chinh }, moi: { soLuong: dto.soLuong, nguon }, lyDo: dto.lyDo,
      }, nguCanh);
      return { sanLuongId: dto.sanLuongId, soLuong: dto.soLuong, version: moi.version };
    }, nguCanh);
  }

  /**
   * POST /api/bang-san-luong/nhap-ho — tổ trưởng nhập thay công nhân [F19].
   * Trạm phải thuộc chuyền được gắn (kiểm ở controller/service gọi); NV: bất kỳ NV đang hoạt động (kể cả hỗ trợ) [R 5.8].
   * Công nhân đã tự nhập → ghi đè, lịch sử số cũ – số mới. NV không đứng trạm đó hôm đó → vẫn cho, audit cờ NV_KHONG_CO_PHIEN.
   */
  async nhapHo(
    dto: { tramId: string; congDoanId: string; ngay: NgayLamViec; nhanVienId: string; soLuong: number; lyDo: string },
    tram: { id: string; chuyenId: string },
    nguCanh: NguCanhAudit,
  ): Promise<{ sanLuongId: string; soLuong: number; version: number }> {
    const taiKhoanId = this.taiKhoanId(nguCanh);
    const [nv, cd] = await Promise.all([
      this.prisma.nhanVien.findUnique({ where: { id: dto.nhanVienId }, select: { trangThai: true } }),
      this.prisma.congDoan.findUnique({ where: { id: dto.congDoanId }, select: { maHangId: true } }),
    ]);
    if (!nv) throw new LoiNghiepVu('KHONG_TIM_THAY');
    if (nv.trangThai !== 'HOAT_DONG') throw new LoiNghiepVu('NV_KHONG_HOAT_DONG');
    if (!cd) throw new LoiNghiepVu('CONG_DOAN_KHONG_THUOC_SO_DO');

    return this.audit.giaoDich(async (tx) => {
      await khoaChuyenNgay(tx, tram.chuyenId, dto.ngay, 'CHIA_SE');
      await khoaMaHangThang(tx, [{ maHangId: cd.maHangId, thang: thangCua(dto.ngay) }], 'CHIA_SE');
      await this.kiemKhoaThang(tx, cd.maHangId, dto.ngay);
      // Công đoạn thuộc sơ đồ ngày D của trạm [R 3.6]
      const { tu, den } = khoangNgay(dto.ngay);
      const soDo = await tx.ganCongDoan.count({
        where: { tramId: tram.id, congDoanId: dto.congDoanId, hieuLucTu: { lt: den }, OR: [{ hieuLucDen: null }, { hieuLucDen: { gt: tu } }] },
      });
      if (!soDo) throw new LoiNghiepVu('CONG_DOAN_KHONG_THUOC_SO_DO');

      const [hienCo] = await tx.$queryRaw<{ id: string; so_luong: number }[]>`
        SELECT id, so_luong FROM san_luong
        WHERE ngay_lam_viec = ${ngayDb(dto.ngay)} AND tram_id = ${tram.id}::uuid
          AND cong_doan_id = ${dto.congDoanId}::uuid AND nhan_vien_id = ${dto.nhanVienId}::uuid FOR UPDATE`;
      const smv = await this.maHang.smvTaiNgay(tx, [dto.congDoanId], dto.ngay);
      const now = this.clock.now();
      const [ghi] = await tx.$queryRaw<{ id: string; version: number }[]>`
        INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, smv_snapshot, chuyen_tram_snapshot,
                               nguon, da_dieu_chinh, cap_nhat_boi_tai_khoan_id, cap_nhat_luc_server, created_at, updated_at)
        VALUES (${ngayDb(dto.ngay)}, ${tram.id}::uuid, ${dto.congDoanId}::uuid, ${dto.nhanVienId}::uuid, ${dto.soLuong},
                ${smv.get(dto.congDoanId) ?? null}::numeric, ${tram.chuyenId}::uuid, 'NHAP_HO', true, ${taiKhoanId}::uuid, ${now}, ${now}, ${now})
        ON CONFLICT (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id) DO UPDATE
          SET so_luong = EXCLUDED.so_luong, nguon = 'NHAP_HO', da_dieu_chinh = true, canh_bao = false,
              cap_nhat_boi_tai_khoan_id = EXCLUDED.cap_nhat_boi_tai_khoan_id, cap_nhat_luc_server = EXCLUDED.cap_nhat_luc_server,
              updated_at = EXCLUDED.updated_at, version = san_luong.version + 1
        RETURNING id, version`;
      // ⚠ nhánh DO UPDATE KHÔNG sửa chuyen_tram_snapshot, smv_snapshot [CLAUDE.md #13]
      await tx.sanLuongLichSu.create({
        data: { sanLuongId: ghi!.id, soCu: hienCo?.so_luong ?? null, soMoi: dto.soLuong, nguon: 'NHAP_HO', lyDo: dto.lyDo, loaiNguoiThucHien: 'TAI_KHOAN', nguoiThucHienId: taiKhoanId, lucServer: now },
      });
      const coPhien = await tx.phienTram.count({ where: { tramId: tram.id, nhanVienId: dto.nhanVienId, ngayLamViec: ngayDb(dto.ngay) } });
      await this.audit.ghi(tx, {
        hanhDong: 'NHAP_HO', doiTuong: 'san_luong', doiTuongId: ghi!.id,
        cu: hienCo ? { soLuong: hienCo.so_luong } : undefined,
        moi: { ...dto, lyDo: undefined, ...(coPhien ? {} : { co: 'NV_KHONG_CO_PHIEN' }) }, lyDo: dto.lyDo,
      }, nguCanh);
      return { sanLuongId: ghi!.id, soLuong: dto.soLuong, version: ghi!.version };
    }, nguCanh);
  }

  /** "Bạn đã bị đăng xuất khỏi trạm X lúc hh:mm bởi [tên]" / "Phiên đã chuyển sang thiết bị khác lúc hh:mm" [R 3.8] [D21] */
  async loiPhienKhongCon(tx: Tx | PrismaService, tramId: string, soTram: number, ngay: string, thietBiId: string): Promise<LoiNghiepVu> {
    const p = await tx.phienTram.findFirst({
      where: { tramId, ngayLamViec: ngayDb(ngay), thietBiId, dangXuatLuc: { not: null } },
      orderBy: { dangXuatLuc: 'desc' },
      include: { dangXuatBoi: { select: { hoTen: true } } },
    });
    if (p?.lyDoDong === 'DANG_XUAT_HO') {
      return new LoiNghiepVu('PHIEN_KHONG_CON', {
        message: `Bạn đã bị đăng xuất khỏi trạm ${soTram} lúc ${dinhDangGio(p.dangXuatLuc!)}${p.dangXuatBoi ? ` bởi ${p.dangXuatBoi.hoTen}` : ''} — nhờ tổ trưởng nhập hộ.`,
        chiTiet: { lyDoDong: p.lyDoDong, luc: p.dangXuatLuc!.toISOString(), boi: p.dangXuatBoi?.hoTen ?? null },
      });
    }
    if (p?.lyDoDong === 'CHUYEN_THIET_BI') {
      return new LoiNghiepVu('PHIEN_KHONG_CON', {
        message: `Phiên đã chuyển sang thiết bị khác lúc ${dinhDangGio(p.dangXuatLuc!)}.`,
        chiTiet: { lyDoDong: p.lyDoDong, luc: p.dangXuatLuc!.toISOString(), boi: null },
      });
    }
    return new LoiNghiepVu('PHIEN_KHONG_CON', { message: `Bạn chưa đăng nhập trạm ${soTram} cho ngày này.` });
  }
}
