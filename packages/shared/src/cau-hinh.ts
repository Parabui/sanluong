/**
 * Cấu hình hệ thống (bảng CauHinh: khoa → giaTri json). Nguồn duy nhất của khóa, kiểu và giá trị mặc định.
 * Seed chèn giá trị mặc định nếu chưa có; Superadmin sửa ở màn Cài đặt.
 */
import { z } from 'zod';

export const zCauHinh = z.object({
  /** Giờ mở chốt ngày [R 5.9] — dùng chung F10, F13 */
  gioMoChotNgay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ dạng HH:mm'),
  /** Chu kỳ tự làm mới dashboard, phút (F7) */
  chuKyLamMoiDashboard: z.number().int().min(1).max(60),
  /** Số ngày làm việc liền trước công nhân còn nhập được [D22] */
  soNgayNhapLui: z.number().int().min(0).max(3),
  /** IP public của nhà máy — phiên TV chỉ hợp lệ từ các IP này [D24] */
  ipNhaMay: z.array(z.string()),
});
export type CauHinh = z.infer<typeof zCauHinh>;
export type KhoaCauHinh = keyof CauHinh;

export const CAU_HINH_MAC_DINH: CauHinh = {
  gioMoChotNgay: '08:00',
  chuKyLamMoiDashboard: 5,
  soNgayNhapLui: 1,
  ipNhaMay: [],
};
