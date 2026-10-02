import { Injectable } from '@nestjs/common';
import {
  type CongDoan,
  dinhDangNgay,
  type DoiSmv,
  type LichSuSmv,
  type MaHang,
  NGAY_SMV_TU_DAU,
  type NgayLamViec,
  type SuaCongDoan,
  type SuaMaHang,
  type TaoCongDoan,
  type TaoMaHang,
  thangCua,
  zSuaCongDoan,
  zSuaMaHang,
  zTaoCongDoan,
  zTaoMaHang,
} from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { laLoiTrung } from '../../core/loi/loi-db.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { khoaMaHangThang } from '../../core/prisma/khoa.js';
import { ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';

type Db = PrismaService | Tx;
const so = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d.toString()));

/** 'YYYY-MM' → ngày đầu tháng kế tiếp */
const dauThangSau = (thang: string): NgayLamViec => {
  const [y, m] = thang.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};

/**
 * Mã hàng, công đoạn, lịch sử SMV · F3.
 * SMV của bản ghi sản lượng = SMV hiệu lực tại ngày làm việc, snapshot khi lưu; đổi SMV lùi ngày chỉ tính lại
 * tháng CHƯA khóa [R 5.5] [TDD 8.6]. Trigger DB chặn mọi thay đổi trên tháng đã khóa (hàng rào cuối).
 */
