"use client";

import { Check, CircleAlert, Clock, Minus, Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { useWorker } from "@/components/mobile/store";
import { BigButton, BottomNav, Sheet, WorkerBar } from "@/components/mobile/ui";
import { HOURS, NOW } from "@/lib/demo-data";
import { cn, ddmm, fmtH, weekday } from "@/lib/utils";

type Req = { date: string; soGio: number; st: "CHO" | "DUYET" | "TU_CHOI"; note?: string; at: string };
const OPEN_DATES = ["2026-09-29", "2026-09-28"];

export default function HoursPage() {
  const w = useWorker();
  const [reqs, setReqs] = useState<Req[]>([
    { date: "2026-09-28", soGio: 10, st: "CHO", at: "18:05 28/09" },
    { date: "2026-09-26", soGio: 9.5, st: "DUYET", note: "Nguyễn Văn Bình duyệt · 08:12 28/09", at: "17:30 26/09" },
    { date: "2026-09-24", soGio: 12, st: "TU_CHOI", note: "Không có lệnh tăng ca", at: "19:02 24/09" },
  ]);
  const [open, setOpen] = useState<string | null>(null);
  const [val, setVal] = useState("9");
  const num = Number(val.replace(",", "."));
  const bad = !(num > 0 && num <= 16);

  const statusOf = (d: string) => reqs.find((r) => r.date === d);

  return (
    <>
      <WorkerBar />
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4">
        <section>
          <h2 className="text-[15px] font-semibold mb-2">Ngày đang mở</h2>
          <ul className="flex flex-col gap-2">
            {OPEN_DATES.map((d) => {
              const r = statusOf(d), def = HOURS(d);
              return (
                <li key={d} className="rounded-card border border-line bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-[16px] font-semibold">{d === NOW.date && "Hôm nay · "}{weekday(d)}, {ddmm(d)}</div>
                      <div className="text-[14px] text-muted">Giờ mặc định <b className="text-ink num">{fmtH(def)} giờ</b></div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-[24px] leading-7 font-bold num">{fmtH(r?.soGio ?? def)}</div>
                      <div className="text-[12px] text-muted">giờ tính hiệu suất</div>
                    </div>
                  </div>
                  {r?.st === "CHO" && (
                    <div className="mt-3 rounded-ctl bg-empty-bg text-empty-ink px-3 py-2 text-[14px] flex items-center gap-2"><Clock className="w-4 h-4" />Chờ duyệt: <b className="num">{fmtH(r.soGio)} giờ</b> · gửi {r.at}</div>
                  )}
                  <BigButton variant="secondary" className="w-full mt-3" onClick={() => { setOpen(d); setVal(String(r?.soGio ?? def).replace(".", ",")); }}>
                    {r?.st === "CHO" ? "Sửa yêu cầu" : "Về sớm / tăng ca? Sửa giờ"}
                  </BigButton>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold mb-2">Yêu cầu đã gửi</h2>
          <ul className="rounded-card border border-line bg-surface divide-y divide-line">
            {reqs.map((r) => (
              <li key={r.date} className="px-4 py-3 flex items-center gap-3">
                <span className={cn("w-9 h-9 rounded-full grid place-items-center shrink-0", r.st === "CHO" ? "bg-empty-bg text-empty-ink" : r.st === "DUYET" ? "bg-closed-bg text-closed-ink" : "bg-danger-bg text-danger")}>
                  {r.st === "CHO" ? <Clock className="w-4 h-4" /> : r.st === "DUYET" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{weekday(r.date)}, {ddmm(r.date)} · <span className="num">{fmtH(r.soGio)} giờ</span></div>
                  <div className={cn("text-[13px]", r.st === "TU_CHOI" ? "text-danger" : "text-muted")}>
                    {r.st === "CHO" ? "Chờ tổ trưởng duyệt" : r.st === "DUYET" ? r.note : `Từ chối — ${r.note}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-muted mt-2">Chưa duyệt hoặc bị từ chối → báo cáo dùng giờ mặc định.</p>
        </section>
      </main>
      <BottomNav />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `Sửa giờ làm ${weekday(open)}, ${ddmm(open)}` : ""}
        footer={<><BigButton variant="secondary" className="flex-1" onClick={() => setOpen(null)}>Hủy</BigButton>
          <BigButton className="flex-1" disabled={bad} onClick={() => {
            setReqs([{ date: open!, soGio: num, st: "CHO", at: `${NOW.time} ${ddmm(NOW.date)}` }, ...reqs.filter((r) => r.date !== open)]);
            setOpen(null); w.toast("Đã gửi duyệt · tổ trưởng sẽ xem");
          }}><Send className="w-5 h-5" />Gửi duyệt</BigButton></>}>
        <p className="text-[14px] text-muted">Nhập tổng số giờ đã làm trong ngày (gồm tăng ca). Yêu cầu mới thay thế yêu cầu cũ đang chờ.</p>
        <div className="mt-4 flex items-stretch gap-2">
          <button onClick={() => setVal(String(Math.max(0.5, (num || 0) - 0.5)).replace(".", ","))} className="w-[56px] h-[60px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover" aria-label="Bớt 0,5 giờ"><Minus className="w-6 h-6" /></button>
          <input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" aria-label="Số giờ" aria-invalid={bad}
            className={cn("num flex-1 min-w-0 h-[60px] rounded-ctl border-2 text-center text-[30px] font-semibold outline-none", bad ? "border-danger" : "border-line-strong focus:border-brand-ink")} />
          <button onClick={() => setVal(String(Math.min(16, (num || 0) + 0.5)).replace(".", ","))} className="w-[56px] h-[60px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover" aria-label="Thêm 0,5 giờ"><Plus className="w-6 h-6" /></button>
        </div>
        {bad ? <p className="text-[14px] text-danger mt-2 flex items-center gap-1.5" role="alert"><CircleAlert className="w-4 h-4" />Số giờ phải lớn hơn 0 và không quá 16</p>
          : <p className="text-[14px] text-muted mt-2 text-center">Giờ mặc định {open ? fmtH(HOURS(open)) : ""} · chênh <b className="text-ink num">{open ? `${num - HOURS(open) >= 0 ? "+" : "−"}${fmtH(Math.abs(num - HOURS(open)))}` : ""} giờ</b></p>}
        <div className="mt-3 flex gap-2 justify-center">
          {[8, 9, 10, 10.5, 11].map((h) => <button key={h} onClick={() => setVal(String(h).replace(".", ","))} className="h-10 px-3.5 rounded-pill border border-line-strong text-[14px] font-medium hover:bg-hover num">{fmtH(h)}</button>)}
        </div>
      </Sheet>
    </>
  );
}
