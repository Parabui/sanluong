import { Injectable } from '@nestjs/common';
import { type GioMacDinhXuong, LOAI_NGAY, type LoaiNgay, type NgayLamViec, type PhamVi } from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';

type BoGio = Record<LoaiNgay, number | null>;
const RONG: BoGio = { T2_T6: null, T7: null, CN: null };

/**
 * Giờ mặc định theo xưởng × thứ trong tuần · F6 bước 1 [R 4.3].
 * Lưu lịch sử theo ngày hiệu lực: đổi giờ chỉ áp dụng TỪ HÔM NAY trở đi (sửa nhiều lần trong ngày → ghi đè dòng của hôm nay).
 * Giờ của một NV × ngày đọc qua hàm SQL gio_mac_dinh_ngay / gio_lam_hieu_luc — service này chỉ để cài và hiển thị.
 */
@Injectable()
export class GioMacDinhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly phamVi: PhamViService,
  ) {}

  /** Giờ đang áp dụng tại ngày D của 1 xưởng (dòng có ngày hiệu lực mới nhất ≤ D) */
  async dangApDung(xuongId: string, ngay: NgayLamViec, db: PrismaService | Tx = this.prisma): Promise<{ chuaCai: boolean; gio: BoGio }> {
    const ds = await db.gioMacDinh.findMany({ where: { xuongId, apDungTuNgay: { lte: ngayDb(ngay) } }, orderBy: { apDungTuNgay: 'desc' } });
    const gio = { ...RONG };
    for (const l of LOAI_NGAY) {
      const d = ds.find((x) => x.loaiNgay === l);
      gio[l] = d?.soGio == null ? null : Number(d.soGio);
    }
    return { chuaCai: !ds.length, gio };
  }

  /** GET /api/gio-mac-dinh — mọi xưởng đang hoạt động trong phạm vi */
  async ds(pv: PhamVi): Promise<GioMacDinhXuong[]> {
    const homNay = this.clock.homNay();
    const xuong = await this.prisma.xuong.findMany({
      where: { trangThai: 'HOAT_DONG', ...(pv.loai === 'XUONG' ? { id: { in: pv.xuongIds } } : {}) },
      orderBy: { ma: 'asc' },
      include: { gioMacDinh: { orderBy: [{ apDungTuNgay: 'desc' }, { loaiNgay: 'asc' }], include: { nguoiTao: { select: { hoTen: true } } } } },
    });
    // Tổ trưởng không có quyền này; nếu được Superadmin cấp thì chỉ thấy xưởng chứa chuyền của mình
    const loc = pv.loai === 'CHUYEN'
      ? new Set((await this.prisma.chuyen.findMany({ where: { id: { in: pv.chuyenIds } }, select: { xuongId: true } })).map((c) => c.xuongId))
      : null;
    const kq: GioMacDinhXuong[] = [];
    for (const x of xuong.filter((x) => !loc || loc.has(x.id))) {
      const ad = await this.dangApDung(x.id, homNay);
      kq.push({
        xuongId: x.id, tenXuong: x.ten, chuaCai: ad.chuaCai, hienTai: ad.gio,
        lichSu: x.gioMacDinh.map((g) => ({
          loaiNgay: g.loaiNgay, soGio: g.soGio == null ? null : Number(g.soGio), apDungTuNgay: tuNgayDb(g.apDungTuNgay), nguoiTao: g.nguoiTao?.hoTen ?? null,
        })),
      });
    }
    return kq;
  }

  /** PUT /api/gio-mac-dinh — chỉ ghi loại ngày có giá trị khác giờ đang áp dụng (lần đầu: ghi cả 3) */
  async luu(pv: PhamVi, dto: { xuongId: string } & BoGio): Promise<GioMacDinhXuong> {
    await this.phamVi.kiemTraXuong(pv, dto.xuongId);
    const x = await this.prisma.xuong.findUnique({ where: { id: dto.xuongId }, select: { id: true } });
    if (!x) throw new LoiNghiepVu('KHONG_TIM_THAY');
    const homNay = this.clock.homNay();
    const nguoiTaoId = this.audit.nguCanh().nguoiThucHienId;

    await this.audit.giaoDich(async (tx) => {
      // Khóa xưởng: 2 người lưu cùng lúc không chen nhau giữa đọc "đang áp dụng" và ghi
      await tx.$queryRaw`SELECT id FROM xuong WHERE id = ${dto.xuongId}::uuid FOR UPDATE`;
      const ad = await this.dangApDung(dto.xuongId, homNay, tx);
      const doi = LOAI_NGAY.filter((l) => ad.chuaCai || ad.gio[l] !== dto[l]);
      for (const l of doi) {
        await tx.gioMacDinh.upsert({
          where: { xuongId_loaiNgay_apDungTuNgay: { xuongId: dto.xuongId, loaiNgay: l, apDungTuNgay: ngayDb(homNay) } },
          create: { xuongId: dto.xuongId, loaiNgay: l, apDungTuNgay: ngayDb(homNay), soGio: dto[l], nguoiTaoId },
          update: { soGio: dto[l], nguoiTaoId },
        });
      }
      if (doi.length) {
        await this.audit.ghi(tx, {
          hanhDong: 'CAI_GIO_MAC_DINH', doiTuong: 'xuong', doiTuongId: dto.xuongId,
          cu: ad.chuaCai ? null : ad.gio, moi: { T2_T6: dto.T2_T6, T7: dto.T7, CN: dto.CN, apDungTuNgay: homNay },
        });
      }
    });
    return (await this.ds({ loai: 'TOAN_NHA_MAY' })).find((g) => g.xuongId === dto.xuongId)!;
  }
}
