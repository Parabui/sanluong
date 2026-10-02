/* ═══════════════════════ DỮ LIỆU MẪU DÙNG CHUNG ═══════════════════════
   Giả lập: 09:15 Thứ 3, 29/09/2026 · Xưởng May 1 · chuyền C05 có dữ liệu đầy đủ nhất */
import { pDate } from "./utils";

export const NOW = { date: "2026-09-29", time: "09:15" };

export const HOURS = (iso: string) => {
  const w = pDate(iso).getDay();
  return w === 0 ? 0 : w === 6 ? 8 : 9; // T2–T6 9 giờ · T7 8 giờ · CN trống
};

export type Line = { ma: string; ten: string; loai: "Chuyền may" | "Vòng ngoài"; xuong: string; soTram: number; active: boolean };
export const LINES: Line[] = [
  ...Array.from({ length: 15 }, (_, i) => ({
    ma: `C${String(i + 1).padStart(2, "0")}`,
    ten: `Chuyền ${i + 1}`,
    loai: "Chuyền may" as const,
    xuong: "X1",
    soTram: 41,
    active: true,
  })),
  { ma: "VN-CAT", ten: "Tổ Cắt", loai: "Vòng ngoài", xuong: "X1", soTram: 0, active: true },
  { ma: "VN-HT", ten: "Tổ Hoàn thành", loai: "Vòng ngoài", xuong: "X1", soTram: 0, active: true },
];

export type Op = { mh: string; cd: string; ten: string; smv: number; qc?: boolean };
/** Sơ đồ chuyền C05: Trạm → công đoạn được gán */
export const C05_MAP: Record<number, Op[]> = {
  12: [{ mh: "PL-2641", cd: "CD-40", ten: "Kiểm thành phẩm", smv: 45, qc: true }],
  25: [{ mh: "PL-2641", cd: "CD-38", ten: "Ủi thành phẩm", smv: 40 }],
  26: [{ mh: "PL-2641", cd: "CD-05", ten: "May nẹp cổ", smv: 38 }],
  27: [{ mh: "PL-2641", cd: "CD-06", ten: "Tra cổ", smv: 52 }, { mh: "PL-2641", cd: "CD-07", ten: "Diễu chân cổ", smv: 24 }],
  28: [{ mh: "PL-2641", cd: "CD-08", ten: "Ráp vai", smv: 30 }],
  29: [{ mh: "PL-2641", cd: "CD-12", ten: "May măng sét", smv: 35 }],
  30: [{ mh: "PL-2641", cd: "CD-13", ten: "Tra tay", smv: 48 }],
  31: [{ mh: "PL-2641", cd: "CD-14", ten: "Can sườn", smv: 42 }],
  32: [{ mh: "PL-2641", cd: "CD-15", ten: "Vắt sổ sườn", smv: 28 }],
  33: [{ mh: "PL-2641", cd: "CD-16", ten: "May nhãn sườn", smv: 20 }],
  34: [{ mh: "PL-2641", cd: "CD-18", ten: "Lên lai áo", smv: 36 }],
  35: [{ mh: "PL-2641", cd: "CD-20", ten: "Đính nút", smv: 18 }, { mh: "PL-2641", cd: "CD-21", ten: "Thùa khuy", smv: 16 }],
  36: [{ mh: "PL-2641", cd: "CD-22", ten: "Cắt chỉ", smv: 12 }],
  37: [{ mh: "PL-2641", cd: "CD-23", ten: "Gắn thẻ bài", smv: 10 }],
  38: [{ mh: "PL-2641", cd: "CD-24", ten: "Gấp xếp", smv: 22 }],
  39: [{ mh: "SH-2655", cd: "CD-03", ten: "Ráp đáy quần", smv: 34 }],
  40: [{ mh: "SH-2655", cd: "CD-04", ten: "Tra lưng", smv: 50 }],
  41: [{ mh: "SH-2655", cd: "CD-05", ten: "Luồn thun", smv: 26 }],
};
export const STATIONS = [12, 25, ...Array.from({ length: 16 }, (_, i) => 26 + i)];

/** Công đoạn chưa gán trạm nào (cho Sơ đồ chuyền) */
export const UNASSIGNED_OPS: Op[] = [
  { mh: "PL-2641", cd: "CD-09", ten: "Diễu vai", smv: 18 },
  { mh: "PL-2641", cd: "CD-10", ten: "May đô", smv: 32 },
  { mh: "PL-2641", cd: "CD-11", ten: "Tra măng sét", smv: 40 },
  { mh: "PL-2641", cd: "CD-17", ten: "Vắt sổ lai", smv: 21 },
  { mh: "SH-2655", cd: "CD-06", ten: "May túi hậu", smv: 44 },
  { mh: "SH-2655", cd: "CD-07", ten: "Lên lai quần", smv: 30 },
];

