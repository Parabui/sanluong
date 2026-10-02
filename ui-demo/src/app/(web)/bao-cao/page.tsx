"use client";

import { Calendar, Download, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { DataTable, TableFooter, type Col } from "@/components/ui/data-table";
import { Button, Page, Pill, Progress, Segmented, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { C05_MAP, LINE_STATS, STYLES } from "@/lib/demo-data";
import { cn, fmt, fmtDec, fmtH, pct } from "@/lib/utils";

type Kind = "cn" | "cd" | "chuyen" | "mh" | "ls";

/* ── Theo công nhân ── */
type W = { nv: string; hoTen: string; tram: string; cd: string; sl: number; smvMin: number; gio: number | null; support?: string; st: "open" | "closed" | "locked" };
const WORKERS: W[] = [
  { nv: "NV00231", hoTen: "Nguyễn Thị Lan", tram: "12", cd: "CD-40", sl: 412, smvMin: 309, gio: 9, st: "closed" },
  { nv: "NV00318", hoTen: "Trần Văn Hùng", tram: "25", cd: "CD-38", sl: 405, smvMin: 270, gio: 9, st: "closed" },
  { nv: "NV00412", hoTen: "Lê Thị Hoa", tram: "26", cd: "CD-05", sl: 520, smvMin: 329, gio: 9, st: "closed" },
  { nv: "NV00127", hoTen: "Phạm Thị Mai", tram: "27", cd: "CD-06, CD-07", sl: 778, smvMin: 492, gio: 9, st: "closed" },
  { nv: "NV01022", hoTen: "Đỗ Thị Ngọc", tram: "29", cd: "CD-12", sl: 610, smvMin: 356, gio: 9, st: "closed" },
  { nv: "NV00788", hoTen: "Huỳnh Thị Kim", tram: "30", cd: "CD-13", sl: 455, smvMin: 364, gio: 9, support: "C03", st: "closed" },
  { nv: "NV00655", hoTen: "Bùi Thị Hạnh", tram: "31", cd: "CD-14", sl: 470, smvMin: 329, gio: 9, st: "closed" },
  { nv: "NV00702", hoTen: "Ngô Thị Yến", tram: "32", cd: "CD-15", sl: 430, smvMin: 201, gio: 9, st: "closed" },
  { nv: "NV00914", hoTen: "Phan Thị Nhung", tram: "35", cd: "CD-20, CD-21", sl: 2200, smvMin: 624, gio: 6.5, st: "closed" },
  { nv: "NV00956", hoTen: "Đặng Thị Vân", tram: "36", cd: "CD-22", sl: 1350, smvMin: 270, gio: null, st: "open" },
  { nv: "NV00987", hoTen: "Trương Thị Hằng", tram: "37", cd: "CD-23", sl: 800, smvMin: 133, gio: 9, st: "closed" },
  { nv: "NV01003", hoTen: "Mai Thị Diễm", tram: "38", cd: "CD-24", sl: 395, smvMin: 145, gio: 9, st: "closed" },
  { nv: "NV01045", hoTen: "Châu Thị Thảo", tram: "39", cd: "CD-03", sl: 160, smvMin: 91, gio: 9, st: "closed" },
];
const stPill = (st: W["st"]) => st === "closed" ? <Pill size="sm" tone="closed">Đã chốt</Pill> : st === "locked" ? <Pill size="sm" tone="locked">Đã khóa</Pill> : <Pill size="sm" tone="open">Chưa chốt</Pill>;
const eff = (w: W) => (w.gio ? Math.round((w.smvMin / (w.gio * 60)) * 1000) / 10 : null);

const workerCols: Col<W>[] = [
  { key: "nv", label: "Mã NV", width: 96, render: (w) => <span className="font-mono text-[13px]">{w.nv}</span> },
  { key: "ten", label: "Họ tên", width: 200, render: (w) => <span className="flex items-center gap-1.5 flex-wrap">{w.hoTen}{w.support && <Pill size="sm" tone="support">Hỗ trợ từ {w.support}</Pill>}</span> },
  { key: "tram", label: "Trạm", width: 64, align: "center", render: (w) => <span className="num">{w.tram}</span> },
  { key: "cd", label: "Công đoạn", render: (w) => <span className="font-mono text-tag">{w.cd}</span> },
  { key: "sl", label: "Sản lượng", width: 100, align: "right", render: (w) => <b className="num text-qty">{fmt(w.sl)}</b> },
  { key: "smv", label: "Phút SMV", width: 96, align: "right", render: (w) => <span className="num">{fmt(w.smvMin)}</span> },
  { key: "gio", label: "Giờ làm", width: 84, align: "right", render: (w) => w.gio ? <span className="num">{fmtH(w.gio)}</span> : <span className="text-warn-ink" data-tip="Giờ làm chờ duyệt">—</span> },
  { key: "eff", label: "% Hiệu suất", width: 150, align: "right", render: (w) => {
    const e = eff(w);
    if (e == null) return <span className="inline-flex items-center gap-1 text-sub text-warn-ink"><TriangleAlert className="w-3.5 h-3.5" />Chưa có giờ làm</span>;
    return <span className={cn("inline-flex items-center gap-2 justify-end", e > 150 && "text-warn-ink font-semibold")}>
      <span className="w-14"><Progress value={Math.min(100, e)} tone={e > 150 ? "warn" : e >= 80 ? "success" : "brand"} /></span><span className="num w-12">{fmtDec(e)}%</span></span>;
  } },
  { key: "st", label: "Trạng thái", width: 110, render: (w) => stPill(w.st) },
];

/* ── Theo công đoạn / trạm ── */
type OpRow = { tram: number; cd: string; ten: string; mh: string; smv: number; sl: number };
const OPS: OpRow[] = Object.entries(C05_MAP).flatMap(([t, ops]) => ops.map((o, i) => ({ tram: +t, ...o, sl: [412, 405, 520, 388, 390, 402, 610, 455, 470, 430, 300, 376, 1120, 1080, 1350, 800, 395, 160, 142, 150][(+t * 3 + i) % 20] })));
const opCols: Col<OpRow>[] = [
  { key: "tram", label: "Trạm", width: 64, align: "center", render: (r) => <b className="num">{r.tram}</b> },
  { key: "mh", label: "Mã hàng", width: 100, render: (r) => <Pill size="sm">{r.mh}</Pill> },
  { key: "cd", label: "Công đoạn", render: (r) => <span><span className="font-mono text-tag text-muted mr-2">{r.cd}</span>{r.ten}</span> },
  { key: "smv", label: "SMV (giây)", width: 100, align: "right", render: (r) => <span className="num">{r.smv}</span> },
  { key: "sl", label: "Sản lượng", width: 110, align: "right", render: (r) => <b className="num text-qty">{fmt(r.sl)}</b> },
  { key: "min", label: "Phút SMV", width: 100, align: "right", render: (r) => <span className="num">{fmt(Math.round((r.sl * r.smv) / 60))}</span> },
];

/* ── Theo chuyền ── */
type LR = (typeof LINE_STATS)[number];
const lineCols: Col<LR>[] = [
  { key: "ma", label: "Chuyền", width: 120, render: (r) => <b>{r.ma}</b> },
  { key: "today", label: "Hoàn thành (QC)", width: 150, align: "right", render: (r) => <span className="num">{fmt(r.today * 9)}</span> },
  { key: "plan", label: "Kế hoạch", width: 120, align: "right", render: (r) => <span className="num text-muted">{fmt(r.plan * 9)}</span> },
  { key: "dat", label: "% Đạt KH", width: 180, align: "right", render: (r) => { const p = pct(r.today, r.plan); return <span className="inline-flex items-center gap-2 justify-end"><span className="w-16"><Progress value={p} tone={p >= 95 ? "success" : "brand"} /></span><span className="num w-10">{p}%</span></span>; } },
  { key: "eff", label: "% Hiệu suất chuyền", align: "right", render: (r) => <b className={cn("num", r.eff >= 85 ? "text-closed-ink" : r.eff < 72 ? "text-warn-ink" : "")}>{fmtDec(r.eff)}%</b> },
];

/* ── Theo mã hàng ── */
const styleCols: Col<(typeof STYLES)[number]>[] = [
  { key: "ma", label: "Mã hàng", width: 110, render: (s) => <b>{s.ma}</b> },
  { key: "ten", label: "Tên hàng", render: (s) => <span>{s.ten}<span className="text-muted"> · {s.khach}</span></span> },
  { key: "done", label: "Đã làm", width: 110, align: "right", render: (s) => <b className="num">{fmt(s.daLam)}</b> },
  { key: "tot", label: "Tổng đơn", width: 110, align: "right", render: (s) => <span className="num text-muted">{fmt(s.soLuong)}</span> },
  { key: "left", label: "Còn lại", width: 110, align: "right", render: (s) => <span className="num">{fmt(s.soLuong - s.daLam)}</span> },
  { key: "pct", label: "% Hoàn thành", width: 200, align: "right", render: (s) => { const p = pct(s.daLam, s.soLuong); return <span className="inline-flex items-center gap-2 justify-end"><span className="w-24"><Progress value={p} /></span><span className="num w-10">{p}%</span></span>; } },
  { key: "st", label: "Trạng thái tháng 09", width: 150, render: (s) => s.trangThai === "Đã xong" ? <Pill size="sm" tone="locked">Đã khóa</Pill> : <Pill size="sm" tone="open">Chưa khóa</Pill> },
];

/* ── Lịch sử chỉnh sửa ── */
type H = { t: string; who: string; tram: string; cd: string; nv: string; from: number | null; to: number; src: string; reason?: string };
const HIST: H[] = [
  { t: "09:04 29/09", who: "Phạm Thị Mai", tram: "C05 · 27", cd: "CD-07", nv: "NV00127", from: null, to: 101, src: "App" },
  { t: "08:07 29/09", who: "Nguyễn Văn Bình", tram: "C05 · 32", cd: "CD-15", nv: "NV00702", from: 460, to: 430, src: "Sửa Web", reason: "Đếm lại bó hàng" },
  { t: "08:05 29/09", who: "Nguyễn Văn Bình", tram: "C05 · 29", cd: "CD-12", nv: "NV01022", from: null, to: 610, src: "Nhập hộ", reason: "Không mang điện thoại" },
  { t: "17:40 28/09", who: "Lý Thị Trang", tram: "C05 · 33", cd: "CD-16", nv: "NV00833", from: null, to: 300, src: "Offline", reason: "Đồng bộ từ máy offline" },
  { t: "16:48 28/09", who: "Ngô Thị Yến", tram: "C05 · 32", cd: "CD-15", nv: "NV00702", from: 380, to: 460, src: "App" },
  { t: "16:30 28/09", who: "Phan Thị Nhung", tram: "C05 · 35", cd: "CD-20", nv: "NV00914", from: 900, to: 1120, src: "App" },
];
const histCols: Col<H>[] = [
  { key: "t", label: "Thời điểm", width: 120, render: (h) => <span className="num text-muted">{h.t}</span> },
  { key: "who", label: "Người thực hiện", width: 170, render: (h) => h.who },
  { key: "where", label: "Chuyền · Trạm", width: 120, render: (h) => <span className="num">{h.tram}</span> },
  { key: "cd", label: "Công đoạn · NV", width: 160, render: (h) => <span className="font-mono text-tag">{h.cd} · {h.nv}</span> },
  { key: "val", label: "Số cũ → mới", width: 130, align: "right", render: (h) => <b className="num">{h.from == null ? fmt(h.to) : `${fmt(h.from)} → ${fmt(h.to)}`}</b> },
  { key: "src", label: "Nguồn", width: 100, render: (h) => <Pill size="sm" tone={h.src === "Sửa Web" || h.src === "Nhập hộ" ? "adjust" : h.src === "Offline" ? "warn" : "neutral"}>{h.src}</Pill> },
  { key: "r", label: "Lý do", render: (h) => <span className="text-muted">{h.reason ?? "—"}</span> },
];

const KINDS: { value: Kind; label: string }[] = [
  { value: "cn", label: "Theo công nhân" }, { value: "cd", label: "Theo công đoạn / trạm" }, { value: "chuyen", label: "Theo chuyền" },
  { value: "mh", label: "Theo mã hàng" }, { value: "ls", label: "Lịch sử chỉnh sửa" },
];

export default function ReportsPage() {
  const toast = useToast();
  const { q } = useShell();
  const [kind, setKind] = useState<Kind>("cn");
  const [period, setPeriod] = useState("ngay");
  const s = q.trim().toLowerCase();
  const f = <T,>(rows: T[], txt: (r: T) => string) => (s ? rows.filter((r) => txt(r).toLowerCase().includes(s)) : rows);

  const table = () => {
    switch (kind) {
      case "cn": {
        const rows = f(WORKERS, (w) => `${w.nv} ${w.hoTen} ${w.cd}`);
        const tot = rows.reduce((a, w) => [a[0] + w.sl, a[1] + w.smvMin], [0, 0]);
        return <DataTable cols={workerCols} rows={rows} rowKey={(w) => w.nv} rowClass={(w) => ((eff(w) ?? 0) > 150 ? "bg-warn-bg/40" : undefined)}
          footer={<TableFooter><span><b className="text-ink num">{rows.length}</b> công nhân</span><span>Tổng sản lượng <b className="text-ink num">{fmt(tot[0])}</b></span><span>Tổng phút SMV <b className="text-ink num">{fmt(tot[1])}</b></span><span className="ml-auto">% hiệu suất = Phút SMV ÷ (giờ làm × 60)</span></TableFooter>} />;
      }
      case "cd": return <DataTable cols={opCols} rows={f(OPS, (r) => `${r.cd} ${r.ten}`)} rowKey={(r) => r.tram + r.cd} />;
      case "chuyen": return <DataTable cols={lineCols} rows={f(LINE_STATS, (r) => r.ma)} rowKey={(r) => r.ma} />;
      case "mh": return <DataTable cols={styleCols} rows={f(STYLES, (r) => `${r.ma} ${r.ten}`)} rowKey={(r) => r.ma} />;
      case "ls": return <DataTable cols={histCols} rows={f(HIST, (h) => `${h.who} ${h.nv} ${h.cd}`)} rowKey={(h, i) => h.t + i} />;
    }
  };

  return (
    <>
      <Page>
        <Toolbar title="Báo cáo" right={<Button variant="primary" icon={Download} onClick={() => toast("Đang xuất Excel… (.xlsx đúng dữ liệu đang xem)", "info")}>Xuất Excel</Button>}>
          <Segmented label="Kỳ báo cáo" value={period} onChange={setPeriod} options={[{ value: "ngay", label: "Ngày" }, { value: "tuan", label: "Tuần" }, { value: "thang", label: "Tháng" }, { value: "khoang", label: "Khoảng" }]} />
          <button className="h-9 px-3 flex items-center gap-2 rounded-ctl border border-line-strong bg-surface text-body hover:bg-hover transition-colors duration-fast shrink-0">
            <Calendar className="w-4 h-4 text-muted" /><span className="num whitespace-nowrap">{period === "ngay" ? "T2, 28/09/2026" : period === "tuan" ? "22/09 – 28/09/2026" : period === "thang" ? "Tháng 09/2026" : "01/09 – 28/09/2026"}</span>
          </button>
          <Select label="Chuyền" className="w-40"><option>C05 · Chuyền 5</option><option>Xưởng May 1 · tất cả chuyền</option></Select>
          <Select label="Mã hàng" className="w-40"><option>Tất cả mã hàng</option><option>PL-2641</option><option>SH-2655</option></Select>
        </Toolbar>

        <div className="flex items-center gap-2 -my-1 shrink-0 overflow-x-auto no-scrollbar">
          {KINDS.map((k) => (
            <button key={k.value} onClick={() => setKind(k.value)} aria-pressed={kind === k.value}
              className={cn("h-8 px-3.5 rounded-pill text-chip whitespace-nowrap border transition-colors duration-fast",
                kind === k.value ? "bg-ink text-surface border-ink font-semibold" : "bg-surface border-line text-ink hover:bg-hover font-medium")}>{k.label}</button>
          ))}
          <span className="ml-auto text-sub text-muted whitespace-nowrap flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" />Tổng trên màn hình = tổng trong file Excel</span>
        </div>

        {table()}
      </Page>
      <StatusBar right={<span>Dữ liệu 28/09 · lấy số nhập cuối cùng của mỗi bản ghi</span>}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warn-bg border border-warn-bar" />% hiệu suất &gt; 150%</span>
        <span>“—” = chưa có giờ làm / SMV</span>
      </StatusBar>
    </>
  );
}
