import { clsx, type ClassValue } from "clsx";

export const cn = (...v: ClassValue[]) => clsx(v);

/** 1234567 → "1.234.567" (quy ước hiển thị VN) */
export const fmt = (n: number | null | undefined) =>
  n == null ? "—" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** 12.5 → "12,5" */
export const fmtDec = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : n.toFixed(digits).replace(".", ",");

export const pDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const ddmm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
export const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");
export const weekday = (iso: string) => {
  const w = pDate(iso).getDay();
  return w === 0 ? "Chủ nhật" : "Thứ " + (w + 1);
};
export const weekdayShort = (iso: string) => {
  const w = pDate(iso).getDay();
  return w === 0 ? "CN" : "T" + (w + 1);
};
export const addDays = (iso: string, n: number) => {
  const d = pDate(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "1.234" | "1234" → 1234; null nếu không hợp lệ (0 – 99.999) */
export function parseQty(v: string): number | null {
  v = String(v).trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 99999 ? n : null;
}

export const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Số giờ: 9 → "9", 10.5 → "10,5" */
export const fmtH = (n: number | null | undefined) =>
  n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
