import { Injectable } from '@nestjs/common';
import {
  congNgay,
  dinhDangSoGio,
  type DsYeuCauGio,
  type GioLamCuaToi,
  type NgayLamViec,
  type NvGioLam,
  type PhamVi,
  thangCua,
  type TrangThaiYeuCauGio,
  type YeuCauGioDuyet,
  type zKetQuaGioLam,
} from '@vsn/shared';
import type { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { laLoiTrung } from '../../core/loi/loi-db.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { khoaMaHangThang } from '../../core/prisma/khoa.js';
import { ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';
import { GioMacDinhService } from './gio-mac-dinh.service.js';

type KetQuaGioLam = z.infer<typeof zKetQuaGioLam>;
type NguonGio = 'MAC_DINH' | 'YEU_CAU_DUYET' | 'TO_TRUONG_SUA';

const so = (d: Prisma.Decimal | number | string | null | undefined): number | null => (d == null ? null : Number(d));
/** Tab Đã duyệt / Từ chối: chỉ hiện yêu cầu của 62 ngày gần nhất */
const SO_NGAY_DA_XU_LY = 62;
const SO_NGAY_CUA_TOI = 30;

/**
 * Giờ làm NV × ngày · F6 [TDD 7.3, 8.9].
 * - Một NV × ngày chỉ có 1 giờ làm (kể cả làm nhiều trạm / nhiều chuyền) — bảng gio_lam UNIQUE (nhan_vien_id, ngay_lam_viec).
 * - Giờ hiệu lực = giờ đã duyệt / tổ trưởng sửa, ngược lại giờ mặc định: CHỈ lấy qua hàm SQL gio_lam_hieu_luc [CLAUDE.md #5].
 * - Ghi giờ: khóa CHIA SẺ (MH, mã hàng, tháng) cho mọi mã hàng của NV ngày đó → kiểm gio_lam_bi_khoa [R 5.7] (trigger kiểm lại).
 * - Phạm vi duyệt / sửa: chuyền gốc của NV TẠI NGÀY ĐÓ [D18] (`phamViGioLam`).
 */
@Injectable()
export class GioLamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly phamVi: PhamViService,
    private readonly macDinh: GioMacDinhService,
  ) {}

  // ── Khóa & ghi ──

  /** Khóa chia sẻ mọi (mã hàng, tháng) có sản lượng của NV ngày D, rồi từ chối nếu đã khóa sổ [TDD 8.9] [R 5.7] */
  private async khoaGio(tx: Tx, nhanVienId: string, ngay: NgayLamViec): Promise<void> {
    const mh = await tx.$queryRaw<{ ma_hang_id: string }[]>`
      SELECT DISTINCT cd.ma_hang_id FROM san_luong s JOIN cong_doan cd ON cd.id = s.cong_doan_id
      WHERE s.nhan_vien_id = ${nhanVienId}::uuid AND s.ngay_lam_viec = ${ngay}::date`;
    await khoaMaHangThang(tx, mh.map((m) => ({ maHangId: m.ma_hang_id, thang: thangCua(ngay) })), 'CHIA_SE');
    const [k] = await tx.$queryRaw<{ khoa: boolean }[]>`SELECT gio_lam_bi_khoa(${nhanVienId}::uuid, ${ngay}::date) AS khoa`;
    if (k?.khoa) throw new LoiNghiepVu('GIO_LAM_DA_KHOA');
  }

  private async ghiGio(
    tx: Tx,
    g: { nhanVienId: string; ngay: NgayLamViec; soGio: number; nguon: 'YEU_CAU_DUYET' | 'TO_TRUONG_SUA'; lyDo: string | null; taiKhoanId: string },
  ) {
    const khoa = { nhanVienId: g.nhanVienId, ngayLamViec: ngayDb(g.ngay) };
    const cu = await tx.gioLam.findUnique({ where: { nhanVienId_ngayLamViec: khoa } });
    const du = { soGio: g.soGio, nguon: g.nguon, lyDo: g.lyDo, nguoiThucHienId: g.taiKhoanId, updatedAt: this.clock.now() };
    await tx.gioLam.upsert({
      where: { nhanVienId_ngayLamViec: khoa },
      create: { ...khoa, ...du, createdAt: this.clock.now() },
      update: { ...du, version: { increment: 1 } },
    });
    return cu ? { soGio: so(cu.soGio), nguon: cu.nguon, lyDo: cu.lyDo } : null;
  }

  private taiKhoanId(): string {
    const id = this.audit.nguCanh().nguoiThucHienId;
    if (!id) throw new LoiNghiepVu('CHUA_DANG_NHAP');
    return id;
  }

  /** Giờ mặc định / hiệu lực / nguồn / khóa của 1 NV × ngày — từ hàm SQL [CLAUDE.md #5] */
  private async trangThaiGio(db: PrismaService | Tx, nhanVienId: string, ngay: NgayLamViec) {
    const [r] = await db.$queryRaw<{ md: Prisma.Decimal | null; hl: Prisma.Decimal | null; khoa: boolean; nguon: NguonGio | null }[]>`
      SELECT gio_mac_dinh_ngay(${nhanVienId}::uuid, ${ngay}::date) AS md,
             gio_lam_hieu_luc(${nhanVienId}::uuid, ${ngay}::date) AS hl,
             gio_lam_bi_khoa(${nhanVienId}::uuid, ${ngay}::date) AS khoa,
             (SELECT nguon::text FROM gio_lam WHERE nhan_vien_id = ${nhanVienId}::uuid AND ngay_lam_viec = ${ngay}::date) AS nguon`;
    return { gioMacDinh: so(r?.md), gioHieuLuc: so(r?.hl), biKhoa: !!r?.khoa, nguon: (r?.nguon ?? 'MAC_DINH') as NguonGio };
  }

  // ── App công nhân ──

  /** GET /api/cn/gio-lam — `ngayMo`: các ngày có phiên trạm còn hiệu lực trên thiết bị (Ngày mở nhập) */
  async cuaToi(nhanVienId: string | null, ngayMo: NgayLamViec[]): Promise<GioLamCuaToi> {
    if (!nhanVienId) return { ngayMo: [], yeuCau: [] };
    const cho = await this.prisma.yeuCauGio.findMany({
      where: { nhanVienId, trangThai: 'CHO', ngayLamViec: { in: ngayMo.map(ngayDb) } },
    });
    const ds: GioLamCuaToi['ngayMo'] = [];
    for (const ngay of [...ngayMo].sort().reverse()) {
      const g = await this.trangThaiGio(this.prisma, nhanVienId, ngay);
      const y = cho.find((c) => tuNgayDb(c.ngayLamViec) === ngay);
      ds.push({ ngay, ...g, yeuCauCho: y ? { soGio: so(y.soGio)!, guiLuc: y.createdAt.toISOString() } : null });
    }
    const yc = await this.prisma.yeuCauGio.findMany({
      where: { nhanVienId, ngayLamViec: { gte: ngayDb(congNgay(this.clock.homNay(), -SO_NGAY_CUA_TOI)) } },
      orderBy: [{ createdAt: 'desc' }],
      include: { nguoiDuyet: { select: { hoTen: true } } },
      take: 60,
    });
    return {
      ngayMo: ds,
      yeuCau: yc.map((y) => ({
        id: y.id, ngay: tuNgayDb(y.ngayLamViec), soGio: so(y.soGio)!, trangThai: y.trangThai, guiLuc: y.createdAt.toISOString(),
        xuLyLuc: y.duyetLuc?.toISOString() ?? null, nguoiXuLy: y.nguoiDuyet?.hoTen ?? null, lyDoTuChoi: y.lyDoTuChoi,
      })),
    };
  }

  /**
   * POST /api/cn/gio-lam — gửi yêu cầu sửa giờ cho một Ngày mở nhập [F6].
   * Yêu cầu mới THAY THẾ yêu cầu đang chờ cùng ngày (xóa yêu cầu cũ, tạo yêu cầu mới → "gửi lúc" là lúc gửi lại;
   * tổ trưởng đang mở yêu cầu cũ bấm Duyệt sẽ nhận "đã thay đổi" thay vì duyệt nhầm số cũ). Lịch sử nằm ở audit log.
   */
  async guiYeuCau(nhanVienId: string | null, ngayMo: NgayLamViec[], ngay: NgayLamViec, soGio: number): Promise<void> {
    if (!nhanVienId) throw new LoiNghiepVu('CHUA_DANG_NHAP_TRAM');
    if (!ngayMo.includes(ngay)) throw new LoiNghiepVu('NGAY_KHONG_MO_NHAP');
    try {
      await this.audit.giaoDich(async (tx) => {
        await this.khoaGio(tx, nhanVienId, ngay);
        const cu = await tx.$queryRaw<{ id: string; so_gio: Prisma.Decimal }[]>`
          SELECT id, so_gio FROM yeu_cau_gio
          WHERE nhan_vien_id = ${nhanVienId}::uuid AND ngay_lam_viec = ${ngay}::date AND trang_thai = 'CHO' FOR UPDATE`;
        if (cu.length) await tx.yeuCauGio.deleteMany({ where: { id: { in: cu.map((c) => c.id) } } });
        const now = this.clock.now();
        const moi = await tx.yeuCauGio.create({ data: { nhanVienId, ngayLamViec: ngayDb(ngay), soGio, createdAt: now, updatedAt: now } });
        await this.audit.ghi(tx, {
          hanhDong: 'GUI_YEU_CAU_GIO', doiTuong: 'yeu_cau_gio', doiTuongId: moi.id,
          cu: cu[0] ? { soGio: so(cu[0].so_gio), thayYeuCau: cu[0].id } : undefined,
          moi: { nhanVienId, ngay, soGio },
        });
      });
    } catch (e) {
      // Hai lần gửi đồng thời cùng NV × ngày → ux_yeu_cau_gio_cho
      if (laLoiTrung(e)) throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', { message: 'Yêu cầu vừa được gửi từ nơi khác — tải lại để xem.' });
      throw e;
    }
  }

  // ── Web: duyệt / sửa ──

  /** Chuyền lọc: tham số `chuyenId` (ngoài phạm vi → 403) hoặc mọi chuyền trong phạm vi (null = toàn nhà máy) */
  private async chuyenLoc(pv: PhamVi, chuyenId?: string): Promise<string[] | null> {
    if (chuyenId) {
      await this.phamVi.kiemTraChuyen(pv, chuyenId);
      return [chuyenId];
    }
    return this.phamVi.chuyenIds(pv);
  }

  /** GET /api/gio-lam/cho-duyet?chuyenId=&trangThai= — theo chuyền gốc của NV TẠI NGÀY của yêu cầu [D18] */
  async dsYeuCau(pv: PhamVi, loc: { chuyenId?: string; trangThai: TrangThaiYeuCauGio }): Promise<DsYeuCauGio> {
    const ids = await this.chuyenLoc(pv, loc.chuyenId);
    const homNay = this.clock.homNay();
    const tuNgay = congNgay(homNay, -SO_NGAY_DA_XU_LY);
    const locChuyen = ids ? Prisma.sql`AND g.cg = ANY(${ids}::uuid[])` : Prisma.empty;
    // Đang chờ: mọi ngày (duyệt bù đến khi khóa) · đã xử lý: 62 ngày gần nhất
    const locNgay = Prisma.sql`AND (y.trang_thai = 'CHO' OR y.ngay_lam_viec >= ${tuNgay}::date)`;

    const dem = await this.prisma.$queryRaw<{ trang_thai: TrangThaiYeuCauGio; n: number }[]>`
      SELECT y.trang_thai::text AS trang_thai, count(*)::int AS n FROM yeu_cau_gio y
      CROSS JOIN LATERAL (SELECT chuyen_goc_ngay(y.nhan_vien_id, y.ngay_lam_viec) AS cg) g
      WHERE TRUE ${locChuyen} ${locNgay} GROUP BY 1`;

    const thuTu = loc.trangThai === 'CHO' ? Prisma.sql`ORDER BY y.ngay_lam_viec, y.created_at` : Prisma.sql`ORDER BY y.duyet_luc DESC NULLS LAST`;
    const dong = await this.prisma.$queryRaw<{
      id: string; version: number; so_gio: Prisma.Decimal; trang_thai: TrangThaiYeuCauGio; created_at: Date; duyet_luc: Date | null;
      ly_do_tu_choi: string | null; ngay: Date; nv_id: string; ma_nv: string; ho_ten: string; cg: string | null; ma_cg: string | null;
      nguoi_duyet: string | null; md: Prisma.Decimal | null; khoa: boolean;
    }[]>`
      SELECT y.id, y.version, y.so_gio, y.trang_thai::text AS trang_thai, y.created_at, y.duyet_luc, y.ly_do_tu_choi,
             y.ngay_lam_viec AS ngay, nv.id AS nv_id, nv.ma_nv, nv.ho_ten, g.cg, c.ma AS ma_cg, tk.ho_ten AS nguoi_duyet,
             gio_mac_dinh_ngay(y.nhan_vien_id, y.ngay_lam_viec) AS md,
             gio_lam_bi_khoa(y.nhan_vien_id, y.ngay_lam_viec) AS khoa
      FROM yeu_cau_gio y
      JOIN nhan_vien nv ON nv.id = y.nhan_vien_id
      CROSS JOIN LATERAL (SELECT chuyen_goc_ngay(y.nhan_vien_id, y.ngay_lam_viec) AS cg) g
      LEFT JOIN chuyen c ON c.id = g.cg
      LEFT JOIN tai_khoan tk ON tk.id = y.nguoi_duyet_id
      WHERE y.trang_thai = ${loc.trangThai}::trang_thai_yeu_cau_gio ${locChuyen} ${locNgay}
      ${thuTu} LIMIT 500`;

    // Sản lượng ngày đó ở MỌI chuyền (chuyền của trạm = chuyen_tram_snapshot, qua view) [CLAUDE.md #5, #12]
    const sl = dong.length
      ? await this.prisma.$queryRaw<{ nhan_vien_id: string; ngay: Date; chuyen_id: string; ma: string; so_luong: number }[]>`
          SELECT v.nhan_vien_id, v.ngay_lam_viec AS ngay, v.chuyen_id, c.ma, v.san_luong_chuyen::int AS so_luong
          FROM v_nv_chuyen_ngay v JOIN chuyen c ON c.id = v.chuyen_id
          WHERE (v.nhan_vien_id, v.ngay_lam_viec) IN (
            SELECT * FROM unnest(${dong.map((d) => d.nv_id)}::uuid[], ${dong.map((d) => tuNgayDb(d.ngay))}::date[]))
          ORDER BY c.ma`
      : [];

    let macDinh: DsYeuCauGio['macDinh'] = null;
    if (loc.chuyenId) {
      const c = await this.prisma.chuyen.findUniqueOrThrow({ where: { id: loc.chuyenId }, select: { xuong: { select: { id: true, ten: true } } } });
      macDinh = { tenXuong: c.xuong.ten, gio: (await this.macDinh.dangApDung(c.xuong.id, homNay)).gio };
    }

    return {
      homNay,
      macDinh,
      dem: { CHO: 0, DUYET: 0, TU_CHOI: 0, ...Object.fromEntries(dem.map((d) => [d.trang_thai, d.n])) },
      ds: dong.map((d): YeuCauGioDuyet => {
        const ngay = tuNgayDb(d.ngay);
        return {
          id: d.id, version: d.version, nhanVien: { id: d.nv_id, maNV: d.ma_nv, hoTen: d.ho_ten },
          chuyenGoc: d.cg ? { id: d.cg, ma: d.ma_cg! } : null, ngay, gioMacDinh: so(d.md), soGio: so(d.so_gio)!,
          trangThai: d.trang_thai, guiLuc: d.created_at.toISOString(),
          xuLy: d.duyet_luc ? { boi: d.nguoi_duyet, luc: d.duyet_luc.toISOString() } : null, lyDoTuChoi: d.ly_do_tu_choi,
          sanLuong: sl.filter((s) => s.nhan_vien_id === d.nv_id && tuNgayDb(s.ngay) === ngay)
            .map((s) => ({ maChuyen: s.ma, soLuong: s.so_luong, hoTro: s.chuyen_id !== d.cg })),
          biKhoa: d.khoa,
        };
      }),
    };
  }

  /** GET /api/gio-lam/nhan-vien?chuyenId=&ngay= — NV có chuyền gốc NGÀY ĐÓ = chuyền [D18] */
  async dsNhanVien(pv: PhamVi, chuyenId: string, ngay: NgayLamViec): Promise<NvGioLam[]> {
    await this.phamVi.kiemTraChuyen(pv, chuyenId);
    const ds = await this.prisma.$queryRaw<{ id: string; ma_nv: string; ho_ten: string; md: Prisma.Decimal | null; hl: Prisma.Decimal | null; khoa: boolean; nguon: NguonGio | null }[]>`
      SELECT nv.id, nv.ma_nv, nv.ho_ten,
             gio_mac_dinh_ngay(nv.id, ${ngay}::date) AS md, gio_lam_hieu_luc(nv.id, ${ngay}::date) AS hl,
             gio_lam_bi_khoa(nv.id, ${ngay}::date) AS khoa, gl.nguon::text AS nguon
      FROM nhan_vien nv
      LEFT JOIN gio_lam gl ON gl.nhan_vien_id = nv.id AND gl.ngay_lam_viec = ${ngay}::date
      WHERE chuyen_goc_ngay(nv.id, ${ngay}::date) = ${chuyenId}::uuid
        AND (nv.trang_thai = 'HOAT_DONG' OR gl.id IS NOT NULL
             OR EXISTS (SELECT 1 FROM san_luong s WHERE s.nhan_vien_id = nv.id AND s.ngay_lam_viec = ${ngay}::date))
      ORDER BY nv.ma_nv`;
    return ds.map((n) => ({
      id: n.id, maNV: n.ma_nv, hoTen: n.ho_ten, gioMacDinh: so(n.md), gioHieuLuc: so(n.hl), biKhoa: n.khoa, nguon: n.nguon ?? 'MAC_DINH',
    }));
  }

  /** Đọc yêu cầu (ngoài transaction) + kiểm phạm vi theo chuyền gốc NV ngày đó */
  private async yeuCauTrongPhamVi(pv: PhamVi, id: string) {
    const y = await this.prisma.yeuCauGio.findUnique({ where: { id } });
    if (!y) throw new LoiNghiepVu('KHONG_TIM_THAY', { message: 'Yêu cầu không còn — công nhân có thể vừa gửi yêu cầu mới, tải lại.' });
    const ngay = tuNgayDb(y.ngayLamViec);
    await this.phamVi.kiemTraGioLam(pv, y.nhanVienId, ngay);
    return { nhanVienId: y.nhanVienId, ngay };
  }

  /** Khóa dòng yêu cầu (SAU khóa advisory) + kiểm còn chờ và đúng phiên bản người duyệt đang xem */
  private async khoaYeuCau(tx: Tx, id: string, version: number) {
    const [y] = await tx.$queryRaw<{ id: string; version: number; trang_thai: TrangThaiYeuCauGio; so_gio: Prisma.Decimal }[]>`
      SELECT id, version, trang_thai::text AS trang_thai, so_gio FROM yeu_cau_gio WHERE id = ${id}::uuid FOR UPDATE`;
    if (!y) throw new LoiNghiepVu('KHONG_TIM_THAY', { message: 'Yêu cầu không còn — công nhân có thể vừa gửi yêu cầu mới, tải lại.' });
    if (y.trang_thai !== 'CHO') throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', { message: 'Yêu cầu này đã được xử lý — tải lại.' });
    if (y.version !== version) throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI');
    return { soGio: so(y.so_gio)! };
  }

  /** POST /api/gio-lam/:id/duyet → giờ làm = số đề nghị (nguồn YEU_CAU_DUYET) */
  async duyet(pv: PhamVi, id: string, version: number): Promise<KetQuaGioLam> {
    const { nhanVienId, ngay } = await this.yeuCauTrongPhamVi(pv, id);
    const taiKhoanId = this.taiKhoanId();
    return this.audit.giaoDich(async (tx) => {
      await this.khoaGio(tx, nhanVienId, ngay);
      const { soGio } = await this.khoaYeuCau(tx, id, version);
      const cu = await this.ghiGio(tx, { nhanVienId, ngay, soGio, nguon: 'YEU_CAU_DUYET', lyDo: null, taiKhoanId });
      await tx.yeuCauGio.update({
        where: { id },
        data: { trangThai: 'DUYET', nguoiDuyetId: taiKhoanId, duyetLuc: this.clock.now(), version: { increment: 1 } },
      });
      await this.audit.ghi(tx, { hanhDong: 'DUYET_GIO', doiTuong: 'yeu_cau_gio', doiTuongId: id, cu, moi: { nhanVienId, ngay, soGio, nguon: 'YEU_CAU_DUYET' } });
      return { nhanVienId, ngay, soGio, nguon: 'YEU_CAU_DUYET' };
    });
  }

  /** POST /api/gio-lam/:id/tu-choi — bắt buộc lý do; giờ làm giữ nguyên (mặc định / số đã duyệt trước đó) */
  async tuChoi(pv: PhamVi, id: string, version: number, lyDo: string): Promise<void> {
    await this.yeuCauTrongPhamVi(pv, id);
    const taiKhoanId = this.taiKhoanId();
    await this.audit.giaoDich(async (tx) => {
      const { soGio } = await this.khoaYeuCau(tx, id, version);
      await tx.yeuCauGio.update({
        where: { id },
        data: { trangThai: 'TU_CHOI', lyDoTuChoi: lyDo, nguoiDuyetId: taiKhoanId, duyetLuc: this.clock.now(), version: { increment: 1 } },
      });
      await this.audit.ghi(tx, { hanhDong: 'TU_CHOI_GIO', doiTuong: 'yeu_cau_gio', doiTuongId: id, moi: { soGio }, lyDo });
    });
  }

  /**
   * PUT /api/gio-lam/truc-tiep — tổ trưởng sửa giờ trực tiếp (bắt buộc lý do) [F6 bước 5] [R 4.2].
   * Yêu cầu đang chờ cùng ngày (nếu có) được đóng là Từ chối, lý do ghi rõ giờ tổ trưởng đã sửa — công nhân thấy trên app.
   */
  async suaTrucTiep(pv: PhamVi, dto: { nhanVienId: string; ngay: NgayLamViec; soGio: number; lyDo: string }): Promise<KetQuaGioLam> {
    if (dto.ngay > this.clock.homNay()) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', { message: 'Không sửa giờ cho ngày chưa tới.', field: 'ngay' });
    }
    const nv = await this.prisma.nhanVien.findUnique({ where: { id: dto.nhanVienId }, select: { id: true } });
    if (!nv) throw new LoiNghiepVu('KHONG_TIM_THAY');
    await this.phamVi.kiemTraGioLam(pv, dto.nhanVienId, dto.ngay);
    const taiKhoanId = this.taiKhoanId();
    return this.audit.giaoDich(async (tx) => {
      await this.khoaGio(tx, dto.nhanVienId, dto.ngay);
      const cu = await this.ghiGio(tx, { ...dto, nguon: 'TO_TRUONG_SUA', taiKhoanId });
      const dong = await tx.yeuCauGio.updateMany({
        where: { nhanVienId: dto.nhanVienId, ngayLamViec: ngayDb(dto.ngay), trangThai: 'CHO' },
        data: {
          trangThai: 'TU_CHOI', nguoiDuyetId: taiKhoanId, duyetLuc: this.clock.now(), version: { increment: 1 },
          lyDoTuChoi: `Tổ trưởng đã sửa giờ trực tiếp: ${dinhDangSoGio(dto.soGio)} giờ — ${dto.lyDo}`,
        },
      });
      await this.audit.ghi(tx, {
        hanhDong: 'SUA_GIO_TRUC_TIEP', doiTuong: 'gio_lam', doiTuongId: `${dto.nhanVienId}|${dto.ngay}`,
        cu, moi: { soGio: dto.soGio, nguon: 'TO_TRUONG_SUA', dongYeuCauCho: dong.count }, lyDo: dto.lyDo,
      });
      return { nhanVienId: dto.nhanVienId, ngay: dto.ngay, soGio: dto.soGio, nguon: 'TO_TRUONG_SUA' };
    });
  }
}
