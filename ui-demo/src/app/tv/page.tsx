"use client";

import { ArrowDownRight, ArrowUpRight, TriangleAlert, Wifi, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EffTrendChart, Legend, LineOutputChart, Meter } from "@/components/charts";
import { BOTTLENECKS, BOTTOM5, LAST_CLOSED, LINE_OUTPUT, TOP5, TOTAL_PLAN, TOTAL_TODAY, TREND_30, type Ranked } from "@/lib/dashboard-data";
import { cn, fmt, fmtDec, pct } from "@/lib/utils";

/* Chế độ TV (F7): thiết kế cho 1920×1080, tự co giãn theo cửa sổ.
   Số chính ≥ 72px, nhãn ≥ 32px, chữ tương phản ≥ 7:1 trên nền tối (#F5F7FA 16:1 · #C3CAD4 10,5:1 · xanh #4ADE80 9,9:1 · cam #FDBA74 10,2:1). */
const W = 1920, H = 1080, ROTATE_MS = 15000;
const UP = "#4ADE80", WARN = "#FDBA74";

function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[16px] bg-tv-surface border border-tv-border p-7 flex flex-col min-h-0", className)}>
      <div className="flex items-baseline gap-4 mb-4 whitespace-nowrap">
        <h2 className="text-[36px] leading-[44px] font-semibold text-tv-text">{title}</h2>
        {sub && <span className="text-[32px] text-tv-muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Rank({ rows, bottom }: { rows: Ranked[]; bottom?: boolean }) {
  return (
    <ol className="flex flex-col">
      {rows.map((r, i) => (
        <li key={r.nv} className={cn("h-[76px] flex items-center gap-5", i && "border-t border-tv-border")}>
          <span className="w-9 text-[32px] text-tv-muted num text-right">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[34px] leading-[40px] font-medium text-tv-text truncate">{r.hoTen}</div>
          </div>
          <div className="w-[200px] flex flex-col gap-2 items-end">
            <span className="text-[36px] leading-[40px] font-semibold num" style={{ color: bottom && r.eff < 50 ? WARN : "var(--tv-text)" }}>{fmtDec(r.eff)}%</span>
            <span className="w-full"><Meter value={r.eff} tv /></span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function TvPage() {
  const [scale, setScale] = useState(1);
  const [slide, setSlide] = useState(0);
  const [clock, setClock] = useState("09:15");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / W, innerHeight / H));
    fit(); addEventListener("resize", fit);
    const r = setInterval(() => setSlide((s) => (s + 1) % 2), ROTATE_MS);
    // đồng hồ giả lập bắt đầu từ 09:15
    const start = Date.now();
    const c = setInterval(() => { const m = 15 + Math.floor((Date.now() - start) / 60000); setClock(`09:${String(m % 60).padStart(2, "0")}`); }, 5000);
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener("online", on); addEventListener("offline", off);
    return () => { removeEventListener("resize", fit); clearInterval(r); clearInterval(c); removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);

  const reach = pct(TOTAL_TODAY, TOTAL_PLAN);
  const effLast = TREND_30[TREND_30.length - 1], effPrev = TREND_30[TREND_30.length - 2];
  const d = effLast.eff - effPrev.eff;

  return (
    <div className="tv fixed inset-0 bg-tv-bg overflow-hidden grid place-items-center">
      <div className="relative shrink-0 origin-center flex flex-col gap-6 p-10 text-tv-text" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {/* Header */}
        <header className="flex items-center gap-6 h-[72px] shrink-0">
          <div className="w-[64px] h-[64px] rounded-[12px] bg-brand text-ink grid place-items-center text-[28px] font-bold">VS</div>
          <div>
            <div className="text-[40px] leading-[44px] font-bold">Sản lượng Xưởng May 1</div>
            <div className="text-[32px] leading-[36px] text-tv-muted">Thứ 3, 29/09/2026</div>
          </div>
          <div className="ml-auto flex items-center gap-8">
            <span className="flex items-center gap-3 text-[32px]" style={{ color: online ? UP : WARN }}>
              {online ? <Wifi className="w-9 h-9" /> : <WifiOff className="w-9 h-9" />}
              {online ? "Cập nhật lúc 09:15" : "Mất kết nối – cập nhật lúc 09:15"}
            </span>
            <span className="text-[72px] leading-[72px] font-semibold num">{clock}</span>
          </div>
        </header>

        {/* KPI — số chính ≥ 72px */}
        <div className="grid grid-cols-4 gap-6 shrink-0">
          {[
            { label: "Sản lượng hôm nay", value: fmt(TOTAL_TODAY), unit: "sp", sub: "15 chuyền · QC", color: undefined },
            { label: "Đạt kế hoạch tới giờ", value: `${reach}%`, sub: `KH ${fmt(TOTAL_PLAN)} sp`, color: WARN, icon: TriangleAlert },
            { label: `Hiệu suất ngày ${LAST_CLOSED}`, value: `${fmtDec(effLast.eff)}%`, sub: `${d >= 0 ? "+" : "−"}${fmtDec(Math.abs(d))} so với ${effPrev.d}`, color: d >= 0 ? UP : WARN, icon: d >= 0 ? ArrowUpRight : ArrowDownRight },
            { label: "Trạm có dữ liệu", value: "214", unit: "/ 270", sub: "56 trạm chưa nhập", color: WARN, icon: TriangleAlert },
          ].map((k) => {
            const I = k.icon;
            return (
              <div key={k.label} className="rounded-[16px] bg-tv-surface border border-tv-border px-7 py-5">
                <div className="text-[32px] leading-[40px] text-tv-muted">{k.label}</div>
                <div className="flex items-baseline gap-3 mt-1"><span className="text-[88px] leading-[96px] font-bold">{k.value}</span>{k.unit && <span className="text-[36px] text-tv-muted">{k.unit}</span>}</div>
                <div className="text-[32px] leading-[40px] flex items-center gap-2 whitespace-nowrap" style={{ color: k.color ?? "var(--tv-muted)" }}>{I && <I className="w-8 h-8" />}{k.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Trang luân phiên */}
        <div className="flex-1 min-h-0 relative">
          <div className={cn("absolute inset-0 grid grid-cols-[1.5fr_1fr] gap-6 transition-opacity duration-500", slide === 0 ? "opacity-100" : "opacity-0 pointer-events-none")} aria-hidden={slide !== 0}>
            <Panel title="Sản lượng theo chuyền" sub={`hôm nay tới ${clock}`}>
              <Legend tv items={[{ kind: "bar", label: "Thực tế (QC)" }, { kind: "tick", label: "Kế hoạch" }]} />
              <div className="flex-1 min-h-0 mt-2"><LineOutputChart data={LINE_OUTPUT} height={380} tv /></div>
            </Panel>
            <Panel title="% hiệu suất" sub="toàn nhà máy · 30 ngày chốt">
              <div className="flex-1 min-h-0 mt-2"><EffTrendChart data={TREND_30} height={400} tv /></div>
            </Panel>
          </div>
          <div className={cn("absolute inset-0 grid grid-cols-3 gap-6 transition-opacity duration-500", slide === 1 ? "opacity-100" : "opacity-0 pointer-events-none")} aria-hidden={slide !== 1}>
            <Panel title="Top 5" sub={`ngày ${LAST_CLOSED}`}><Rank rows={TOP5} /></Panel>
            <Panel title="Bottom 5" sub={`ngày ${LAST_CLOSED}`}><Rank rows={BOTTOM5} bottom /></Panel>
            <Panel title="Công đoạn nghẽn" sub="hôm nay">
              <ul className="flex flex-col">
                {BOTTLENECKS.map((b, i) => (
                  <li key={b.line + b.cd} className={cn("h-[76px] flex items-center gap-5", i && "border-t border-tv-border")}>
                    <span className="w-[76px] text-[34px] font-semibold">{b.line}</span>
                    <span className="flex-1 min-w-0 text-[34px] truncate">{b.ten}</span>
                    <span className="text-[36px] font-semibold num" style={{ color: b.sl === 0 ? WARN : "var(--tv-text)" }}>{b.sl === 0 ? "Chưa nhập" : fmt(b.sl)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        {/* Chỉ báo trang */}
        <div className="flex items-center justify-center gap-3 shrink-0 h-4">
          {[0, 1].map((i) => <button key={i} onClick={() => setSlide(i)} aria-label={`Trang ${i + 1}`} className={cn("h-3 rounded-full transition-all duration-300", slide === i ? "w-12 bg-brand" : "w-3 bg-tv-border")} />)}
        </div>
      </div>

      <Link href="/bao-cao/dashboard" aria-label="Thoát chế độ TV" className="fixed top-3 right-3 w-10 h-10 rounded-full bg-tv-surface/80 border border-tv-border text-tv-muted grid place-items-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity duration-fast">
        <X className="w-5 h-5" />
      </Link>
    </div>
  );
}
