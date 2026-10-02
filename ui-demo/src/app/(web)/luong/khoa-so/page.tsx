"use client";

import { CalendarX, CircleCheck, Lock, LockOpen, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { DataTable, type Col } from "@/components/ui/data-table";
import { Button, Modal, Page, Pill, Progress, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn, fmt } from "@/lib/utils";

type L = {
  mh: string; ten: string; sl: number; ngay: number; chuaChot: string[];
  st: "locked" | "ready" | "blocked" | "reopened"; by?: string;
};
const INIT: L[] = [
  { mh: "TS-2610", ten: "Áo thun cổ tròn", sl: 20000, ngay: 18, chuaChot: [], st: "locked", by: "Dương Thị Mỹ · 18:02 20/09" },
  { mh: "DR-2633", ten: "Đầm suông cổ V", sl: 2710, ngay: 14, chuaChot: [], st: "ready" },
  { mh: "PL-2588", ten: "Áo polo nữ", sl: 5230, ngay: 24, chuaChot: [], st: "reopened", by: "Mở khóa bởi Dương Thị Mỹ · 10:20 27/09 — Sửa số C03 ngày 19/09" },
  { mh: "PL-2641", ten: "Áo polo nam tay ngắn", sl: 8640, ngay: 25, chuaChot: ["C05 · 28/09", "C06 · 28/09"], st: "blocked" },
  { mh: "SH-2655", ten: "Quần short kaki", sl: 1210, ngay: 6, chuaChot: ["C05 · 28/09"], st: "blocked" },
];
const REASONS = ["Tổ trưởng báo sai số", "Điều chỉnh giờ làm", "Sai SMV", "Khác"];

export default function LockPage() {
  const toast = useToast();
  const { q } = useShell();
  const [rows, setRows] = useState(INIT);
  const [unlock, setUnlock] = useState<L | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState<L | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  const set = (mh: string, patch: Partial<L>) => setRows((r) => r.map((x) => (x.mh === mh ? { ...x, ...patch } : x)));
  const lock = (l: L) => {
    if (l.st === "blocked") return setBlocked(l);
    set(l.mh, { st: "locked", by: "Dương Thị Mỹ · 09:15 29/09" });
    toast(`Đã khóa ${l.mh} × 09/2026 · khóa cả giờ làm liên quan`);
  };
  const s = q.trim().toLowerCase();
  const list = rows.filter((r) => !s || `${r.mh} ${r.ten}`.toLowerCase().includes(s));
  const locked = rows.filter((r) => r.st === "locked").length;

  const cols: Col<L>[] = [
    { key: "mh", label: "Mã hàng", width: 220, render: (l) => <div><div className="font-semibold">{l.mh}</div><div className="text-sub text-muted truncate">{l.ten}</div></div> },
    { key: "sl", label: "Sản lượng tháng 09", width: 150, align: "right", render: (l) => <b className="num text-qty">{fmt(l.sl)}</b> },
    { key: "ngay", label: "Ngày có SL", width: 110, align: "right", render: (l) => <span className="num">{l.ngay}</span> },
    { key: "chot", label: "Ngày chưa chốt", width: 230, render: (l) => l.chuaChot.length
      ? <button onClick={() => setBlocked(l)} className="inline-flex items-center gap-1.5 text-chip text-empty-ink font-semibold hover:underline"><CalendarX className="w-4 h-4" />{l.chuaChot.length} ngày: {l.chuaChot.join(", ")}</button>
      : <span className="inline-flex items-center gap-1.5 text-chip text-closed-ink"><CircleCheck className="w-4 h-4" />Đã chốt đủ</span> },
    { key: "st", label: "Trạng thái", render: (l) => (
      <div className="flex flex-col gap-0.5 items-start">
        {l.st === "locked" ? <Pill tone="locked" icon={Lock}>Đã khóa</Pill> : l.st === "reopened" ? <Pill tone="warn" icon={LockOpen}>Đang mở khóa</Pill> : l.st === "ready" ? <Pill tone="open">Sẵn sàng khóa</Pill> : <Pill tone="empty">Chưa đủ điều kiện</Pill>}
        {l.by && <span className="text-sub text-muted">{l.by}</span>}
      </div>) },
    { key: "act", label: <span className="sr-only">Thao tác</span>, width: 150, align: "right", render: (l) => l.st === "locked"
      ? <Button size="sm" icon={LockOpen} onClick={() => { setUnlock(l); setReason(""); setErr(""); }}>Mở khóa</Button>
      : <Button size="sm" variant={l.st === "blocked" ? "secondary" : "primary"} icon={Lock} onClick={() => lock(l)}>{l.st === "reopened" ? "Khóa lại" : "Khóa"}</Button> },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Khóa sổ" right={<Button variant="primary" icon={Lock} onClick={() => setAllOpen(true)}>Khóa tất cả mã hàng của tháng</Button>}>
          <Select label="Tháng" defaultValue="2026-09" className="w-40"><option value="2026-09">Tháng 09/2026</option><option value="2026-08">Tháng 08/2026</option></Select>
          <div className="flex items-center gap-2.5 ml-2 text-chip">
            <span className="w-32"><Progress value={(locked / rows.length) * 100} /></span>
            <span className="text-muted"><b className="text-ink num">{locked}/{rows.length}</b> mã hàng đã khóa</span>
          </div>
        </Toolbar>
        <div className="rounded-card border border-line bg-surface px-4 py-2.5 text-chip text-muted flex items-center gap-2 shrink-0">
          <Lock className="w-4 h-4" />Khóa theo <b className="text-ink">Mã hàng × Tháng</b>. Chỉ khóa được khi mọi ngày liên quan đã chốt. Khóa cũng khóa giờ làm của các NV × ngày có sản lượng thuộc mã hàng đó.
        </div>
        <DataTable cols={cols} rows={list} rowKey={(l) => l.mh} rowClass={(l) => (l.st === "reopened" ? "bg-warn-bg/40" : undefined)} />
      </Page>
      <StatusBar right={<span>Mã hàng vắt qua 2 tháng được khóa riêng từng tháng</span>}>
        <span>Mở khóa → tổ trưởng sửa (lý do) → khóa lại</span>
      </StatusBar>

      <Modal open={!!unlock} onClose={() => setUnlock(null)} title={`Mở khóa ${unlock?.mh ?? ""} × 09/2026?`}
        footer={<><Button onClick={() => setUnlock(null)}>Hủy</Button><Button variant="primary" icon={LockOpen} onClick={() => {
          if (!reason) return setErr("Bắt buộc chọn lý do mở khóa.");
          set(unlock!.mh, { st: "reopened", by: `Mở khóa bởi Dương Thị Mỹ · 09:15 29/09 — ${reason}` }); setUnlock(null); toast("Đã mở khóa · tổ trưởng có thể sửa số");
        }}>Mở khóa</Button></>}>
        <p className="text-body text-muted mb-4">Tổ trưởng sẽ sửa được sản lượng và giờ làm của mã hàng này trong tháng 09. Nhớ khóa lại sau khi sửa xong.</p>
        <fieldset>
          <legend className="text-chip font-medium mb-1.5">Lý do <span className="text-danger">*</span></legend>
          <div className="flex flex-wrap gap-1.5">{REASONS.map((r) => (
            <label key={r} className="chip-radio"><input type="radio" name="ul" className="sr-only" checked={reason === r} onChange={() => { setReason(r); setErr(""); }} />
              <span className="inline-flex items-center h-8 px-3 rounded-pill border border-line-strong bg-surface text-chip font-medium hover:bg-hover transition-colors duration-fast">{r}</span></label>))}</div>
        </fieldset>
        {err && <p className="text-sub text-danger mt-1.5" role="alert">{err}</p>}
      </Modal>

      <Modal open={!!blocked} onClose={() => setBlocked(null)} title={`Chưa khóa được ${blocked?.mh ?? ""}`}
        footer={<Button variant="primary" onClick={() => setBlocked(null)}>Đã hiểu</Button>}>
        <p className="text-body text-muted">Còn ngày chưa chốt — tổ trưởng phải chốt ngày trước khi khóa:</p>
        <ul className="mt-3 flex flex-col gap-2">{blocked?.chuaChot.map((d) => (
          <li key={d} className="flex items-center gap-2.5 px-3 py-2 rounded-ctl bg-empty-bg text-empty-ink text-body"><CalendarX className="w-4 h-4" />{d}</li>))}</ul>
      </Modal>

      <Modal open={allOpen} onClose={() => setAllOpen(false)} title="Khóa tất cả mã hàng tháng 09/2026?"
        footer={<><Button onClick={() => setAllOpen(false)}>Hủy</Button><Button variant="primary" icon={Lock} onClick={() => {
          const ok = rows.filter((r) => r.st === "ready" || r.st === "reopened");
          setRows(rows.map((r) => (r.st === "ready" || r.st === "reopened" ? { ...r, st: "locked", by: "Dương Thị Mỹ · 09:15 29/09" } : r)));
          setAllOpen(false); toast(`Đã khóa ${ok.length} mã hàng · bỏ qua ${rows.filter((r) => r.st === "blocked").length} mã chưa đủ điều kiện`);
        }}>Khóa {rows.filter((r) => r.st === "ready" || r.st === "reopened").length} mã hàng</Button></>}>
        <ul className="flex flex-col gap-2">
          {rows.filter((r) => r.st !== "locked").map((r) => (
            <li key={r.mh} className={cn("flex items-center gap-2.5 px-3 py-2 rounded-ctl border text-body", r.st === "blocked" ? "bg-empty-bg border-transparent text-empty-ink" : "bg-thead border-line")}>
              {r.st === "blocked" ? <TriangleAlert className="w-4 h-4" /> : <CircleCheck className="w-4 h-4 text-closed-ink" />}
              <b>{r.mh}</b><span className="text-sub">{r.st === "blocked" ? `bỏ qua — còn ${r.chuaChot.length} ngày chưa chốt` : "sẽ khóa"}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
