import { Injectable } from '@nestjs/common';
import type { NgayLamViec, PhamVi, VaiTro } from '@vsn/shared';
import { AuditService } from '../audit/audit.service.js';
import { LoiNghiepVu } from '../loi/loi-nghiep-vu.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Phạm vi dữ liệu [D8] [TDD 10.2]. Đọc lại từ DB ở MỖI request → đổi phạm vi có hiệu lực ngay.
 * Phạm vi cố định theo vai trò: Tổ trưởng → chuyền gắn; Quản lý xưởng → xưởng gắn; còn lại → toàn nhà máy.
 */
@Injectable()
export class PhamViService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async cuaTaiKhoan(taiKhoanId: string, vaiTro: VaiTro): Promise<PhamVi> {
    if (vaiTro === 'TO_TRUONG') {
      const dong = await this.prisma.taiKhoanChuyen.findMany({ where: { taiKhoanId }, select: { chuyenId: true } });
      return { loai: 'CHUYEN', chuyenIds: dong.map((d) => d.chuyenId) };
    }
    if (vaiTro === 'QUAN_LY_XUONG') {
      const dong = await this.prisma.taiKhoanXuong.findMany({ where: { taiKhoanId }, select: { xuongId: true } });
      return { loai: 'XUONG', xuongIds: dong.map((d) => d.xuongId) };
    }
    return { loai: 'TOAN_NHA_MAY' };
  }

  /** Tên hiển thị: "Toàn nhà máy" | "C05, C06" | "Xưởng May 1" */
  async tenHienThi(pv: PhamVi): Promise<string> {
    if (pv.loai === 'TOAN_NHA_MAY') return 'Toàn nhà máy';
    if (pv.loai === 'CHUYEN') {
      const ds = await this.prisma.chuyen.findMany({ where: { id: { in: pv.chuyenIds } }, select: { ma: true }, orderBy: { ma: 'asc' } });
      return ds.map((c) => c.ma).join(', ');
    }
    const ds = await this.prisma.xuong.findMany({ where: { id: { in: pv.xuongIds } }, select: { ten: true }, orderBy: { ma: 'asc' } });
    return ds.map((x) => x.ten).join(', ');
  }

  /** Điều kiện Prisma lọc bảng `chuyen` theo phạm vi (null = không lọc) */
  dieuKienChuyen(pv: PhamVi): { id: { in: string[] } } | { xuongId: { in: string[] } } | null {
    if (pv.loai === 'CHUYEN') return { id: { in: pv.chuyenIds } };
    if (pv.loai === 'XUONG') return { xuongId: { in: pv.xuongIds } };
    return null;
  }

  /**
   * Tham số `chuyenId` ngoài phạm vi → 403 + audit (KHÔNG trả danh sách rỗng) [TDD 10.2] [F8].
   */
  async kiemTraChuyen(pv: PhamVi, chuyenId: string): Promise<void> {
    if (pv.loai === 'TOAN_NHA_MAY') return;
    if (pv.loai === 'CHUYEN' && pv.chuyenIds.includes(chuyenId)) return;
    if (pv.loai === 'XUONG') {
      const c = await this.prisma.chuyen.findUnique({ where: { id: chuyenId }, select: { xuongId: true } });
      if (c && pv.xuongIds.includes(c.xuongId)) return;
    }
    await this.tuChoi();
  }

  async kiemTraXuong(pv: PhamVi, xuongId: string): Promise<void> {
    if (pv.loai === 'TOAN_NHA_MAY') return;
    if (pv.loai === 'XUONG' && pv.xuongIds.includes(xuongId)) return;
    await this.tuChoi();
  }

  /** Chuyền trong phạm vi (null = toàn nhà máy) — XUONG quy ra chuyền của xưởng */
  async chuyenIds(pv: PhamVi): Promise<string[] | null> {
    if (pv.loai === 'TOAN_NHA_MAY') return null;
    if (pv.loai === 'CHUYEN') return pv.chuyenIds;
    const ds = await this.prisma.chuyen.findMany({ where: { xuongId: { in: pv.xuongIds } }, select: { id: true } });
    return ds.map((c) => c.id);
  }

  /**
   * `phamViGioLam(pv, ngay)` [TDD 10.2] [R 5.8]: chuyền gốc của NV TẠI NGÀY ĐÓ thuộc phạm vi [D18].
   * Ngoài phạm vi (kể cả NV không có chuyền gốc ngày đó) → 403 + audit.
   */
  async kiemTraGioLam(pv: PhamVi, nhanVienId: string, ngay: NgayLamViec): Promise<void> {
    if (pv.loai === 'TOAN_NHA_MAY') return;
    const [c] = await this.prisma.$queryRaw<{ id: string; xuong_id: string }[]>`
      SELECT id, xuong_id FROM chuyen WHERE id = chuyen_goc_ngay(${nhanVienId}::uuid, ${ngay}::date)`;
    if (c && pv.loai === 'CHUYEN' && pv.chuyenIds.includes(c.id)) return;
    if (c && pv.loai === 'XUONG' && pv.xuongIds.includes(c.xuong_id)) return;
    await this.tuChoi();
  }

  private async tuChoi(): Promise<never> {
    await this.audit.ghiTuChoi('PHAM_VI');
    throw new LoiNghiepVu('KHONG_CO_QUYEN');
  }
}
