"use client";

import { Clock, Lock, Pencil } from "lucide-react";
import Link from "next/link";
import { effOf, MY_DAYS } from "@/components/mobile/my-data";
import { BottomNav, WorkerBar } from "@/components/mobile/ui";
import { NOW } from "@/lib/demo-data";
import { cn, ddmm, fmt, fmtDec, fmtH, weekday } from "@/lib/utils";

const ST = {
  open: ["Chưa chốt", "bg-open-bg text-open-ink"],
  closed: ["Đã chốt", "bg-closed-bg text-closed-ink"],
  locked: ["Đã khóa", "bg-locked-bg text-locked-ink"],
} as const;

export default function MyOutputPage() {
  const closed = MY_DAYS.filter((d) => d.st !== "open");
  const avg = closed.reduce((a, d) => a + (effOf(d) ?? 0), 0) / closed.length;
  const total = MY_DAYS.reduce((a, d) => a + d.sl, 0);

  return (
    <>
      <WorkerBar />
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="p-4">
          <section className="rounded-card bg-ink text-ondark p-4">
            <div className="text-[13px] opacity-80">30 ngày gần nhất · {MY_DAYS.length} ngày có sản lượng</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div><div className="text-[13px] opacity-80">Tổng sản lượng</div><div className="text-[28px] leading-9 font-bold">{fmt(total)}</div></div>
              <div><div className="text-[13px] opacity-80">% hiệu suất TB · ngày chốt</div><div className="text-[28px] leading-9 font-bold">{fmtDec(avg)}%</div></div>
            </div>
          </section>
          <p className="text-[13px] text-muted mt-3">Chỉ bạn xem được số của mình. Thấy sai? Báo tổ trưởng trước khi khóa sổ.</p>
        </div>

        <ul className="px-4 pb-4 flex flex-col gap-2">
          {MY_DAYS.map((d) => {
            const e = effOf(d), today = d.date === NOW.date;
            return (
              <li key={d.date}>
                <Link href={`/app/cua-toi/${d.date}`} className="rounded-card border border-line bg-surface py-3 pl-2.5 pr-3 flex items-center gap-2.5 hover:border-line-strong active:bg-hover transition-colors duration-fast">
                  <span className="w-10 text-center leading-none shrink-0">
                    <span className="block text-[12px] text-muted font-semibold uppercase">{weekday(d.date).replace("Thứ ", "T")}</span>
                    <span className="block text-[20px] font-semibold num mt-1">{d.date.slice(8)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5"><b className="text-[18px] num">{fmt(d.sl)}</b><span className="text-[13px] text-muted">sp</span>
                      {d.adjusted && <Pencil className="w-3.5 h-3.5 text-adjust-ink self-center" aria-label="Có ô tổ trưởng điều chỉnh" />}</div>
                    <div className="text-[13px] text-muted num whitespace-nowrap">{fmt(d.smvMin)} phút SMV · {d.gio ? `${fmtH(d.gio)}h` : "—"}</div>
                    {(d.pending || today) && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {today && <span className="h-6 px-2 rounded-pill bg-group text-[12px] font-semibold inline-flex items-center whitespace-nowrap">Tạm tính</span>}
                        {d.pending && <span className="h-6 px-2 rounded-pill bg-empty-bg text-empty-ink text-[12px] font-semibold inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Giờ chờ duyệt</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[18px] font-semibold num">{e == null ? "—" : `${fmtDec(e)}%`}</div>
                    <span className={cn("mt-1 h-6 px-2 rounded-pill text-[12px] font-semibold inline-flex items-center gap-1", ST[d.st][1])}>{d.st === "locked" && <Lock className="w-3 h-3" />}{ST[d.st][0]}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] text-muted text-center pb-4">Ngày không có sản lượng không hiển thị · {ddmm(MY_DAYS[MY_DAYS.length - 1].date)} – {ddmm(MY_DAYS[0].date)}</p>
      </main>
      <BottomNav />
    </>
  );
}