export type Employee = { nv: string; hoTen: string; chuyen: string; bac?: string; active: boolean };
export const EMPLOYEES: Employee[] = [
  ["NV00231", "Nguyễn Thị Lan", "C05", "4/7"], ["NV00318", "Trần Văn Hùng", "C05", "3/7"], ["NV00412", "Lê Thị Hoa", "C05", "4/7"],
  ["NV00127", "Phạm Thị Mai", "C05", "5/7"], ["NV00509", "Võ Thị Thu", "C05", "3/7"], ["NV01022", "Đỗ Thị Ngọc", "C05", "3/7"],
  ["NV00788", "Huỳnh Thị Kim", "C03", "4/7"], ["NV00655", "Bùi Thị Hạnh", "C05", "4/7"], ["NV00702", "Ngô Thị Yến", "C05", "3/7"],
  ["NV00833", "Lý Thị Trang", "C05", "2/7"], ["NV00914", "Phan Thị Nhung", "C05", "5/7"], ["NV00956", "Đặng Thị Vân", "C05", "2/7"],
  ["NV00987", "Trương Thị Hằng", "C05", "2/7"], ["NV01003", "Mai Thị Diễm", "C05", "3/7"], ["NV01045", "Châu Thị Thảo", "C05", "4/7"],
  ["NV01051", "Tạ Thị Loan", "C05", "3/7"], ["NV01060", "La Thị Phương", "C05", "3/7"], ["NV00501", "Trịnh Thị Nga", "C06", "4/7"],
  ["NV00517", "Hồ Thị Bích", "C06", "3/7"], ["NV00540", "Lương Văn Tâm", "C06", "5/7"], ["NV00848", "Lâm Thị Tuyết", "C05", "3/7"],
  ["NV00562", "Kiều Thị Sen", "C06", "2/7"], ["NV00577", "Đinh Văn Lộc", "C06", "4/7"], ["NV00603", "Vũ Thị Nhàn", "C06", "3/7"],
].map(([nv, hoTen, chuyen, bac]) => ({ nv, hoTen, chuyen, bac, active: true }));
EMPLOYEES.push({ nv: "NV00199", hoTen: "Cao Thị Xuân", chuyen: "C05", bac: "3/7", active: false });

export const empName = (nv: string) => EMPLOYEES.find((e) => e.nv === nv)?.hoTen ?? "—";

export type Style = { ma: string; ten: string; khach: string; soLuong: number; daLam: number; chuyen: string[]; soCd: number; trangThai: "Đang chạy" | "Sắp chạy" | "Đã xong" };
export const STYLES: Style[] = [
  { ma: "PL-2641", ten: "Áo polo nam tay ngắn", khach: "Khách hàng A", soLuong: 12000, daLam: 8640, chuyen: ["C05", "C06"], soCd: 24, trangThai: "Đang chạy" },
  { ma: "SH-2655", ten: "Quần short kaki", khach: "Khách hàng B", soLuong: 6000, daLam: 1210, chuyen: ["C05"], soCd: 12, trangThai: "Đang chạy" },
  { ma: "TS-2610", ten: "Áo thun cổ tròn", khach: "Khách hàng A", soLuong: 20000, daLam: 20000, chuyen: ["C01", "C02"], soCd: 14, trangThai: "Đã xong" },
  { ma: "JK-2702", ten: "Áo khoác gió 2 lớp", khach: "Khách hàng C", soLuong: 4500, daLam: 0, chuyen: [], soCd: 38, trangThai: "Sắp chạy" },
  { ma: "PL-2588", ten: "Áo polo nữ", khach: "Khách hàng A", soLuong: 9000, daLam: 5230, chuyen: ["C03", "C04"], soCd: 22, trangThai: "Đang chạy" },
  { ma: "DR-2633", ten: "Đầm suông cổ V", khach: "Khách hàng D", soLuong: 3000, daLam: 2710, chuyen: ["C07"], soCd: 19, trangThai: "Đang chạy" },
];

/** Sản lượng hôm nay & hiệu suất ngày chốt gần nhất theo chuyền */
export const LINE_STATS = LINES.filter((l) => l.loai === "Chuyền may").map((l, i) => {
  const eff = [78, 84, 71, 88, 82, 76, 91, 68, 80, 74, 86, 79, 73, 83, 77][i];
  const today = [210, 245, 188, 262, 214, 198, 271, 164, 226, 190, 248, 205, 182, 238, 201][i];
  const plan = [240, 260, 220, 270, 240, 230, 280, 210, 240, 220, 260, 230, 220, 250, 230][i];
  return { ma: l.ma, eff, today, plan };
});

export const TREND = ["16/09", "17/09", "18/09", "19/09", "20/09", "22/09", "23/09", "24/09", "25/09", "26/09", "28/09"].map((d, i) => ({
  d,
  eff: [74, 76, 75, 78, 73, 77, 79, 80, 78, 81, 82][i],
  c05: [76, 78, 74, 80, 75, 79, 81, 83, 80, 84, 82][i],
}));

export const REASON_EDIT = ["Công nhân báo lại", "Đếm lại bó hàng", "Nhập nhầm công đoạn", "Khác"];
export const REASON_PROXY = ["Không mang điện thoại", "Hết pin", "Không có phiên trạm", "Khác"];
export const REASON_CONFIRM = "Đã kiểm tra, số đúng";
export const REASON_WARN = [REASON_CONFIRM, "Công nhân báo lại", "Đếm lại bó hàng", "Nhập nhầm công đoạn", "Khác"];
