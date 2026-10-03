import type { MaLoi } from '@vsn/shared';

/**
 * Mã lỗi nghiệp vụ mà trigger trong migration RAISE (message = mã lỗi) — xem migration khởi tạo, phần 2.
 * Mã KHÔNG nằm trong danh sách này (vd. SNAPSHOT_CHUYEN_SAI) là lỗi lập trình → 500.
 */
const MA_LOI_TRIGGER = new Set<MaLoi>([
  'TRAM_KHONG_DOI_CHUYEN',
  'QUA_2_MA_HANG',
  'THANG_DA_KHOA',
  'NGAY_DA_CHOT',
  'O_DA_DIEU_CHINH',
]);

/** Gom message của lỗi và chuỗi `cause` / `meta` (Prisma bọc lỗi Postgres nhiều lớp) */
function gomChuoi(e: unknown, sau = 0): string {
  if (!e || typeof e !== 'object' || sau > 4) return '';
  const o = e as { message?: unknown; cause?: unknown; meta?: unknown };
  let s = typeof o.message === 'string' ? o.message : '';
  if (o.meta) s += ' ' + JSON.stringify(o.meta);
  return s + ' ' + gomChuoi(o.cause, sau + 1);
}

/** Lỗi do trigger nghiệp vụ của DB → mã lỗi tương ứng; không phải → null */
export function maLoiTuTrigger(e: unknown): MaLoi | null {
  const chuoi = gomChuoi(e);
  for (const m of chuoi.matchAll(/\b[A-Z][A-Z0-9_]{3,}\b/g)) {
    if (MA_LOI_TRIGGER.has(m[0] as MaLoi)) return m[0] as MaLoi;
  }
  return null;
}

/** Vi phạm UNIQUE của Prisma (P2002) */
export function laLoiTrung(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: unknown }).code === 'P2002';
}
