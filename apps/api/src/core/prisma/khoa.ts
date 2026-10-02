/**
 * Khóa advisory theo ma trận khóa TDD 8.9 [D25] — MỘT chỗ tạo khóa để mọi luồng dùng cùng khóa.
 * Thứ tự bắt buộc: (CN, chuyền, ngày) → (MH, mã hàng, tháng) tăng dần → khóa dòng [CLAUDE.md #11].
 *   Lưu / Sửa / Nhập hộ: CHIA SẺ · Chốt ngày, Khóa tháng, Đổi SMV: ĐỘC QUYỀN.
 */
import type { NgayLamViec, Thang } from '@vsn/shared';
import type { Tx } from './prisma.service.js';

export type KieuKhoa = 'CHIA_SE' | 'DOC_QUYEN';

const khoa = (tx: Tx, chuoi: string, kieu: KieuKhoa) =>
  kieu === 'DOC_QUYEN'
    ? tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chuoi}, 0))`
    : tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${chuoi}, 0))`;

export async function khoaChuyenNgay(tx: Tx, chuyenId: string, ngay: NgayLamViec, kieu: KieuKhoa): Promise<void> {
  await khoa(tx, `CN|${chuyenId}|${ngay}`, kieu);
}

/** Khóa nhiều (mã hàng, tháng) — tự sắp tăng dần để không deadlock */
export async function khoaMaHangThang(tx: Tx, cap: { maHangId: string; thang: Thang }[], kieu: KieuKhoa): Promise<void> {
  const ds = [...new Set(cap.map((c) => `MH|${c.maHangId}|${c.thang}`))].sort();
  for (const c of ds) await khoa(tx, c, kieu);
}
