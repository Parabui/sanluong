/* Dữ liệu mẫu Dashboard (Web + TV) — khớp định nghĩa chỉ số trong PRD F7 [R 1.4] */
import { LINE_STATS } from "./demo-data";

export const LAST_CLOSED = "26/09";

export const LINE_OUTPUT = LINE_STATS.map((l) => ({ ma: l.ma, today: l.today, plan: l.plan }));
export const TOTAL_TODAY = LINE_OUTPUT.reduce((s, l) => s + l.today, 0);
export const TOTAL_PLAN = LINE_OUTPUT.reduce((s, l) => s + l.plan, 0);

/** Xu hướng % hiệu suất toàn nhà máy — chỉ ngày đã chốt */
const T30 = [72.4, 74.1, 73.0, 75.6, 76.2, 74.8, 77.1, 76.0, 78.3, 77.5, 76.9, 78.8, 79.4, 77.2, 78.0, 79.9, 80.4, 78.6, 79.1, 80.8, 81.2, 79.7, 80.5, 81.9, 81.6];
const D30 = ["01/09", "03/09", "04/09", "05/09", "06/09", "08/09", "09/09", "10/09", "11/09", "12/09", "13/09", "15/09", "16/09", "17/09", "18/09", "19/09", "20/09", "22/09", "23/09", "24/09", "25/09", "26/09", "27/09", "28/09", "29/09"].slice(0, T30.length);
export const TREND_30 = T30.map((eff, i) => ({ d: D30[i], eff })).slice(0, 22); // tới 26/09 (ngày chốt gần nhất)
export const TREND_7 = TREND_30.slice(-6);

export type Ranked = { nv: string; hoTen: string; line: string; eff: number; gio: number };
export const TOP5: Ranked[] = [
  { nv: "NV00914", hoTen: "Phan Thị Nhung", line: "C05", eff: 118.6, gio: 8 },
  { nv: "NV00127", hoTen: "Phạm Thị Mai", line: "C05", eff: 104.2, gio: 8 },
  { nv: "NV00788", hoTen: "Huỳnh Thị Kim", line: "C05", eff: 101.1, gio: 8 },
  { nv: "NV01022", hoTen: "Đỗ Thị Ngọc", line: "C05", eff: 97.4, gio: 8 },
  { nv: "NV00412", hoTen: "Lê Thị Hoa", line: "C05", eff: 93.8, gio: 8 },
];
export const BOTTOM5: Ranked[] = [
  { nv: "NV01045", hoTen: "Châu Thị Thảo", line: "C05", eff: 42.3, gio: 8 },
  { nv: "NV00987", hoTen: "Trương Thị Hằng", line: "C05", eff: 51.0, gio: 8 },
  { nv: "NV01003", hoTen: "Mai Thị Diễm", line: "C05", eff: 55.7, gio: 8 },
  { nv: "NV00702", hoTen: "Ngô Thị Yến", line: "C05", eff: 58.9, gio: 8 },
  { nv: "NV00956", hoTen: "Đặng Thị Vân", line: "C05", eff: 61.4, gio: 8 },
];

/** Công đoạn nghẽn = tổng sản lượng thấp nhất hôm nay, theo từng mã hàng của chuyền */
export const BOTTLENECKS = [
  { line: "C05", mh: "PL-2641", cd: "CD-08", ten: "Ráp vai", sl: 0, note: "chưa nhập" },
  { line: "C05", mh: "SH-2655", cd: "CD-04", ten: "Tra lưng", sl: 0, note: "chưa nhập" },
  { line: "C06", mh: "PL-2641", cd: "CD-13", ten: "Tra tay", sl: 96, note: "" },
  { line: "C07", mh: "DR-2633", cd: "CD-09", ten: "Tra dây kéo", sl: 104, note: "" },
  { line: "C03", mh: "PL-2588", cd: "CD-11", ten: "Tra măng sét", sl: 118, note: "" },
];
