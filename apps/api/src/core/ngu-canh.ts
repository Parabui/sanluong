import type { PhamVi, VaiTro } from '@vsn/shared';
import type { ClsStore } from 'nestjs-cls';

export type LoaiNguoiThucHien = 'TAI_KHOAN' | 'NHAN_VIEN' | 'HE_THONG' | 'DB_TRUC_TIEP';

/** Mang qua nestjs-cls suốt request; service chỉ cần gọi audit.ghi(tx, …) [D9] [TDD 12.1] */
export interface NguCanhAudit {
  loaiNguoiThucHien: LoaiNguoiThucHien;
  /** NULL với HE_THONG */
  nguoiThucHienId: string | null;
  maNV?: string;
  thietBiId?: string;
  ip: string;
  traceId: string;
}

/** Tài khoản Web/TV của request hiện tại (QuyenGuard nạp từ phiên `vsn_sid`) */
export interface TaiKhoanPhien {
  id: string;
  tenDangNhap: string;
  hoTen: string;
  vaiTro: VaiTro;
  phaiDoiMatKhau: boolean;
  phienId: string;
}

/** Dữ liệu trong CLS. traceId = ClsService.getId() */
export interface VsnClsStore extends ClsStore {
  nguCanhAudit?: NguCanhAudit;
  phamVi?: PhamVi;
  taiKhoan?: TaiKhoanPhien;
  /** "GET /api/chuyen/:id/tram" — dùng cho audit từ chối truy cập */
  route?: string;
}
