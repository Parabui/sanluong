import { Injectable } from '@nestjs/common';
import { type DongKhoaThang, dinhDangNgay, thangCua, type Thang, type zKetQuaKhoaTatCa, type zKhoaThangThang } from '@vsn/shared';
import type { z } from 'zod';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { khoaMaHangThang } from '../../core/prisma/khoa.js';
import { tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';

type Db = PrismaService | Tx;
interface NgayChuaChot { chuyenId: string; maChuyen: string; ngay: string }

/**
 * Khóa / mở khóa Mã hàng × Tháng · F10 [TDD 8.5] [R 5.7]:
 * khóa ĐỘC QUYỀN (MH, mã hàng, tháng) — chờ mọi lần ghi sản lượng / sửa giờ (khóa chia sẻ) xong;
 * chỉ khóa khi mọi (chuyền, ngày) có sản lượng của mã hàng trong tháng đã chốt; mã hàng vắt 2 tháng khóa riêng từng tháng.
 * Khóa cũng khóa giờ làm (hàm gio_lam_bi_khoa) và mọi ghi sản lượng (trigger bao_ve_san_luong).
 */
@Injectable()
export class KhoaThangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  private async chuaChot(db: Db, maHangIds: string[], thang: Thang): Promise<Map<string, NgayChuaChot[]>> {
    const ds = maHangIds.length
      ? await db.$queryRaw<{ ma_hang_id: string; chuyen_id: string; ma: string; ngay: Date }[]>`
          SELECT DISTINCT cd.ma_hang_id, s.chuyen_tram_snapshot AS chuyen_id, c.ma, s.ngay_lam_viec AS ngay
          FROM san_luong s JOIN cong_doan cd ON cd.id = s.cong_doan_id JOIN chuyen c ON c.id = s.chuyen_tram_snapshot
          WHERE cd.ma_hang_id = ANY(${maHangIds}::uuid[]) AND to_char(s.ngay_lam_viec, 'YYYY-MM') = ${thang}
            AND NOT EXISTS (SELECT 1 FROM chot_ngay k WHERE k.chuyen_id = s.chuyen_tram_snapshot AND k.ngay_lam_viec = s.ngay_lam_viec)
          ORDER BY s.ngay_lam_viec, c.ma`
      : [];
    const kq = new Map<string, NgayChuaChot[]>();
    for (const d of ds) kq.set(d.ma_hang_id, [...(kq.get(d.ma_hang_id) ?? []), { chuyenId: d.chuyen_id, maChuyen: d.ma, ngay: tuNgayDb(d.ngay) }]);
    return kq;
  }

  /** GET /api/khoa-thang?thang= — mã hàng có sản lượng (hoặc đã từng khóa) trong tháng */
  async xem(thangHoi?: Thang): Promise<z.infer<typeof zKhoaThangThang>> {
    const thang = thangHoi ?? thangCua(this.clock.homNay());
    const tk = await this.prisma.$queryRaw<{ ma_hang_id: string; san_luong: number; so_ngay: number }[]>`
      SELECT cd.ma_hang_id,
             COALESCE(SUM(s.so_luong) FILTER (WHERE cd.la_cong_doan_hoan_thanh), 0)::int AS san_luong,
             COUNT(DISTINCT s.ngay_lam_viec)::int AS so_ngay
      FROM san_luong s JOIN cong_doan cd ON cd.id = s.cong_doan_id
      WHERE to_char(s.ngay_lam_viec, 'YYYY-MM') = ${thang}
      GROUP BY cd.ma_hang_id`;
    const khoa = await this.prisma.khoaThang.findMany({ where: { thang }, include: { nguoiThucHien: { select: { hoTen: true } } } });
    const ids = [...new Set([...tk.map((x) => x.ma_hang_id), ...khoa.map((k) => k.maHangId)])];
    const mh = await this.prisma.maHang.findMany({ where: { id: { in: ids } }, select: { id: true, ma: true, ten: true }, orderBy: { ma: 'asc' } });
    const chua = await this.chuaChot(this.prisma, ids, thang);
    const dsThang = await this.prisma.$queryRaw<{ t: string }[]>`
      SELECT DISTINCT to_char(ngay_lam_viec, 'YYYY-MM') AS t FROM san_luong ORDER BY 1 DESC LIMIT 12`;
    const thangCo = [...new Set([thangCua(this.clock.homNay()), thang, ...dsThang.map((x) => x.t)])].sort().reverse();
    return {
      thang,
      dsThang: thangCo,
      dong: mh.map((m): DongKhoaThang => {
        const t = tk.find((x) => x.ma_hang_id === m.id);
        const k = khoa.find((x) => x.maHangId === m.id);
        return {
          maHangId: m.id, ma: m.ma, ten: m.ten, sanLuong: t?.san_luong ?? 0, soNgay: t?.so_ngay ?? 0,
          chuaChot: chua.get(m.id) ?? [],
          khoa: k ? { trangThai: k.trangThai, boi: k.nguoiThucHien.hoTen, luc: k.updatedAt.toISOString(), lyDo: k.lyDo } : null,
        };
      }),
    };
  }

  private taiKhoanId(): string {
    const id = this.audit.nguCanh().nguoiThucHienId;
    if (!id) throw new LoiNghiepVu('CHUA_DANG_NHAP');
    return id;
  }

  /** Khóa trong transaction đang có (khóa tất cả gọi lần lượt từng mã hàng) */
  private async khoaMot(tx: Tx, maHangId: string, thang: Thang, taiKhoanId: string): Promise<void> {
    await khoaMaHangThang(tx, [{ maHangId, thang }], 'DOC_QUYEN');
    const k = await tx.khoaThang.findUnique({ where: { maHangId_thang: { maHangId, thang } } });
    if (k?.trangThai === 'KHOA') throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', { message: 'Mã hàng này đã khóa tháng này.' });
    const chua = (await this.chuaChot(tx, [maHangId], thang)).get(maHangId) ?? [];
    if (chua.length) {
      throw new LoiNghiepVu('CON_NGAY_CHUA_CHOT', {
        message: `Còn ${chua.length} ngày chưa chốt: ${chua.slice(0, 5).map((d) => `${d.maChuyen} · ${dinhDangNgay(d.ngay).slice(0, 5)}`).join(', ')}${chua.length > 5 ? '…' : ''}`,
        chiTiet: chua,
      });
    }
    const now = this.clock.now();
    await tx.khoaThang.upsert({
      where: { maHangId_thang: { maHangId, thang } },
      create: { maHangId, thang, trangThai: 'KHOA', nguoiThucHienId: taiKhoanId, createdAt: now, updatedAt: now },
      update: { trangThai: 'KHOA', nguoiThucHienId: taiKhoanId, lyDo: null, updatedAt: now, version: { increment: 1 } },
    });
    await this.audit.ghi(tx, { hanhDong: k ? 'KHOA_LAI_THANG' : 'KHOA_THANG', doiTuong: 'ma_hang', doiTuongId: maHangId, moi: { thang } });
  }

  async khoa(maHangId: string, thang: Thang): Promise<void> {
    const taiKhoanId = this.taiKhoanId();
    if (!(await this.prisma.maHang.count({ where: { id: maHangId } }))) throw new LoiNghiepVu('KHONG_TIM_THAY');
    await this.audit.giaoDich((tx) => this.khoaMot(tx, maHangId, thang, taiKhoanId));
  }

  /** "Khóa tất cả mã hàng của tháng" — mỗi mã hàng 1 transaction; mã còn ngày chưa chốt được bỏ qua */
  async khoaTatCa(thang: Thang): Promise<z.infer<typeof zKetQuaKhoaTatCa>> {
    const taiKhoanId = this.taiKhoanId();
    const { dong } = await this.xem(thang);
    const kq: z.infer<typeof zKetQuaKhoaTatCa> = { daKhoa: [], boQua: [] };
    for (const d of dong.filter((x) => x.khoa?.trangThai !== 'KHOA' && x.soNgay > 0)) {
      try {
        await this.audit.giaoDich((tx) => this.khoaMot(tx, d.maHangId, thang, taiKhoanId));
        kq.daKhoa.push(d.ma);
      } catch (e) {
        if (e instanceof LoiNghiepVu && e.code === 'CON_NGAY_CHUA_CHOT') kq.boQua.push({ ma: d.ma, soNgayChuaChot: (e.chiTiet as unknown[]).length });
        else throw e;
      }
    }
    return kq;
  }

  /** Mở khóa — bắt buộc lý do; tổ trưởng sửa được sản lượng và giờ làm của mã hàng × tháng này, xong khóa lại */
  async moKhoa(maHangId: string, thang: Thang, lyDo: string): Promise<void> {
    const taiKhoanId = this.taiKhoanId();
    await this.audit.giaoDich(async (tx) => {
      await khoaMaHangThang(tx, [{ maHangId, thang }], 'DOC_QUYEN');
      const k = await tx.khoaThang.findUnique({ where: { maHangId_thang: { maHangId, thang } } });
      if (k?.trangThai !== 'KHOA') throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', { message: 'Mã hàng này chưa khóa tháng này.' });
      await tx.khoaThang.update({
        where: { id: k.id },
        data: { trangThai: 'MO', lyDo, nguoiThucHienId: taiKhoanId, updatedAt: this.clock.now(), version: { increment: 1 } },
      });
      await this.audit.ghi(tx, { hanhDong: 'MO_KHOA_THANG', doiTuong: 'ma_hang', doiTuongId: maHangId, moi: { thang }, lyDo });
    });
  }
}
