"use client";

import { CalendarX, Clock, Lock, Pencil } from "lucide-react";
import { useParams } from "next/navigation";
import { effOf, MY_DAYS } from "@/components/mobile/my-data";
import { BottomNav, TopBar } from "@/components/mobile/ui";
import { cn, ddmmyyyy, fmt, fmtDec, fmtH, weekday } from "@/lib/utils";

export default function MyDayPage() {
  const { ngay } = useParams<{ ngay: string }>();
  const d = MY_DAYS.find((x) => x.date === ngay);

  if (!d) return (
    <>
      <TopBar title="Chi tiết ngày" back="/app/cua-toi" />
      <div className="flex-1 grid place-items-center text-center px-8"><div><CalendarX className="w-12 h-12 text-muted mx-auto" /><p className="text-[17px] font-semibold mt-3">Không có sản lượng ngày này</p></div></div>
      <BottomNav />
    </>
  );

  const e = effOf(d);
  const stations = [...new Set(d.items.map((i) => i.tram))];

  return (
    <>
      <TopBar title={`${weekday(d.date)}, ${ddmmyyyy(d.date)}`} back="/app/cua-toi" />
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3">
        <section className="rounded-card border border-line bg-surface p-4 grid grid-cols-2 gap-y-3 gap-x-4">
          <div><div className="text-[13px] text-muted">Sản lượng</div><div className="text-[22px] font-bold">{fmt(d.sl)}</div></div>
          <div><div className="text-[13px] text-muted">% hiệu suất</div><div className="text-[22px] font-bold">{e == null ? "—" : `${fmtDec(e)}%`}</div></div>
          <div><div className="text-[13px] text-muted">Phút SMV</div><div className="text-[17px] font-semibold num">{fmt(d.smvMin)}</div></div>
          <div><div className="text-[13px] text-muted">Giờ làm</div><div className="text-[17px] font-semibold num">{fmtH(d.gio)}</div></div>
          <div className="col-span-2 flex flex-wrap gap-1.5">
            <span className={cn("h-7 px-2.5 rounded-pill text-[13px] font-semibold inline-flex items-center gap-1", d.st === "open" ? "bg-open-bg text-open-ink" : d.st === "closed" ? "bg-closed-bg text-closed-ink" : "bg-locked-bg text-locked-ink")}>
              {d.st === "locked" && <Lock className="w-3.5 h-3.5" />}{d.st === "open" ? "Chưa chốt" : d.st === "closed" ? "Đã chốt" : "Đã khóa"}
            </span>
            {d.pending && <span className="h-7 px-2.5 rounded-pill bg-empty-bg text-empty-ink text-[13px] font-semibold inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Giờ làm chờ duyệt · % tạm tính</span>}
          </div>
        </section>

        {stations.map((t) => (
          <section key={t} className="rounded-card border border-line bg-surface overflow-hidden">
            <div className="px-4 h-11 flex items-center bg-thead border-b border-line text-[14px] font-semibold">Trạm {t} · C05</div>
            <ul>
              {d.items.filter((i) => i.tram === t).map((i, idx) => (
                <li key={i.cd} className={cn("px-4 py-3", idx && "border-t border-line")}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-muted">{i.cd}</span><span className="text-[16px] font-medium">{i.ten}</span>
                    <b className="ml-auto text-[18px] num flex items-center gap-1.5">{i.adj && <Pencil className="w-4 h-4 text-adjust-ink" />}{fmt(i.sl)}</b>
                  </div>
                  {i.adj && (
                    <div className="mt-2 rounded-ctl bg-adjust-bg text-adjust-ink px-3 py-2 text-[14px] leading-snug">
                      <div className="font-semibold">Tổ trưởng đã điều chỉnh: {fmt(i.adj.old)} → {fmt(i.sl)}</div>
                      <div>{i.adj.reason} · {i.adj.by} · {i.adj.at}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-[13px] text-muted text-center">Số liệu khớp 100% với báo cáo của công ty · sai số → báo tổ trưởng</p>
      </main>
      <BottomNav />
    </>
  );
}
