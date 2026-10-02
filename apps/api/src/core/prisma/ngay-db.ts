/**
 * Chuyển đổi ngày làm việc ↔ cột `DateTime @db.Date` — MỘT chỗ duy nhất [D5] [TDD 6.2].
 * Prisma biểu diễn cột date bằng Date lúc 00:00 UTC; ngày làm việc của ứng dụng là chuỗi 'YYYY-MM-DD'.
 * Module nghiệp vụ KHÔNG tự tạo Date cho cột ngày — luôn đi qua 2 hàm này.
 */
import { laNgayHopLe, type NgayLamViec } from '@vsn/shared';

export function ngayDb(ngay: NgayLamViec): Date {
  if (!laNgayHopLe(ngay)) throw new Error(`Ngày làm việc không hợp lệ: ${ngay}`);
  return new Date(`${ngay}T00:00:00.000Z`);
}

export function tuNgayDb(d: Date): NgayLamViec {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
