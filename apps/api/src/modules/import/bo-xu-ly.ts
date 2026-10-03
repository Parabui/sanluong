import type { ChucNang, DongBaoCao, KetQuaImport, LoaiImport } from '@vsn/shared';
import type { Tx } from '../../core/prisma/prisma.service.js';
import type { SheetXlsx } from './doc-xlsx.js';

/** Kết quả phân tích file — phần `hopLe` được lưu vào ImportTam để ghi ở bước xác nhận */
export interface KetQuaPhanTich<TDong> {
  tongDong: number;
  them: number;
  capNhat: number;
  khongDoi: number;
  dsLoi: DongBaoCao[];
  dsCanhBao: DongBaoCao[];
  /** Số dòng có lỗi (một mục dsLoi có thể gồm nhiều dòng, vd. trùng mã) */
  soDongLoi: number;
  hopLe: TDong[];
}

/**
 * Bộ xử lý cho một loại import (nhân viên F2, mã hàng F3, kế hoạch F16…).
 * Khung chung (ImportService) lo: kiểm tra file, đọc xlsx, lưu bản xem trước 30 phút, quyền, audit, transaction.
 */
export interface BoXuLyImport<TDong = unknown> {
  loai: LoaiImport;
  loaiDb: 'NHAN_VIEN' | 'MA_HANG' | 'KE_HOACH';
  /** Chức năng cần có để import loại này */
  chucNang: ChucNang;
  tenFileMau: string;
  phanTich(sheet: SheetXlsx): Promise<KetQuaPhanTich<TDong>>;
  /** Ghi trong transaction của khung (đã đặt vsn.nguoi_thuc_hien); tự kiểm tra lại dữ liệu có thể đã đổi từ lúc xem trước */
  ghi(tx: Tx, hopLe: TDong[]): Promise<KetQuaImport>;
  taoFileMau(): Promise<Buffer>;
}

export const BO_XU_LY_IMPORT = Symbol('BO_XU_LY_IMPORT');
