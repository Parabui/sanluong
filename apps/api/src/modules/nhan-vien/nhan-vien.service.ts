import { Injectable } from '@nestjs/common';
import {
  type LocNhanVien,
  type NhanVien,
  type PhamVi,
  type SuaNhanVien,
  type TaoNhanVien,
  zLocNhanVien,
} from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { laLoiTrung } from '../../core/loi/loi-db.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { TaiKhoanPhien } from '../../core/ngu-canh.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';

const CHON = {
  id: true, maNV: true, hoTen: true, chuyenId: true, bacTayNghe: true, trangThai: true, version: true,
  chuyen: { select: { ma: true, ten: true } },
  sanLuong: { select: { id: true }, take: 1 },
} as const;

type DongDb = {
  id: string; maNV: string; hoTen: string; chuyenId: string; bacTayNghe: string | null; trangThai: NhanVien['trangThai']; version: number;
  chuyen: { ma: string; ten: string }; sanLuong: { id: string }[];
};

const sangNhanVien = (n: DongDb): NhanVien => ({
  id: n.id, maNV: n.maNV, hoTen: n.hoTen, chuyenId: n.chuyenId, maChuyen: n.chuyen.ma, tenChuyen: n.chuyen.ten,
  bacTayNghe: n.bacTayNghe, trangThai: n.trangThai, version: n.version, coSanLuong: n.sanLuong.length > 0,
});

/**
 * Nhân viên · F2. Lịch sử chuyền gốc do trigger DB ghi khi thêm / đổi chuyền [D18] — service không tự ghi.
 */
