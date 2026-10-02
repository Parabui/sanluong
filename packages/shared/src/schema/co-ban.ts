/** Schema Zod nền tảng — nguồn duy nhất cho API (nestjs-zod) và frontend (zodResolver) [D3] */
import { z } from 'zod';
import { laNgayHopLe, THANG_REGEX } from '../ngay-lam-viec.js';

export const zNgayLamViec = z.string().refine(laNgayHopLe, { message: 'Ngày không hợp lệ (YYYY-MM-DD)' });
export const zThang = z.string().regex(THANG_REGEX, { message: 'Tháng không hợp lệ (YYYY-MM)' });
export const zUuid = z.uuid({ message: 'Mã không hợp lệ' });

/** Phân trang [TDD 7.1]: ?trang=1&kichThuoc=50 */
export const zPhanTrang = z.object({
  trang: z.coerce.number().int().min(1).default(1),
  kichThuoc: z.coerce.number().int().min(1).max(500).default(50),
});

export function zKetQuaPhanTrang<T extends z.ZodType>(dong: T) {
  return z.object({
    duLieu: z.array(dong),
    tong: z.number().int(),
    trang: z.number().int(),
    kichThuoc: z.number().int(),
  });
}
