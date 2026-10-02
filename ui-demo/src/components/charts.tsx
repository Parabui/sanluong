"use client";

/* Biểu đồ dùng chung Web + TV — theo quy tắc dataviz:
   nét mảnh, cột ≤ 24px bo 4px ở đầu dữ liệu, lưới hairline liền, chữ dùng token chữ (không dùng màu dữ liệu),
   tooltip: giá trị trước – nhãn sau, khóa bằng nét ngắn. Màu dữ liệu: --chart-accent (đã kiểm validator). */

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmt, fmtDec } from "@/lib/utils";

type Row = { ma: string; today: number; plan: number };

const AXIS = { stroke: "var(--chart-axis)", strokeWidth: 1 };
const tick = (size: number) => ({ fill: "var(--chart-label)", fontSize: size, fontFamily: "var(--font)" });

/* ─── Tooltip ─── */
function Tip({ rows, title, tv }: { rows: { key: "bar" | "line" | "tick"; label: string; value: string }[]; title: string; tv?: boolean }) {
  return (
    <div className={tv ? "rounded-card bg-[#232933] border border-tv-border px-4 py-3 shadow-pop" : "rounded-card bg-surface border border-line px-3 py-2 shadow-pop"}>
      <div className={tv ? "text-[22px] text-tv-muted mb-1" : "text-sub text-muted mb-1"}>{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block shrink-0"
            style={{ width: 12, height: r.key === "bar" ? 8 : 2, borderRadius: r.key === "bar" ? 2 : 1, background: r.key === "tick" ? "var(--chart-target)" : "var(--chart-accent)" }} />
          <b className={tv ? "text-[26px] text-tv-text num" : "text-body text-ink num"}>{r.value}</b>
          <span className={tv ? "text-[22px] text-tv-muted" : "text-chip text-muted"}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/* Vạch kế hoạch: nét 2px màu mực, rộng hơn cột một chút */
function TargetTick(p: { x?: number; y?: number; width?: number }) {
  const { x = 0, y = 0, width = 0 } = p;
  return <line x1={x - 4} x2={x + width + 4} y1={y} y2={y} stroke="var(--chart-target)" strokeWidth={2} strokeLinecap="round" />;
}

/** Sản lượng hôm nay theo chuyền: cột = thực tế (QC), vạch = kế hoạch (dạng bullet) */
export function LineOutputChart({ data, height = 260, tv = false }: { data: Row[]; height?: number; tv?: boolean }) {
  const bar = tv ? 36 : 20;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barSize={bar} barGap={-bar} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="ma" tickLine={false} axisLine={AXIS} tick={tick(tv ? 32 : 12)} interval={0} height={tv ? 52 : 28} tickFormatter={tv ? (v: string) => v.replace(/^C/, "") : undefined} />
        <YAxis tickLine={false} axisLine={false} tick={tick(tv ? 32 : 12)} width={tv ? 84 : 40} tickFormatter={(v) => fmt(v)} />
        <Tooltip cursor={{ fill: "var(--chart-grid)", opacity: 0.6 }} isAnimationActive={false}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as Row;
            const p = Math.round((r.today / r.plan) * 100);
            return <Tip tv={tv} title={`${r.ma} · đạt ${p}% kế hoạch`} rows={[{ key: "bar", label: "Thực tế (QC)", value: fmt(r.today) }, { key: "tick", label: "Kế hoạch", value: fmt(r.plan) }]} />;
          }} />
        <Bar dataKey="today" name="Thực tế (QC)" fill="var(--chart-accent)" radius={[4, 4, 0, 0]} isAnimationActive={!tv} animationDuration={500} />
        <Bar dataKey="plan" name="Kế hoạch" shape={<TargetTick />} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Xu hướng % hiệu suất (chỉ ngày đã chốt): 1 chuỗi, vùng wash 10%, đường mục tiêu có nhãn */
export function EffTrendChart({ data, target = 85, height = 240, tv = false }: { data: { d: string; eff: number }[]; target?: number; height?: number; tv?: boolean }) {
  const last = data.length - 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: tv ? 128 : 56, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="d" tickLine={false} axisLine={AXIS} tick={tick(tv ? 32 : 12)} height={tv ? 52 : 28} interval="preserveStartEnd" minTickGap={tv ? 40 : 16} />
        <YAxis domain={[60, 100]} ticks={[60, 70, 80, 90, 100]} tickLine={false} axisLine={false} tick={tick(tv ? 32 : 12)} width={tv ? 100 : 40} tickFormatter={(v) => `${v}%`} />
        <ReferenceLine y={target} stroke="var(--chart-label)" strokeWidth={1}
          label={{ value: `Mục tiêu ${target}%`, position: "insideTopLeft", fill: "var(--chart-label)", fontSize: tv ? 28 : 11 }} />
        <Tooltip isAnimationActive={false} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return <Tip tv={tv} title={`Ngày ${label}`} rows={[{ key: "line", label: "% hiệu suất", value: `${fmtDec(payload[0].payload.eff)}%` }]} />;
          }} />
        <Area dataKey="eff" stroke="none" fill="var(--chart-accent-wash)" fillOpacity={1} isAnimationActive={false} />
        <Line dataKey="eff" stroke="var(--chart-accent)" strokeWidth={tv ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" isAnimationActive={!tv} animationDuration={600}
          activeDot={{ r: tv ? 7 : 5, fill: "var(--chart-accent)", stroke: tv ? "var(--tv-surface)" : "var(--surface)", strokeWidth: 2 }}
          dot={(p: { cx?: number; cy?: number; index?: number; value?: number }) => p.index === last ? (
            <g key="end">
              <circle cx={p.cx} cy={p.cy} r={tv ? 7 : 4.5} fill="var(--chart-accent)" stroke={tv ? "var(--tv-surface)" : "var(--surface)"} strokeWidth={2} />
              <text x={(p.cx ?? 0) + (tv ? 14 : 10)} y={(p.cy ?? 0) + (tv ? 8 : 4)} fill={tv ? "var(--tv-text)" : "var(--text)"} fontSize={tv ? 34 : 13} fontWeight={600}>{fmtDec(p.value)}%</text>
            </g>
          ) : <g key={p.index} />} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Thanh đo nhỏ (meter) — track là bậc nhạt của cùng ramp */
export function Meter({ value, max = 120, tv = false }: { value: number; max?: number; tv?: boolean }) {
  return (
    <span className="block rounded-pill overflow-hidden" style={{ height: tv ? 10 : 6, background: "var(--chart-track)" }} aria-hidden="true">
      <span className="block h-full rounded-pill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: "var(--chart-accent)" }} />
    </span>
  );
}

/** Chú giải: ô chữ nhật cho cột, nét ngắn cho vạch / đường */
export function Legend({ items, tv }: { items: { kind: "bar" | "tick" | "line"; label: string }[]; tv?: boolean }) {
  return (
    <ul className={tv ? "flex items-center gap-8 text-[32px] text-tv-muted" : "flex items-center gap-4 text-sub text-muted"}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" style={{ width: tv ? 28 : 12, height: i.kind === "bar" ? (tv ? 16 : 8) : (tv ? 3 : 2), borderRadius: i.kind === "bar" ? 2 : 1, background: i.kind === "tick" ? "var(--chart-target)" : "var(--chart-accent)" }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
