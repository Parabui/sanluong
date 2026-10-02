/**
 * Phân quyền lớp 2 — Phạm vi dữ liệu [D8] [TDD 10.2].
 * Mọi hàm repository / báo cáo nhận PhamVi làm tham số BẮT BUỘC (không có giá trị mặc định).
 */
import { z } from 'zod';

export const zPhamVi = z.discriminatedUnion('loai', [
  z.object({ loai: z.literal('TOAN_NHA_MAY') }),
  z.object({ loai: z.literal('CHUYEN'), chuyenIds: z.array(z.string()) }), // Tổ trưởng: TaiKhoanChuyen
  z.object({ loai: z.literal('XUONG'), xuongIds: z.array(z.string()) }), // QL xưởng: TaiKhoanXuong → quy ra chuyenIds khi truy vấn
]);
export type PhamVi = z.infer<typeof zPhamVi>;
