import type { PhamVi } from '@vsn/shared';
import type { ClsStore } from 'nestjs-cls';

export type LoaiNguoiThucHien = 'TAI_KHOAN' | 'NHAN_VIEN' | 'HE_THONG' | 'DB_TRUC_TIEP';

/** Mang qua nestjs-cls suốt request; service chỉ cần gọi audit.ghi(tx, …) [D9] [TDD 12.1] */
export interface NguCanhAudit {
  loaiNguoiThucHien: LoaiNguoiThucHien;
  nguoiThucHienId: string;
  maNV?: string;
  thietBiId?: string;
  ip: string;
  traceId: string;
}

/** Dữ liệu trong CLS. traceId = ClsService.getId() */
export interface VsnClsStore extends ClsStore {
  nguCanhAudit?: NguCanhAudit;
  phamVi?: PhamVi;
}
