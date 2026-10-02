/* Dữ liệu mẫu cho Bảng sản lượng ngày — giữ nguyên từ merged.html */
import { EMPLOYEES } from "@/lib/demo-data";

export type Src = "app" | "offline" | "proxy" | "web";
export type St = "ok" | "empty" | "warn" | "adjusted";
export type Hist = { t: string; from: number | null; to: number; src: Src; by: string; reason?: string };
export type Row = {
  id: string; tram: number; mh: string; cd: string; ten: string; smv: number;
  nv: string | null; hoTen: string | null; sl: number | null; src: Src | null; st: St;
  qc: boolean; support: string | null; flag: string | null;
  login: { nv: string; hoTen: string } | null; hist: Hist[];
};
export type DayStatus = "open" | "closed" | "locked" | "none" | "nodata";
export type Day = { status: DayStatus; rows: Row[]; closedBy?: string; timeReq?: number };

export const DATES = ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"];
export const SRC: Record<Src, { label: string }> = {
  app: { label: "App" }, offline: { label: "Offline" }, proxy: { label: "Nhập hộ" }, web: { label: "Sửa Web" },
};

type Extra = { st?: St; qc?: boolean; support?: string; flag?: string; login?: [string, string] | null; hist?: Hist[] };
type Raw = [number, string, string, string, number, string | null, string | null, number | null, Src | null, Extra?];

// [trạm, mã hàng, mã CĐ, công đoạn, SMV, mã NV, họ tên, SL, nguồn, phụ]
const RAW: Raw[] = [
  [12, "PL-2641", "CD-40", "Kiểm thành phẩm", 45, "NV00231", "Nguyễn Thị Lan", 412, "app", { qc: true }],
  [25, "PL-2641", "CD-38", "Ủi thành phẩm", 40, "NV00318", "Trần Văn Hùng", 405, "app"],
  [26, "PL-2641", "CD-05", "May nẹp cổ", 38, "NV00412", "Lê Thị Hoa", 520, "app"],
  [27, "PL-2641", "CD-06", "Tra cổ", 52, "NV00127", "Phạm Thị Mai", 388, "app"],
  [27, "PL-2641", "CD-07", "Diễu chân cổ", 24, "NV00127", "Phạm Thị Mai", 390, "app"],
  [28, "PL-2641", "CD-08", "Ráp vai", 30, null, null, null, null, { st: "empty", login: ["NV00509", "Võ Thị Thu"] }],
  [29, "PL-2641", "CD-12", "May măng sét", 35, "NV01022", "Đỗ Thị Ngọc", 610, "proxy", { st: "adjusted", hist: [{ t: "08:05 29/09", from: null, to: 610, src: "proxy", by: "Nguyễn Văn Bình", reason: "Không mang điện thoại" }] }],
  [30, "PL-2641", "CD-13", "Tra tay", 48, "NV00788", "Huỳnh Thị Kim", 455, "app", { support: "C03" }],
  [31, "PL-2641", "CD-14", "Can sườn", 42, "NV00655", "Bùi Thị Hạnh", 470, "app"],
  [32, "PL-2641", "CD-15", "Vắt sổ sườn", 28, "NV00702", "Ngô Thị Yến", 430, "web", { st: "adjusted", hist: [{ t: "08:07 29/09", from: 460, to: 430, src: "web", by: "Nguyễn Văn Bình", reason: "Đếm lại bó hàng" }, { t: "16:48 28/09", from: null, to: 460, src: "app", by: "Ngô Thị Yến" }] }],
  [33, "PL-2641", "CD-16", "May nhãn sườn", 20, "NV00833", "Lý Thị Trang", 300, "offline", { st: "warn", flag: "Gửi sau khi công đoạn bị gỡ lúc 15:02 28/09" }],
  [34, "PL-2641", "CD-18", "Lên lai áo", 36, null, null, null, null, { st: "empty", login: null }],
  [35, "PL-2641", "CD-20", "Đính nút", 18, "NV00914", "Phan Thị Nhung", 1120, "app"],
  [35, "PL-2641", "CD-21", "Thùa khuy", 16, "NV00914", "Phan Thị Nhung", 1080, "app"],
  [36, "PL-2641", "CD-22", "Cắt chỉ", 12, "NV00956", "Đặng Thị Vân", 1350, "app"],
  [37, "PL-2641", "CD-23", "Gắn thẻ bài", 10, "NV00987", "Trương Thị Hằng", 800, "app"],
  [38, "PL-2641", "CD-24", "Gấp xếp", 22, "NV01003", "Mai Thị Diễm", 395, "app"],
  [39, "SH-2655", "CD-03", "Ráp đáy quần", 34, "NV01045", "Châu Thị Thảo", 160, "app"],
  [40, "SH-2655", "CD-04", "Tra lưng", 50, null, null, null, null, { st: "empty", login: ["NV01051", "Tạ Thị Loan"] }],
  [41, "SH-2655", "CD-05", "Luồn thun", 26, "NV01060", "La Thị Phương", 150, "app"],
];

