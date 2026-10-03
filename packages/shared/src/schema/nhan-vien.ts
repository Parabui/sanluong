/** Nhân viên · F2 */
import { z } from 'zod';
import { zUuid } from './co-ban.js';
import { TRANG_THAI } from './danh-muc.js';

/** Mã NV: lưu text, trim + viết hoa khi import và khi đăng nhập; giữ số 0 đầu [R 3.4] */
export const chuanHoaMaNV = (ma: string) => ma.trim().toUpperCase();

export const zMaNV = z
  .string()
  .transform(chuanHoaMaNV)
  .pipe(
    z
      .string()
      .min(1, 'Nhập mã NV.')
      .max(20, 'Mã NV tối đa 20 ký tự.')
      .regex(/^[A-Z0-9._-]+$/, 'Mã NV chỉ gồm chữ không dấu, số, ".", "-", "_".'),
  );
export const zHoTen = z.string().trim().min(1, 'Nhập họ tên.').max(100, 'Họ tên tối đa 100 ký tự.');
export const zBacTayNghe = z
  .string()
  .trim()
  .max(20, 'Bậc tay nghề tối đa 20 ký tự.')
  .transform((v) => v || null)
  .nullable();

export const zNhanVien = z.object({
  id: z.string(),
  maNV: z.string(),
  hoTen: z.string(),
  chuyenId: z.string(),
  maChuyen: z.string(),
  tenChuyen: z.string(),
  bacTayNghe: z.string().nullable(),
  trangThai: z.enum(TRANG_THAI),
  version: z.number().int(),
  /** Đã có bản ghi sản lượng → không được xóa hẳn, chỉ được Ngưng [R 5.6] */
  coSanLuong: z.boolean(),
});
export type NhanVien = z.infer<typeof zNhanVien>;

/** GET /api/nhan-vien */
export const zLocNhanVien = z.object({
  chuyenId: zUuid.optional(),
  trangThai: z.enum([...TRANG_THAI, 'TAT_CA']).default('HOAT_DONG'),
  q: z.string().trim().max(100).optional(),
  trang: z.coerce.number().int().min(1).default(1),
  kichThuoc: z.coerce.number().int().min(1).max(500).default(100),
});
export type LocNhanVien = z.input<typeof zLocNhanVien>;

export const zTaoNhanVien = z.object({
  maNV: zMaNV,
  hoTen: zHoTen,
  chuyenId: zUuid,
  bacTayNghe: zBacTayNghe.optional(),
});
export type TaoNhanVien = z.infer<typeof zTaoNhanVien>;

/** Mã NV không sửa được (không bao giờ tái sử dụng) */
export const zSuaNhanVien = z.object({
  hoTen: zHoTen.optional(),
  chuyenId: zUuid.optional(),
  bacTayNghe: zBacTayNghe.optional(),
  trangThai: z.enum(TRANG_THAI).optional(),
  version: z.number().int().min(0),
});
export type SuaNhanVien = z.infer<typeof zSuaNhanVien>;