@Injectable()
export class NhanVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly phamVi: PhamViService,
    private readonly clock: ClockService,
  ) {}

  async ds(pv: PhamVi, dauVao: LocNhanVien): Promise<{ duLieu: NhanVien[]; tong: number; trang: number; kichThuoc: number }> {
    const loc = zLocNhanVien.parse(dauVao);
    if (loc.chuyenId) await this.phamVi.kiemTraChuyen(pv, loc.chuyenId);
    const dkChuyen = this.phamVi.dieuKienChuyen(pv);
    const q = loc.q?.trim();
    const where = {
      AND: [
        dkChuyen ? { chuyen: dkChuyen } : {},
        loc.chuyenId ? { chuyenId: loc.chuyenId } : {},
        loc.trangThai === 'TAT_CA' ? {} : { trangThai: loc.trangThai },
        q ? { OR: [{ maNV: { contains: q.toUpperCase() } }, { hoTen: { contains: q, mode: 'insensitive' as const } }] } : {},
      ],
    };
    const [tong, ds] = await Promise.all([
      this.prisma.nhanVien.count({ where }),
      this.prisma.nhanVien.findMany({
        where,
        orderBy: { maNV: 'asc' },
        skip: (loc.trang - 1) * loc.kichThuoc,
        take: loc.kichThuoc,
        select: CHON,
      }),
    ]);
    return { duLieu: ds.map(sangNhanVien), tong, trang: loc.trang, kichThuoc: loc.kichThuoc };
  }

  async tao(dto: TaoNhanVien): Promise<NhanVien> {
    return this.audit.giaoDich(async (tx) => {
      await this.chuyenHoatDong(tx, dto.chuyenId);
      let nv: DongDb;
      try {
        nv = await tx.nhanVien.create({
          data: { maNV: dto.maNV, hoTen: dto.hoTen, chuyenId: dto.chuyenId, bacTayNghe: dto.bacTayNghe ?? null },
          select: CHON,
        });
      } catch (e) {
        if (laLoiTrung(e)) {
          throw new LoiNghiepVu('TRUNG_MA', { field: 'maNV', message: `Mã NV ${dto.maNV} đã tồn tại (mã NV không bao giờ tái sử dụng).` });
        }
        throw e;
      }
      await this.audit.ghi(tx, { hanhDong: 'TAO_NHAN_VIEN', doiTuong: 'nhan_vien', doiTuongId: nv.id, moi: dto });
      return sangNhanVien(nv);
    });
  }

  async sua(id: string, dto: SuaNhanVien): Promise<NhanVien> {
    return this.audit.giaoDich(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM nhan_vien WHERE id = ${id}::uuid FOR UPDATE`;
      const cu = await tx.nhanVien.findUnique({ where: { id } });
      if (!cu) throw new LoiNghiepVu('KHONG_TIM_THAY');
      if (cu.version !== dto.version) throw await this.audit.loiDaThayDoi(tx, 'nhan_vien', id);

      const ngung = dto.trangThai === 'NGUNG' && cu.trangThai !== 'NGUNG';
      const kichHoat = dto.trangThai === 'HOAT_DONG' && cu.trangThai !== 'HOAT_DONG';
      if ((dto.chuyenId && dto.chuyenId !== cu.chuyenId) || kichHoat) await this.chuyenHoatDong(tx, dto.chuyenId ?? cu.chuyenId);

      const nv = await tx.nhanVien.update({
        where: { id },
        data: {
          hoTen: dto.hoTen,
          chuyenId: dto.chuyenId,
          bacTayNghe: dto.bacTayNghe,
          trangThai: dto.trangThai,
          version: { increment: 1 },
        },
        select: CHON,
      });

      // Ngưng NV đang đăng nhập trạm → tự đăng xuất khỏi mọi trạm [F2]
      if (ngung) {
        const { count } = await tx.phienTram.updateMany({
          where: { nhanVienId: id, dangXuatLuc: null },
          data: {
            dangXuatLuc: this.clock.now(),
            lyDoDong: 'DANG_XUAT_HO',
            dangXuatBoiId: this.audit.nguCanh().nguoiThucHienId,
            lyDo: 'Ngưng nhân viên',
          },
        });
        if (count) await this.audit.ghi(tx, { hanhDong: 'DANG_XUAT_HO', doiTuong: 'nhan_vien', doiTuongId: id, moi: { soPhien: count }, lyDo: 'Ngưng nhân viên' });
      }
      await this.audit.ghi(tx, {
        hanhDong: ngung ? 'NGUNG_NHAN_VIEN' : 'SUA_NHAN_VIEN',
        doiTuong: 'nhan_vien',
        doiTuongId: id,
        cu: { hoTen: cu.hoTen, chuyenId: cu.chuyenId, bacTayNghe: cu.bacTayNghe, trangThai: cu.trangThai },
        moi: { hoTen: dto.hoTen, chuyenId: dto.chuyenId, bacTayNghe: dto.bacTayNghe, trangThai: dto.trangThai },
      });
      return sangNhanVien(nv);
    });
  }

  /**
   * Xóa hẳn — chỉ Superadmin, chỉ NV CHƯA có bản ghi sản lượng nào (dùng khi import nhầm) [R 5.6].
   * Kéo theo phiên trạm / yêu cầu giờ / giờ làm / lịch sử chuyền gốc của NV đó.
   */
  async xoa(id: string, tk: TaiKhoanPhien): Promise<void> {
    if (tk.vaiTro !== 'SUPERADMIN') throw new LoiNghiepVu('CHI_SUPERADMIN');
    await this.audit.giaoDich(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM nhan_vien WHERE id = ${id}::uuid FOR UPDATE`;
      const nv = await tx.nhanVien.findUnique({ where: { id } });
      if (!nv) throw new LoiNghiepVu('KHONG_TIM_THAY');
      if (await tx.sanLuong.count({ where: { nhanVienId: id } })) throw new LoiNghiepVu('NV_DA_CO_SAN_LUONG');
      await tx.phienTram.deleteMany({ where: { nhanVienId: id } });
      await tx.yeuCauGio.deleteMany({ where: { nhanVienId: id } });
      await tx.gioLam.deleteMany({ where: { nhanVienId: id } });
      await tx.nhanVien.delete({ where: { id } });
      await this.audit.ghi(tx, {
        hanhDong: 'XOA_NHAN_VIEN',
        doiTuong: 'nhan_vien',
        doiTuongId: id,
        cu: { maNV: nv.maNV, hoTen: nv.hoTen, chuyenId: nv.chuyenId, bacTayNghe: nv.bacTayNghe },
      });
    });
  }

  private async chuyenHoatDong(tx: Tx, chuyenId: string): Promise<void> {
    const c = await tx.chuyen.findUnique({ where: { id: chuyenId }, select: { trangThai: true } });
    if (!c) throw new LoiNghiepVu('KHONG_TIM_THAY', { field: 'chuyenId', message: 'Chuyền/Nhóm không tồn tại.' });
    if (c.trangThai !== 'HOAT_DONG') {
      throw new LoiNghiepVu('CAP_TREN_DANG_NGUNG', { field: 'chuyenId', message: 'Chuyền/Nhóm đang ngưng — chọn chuyền khác.' });
    }
  }
}
