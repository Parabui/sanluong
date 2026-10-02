"use client";

import { ArrowDownRight, ArrowUpRight, ChartColumn, Gauge, Package, Radio, Table2, Target, TrendingUp, Tv } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EffTrendChart, Legend, LineOutputChart, Meter } from "@/components/charts";
import { StatusBar } from "@/components/shell/app-shell";
import { Card, CardHeader, Page, Segmented, Select, Stat, Tag } from "@/components/ui/primitives";
import { BOTTLENECKS, BOTTOM5, LAST_CLOSED, LINE_OUTPUT, TOP5, TOTAL_PLAN, TOTAL_TODAY, TREND_30, TREND_7, type Ranked } from "@/lib/dashboard-data";
import { NOW } from "@/lib/demo-data";
import { cn, fmt, fmtDec, pct } from "@/lib/utils";

function RankList({ rows, tone }: { rows: Ranked[]; tone: "top" | "bottom" }) {
  return (
    <ol className="px-4 py-2">
      {rows.map((r, i) => (
        <li key={r.nv} className={cn("h-12 flex items-center gap-3", i && "border-t border-line")}>
          <span className="w-6 text-chip text-muted num text-right">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-body font-medium truncate">{r.hoTen}</div>
            <div className="text-sub text-muted"><span className="font-mono">{r.nv}</span> · {r.line}</div>
          </div>
          <div className="w-28 flex flex-col gap-1 items-end">
            <b className={cn("text-body num", tone === "bottom" && r.eff < 50 && "text-warn-ink")}>{fmtDec(r.eff)}%</b>
            <span className="w-full"><Meter value={r.eff} /></span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<"7" | "30">("30");
  const [view, setView] = useState<"chart" | "table">("chart");
  const trend = range === "7" ? TREND_7 : TREND_30;
  const reach = pct(TOTAL_TODAY, TOTAL_PLAN);
  const effLast = TREND_30[TREND_30.length - 1], effPrev = TREND_30[TREND_30.length - 2];
  const effDelta = effLast.eff - effPrev.eff;

  return (
    <>
      <Page scroll>
        {/* Một hàng bộ lọc phía trên mọi biểu đồ */}
        <section className="bg-surface border border-line rounded-card px-4 flex items-center gap-2.5 shrink-0" style={{ height: "var(--toolbar-h)" }}>
          <h1 className="text-title font-semibold whitespace-nowrap">Dashboard</h1>
          <Segmented label="Khoảng xu hướng" value={range} onChange={setRange} options={[{ value: "7", label: "7 ngày" }, { value: "30", label: "30 ngày" }]} />
          <Select label="Xưởng" className="w-36"><option>Xưởng May 1</option></Select>
          <Select label="Chuyền" className="w-36"><option>Tất cả chuyền</option><option>C05</option><option>C06</option></Select>
          <span className="text-sub text-muted flex items-center gap-1.5 ml-1"><span className="live-dot w-2 h-2 rounded-full bg-success" />Tự làm mới mỗi 5 phút</span>
          <Link href="/tv" className="ml-auto h-9 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-body font-medium inline-flex items-center gap-2 transition-colors duration-fast"><Tv className="w-[18px] h-[18px]" />Chế độ TV</Link>
        </section>

        <div className="grid grid-cols-4 gap-4">
          <Stat icon={Package} label="Sản lượng hôm nay (QC)" value={fmt(TOTAL_TODAY)} unit="sp" sub={`15 chuyền · realtime ${NOW.time}`} />
          <Stat icon={Target} label="Đạt kế hoạch hôm nay" value={`${reach}%`} sub={`Kế hoạch ${fmt(TOTAL_PLAN)} sp tới ${NOW.time}`} tone="warn" />
          <Stat icon={Gauge} label={`% hiệu suất ngày chốt gần nhất`} value={`${fmtDec(effLast.eff)}%`} tone={effDelta >= 0 ? "up" : "down"}
            sub={<span className="inline-flex items-center gap-1">{effDelta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}{effDelta >= 0 ? "+" : "−"}{fmtDec(Math.abs(effDelta))} điểm so với {effPrev.d}</span>} />
          <Stat icon={Radio} label="Trạm có dữ liệu hôm nay" value="214" unit="/ 270" sub={<span className="inline-flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5" />56 trạm chưa nhập</span>} tone="warn" />
        </div>

        <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4">
          <Card>
            <CardHeader icon={ChartColumn} title="Sản lượng hôm nay theo chuyền" sub={`tới ${NOW.time}`}
              right={<Segmented label="Kiểu xem" value={view} onChange={setView} options={[{ value: "chart", label: <ChartColumn className="w-4 h-4" aria-label="Biểu đồ" /> }, { value: "table", label: <Table2 className="w-4 h-4" aria-label="Bảng" /> }]} />} />
            {view === "chart" ? (
              <div className="px-3 pt-3 pb-2">
                <div className="px-1 pb-1"><Legend items={[{ kind: "bar", label: "Thực tế (công đoạn QC)" }, { kind: "tick", label: "Kế hoạch tới giờ này" }]} /></div>
                <LineOutputChart data={LINE_OUTPUT} height={250} />
              </div>
            ) : (
              <div className="max-h-[290px] overflow-auto scroll-area">
                <table className="grid-table hoverable text-body">
                  <thead><tr className="text-th font-semibold uppercase text-muted"><th className="px-4 text-left">Chuyền</th><th className="px-4 text-right">Thực tế</th><th className="px-4 text-right">Kế hoạch</th><th className="px-4 text-right">% đạt</th></tr></thead>
                  <tbody>{LINE_OUTPUT.map((l) => (<tr key={l.ma}><td className="px-4 font-medium">{l.ma}</td><td className="px-4 text-right num">{fmt(l.today)}</td><td className="px-4 text-right num text-muted">{fmt(l.plan)}</td><td className="px-4 text-right num font-semibold">{pct(l.today, l.plan)}%</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={TrendingUp} title="% hiệu suất toàn nhà máy" sub={`${range} ngày · chỉ ngày đã chốt`} />
            <div className="px-3 pt-4 pb-2"><EffTrendChart data={trend} height={272} /></div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Top 5 công nhân" sub={`ngày chốt ${LAST_CLOSED} · ≥ 4 giờ làm`} />
            <RankList rows={TOP5} tone="top" />
          </Card>
          <Card>
            <CardHeader title="Bottom 5 công nhân" sub={`ngày chốt ${LAST_CLOSED} · ≥ 4 giờ làm`} />
            <RankList rows={BOTTOM5} tone="bottom" />
          </Card>
          <Card>
            <CardHeader title="Công đoạn nghẽn hôm nay" sub="SL thấp nhất / mã hàng" />
            <ul className="px-4 py-2">
              {BOTTLENECKS.map((b, i) => (
                <li key={b.line + b.cd} className={cn("h-12 flex items-center gap-3", i && "border-t border-line")}>
                  <span className="w-10 text-chip font-semibold">{b.line}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium truncate">{b.ten}</div>
                    <div className="text-sub text-muted flex items-center gap-1.5"><Tag>{b.mh}</Tag><span className="font-mono">{b.cd}</span></div>
                  </div>
                  <span className="text-right">
                    <b className="text-body num">{fmt(b.sl)}</b>
                    {b.note && <span className="block text-sub text-empty-ink">{b.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Page>
      <StatusBar right={<span>Số liệu khớp 100% với Báo cáo (F5) · cùng công thức</span>}>
        <span>% hiệu suất và Top/Bottom tính trên ngày đã chốt gần nhất ({LAST_CLOSED})</span>
      </StatusBar>
    </>
  );
}