export const BOARD_EMPLOYEES = EMPLOYEES.filter((e) => e.active).map(({ nv, hoTen }) => ({ nv, hoTen }));

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

function mkRow(a: Raw, i: number, dLabel: string): Row {
  const [tram, mh, cd, ten, smv, nv, hoTen, sl, src, x = {}] = a;
  const r: Row = {
    id: "r" + i, tram, mh, cd, ten, smv, nv, hoTen, sl, src, st: x.st || "ok", qc: !!x.qc, support: x.support || null,
    flag: x.flag || null, login: x.login ? { nv: x.login[0], hoTen: x.login[1] } : null, hist: x.hist ? clone(x.hist) : [],
  };
  if (!x.hist && sl != null && src) {
    r.hist = [src === "offline"
      ? { t: "17:40 " + dLabel, from: null, to: sl, src, by: hoTen!, reason: "Đồng bộ từ máy offline" }
      : { t: `16:${String(10 + i * 2).padStart(2, "0")} ${dLabel}`, from: null, to: sl, src, by: hoTen! }];
  }
  return r;
}

export function buildData(): Record<string, Record<string, Day>> {
  const d28 = RAW.map((a, i) => mkRow(a, i, "28/09"));
  // 29/09 (hôm nay, 09:15): chỉ 5 dòng đầu có số, còn lại chưa có
  const d29 = RAW.map((a, i) => {
    const r = mkRow(a, i, "29/09");
    if (i < 5) {
      r.st = "ok"; r.src = "app"; r.sl = Math.round(a[7]! * 0.26);
      r.hist = [{ t: `09:0${i} 29/09`, from: null, to: r.sl, src: "app", by: r.hoTen! }];
    } else {
      r.login = a[5] ? { nv: a[5], hoTen: a[6]! } : r.login;
      Object.assign(r, { nv: null, hoTen: null, sl: null, src: null, st: "empty", flag: null, hist: [] });
    }
    return r;
  });
  // 26/09 (Thứ 7): đủ số, không còn ô vàng/cam, đã chốt
  const fill: Record<number, [string, string, number]> = { 5: ["NV00509", "Võ Thị Thu", 402], 11: ["NV00848", "Lâm Thị Tuyết", 376], 18: ["NV01051", "Tạ Thị Loan", 142] };
  const d26 = RAW.map((a, i) => {
    const b = [...a] as Raw;
    b[9] = { qc: a[9]?.qc, support: a[9]?.support };
    if (fill[i]) { [b[5], b[6], b[7]] = fill[i]; }
    b[7] = b[7]! + ((i * 37) % 21) - 10; b[8] = "app";
    return mkRow(b, i, "26/09");
  });
  return {
    C05: {
      "2026-09-26": { status: "closed", closedBy: "Đã chốt bởi Nguyễn Văn Bình lúc 08:10 28/09/2026", rows: d26 },
      "2026-09-27": { status: "none", rows: [] },
      "2026-09-28": { status: "open", rows: d28, timeReq: 1 },
      "2026-09-29": { status: "open", rows: d29 },
    },
    C06: {},
  };
}
