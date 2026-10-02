/* Dữ liệu "Của tôi" (F11) — NV00127 Phạm Thị Mai; khớp Báo cáo theo công nhân (F5) */
import { addDays, pDate } from "@/lib/utils";

export type MyDay = {
  date: string; sl: number; smvMin: number; gio: number | null; st: "open" | "closed" | "locked";
  pending?: boolean; adjusted?: boolean;
  items: { tram: number; cd: string; ten: string; sl: number; adj?: { old: number; reason: string; by: string; at: string } }[];
};

const days: MyDay[] = [];
for (let i = 0; i < 30; i++) {
  const d = addDays("2026-09-29", -i);
  if (pDate(d).getDay() === 0) continue; // Chủ nhật không có sản lượng → không hiện
  const base = 360 + ((i * 53) % 70);
  const a = base, b = base + ((i * 17) % 9) - 3;
  const gio = pDate(d).getDay() === 6 ? 8 : 9;
  days.push({
    date: d, sl: a + b, smvMin: Math.round((a * 52 + b * 24) / 60), gio,
    st: i <= 1 ? "open" : i <= 7 ? "closed" : "locked",
    items: [{ tram: 27, cd: "CD-06", ten: "Tra cổ", sl: a }, { tram: 27, cd: "CD-07", ten: "Diễu chân cổ", sl: b }],
  });
}
// hôm nay tạm tính
days[0] = { ...days[0], sl: 202, smvMin: Math.round((101 * 52 + 101 * 24) / 60), items: [{ tram: 27, cd: "CD-06", ten: "Tra cổ", sl: 101 }, { tram: 27, cd: "CD-07", ten: "Diễu chân cổ", sl: 101 }] };
// 28/09: số giống Bảng sản lượng ngày; giờ làm chờ duyệt
days[1] = { ...days[1], sl: 778, smvMin: Math.round((388 * 52 + 390 * 24) / 60), pending: true, items: [{ tram: 27, cd: "CD-06", ten: "Tra cổ", sl: 388 }, { tram: 27, cd: "CD-07", ten: "Diễu chân cổ", sl: 390 }] };
// 25/09: tổ trưởng điều chỉnh 1 ô + đứng thêm trạm 28
const i25 = days.findIndex((d) => d.date === "2026-09-25");
days[i25] = {
  ...days[i25], adjusted: true, sl: 812, smvMin: Math.round((380 * 52 + 372 * 24 + 60 * 30) / 60),
  items: [
    { tram: 27, cd: "CD-06", ten: "Tra cổ", sl: 380, adj: { old: 400, reason: "Đếm lại bó hàng", by: "Nguyễn Văn Bình", at: "08:12 26/09" } },
    { tram: 27, cd: "CD-07", ten: "Diễu chân cổ", sl: 372 },
    { tram: 28, cd: "CD-08", ten: "Ráp vai", sl: 60 },
  ],
};

export const MY_DAYS = days;
export const effOf = (d: MyDay) => (d.gio ? Math.round((d.smvMin / (d.gio * 60)) * 1000) / 10 : null);
