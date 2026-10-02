/**
 * Ngày làm việc & thời gian [D5] — hàm THUẦN, nhận `now` làm tham số.
 * Server lấy `now` từ ClockService; frontend KHÔNG tự tính "hôm nay" mà nhận từ API.
 *
 * Quy ước: ngày làm việc là chuỗi 'YYYY-MM-DD' theo giờ Việt Nam.
 * Phép tính trên ngày làm việc đi qua UTC để không phụ thuộc múi giờ của máy chạy.
 */
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const MUI_GIO = 'Asia/Ho_Chi_Minh';

/** 'YYYY-MM-DD' */
export type NgayLamViec = string;
/** 'YYYY-MM' */
export type Thang = string;
export type LoaiNgay = 'T2_T6' | 'T7' | 'CN';

export const NGAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const THANG_REGEX = /^\d{4}-\d{2}$/;

// ── Nội bộ: chuyển 'YYYY-MM-DD' ↔ mốc UTC 00:00 ──
function sangUtc(ngay: NgayLamViec): Date {
  const [y, m, d] = ngay.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}
function tuUtc(d: Date): NgayLamViec {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** Chuỗi có đúng là một ngày dương lịch hợp lệ dạng 'YYYY-MM-DD' không */
export function laNgayHopLe(ngay: string): boolean {
  return NGAY_REGEX.test(ngay) && tuUtc(sangUtc(ngay)) === ngay;
}

/** 'YYYY-MM-DD' của thời điểm `now` theo giờ Việt Nam */
export function homNay(now: Date): NgayLamViec {
  return format(new TZDate(now, MUI_GIO), 'yyyy-MM-dd');
}

export function congNgay(ngay: NgayLamViec, soNgay: number): NgayLamViec {
  const d = sangUtc(ngay);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return tuUtc(d);
}

/** Thứ theo ISO: 1 = Thứ Hai … 7 = Chủ nhật */
export function thuIso(ngay: NgayLamViec): number {
  const w = sangUtc(ngay).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Khớp hàm SQL `loai_ngay(d)` */
export function loaiNgay(ngay: NgayLamViec): LoaiNgay {
  const t = thuIso(ngay);
  return t === 7 ? 'CN' : t === 6 ? 'T7' : 'T2_T6';
}

/** Ngày làm việc liền trước (bỏ Chủ nhật) */
export function ngayLamViecLienTruoc(ngay: NgayLamViec): NgayLamViec {
  let d = congNgay(ngay, -1);
  while (loaiNgay(d) === 'CN') d = congNgay(d, -1);
  return d;
}

/**
 * Các ngày công nhân được nhập [R 3.1] [D22]:
 * hôm nay + `soNgayNhapLui` ngày làm việc liền trước (bỏ Chủ nhật) mà CHUYỀN ĐÓ CHƯA CHỐT.
 * Trả về theo thứ tự mới → cũ.
 */
export function ngayMoNhap(
  now: Date,
  daChot: (ngay: NgayLamViec) => boolean,
  soNgayNhapLui = 1,
): NgayLamViec[] {
  const homNayVn = homNay(now);
  const ketQua = [homNayVn];
  let d = homNayVn;
  for (let i = 0; i < soNgayNhapLui; i++) {
    d = ngayLamViecLienTruoc(d);
    if (!daChot(d)) ketQua.push(d);
  }
  return ketQua;
}

/**
 * Đã tới giờ mở chốt của ngày `ngay` chưa [R 5.9]:
 * now ≥ (ngay + 1 ngày) lúc `gioMoChot` (mặc định 08:00) theo giờ Việt Nam.
 */
export function daQuaGioMoChot(ngay: NgayLamViec, now: Date, gioMoChot = '08:00'): boolean {
  const [y, m, d] = congNgay(ngay, 1).split('-').map(Number) as [number, number, number];
  const [hh, mm] = gioMoChot.split(':').map(Number) as [number, number];
  const moc = new TZDate(y, m - 1, d, hh, mm, MUI_GIO);
  return now.getTime() >= moc.getTime();
}

export function thangCua(ngay: NgayLamViec): Thang {
  return ngay.slice(0, 7);
}

// ── Định dạng hiển thị kiểu Việt Nam ──

const boDinhDangSo = new Map<number, Intl.NumberFormat>();

/** 1234.5 → "1.234,5" */
export function dinhDangSo(x: number | null | undefined, soChuSoLeToiDa = 1): string {
  if (x == null || Number.isNaN(x)) return '—';
  let f = boDinhDangSo.get(soChuSoLeToiDa);
  if (!f) {
    f = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: soChuSoLeToiDa });
    boDinhDangSo.set(soChuSoLeToiDa, f);
  }
  return f.format(x);
}

/** '2026-10-05' → '05/10/2026' */
export function dinhDangNgay(ngay: NgayLamViec): string {
  const [y, m, d] = ngay.split('-');
  return `${d}/${m}/${y}`;
}

/** Thời điểm (Date hoặc ISO) → 'HH:mm' theo giờ Việt Nam */
export function dinhDangGio(thoiDiem: Date | string): string {
  const d = typeof thoiDiem === 'string' ? new Date(thoiDiem) : thoiDiem;
  return format(new TZDate(d, MUI_GIO), 'HH:mm');
}

/** Nhận "9,5" hoặc "9.5" → 9.5; không hợp lệ → null */
export function docSoGio(chuoi: string): number | null {
  const s = chuoi.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}