@Injectable()
export class MaHangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  // ═══ Mã hàng ═══

  async ds(): Promise<MaHang[]> {
    const ds = await this.prisma.maHang.findMany({
      orderBy: { ma: 'asc' },
      include: {
        congDoan: { select: { laCongDoanHoanThanh: true } },
        chuyenMaHang: { select: { ketThuc: true, chuyen: { select: { ma: true } } } },
        khoaThang: { where: { trangThai: 'KHOA' }, select: { thang: true } },
      },
    });
    const daLam = new Map(
      (await this.prisma.$queryRaw<{ ma_hang_id: string; tong: bigint }[]>`
        SELECT cd.ma_hang_id, SUM(sl.so_luong) AS tong
        FROM san_luong sl JOIN cong_doan cd ON cd.id = sl.cong_doan_id
        WHERE cd.la_cong_doan_hoan_thanh
        GROUP BY cd.ma_hang_id`).map((r) => [r.ma_hang_id, Number(r.tong)]),
    );
    return ds.map((m) => {
      const dangChay = m.chuyenMaHang.filter((c) => !c.ketThuc).map((c) => c.chuyen.ma).sort();
      const thangKhoa = m.khoaThang.map((k) => k.thang).sort().at(-1);
      return {
        id: m.id, ma: m.ma, ten: m.ten, khachHang: m.khachHang, soLuongDonHang: m.soLuongDonHang, version: m.version,
        soCongDoan: m.congDoan.length,
        dangChayTren: dangChay,
        trangThai: dangChay.length ? 'DANG_CHAY' : m.chuyenMaHang.length ? 'DA_KET_THUC' : 'SAP_CHAY',
        daLam: daLam.get(m.id) ?? 0,
        thieuCongDoanHoanThanh: m.congDoan.length > 0 && !m.congDoan.some((c) => c.laCongDoanHoanThanh),
        ngaySomNhatDoiSmv: thangKhoa ? dauThangSau(thangKhoa) : null,
      };
    });
  }

  private async motMaHang(id: string): Promise<MaHang> {
    const m = (await this.ds()).find((x) => x.id === id);
    if (!m) throw new LoiNghiepVu('KHONG_TIM_THAY');
    return m;
  }

  async tao(dauVao: TaoMaHang): Promise<MaHang> {
    const dto = zTaoMaHang.parse(dauVao);
    const id = await this.audit.giaoDich(async (tx) => {
      const m = await this.batTrung(dto.ma, 'ma', () =>
        tx.maHang.create({ data: { ma: dto.ma, ten: dto.ten, khachHang: dto.khachHang ?? null, soLuongDonHang: dto.soLuongDonHang } }),
      );
      await this.audit.ghi(tx, { hanhDong: 'TAO_MA_HANG', doiTuong: 'ma_hang', doiTuongId: m.id, moi: dto });
      return m.id;
    });
    return this.motMaHang(id);
  }

  async sua(id: string, dauVao: SuaMaHang): Promise<MaHang> {
    const dto = zSuaMaHang.parse(dauVao);
    await this.audit.giaoDich(async (tx) => {
      const cu = await tx.maHang.findUnique({ where: { id } });
      if (!cu) throw new LoiNghiepVu('KHONG_TIM_THAY');
      const { count } = await this.batTrung(dto.ma, 'ma', () =>
        tx.maHang.updateMany({
          where: { id, version: dto.version },
          data: { ma: dto.ma, ten: dto.ten, khachHang: dto.khachHang, soLuongDonHang: dto.soLuongDonHang, version: { increment: 1 } },
        }),
      );
      if (!count) throw await this.audit.loiDaThayDoi(tx, 'ma_hang', id);
      await this.audit.ghi(tx, {
        hanhDong: 'SUA_MA_HANG', doiTuong: 'ma_hang', doiTuongId: id,
        cu: { ma: cu.ma, ten: cu.ten, khachHang: cu.khachHang, soLuongDonHang: cu.soLuongDonHang },
        moi: { ma: dto.ma, ten: dto.ten, khachHang: dto.khachHang, soLuongDonHang: dto.soLuongDonHang },
      });
    });
    return this.motMaHang(id);
  }

  // ═══ Công đoạn ═══

  /** SMV hiệu lực tại `ngay` của từng công đoạn (dòng lịch sử mới nhất có apDungTuNgay ≤ ngay) */
  async smvTaiNgay(db: Db, congDoanIds: string[], ngay: NgayLamViec): Promise<Map<string, number>> {
    const ds = await db.smvLichSu.findMany({
      where: { congDoanId: { in: congDoanIds }, apDungTuNgay: { lte: ngayDb(ngay) } },
      orderBy: { apDungTuNgay: 'desc' },
      select: { congDoanId: true, smv: true },
    });
    const kq = new Map<string, number>();
    for (const d of ds) if (!kq.has(d.congDoanId)) kq.set(d.congDoanId, so(d.smv)!);
    return kq;
  }

  async dsCongDoan(maHangId: string): Promise<CongDoan[]> {
    if (!(await this.prisma.maHang.count({ where: { id: maHangId } }))) throw new LoiNghiepVu('KHONG_TIM_THAY');
    const homNay = this.clock.homNay();
    const ds = await this.prisma.congDoan.findMany({
      where: { maHangId },
      orderBy: { ma: 'asc' },
      include: {
        ganCongDoan: { where: { hieuLucDen: null }, select: { tram: { select: { soTram: true, chuyen: { select: { ma: true } } } } } },
        smvLichSu: { where: { apDungTuNgay: { gt: ngayDb(homNay) } }, orderBy: { apDungTuNgay: 'asc' }, take: 1 },
      },
    });
    const smv = await this.smvTaiNgay(this.prisma, ds.map((c) => c.id), homNay);
    return ds.map((c) => {
      const theoChuyen = new Map<string, number[]>();
      for (const g of c.ganCongDoan) theoChuyen.set(g.tram.chuyen.ma, [...(theoChuyen.get(g.tram.chuyen.ma) ?? []), g.tram.soTram]);
      const sap = c.smvLichSu[0];
      return {
        id: c.id, maHangId: c.maHangId, ma: c.ma, ten: c.ten, laCongDoanHoanThanh: c.laCongDoanHoanThanh, trangThai: c.trangThai, version: c.version,
        smv: smv.get(c.id) ?? null,
        smvSapApDung: sap ? { smv: so(sap.smv)!, tuNgay: tuNgayDb(sap.apDungTuNgay) } : null,
        dangGan: [...theoChuyen].map(([maChuyen, ds]) => ({ maChuyen, soTram: ds.sort((a, b) => a - b) })).sort((a, b) => a.maChuyen.localeCompare(b.maChuyen)),
      };
    });
  }

  private async motCongDoan(id: string): Promise<CongDoan> {
    const cd = await this.prisma.congDoan.findUniqueOrThrow({ where: { id }, select: { maHangId: true } });
    return (await this.dsCongDoan(cd.maHangId)).find((c) => c.id === id)!;
  }

  async taoCongDoan(maHangId: string, dauVao: TaoCongDoan): Promise<CongDoan> {
    const dto = zTaoCongDoan.parse(dauVao);
    const id = await this.audit.giaoDich(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM ma_hang WHERE id = ${maHangId}::uuid FOR UPDATE`;
      if (!(await tx.maHang.count({ where: { id: maHangId } }))) throw new LoiNghiepVu('KHONG_TIM_THAY');
      if (dto.laCongDoanHoanThanh) await tx.congDoan.updateMany({ where: { maHangId, laCongDoanHoanThanh: true }, data: { laCongDoanHoanThanh: false } });
      const cd = await this.batTrung(dto.ma, 'ma', () =>
        tx.congDoan.create({ data: { maHangId, ma: dto.ma, ten: dto.ten, laCongDoanHoanThanh: dto.laCongDoanHoanThanh } }),
      );
      // SMV ban đầu áp dụng "từ đầu" → mọi bản ghi của công đoạn, kể cả nhập lùi ngày, đều có SMV
      if (dto.smv != null) {
        await tx.smvLichSu.create({ data: { congDoanId: cd.id, smv: dto.smv, apDungTuNgay: ngayDb(NGAY_SMV_TU_DAU), nguoiTaoId: this.nguoi() } });
      }
      await this.audit.ghi(tx, { hanhDong: 'TAO_CONG_DOAN', doiTuong: 'cong_doan', doiTuongId: cd.id, moi: { maHangId, ...dto } });
      return cd.id;
    });
    return this.motCongDoan(id);
  }

  async suaCongDoan(id: string, dauVao: SuaCongDoan): Promise<CongDoan> {
    const dto = zSuaCongDoan.parse(dauVao);
    await this.audit.giaoDich(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM cong_doan WHERE id = ${id}::uuid FOR UPDATE`;
      const cu = await tx.congDoan.findUnique({ where: { id } });
      if (!cu) throw new LoiNghiepVu('KHONG_TIM_THAY');
      if (cu.version !== dto.version) throw await this.audit.loiDaThayDoi(tx, 'cong_doan', id);

      const ngung = dto.trangThai === 'NGUNG' && cu.trangThai !== 'NGUNG';
      if (ngung) {
        // Không ngưng công đoạn còn đang gán ở trạm [F3]
        const gan = await tx.ganCongDoan.findMany({
          where: { congDoanId: id, hieuLucDen: null },
          select: { tram: { select: { soTram: true, chuyen: { select: { ma: true } } } } },
        });
        if (gan.length) {
          const noi = gan.map((g) => `${g.tram.chuyen.ma} trạm ${g.tram.soTram}`).sort().join(', ');
          throw new LoiNghiepVu('CONG_DOAN_DANG_GAN', { message: `Công đoạn đang gán tại ${noi} — gỡ khỏi trạm trước khi ngưng.` });
        }
        if (cu.laCongDoanHoanThanh) throw new LoiNghiepVu('CONG_DOAN_HOAN_THANH');
      }
      if (dto.laCongDoanHoanThanh && !cu.laCongDoanHoanThanh) {
        if (cu.trangThai === 'NGUNG' && dto.trangThai !== 'HOAT_DONG') {
          throw new LoiNghiepVu('CONG_DOAN_HOAN_THANH', { message: 'Công đoạn đã ngưng không làm công đoạn hoàn thành được.' });
        }
        await tx.congDoan.updateMany({ where: { maHangId: cu.maHangId, laCongDoanHoanThanh: true }, data: { laCongDoanHoanThanh: false, version: { increment: 1 } } });
      }
      await this.batTrung(dto.ma, 'ma', () =>
        tx.congDoan.update({
          where: { id },
          data: { ma: dto.ma, ten: dto.ten, laCongDoanHoanThanh: dto.laCongDoanHoanThanh, trangThai: dto.trangThai, version: { increment: 1 } },
        }),
      );
      await this.audit.ghi(tx, {
        hanhDong: ngung ? 'NGUNG_CONG_DOAN' : 'SUA_CONG_DOAN', doiTuong: 'cong_doan', doiTuongId: id,
        cu: { ma: cu.ma, ten: cu.ten, laCongDoanHoanThanh: cu.laCongDoanHoanThanh, trangThai: cu.trangThai },
        moi: { ma: dto.ma, ten: dto.ten, laCongDoanHoanThanh: dto.laCongDoanHoanThanh, trangThai: dto.trangThai },
      });
    });
    return this.motCongDoan(id);
  }

  // ═══ SMV ═══

  /** Ngày sớm nhất được chọn khi đổi SMV: ngày đầu tháng sau tháng khóa gần nhất; null = không giới hạn */
  private async ngaySomNhat(db: Db, maHangId: string): Promise<NgayLamViec | null> {
    const k = await db.khoaThang.findFirst({ where: { maHangId, trangThai: 'KHOA' }, orderBy: { thang: 'desc' }, select: { thang: true } });
    return k ? dauThangSau(k.thang) : null;
  }

  /**
   * Đổi SMV "áp dụng từ ngày D" [R 5.5] [TDD 8.6]:
   *  1. D ≥ ngày sớm nhất chưa khóa  2. khóa ĐỘC QUYỀN (MH, mã hàng, tháng) mọi tháng ảnh hưởng (tăng dần)
   *  3. ghi smv_lich_su  4. MỘT câu UPDATE snapshot từ D đến mốc đổi SMV kế tiếp, chỉ tháng chưa khóa
   *  5. 1 dòng audit DOI_SMV (kèm số bản ghi tính lại)
   */
  async doiSmv(congDoanId: string, dto: DoiSmv): Promise<{ soBanGhiTinhLai: number }> {
    return this.audit.giaoDich(async (tx) => {
      const cd = await tx.congDoan.findUnique({ where: { id: congDoanId } });
      if (!cd) throw new LoiNghiepVu('KHONG_TIM_THAY');
      const D = dto.apDungTuNgay;

      const thang = (await tx.$queryRaw<{ thang: string }[]>`
        SELECT DISTINCT to_char(ngay_lam_viec, 'YYYY-MM') AS thang FROM san_luong
        WHERE cong_doan_id = ${congDoanId}::uuid AND ngay_lam_viec >= ${ngayDb(D)}`).map((r) => r.thang);
      await khoaMaHangThang(tx, [thangCua(D), ...thang].map((t) => ({ maHangId: cd.maHangId, thang: t })), 'DOC_QUYEN');

      // Kiểm tra SAU khi giữ khóa — khóa tháng không thể chen vào giữa
      const somNhat = await this.ngaySomNhat(tx, cd.maHangId);
      const thangDKhoa = await tx.khoaThang.count({ where: { maHangId: cd.maHangId, thang: thangCua(D), trangThai: 'KHOA' } });
      if ((somNhat && D < somNhat) || thangDKhoa) {
        throw new LoiNghiepVu('NGAY_SMV_DA_KHOA', {
          field: 'apDungTuNgay',
          message: somNhat ? `Ngày áp dụng rơi vào tháng đã khóa sổ — sớm nhất được chọn: ${dinhDangNgay(somNhat)}.` : undefined,
        });
      }

      const smvCu = (await this.smvTaiNgay(tx, [congDoanId], D)).get(congDoanId) ?? null;
      await tx.smvLichSu.upsert({
        where: { congDoanId_apDungTuNgay: { congDoanId, apDungTuNgay: ngayDb(D) } },
        create: { congDoanId, smv: dto.smv, apDungTuNgay: ngayDb(D), nguoiTaoId: this.nguoi() },
        update: { smv: dto.smv, nguoiTaoId: this.nguoi() },
      });
      const keTiep = await tx.smvLichSu.findFirst({
        where: { congDoanId, apDungTuNgay: { gt: ngayDb(D) } },
        orderBy: { apDungTuNgay: 'asc' },
        select: { apDungTuNgay: true },
      });

      const soBanGhiTinhLai = await tx.$executeRaw`
        UPDATE san_luong sl SET smv_snapshot = ${dto.smv}
        WHERE sl.cong_doan_id = ${congDoanId}::uuid
          AND sl.ngay_lam_viec >= ${ngayDb(D)}
          AND (${keTiep?.apDungTuNgay ?? null}::date IS NULL OR sl.ngay_lam_viec < ${keTiep?.apDungTuNgay ?? null}::date)
          AND sl.smv_snapshot IS DISTINCT FROM ${dto.smv}::numeric
          AND NOT EXISTS (SELECT 1 FROM khoa_thang k WHERE k.ma_hang_id = ${cd.maHangId}::uuid
                          AND k.thang = to_char(sl.ngay_lam_viec, 'YYYY-MM') AND k.trang_thai = 'KHOA')`;

      await this.audit.ghi(tx, {
        hanhDong: 'DOI_SMV', doiTuong: 'cong_doan', doiTuongId: congDoanId,
        cu: { smv: smvCu },
        moi: { maCongDoan: cd.ma, tenCongDoan: cd.ten, smvCu, smvMoi: dto.smv, apDungTuNgay: D, soBanGhiTinhLai },
      });
      if (soBanGhiTinhLai) {
        await this.audit.ghi(tx, { hanhDong: 'TINH_LAI_SMV', doiTuong: 'cong_doan', doiTuongId: congDoanId, moi: { soBanGhi: soBanGhiTinhLai, tuNgay: D } });
      }
      return { soBanGhiTinhLai };
    });
  }

  async lichSuSmv(maHangId: string): Promise<LichSuSmv[]> {
    const cd = await this.prisma.congDoan.findMany({ where: { maHangId }, select: { id: true } });
    const ds = await this.prisma.auditLog.findMany({
      where: { hanhDong: 'DOI_SMV', doiTuong: 'cong_doan', doiTuongId: { in: cd.map((c) => c.id) } },
      orderBy: { luc: 'desc' },
      take: 200,
    });
    const nguoi = new Map(
      (await this.prisma.taiKhoan.findMany({ where: { id: { in: ds.map((d) => d.nguoiThucHienId!).filter(Boolean) } }, select: { id: true, hoTen: true } }))
        .map((t) => [t.id, t.hoTen]),
    );
    return ds.map((d) => {
      const m = d.duLieuMoi as { maCongDoan: string; tenCongDoan: string; smvCu: number | null; smvMoi: number; apDungTuNgay: string; soBanGhiTinhLai: number };
      return {
        luc: d.luc.toISOString(),
        nguoi: d.nguoiThucHienId ? (nguoi.get(d.nguoiThucHienId) ?? null) : null,
        maCongDoan: m.maCongDoan, tenCongDoan: m.tenCongDoan, smvCu: m.smvCu, smvMoi: m.smvMoi,
        apDungTuNgay: m.apDungTuNgay, soBanGhiTinhLai: m.soBanGhiTinhLai,
      };
    });
  }

  private nguoi(): string {
    const id = this.audit.nguCanh().nguoiThucHienId;
    if (!id) throw new Error('Thiếu người thực hiện');
    return id;
  }

  private async batTrung<T>(ma: string | undefined, field: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (laLoiTrung(e)) throw new LoiNghiepVu('TRUNG_MA', { field, message: `Mã ${ma ?? ''} đã tồn tại.` });
      throw e;
    }
  }
}
