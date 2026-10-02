"use client";

import {
  Calendar, CalendarX, Check, ChevronDown, ChevronLeft, ChevronRight, CircleArrowRight, CircleCheck, CircleDashed,
  CircleDot, Clock, Database, History, Lock, Minus, Moon, Pencil, Radio, RefreshCw, SearchX, Smartphone, Timer,
  TriangleAlert, UserPlus, WifiOff, X, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Drawer, Kbd, Modal, Switch, useOutside } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { NOW } from "@/lib/demo-data";
import { addDays, cn, ddmm, ddmmyyyy, fmt, parseQty, weekday } from "@/lib/utils";
import { buildData, DATES, SRC, type Day, type Row, type Src, type St } from "./board-data";
import { ProxyPopover, ReasonPopover } from "./popovers";

const SRC_ICON: Record<Src, LucideIcon> = { app: Smartphone, offline: WifiOff, proxy: UserPlus, web: Pencil };
const USER = "Nguyễn Văn Bình";
/** Dữ liệu demo sống ở cấp module: chỉnh sửa giữ nguyên khi chuyển trang trong phiên */
const data = buildData();
const closeDay = (line: string, date: string) =>
  Object.assign(data[line][date], { status: "closed", closedBy: `Đã chốt bởi ${USER} lúc ${NOW.time} ${ddmmyyyy(NOW.date)}` });
const canCloseFrom = (iso: string) => addDays(iso, 1); // chốt được từ 08:00 ngày hôm sau
const notYetClosable = (iso: string) => !(NOW.date > iso && (NOW.date > canCloseFrom(iso) || NOW.time >= "08:00"));
const stamp = () => `${NOW.time} ${ddmm(NOW.date)}`;
const issuesOf = (d: Day) => d.rows.filter((r) => r.st === "empty" || r.st === "warn");
const counts = (rows: Row[]) => rows.reduce((c, r) => ((c[r.st] = (c[r.st] || 0) + 1), c), {} as Partial<Record<St, number>>);
const lastAdj = (r: Row) => r.hist.find((h) => h.reason);
const adjTip = (r: Row) => { const h = lastAdj(r); return h ? `${h.from == null ? "—" : fmt(h.from)} → ${fmt(h.to)} · ${h.reason} · ${h.by} · ${h.t}` : ""; };

type Pop = { kind: "reason"; id: string; n: number; moveNext: boolean; fromEdit: boolean } | { kind: "proxy"; id: string };

export function DailyBoard() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { q } = useShell();
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [line, setLine] = useState(sp.get("chuyen") === "C06" ? "C06" : "C05");
  const [date, setDate] = useState(DATES.includes(sp.get("ngay") ?? "") ? sp.get("ngay")! : "2026-09-28");
  const [filter, setFilter] = useState<St | null>(null);
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [edit, setEdit] = useState<{ id: string; value: string; error: string | null } | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [dateMenu, setDateMenu] = useState(false);
  const [updated, setUpdated] = useState(NOW.time);
  const dateRef = useRef<HTMLDivElement>(null);
  useOutside(dateRef, () => setDateMenu(false), dateMenu);

  // mở từ link "ngày chưa chốt" trên header / trang chủ (điều chỉnh state ngay khi render)
  const spKey = sp.toString();
  const [prevSp, setPrevSp] = useState(spKey);
  if (prevSp !== spKey) {
    setPrevSp(spKey);
    const c = sp.get("chuyen"), n = sp.get("ngay");
    if (c) setLine(c === "C06" ? "C06" : "C05");
    if (n && DATES.includes(n)) setDate(n);
  }

  const day = (): Day => data[line][date] || { status: line === "C06" ? "nodata" : "none", rows: [] };
  const d = day();
  const editable = d.status === "open" || d.status === "closed";
  const findRow = (id: string) => d.rows.find((r) => r.id === id);
  const lines = ["C05", "C06"];

  const visibleRows = () => {
    let rows = d.rows;
    if (filter) rows = rows.filter((r) => r.st === filter);
    if (onlyTodo) rows = rows.filter((r) => r.st === "empty" || r.st === "warn");
    const s = q.trim().toLowerCase();
    if (s) rows = rows.filter((r) => [r.nv, r.hoTen, r.ten, r.cd, r.login?.nv, r.login?.hoTen, "trạm " + r.tram].some((x) => x && String(x).toLowerCase().includes(s)));
    return rows;
  };
  const rows = visibleRows();

  const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
  const focusLater = (sel: string, scroll = false) => requestAnimationFrame(() => { const el = $(sel); if (scroll) el?.scrollIntoView({ block: "center" }); el?.focus(); });
  const anchorOf = (id: string) => $(`tr[data-id="${id}"] td.qty-td`);

  /* ─── Sửa số ─── */
  const startEdit = (id: string) => {
    if (!editable) return;
    const r = findRow(id); if (!r) return;
    setPop(null);
    setEdit({ id, value: String(r.sl), error: null });
    requestAnimationFrame(() => { const i = $("#qty-input") as HTMLInputElement | null; i?.focus(); i?.select(); });
  };
  const cancelEdit = (focusBack = true) => {
    if (!edit) return;
    const id = edit.id; setEdit(null);
    if (focusBack) focusLater(`[data-edit="${id}"]`);
  };
  const focusNext = (id: string) => {
    const i = rows.findIndex((r) => r.id === id), n = rows[i + 1];
    if (!n) return;
    if (n.sl != null) startEdit(n.id); else focusLater(`[data-proxy="${n.id}"]`);
  };
  const submitEdit = (moveNext: boolean) => {
    if (!edit) return;
    const r = findRow(edit.id)!, n = parseQty(edit.value);
    if (n == null) { setEdit({ ...edit, error: "Số lượng phải là số nguyên từ 0 đến 99.999" }); return; }
    if (n === r.sl && r.st !== "warn") { setEdit(null); if (moveNext) focusNext(r.id); else focusLater(`[data-edit="${r.id}"]`); return; }
    setEdit({ ...edit, error: null });
    setPop({ kind: "reason", id: r.id, n, moveNext, fromEdit: true });
  };

  /* ─── Luồng "việc tiếp theo" ─── */
  const goIssue = (r?: Row) => {
    if (!r) return toast("Không còn ô nào cần xử lý");
    setEdit(null);
    if (!visibleRows().includes(r)) { setFilter(null); }
    requestAnimationFrame(() => {
      const btn = $(`[data-proxy="${r.id}"]`) || $(`[data-confirm="${r.id}"]`);
      btn?.scrollIntoView({ block: "center" });
      setPop(r.st === "empty" ? { kind: "proxy", id: r.id } : { kind: "reason", id: r.id, n: r.sl!, moveNext: false, fromEdit: false });
    });
  };
  const afterIssueSaved = (r: Row) => {
    const next = issuesOf(day())[0];
    toast(next ? `Đã lưu · Trạm ${r.tram} — tiếp: Trạm ${next.tram} (Enter hoặc N)` : `Đã lưu · Trạm ${r.tram} — đã xử lý hết ô cần xử lý`);
    if (!next) return focusLater(`[data-edit="${r.id}"]`);
    if (!visibleRows().includes(next)) setFilter(null);
    focusLater(`[data-proxy="${next.id}"], [data-confirm="${next.id}"]`, true);
  };

  const cancelPop = useCallback(() => {
    setPop((p) => {
      if (p?.kind === "reason" && p.fromEdit) { setEdit(null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-edit="${p.id}"]`)?.focus()); }
      else if (p) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-proxy="${p.id}"], [data-confirm="${p.id}"]`)?.focus());
      return null;
    });
  }, []);

  const goDate = (iso: string) => { setDate(iso); setFilter(null); setEdit(null); setPop(null); router.replace(`/san-xuat/bang-san-luong?chuyen=${line}&ngay=${iso}`, { scroll: false }); };

  // bấm ra ngoài khi đang sửa (chưa mở popover) → hủy sửa
  useEffect(() => {
    if (!edit || pop) return;
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("#qty-input")) setEdit(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [edit, pop]);

  /* ─── Phím tắt ─── */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.matches("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey;
      const busy = pop || drawerId || closeOpen;
      if (!typing && !busy && (e.key === "n" || e.key === "N") && editable) { e.preventDefault(); goIssue(issuesOf(day())[0]); }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  });

  /* ─── Toolbar ─── */
  const dayMeta = (iso: string): [string, string, LucideIcon] => {
    const x = data[line][iso];
    if (!x) return ["Chưa có dữ liệu", "text-muted", Minus];
    if (x.status === "closed") return ["Đã chốt", "text-closed-ink", CircleCheck];
    if (x.status === "locked") return ["Đã khóa", "text-locked-ink", Lock];
    if (x.status === "none") return ["Nghỉ", "text-muted", Moon];
    if (iso === NOW.date) return ["Hôm nay · đang nhập", "text-open-ink", Radio];
    const n = issuesOf(x).length;
    return n ? [`Chưa chốt · ${n} việc`, "text-empty-ink", CircleDot] : ["Chưa chốt · sẵn sàng", "text-open-ink", CircleDot];
  };

  const statusChip = () => {
    const m = ({ open: ["bg-open-bg text-open-ink", null, "Chưa chốt"], closed: ["bg-closed-bg text-closed-ink", Check, "Đã chốt"], locked: ["bg-locked-bg text-locked-ink", Lock, "Đã khóa"] } as const)[d.status as "open"];
    if (!m) return null;
    const I = m[1] as LucideIcon | null;
    return <span className={cn("h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold whitespace-nowrap", m[0])}>{I && <I className="w-3.5 h-3.5" />}{m[2]}</span>;
  };

  const closeArea = () => {
    if (d.status === "open") {
      if (notYetClosable(date))
        return <button className="h-9 px-4 rounded-ctl bg-disabled-bg text-disabled-ink text-body font-semibold flex items-center gap-2 cursor-not-allowed" aria-disabled="true" data-tip={`Chốt được từ 08:00 ngày ${ddmmyyyy(canCloseFrom(date))}`}><CircleCheck className="w-[18px] h-[18px]" />Chốt ngày</button>;
      return <button onClick={() => { setAck(false); setCloseOpen(true); }} className="h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold flex items-center gap-2 transition-colors duration-fast"><CircleCheck className="w-[18px] h-[18px]" />Chốt ngày</button>;
    }
    if (d.status === "closed") {
      const [who, when] = d.closedBy!.replace("Đã chốt ", "").split(" lúc ");
      return <span className="text-sub text-closed-ink flex flex-col items-end leading-4" aria-label={d.closedBy}><span className="font-semibold whitespace-nowrap num">Đã chốt · {when}</span><span className="whitespace-nowrap">{who}</span></span>;
    }
    if (d.status === "locked") return <span className="text-chip text-locked-ink flex items-center gap-1.5"><Lock className="w-4 h-4" />Kỳ lương đã khóa sổ</span>;
    return null;
  };

  /* ─── Tóm tắt ─── */
  const c = counts(d.rows);
  const tramCount = new Set(d.rows.map((r) => r.tram)).size;
  const qc = d.rows.find((r) => r.qc);
  const filled = d.rows.filter((r) => r.sl != null).length, pctFilled = d.rows.length ? Math.round((filled / d.rows.length) * 100) : 0;
  const todo = issuesOf(d).length;
  const chip = (key: St, n: number | undefined, text: string, cls: string, Icon?: LucideIcon) => !n ? null : (
    <button onClick={() => { setFilter(filter === key ? null : key); setEdit(null); }} aria-pressed={filter === key}
      className={cn("h-8 px-3 rounded-pill inline-flex items-center gap-1.5 text-chip whitespace-nowrap border transition-colors duration-fast", cls, filter === key && "ring-2 ring-offset-1 ring-current")}>
      {Icon && <Icon className="w-3.5 h-3.5" />}<b className="font-semibold num">{n}</b> {text}{filter === key && <X className="w-3.5 h-3.5 -mr-1" />}
    </button>
  );

  /* ─── Bảng ─── */
  const statusPill = (r: Row) => {
    if (r.st === "empty") return <span className="h-6 px-2.5 rounded-pill inline-flex items-center text-sub font-semibold bg-surface/60 text-empty-ink border border-empty-bar/40 whitespace-nowrap">Chưa có số</span>;
    if (r.st === "warn") return editable
      ? <button data-confirm={r.id} onClick={() => setPop({ kind: "reason", id: r.id, n: r.sl!, moveNext: false, fromEdit: false })} className="h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold bg-surface text-warn-ink border border-warn-bar/60 hover:border-warn-bar whitespace-nowrap transition-colors duration-fast" data-tip={`${r.flag} — bấm để xem lại`}><TriangleAlert className="w-3.5 h-3.5" />Cần xem lại</button>
      : <span className="h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold bg-surface/60 text-warn-ink border border-warn-bar/40 whitespace-nowrap" data-tip={r.flag ?? ""}><TriangleAlert className="w-3.5 h-3.5" />Cần xem lại</span>;
    if (r.st === "adjusted") {
      const h = lastAdj(r), same = h && h.from === h.to;
      return <span tabIndex={0} className="h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold bg-adjust-bg text-adjust-ink whitespace-nowrap cursor-help" data-tip={adjTip(r)}>{same ? <><Check className="w-3.5 h-3.5" />Đã xác nhận</> : "Đã điều chỉnh"}</span>;
    }
    return null;
  };

  const qtyCell = (r: Row) => {
    if (edit?.id === r.id) return (
      <div className="flex flex-col items-end gap-1">
        <input id="qty-input" inputMode="numeric" autoComplete="off" value={edit.value} aria-label="Số lượng mới"
          aria-invalid={!!edit.error} aria-describedby={edit.error ? "qty-err" : undefined}
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submitEdit(false); }
            else if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); submitEdit(true); }
            else if (e.key === "Escape") { e.preventDefault(); cancelEdit(true); }
          }}
          className={cn("num w-full h-8 px-2 text-right text-qty font-semibold rounded-ctl border-2 outline-none bg-surface", edit.error ? "border-danger" : "border-brand-ink")} />
        {edit.error && <p id="qty-err" className="text-sub text-danger text-right leading-tight whitespace-normal">{edit.error}</p>}
      </div>
    );
    if (r.sl == null) return (
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-muted" aria-hidden="true">—</span>
        {editable && <button data-proxy={r.id} onClick={() => { setEdit(null); setPop({ kind: "proxy", id: r.id }); }} className="h-7 px-1.5 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-chip font-medium inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-fast"><UserPlus className="w-3.5 h-3.5" />Nhập hộ</button>}
      </div>
    );
    const adj = r.st === "adjusted";
    const inner = <>{adj && <Pencil className="w-3.5 h-3.5 text-adjust-ink" />}<span className="num text-qty font-semibold">{fmt(r.sl)}</span></>;
    if (!editable) return <div className="flex items-center justify-end gap-1.5">{inner}</div>;
    return (
      <button data-edit={r.id} onClick={() => startEdit(r.id)} aria-label={`Sửa số lượng ${fmt(r.sl)}`} data-tip={adj ? adjTip(r) : undefined} style={{ width: "calc(100% + 16px)" }}
        className="w-full h-8 -my-1 px-2 -mx-2 flex items-center justify-end gap-1.5 rounded-ctl hover:bg-surface hover:ring-1 hover:ring-line-strong transition duration-fast">
        {inner}
      </button>
    );
  };

  const empty = (Icon: LucideIcon, text: string, sub = "") => (
    <tr><td colSpan={8} className="!h-auto !border-0"><div className="py-16 flex flex-col items-center gap-3 text-center">
      <Icon className="w-10 h-10 text-muted" /><p className="text-body text-ink font-medium">{text}</p>{sub && <p className="text-sub text-muted">{sub}</p>}
    </div></td></tr>
  );

  const tableBody = () => {
    if (d.status === "nodata") return empty(Database, `Chưa có dữ liệu mẫu cho chuyền ${line}`, "Bản demo chỉ có dữ liệu chuyền C05.");
    if (!d.rows.length) return empty(CalendarX, `Không có dữ liệu ngày ${ddmmyyyy(date)} (${weekday(date)})`);
    if (!rows.length) return q.trim()
      ? empty(SearchX, `Không tìm thấy “${q.trim()}”`, "Thử mã NV, tên công nhân hoặc tên công đoạn. Nhấn Esc để xóa tìm kiếm.")
      : empty(CircleCheck, "Không còn dòng nào cần xử lý", "Bấm lại chip lọc hoặc tắt công tắc để xem toàn bộ.");
    const groups: { tram: number; rows: Row[] }[] = [];
    rows.forEach((r) => { const g = groups[groups.length - 1]; if (g && g.tram === r.tram) g.rows.push(r); else groups.push({ tram: r.tram, rows: [r] }); });
    return groups.map((g) => g.rows.map((r, i) => {
      const first = i === 0, span = g.rows.length, last = i === span - 1, isEmpty = r.st === "empty";
      const SIcon = r.src ? SRC_ICON[r.src] : null;
      return (
        <tr key={r.id} className={cn(`st-${r.st}`, last && "grp-end")} data-id={r.id}>
          {first && <td rowSpan={span} className={cn(span > 1 ? "tram-span bg-surface" : "lead", "px-3 text-center align-middle text-qty font-semibold num")}>{r.tram}</td>}
          <td className={cn((!first || span > 1) && "lead", "px-3 py-0.5")}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-[18px] px-1.5 rounded-pill bg-group text-tag font-semibold text-ink shrink-0 inline-flex items-center">{r.mh}</span>
              <span className="font-medium truncate">{r.ten}</span>
              {r.qc && <span className="h-[18px] px-1.5 rounded-pill bg-closed-bg text-closed-ink text-tag font-semibold shrink-0 inline-flex items-center">QC ★</span>}
            </div>
            <div className="text-sub text-muted num"><span className="font-mono text-tag">{r.cd}</span> · SMV {r.smv}s</div>
          </td>
          <td className={cn("px-3 font-mono text-[13px]", isEmpty && "italic text-muted")}>{isEmpty ? (r.login ? r.login.nv : "—") : r.nv}</td>
          <td className="px-3 py-0.5">
            {isEmpty
              ? <span className="italic text-muted truncate block">{r.login ? r.login.hoTen : "Chưa có người đăng nhập"}</span>
              : <span className="truncate block">{r.hoTen}</span>}
            {r.support && <span className="mt-0.5 h-[18px] px-1.5 rounded-pill bg-support-bg text-support-ink text-tag font-semibold inline-flex items-center">Hỗ trợ từ {r.support}</span>}
          </td>
          <td className="qty-td px-3 text-right relative">{qtyCell(r)}</td>
          <td className="px-3">{r.src && SIcon ? <span className="inline-flex items-center gap-1.5 text-chip text-ink whitespace-nowrap"><SIcon className="w-3.5 h-3.5 text-muted" />{SRC[r.src].label}</span> : <span className="text-muted">—</span>}</td>
          <td className="px-3">{statusPill(r)}</td>
          <td className="px-3 text-center">
            <button onClick={() => setDrawerId(r.id)} className="row-action opacity-0 focus:opacity-100 w-8 h-8 grid place-items-center rounded-ctl text-muted hover:bg-group hover:text-ink transition duration-fast mx-auto"
              aria-label={`Lịch sử trạm ${r.tram} ${r.cd}`} data-tip="Lịch sử"><History className="w-4 h-4" /></button>
          </td>
        </tr>
      );
    }));
  };

  /* ─── Lưu từ popover ─── */
  const popRow = pop ? findRow(pop.id) : undefined;
  const popAnchor = pop ? anchorOf(pop.id) : null;

  const saveReason = (reason: string, same: boolean) => {
    if (!pop || pop.kind !== "reason" || !popRow) return;
    const r = popRow, n = pop.n, wasIssue = r.st === "warn", moveNext = pop.moveNext;
    r.hist.unshift({ t: stamp(), from: r.sl, to: n, src: same ? r.src! : "web", by: USER, reason });
    Object.assign(r, { sl: n, src: same ? r.src : "web", st: "adjusted", flag: null });
    setPop(null); setEdit(null); rerender();
    if (wasIssue) return afterIssueSaved(r);
    toast("Đã lưu");
    if (moveNext) requestAnimationFrame(() => focusNext(r.id)); else focusLater(`[data-edit="${r.id}"]`);
  };
  const saveProxy = (emp: { nv: string; hoTen: string }, n: number, reason: string) => {
    if (!popRow) return;
    const r = popRow;
    r.hist.unshift({ t: stamp(), from: null, to: n, src: "proxy", by: USER, reason });
    Object.assign(r, { nv: emp.nv, hoTen: emp.hoTen, sl: n, src: "proxy", st: "adjusted", login: null });
    setPop(null); rerender(); afterIssueSaved(r);
  };

  /* ─── Drawer lịch sử ─── */
  const dr = drawerId ? findRow(drawerId) : undefined;

  /* ─── Modal chốt ngày ─── */
  const warns: [LucideIcon, string, React.ReactNode, "empty" | "warn" | "time"][] = [];
  if (c.empty) warns.push([CircleDashed, "text-empty-bar", <>Còn <b className="num">{c.empty}</b> ô chưa có số</>, "empty"]);
  if (c.warn) warns.push([TriangleAlert, "text-warn-bar", <>Còn <b className="num">{c.warn}</b> ô cần xem lại</>, "warn"]);
  if (d.timeReq) warns.push([Clock, "text-muted", <>Còn <b className="num">{d.timeReq}</b> yêu cầu giờ chờ duyệt</>, "time"]);
  const nWarn = (c.empty || 0) + (c.warn || 0) + (d.timeReq || 0);

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: "var(--content-pad)", gap: "var(--block-gap)" }}>
        <div className="page-in w-full mx-auto flex-1 min-h-0 flex flex-col" style={{ maxWidth: "var(--table-max)", gap: "var(--block-gap)" }}>

          {/* ① Thanh tiêu đề & bộ lọc */}
          <section className="bg-surface border border-line rounded-card px-4 flex items-center gap-2.5 shrink-0" style={{ height: "var(--toolbar-h)" }} aria-label="Bộ lọc">
            <h1 className="text-title font-semibold whitespace-nowrap">Bảng sản lượng ngày</h1>

            <label className="relative shrink-0">
              <span className="sr-only">Chuyền</span>
              <select value={line} onChange={(e) => { setLine(e.target.value); setFilter(null); setEdit(null); setPop(null); }}
                className="native w-40 h-9 pl-3 pr-8 rounded-ctl border border-line-strong bg-surface text-body font-medium hover:border-muted transition-colors duration-fast">
                {lines.map((l) => <option key={l} value={l}>{l} · Chuyền {Number(l.slice(1))}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
            </label>

            <div ref={dateRef} className="relative flex items-center shrink-0" role="group" aria-label="Chọn ngày">
              <button onClick={() => { const i = DATES.indexOf(date); if (i > 0) goDate(DATES[i - 1]); }} disabled={date <= DATES[0]}
                className="w-9 h-9 grid place-items-center rounded-l-ctl border border-line-strong bg-surface hover:bg-hover disabled:text-disabled-ink disabled:hover:bg-surface disabled:cursor-not-allowed transition-colors duration-fast" aria-label="Ngày trước"><ChevronLeft className="w-[18px] h-[18px]" /></button>
              <button onClick={() => setDateMenu((o) => !o)} aria-haspopup="menu" aria-expanded={dateMenu} aria-label="Chọn ngày"
                className="w-[180px] h-9 -ml-px -mr-px px-3 flex items-center gap-2 border border-line-strong bg-surface text-body hover:bg-hover transition-colors duration-fast">
                <Calendar className="w-4 h-4 text-muted" /><span className="num whitespace-nowrap">{weekday(date)}, {ddmmyyyy(date)}</span>
              </button>
              {dateMenu && (
                <div role="menu" className="pop-in absolute left-9 top-11 w-[300px] bg-surface border border-line rounded-card shadow-pop p-1 z-40">
                  <div className="px-3 pt-2 pb-1 text-tag font-semibold uppercase tracking-[0.06em] text-muted">Ngày có dữ liệu mẫu · {line}</div>
                  {[...DATES].reverse().map((iso) => {
                    const [label, cls, Icon] = dayMeta(iso), cur = iso === date;
                    return (
                      <button key={iso} role="menuitem" onClick={() => { setDateMenu(false); goDate(iso); }} aria-current={cur ? "date" : undefined}
                        className={cn("w-full h-10 px-3 flex items-center gap-2.5 rounded-ctl text-body hover:bg-hover", cur && "bg-brand-soft")}>
                        <span className={cn("num", cur && "font-semibold")}>{weekday(iso)}, {ddmmyyyy(iso)}</span>
                        <span className={cn("ml-auto inline-flex items-center gap-1 text-sub font-semibold", cls)}><Icon className="w-3.5 h-3.5" />{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button onClick={() => { const i = DATES.indexOf(date); if (i < DATES.length - 1) goDate(DATES[i + 1]); }} disabled={date >= NOW.date}
                className="w-9 h-9 grid place-items-center rounded-r-ctl border border-line-strong bg-surface hover:bg-hover disabled:text-disabled-ink disabled:hover:bg-surface disabled:cursor-not-allowed transition-colors duration-fast" aria-label="Ngày sau"><ChevronRight className="w-[18px] h-[18px]" /></button>
            </div>

            <span className="shrink-0">{statusChip()}</span>

            <Switch checked={onlyTodo} onChange={(v) => { setOnlyTodo(v); setEdit(null); }} label={<span className="whitespace-normal w-[92px] block">Chỉ hiện dòng cần xử lý</span>} />

            <div className="ml-auto shrink-0 flex items-center">{closeArea()}</div>
          </section>

          {/* ② Dải tóm tắt */}
          <section className="flex items-center gap-2 shrink-0 min-w-0" style={{ height: "var(--summary-h)", margin: "-4px 0" }} aria-label="Tóm tắt">
            <span className="h-8 px-3 rounded-pill inline-flex items-center gap-2 text-chip bg-surface border border-line whitespace-nowrap">
              <span><b className="font-semibold num">{tramCount}</b> trạm · <b className="font-semibold num">{d.rows.length}</b> dòng</span>
              {d.rows.length > 0 && (<>
                <span className="w-10 h-1.5 rounded-pill bg-group overflow-hidden" role="progressbar" aria-valuenow={pctFilled} aria-valuemin={0} aria-valuemax={100} aria-label="Tỉ lệ dòng đã có số">
                  <span className="block h-full bg-success" style={{ width: `${pctFilled}%` }} />
                </span>
                <span className="text-muted num" data-tip={`${filled}/${d.rows.length} dòng đã có số`}>{filled}/{d.rows.length}</span>
              </>)}
            </span>
            {chip("empty", c.empty, "ô chưa có số", "bg-empty-bg text-empty-ink border-transparent hover:border-empty-bar")}
            {chip("warn", c.warn, "ô cảnh báo", "bg-warn-bg text-warn-ink border-transparent hover:border-warn-bar", TriangleAlert)}
            {chip("adjusted", c.adjusted, "ô đã điều chỉnh", "bg-adjust-bg text-adjust-ink border-transparent hover:border-adjust-ink")}
            {d.timeReq && line === "C05" && (
              <Link href="/san-xuat/duyet-gio" className="h-8 px-3 rounded-pill inline-flex items-center gap-1.5 text-chip text-muted bg-surface border border-line hover:bg-hover whitespace-nowrap transition-colors duration-fast">
                <Clock className="w-3.5 h-3.5" /><b className="font-semibold num text-ink">{d.timeReq}</b> giờ làm chờ duyệt
              </Link>
            )}
            {todo > 0 && editable && (
              <button onClick={() => goIssue(issuesOf(d)[0])} className="h-8 pl-2.5 pr-2 rounded-pill inline-flex items-center gap-1.5 text-chip font-semibold text-ink bg-surface border border-line-strong hover:bg-hover whitespace-nowrap transition-colors duration-fast" data-tip="Mở ô cần xử lý kế tiếp · phím N">
                <CircleArrowRight className="w-4 h-4 text-brand-ink" />Xử lý tiếp
              </button>
            )}
            {qc && qc.sl != null && (
              <span className="ml-auto min-w-0 truncate text-chip text-muted whitespace-nowrap">
                <span data-tip={`Số sản phẩm qua công đoạn hoàn thành (QC ★) · ${qc.mh}`}>Hoàn thành: <b className="font-semibold text-ink num">{fmt(qc.sl)}</b> sp</span>
              </span>
            )}
          </section>

          {/* ③ Bảng dữ liệu */}
          <section className="bg-surface border border-line rounded-card overflow-hidden flex-1 min-h-0 flex flex-col" aria-label="Bảng sản lượng">
            <div id="table-scroll" className="flex-1 min-h-0 overflow-auto scroll-area">
              <table className="grid-table text-body">
                <colgroup>
                  <col style={{ width: 64 }} /><col style={{ minWidth: 260 }} /><col style={{ width: 96 }} /><col style={{ width: 180 }} />
                  <col style={{ width: 110 }} /><col style={{ width: 104 }} /><col style={{ width: 160 }} /><col style={{ width: 56 }} />
                </colgroup>
                <thead>
                  <tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted">
                    <th scope="col" className="px-3 text-center">Trạm</th>
                    <th scope="col" className="px-3 text-left">Công đoạn</th>
                    <th scope="col" className="px-3 text-left">Mã NV</th>
                    <th scope="col" className="px-3 text-left">Họ tên</th>
                    <th scope="col" className="px-3 text-right">Số lượng</th>
                    <th scope="col" className="px-3 text-left">Nguồn</th>
                    <th scope="col" className="px-3 text-left">Trạng thái</th>
                    <th scope="col" className="px-3"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>{tableBody()}</tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* ④ Thanh trạng thái dưới */}
      <StatusBar right={<>
        <span>Cập nhật lúc {updated} · Tự làm mới khi có thay đổi</span>
        <button onClick={() => { setUpdated(NOW.time); toast("Đã tải lại dữ liệu"); }} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-hover text-muted transition-colors duration-fast" aria-label="Tải lại" data-tip="Tải lại"><RefreshCw className="w-4 h-4" /></button>
      </>}>
        <ul className="flex items-center gap-4" aria-label="Chú thích màu">
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-empty-bg border border-empty-bar" />Chưa có số</li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warn-bg border border-warn-bar" />Cần xem lại</li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-adjust-bg border border-adjust-ink" />Đã điều chỉnh</li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-support-bg border border-support-ink" />Hỗ trợ chuyền khác</li>
        </ul>
        <span className="ml-auto hidden 2xl:inline-flex items-center gap-1.5"><Kbd>/</Kbd> tìm · <Kbd>N</Kbd> ô cần xử lý kế tiếp · <Kbd>Tab</Kbd> dòng dưới</span>
      </StatusBar>

      {/* Popover */}
      {pop && popRow && popAnchor && (pop.kind === "reason"
        ? <ReasonPopover key={pop.id + "r"} row={popRow} n={pop.n} anchor={popAnchor} onCancel={cancelPop} onSave={saveReason} />
        : <ProxyPopover key={pop.id + "p"} row={popRow} date={date} anchor={popAnchor} onCancel={cancelPop} onSave={saveProxy} />)}

      {/* Drawer lịch sử */}
      <Drawer open={!!dr} onClose={() => setDrawerId(null)} title="Lịch sử bản ghi">
        {dr && <HistoryBody r={dr} date={date} dayRows={d.rows} />}
      </Drawer>

      {/* Modal chốt ngày */}
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title={`Chốt ngày ${ddmmyyyy(date)} – ${line}?`}
        footer={<>
          <button data-autofocus={nWarn ? undefined : true} onClick={() => setCloseOpen(false)} className="h-9 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-body font-medium transition-colors duration-fast">Hủy</button>
          <button disabled={nWarn > 0 && !ack} onClick={() => {
            closeDay(line, date);
            setCloseOpen(false); rerender(); toast(`Đã chốt ngày ${ddmmyyyy(date)} – ${line}`);
          }} className="h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold flex items-center gap-2 transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink disabled:cursor-not-allowed">
            <CircleCheck className="w-[18px] h-[18px]" />{nWarn ? "Vẫn chốt ngày" : "Chốt ngày"}
          </button>
        </>}>
        {warns.length > 0 && (
          <ul className="flex flex-col gap-2">
            {warns.map(([I, cls, text, key]) => (
              <li key={key} className="flex items-center gap-2.5 px-3 py-2 rounded-ctl bg-thead border border-line text-body">
                <I className={cn("w-[18px] h-[18px]", cls)} /><span>{text}</span>
                {key === "time"
                  ? <Link href="/san-xuat/duyet-gio" className="ml-auto text-chip font-semibold text-brand-ink hover:underline">Mở Duyệt giờ</Link>
                  : <button onClick={() => { setCloseOpen(false); goIssue(issuesOf(d).find((r) => r.st === key)); }} className="ml-auto text-chip font-semibold text-brand-ink hover:underline">Xử lý ngay</button>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-body text-muted">Sau khi chốt, công nhân không nhập được số của ngày này. Tổ trưởng vẫn sửa được (bắt buộc lý do).</p>
        {nWarn > 0 && (
          <label className="mt-4 flex items-start gap-2.5 text-body cursor-pointer">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--text)]" />
            <span>Tôi đã kiểm tra và vẫn muốn chốt khi còn <b className="num">{nWarn}</b> mục chưa xử lý.</span>
          </label>
        )}
      </Modal>
    </>
  );
}

function HistoryBody({ r, date, dayRows }: { r: Row; date: string; dayRows: Row[] }) {
  const who = r.nv ? `${r.nv} ${r.hoTen}` : "Chưa có người nhập";
  const m = r.sl != null ? Math.round((r.sl * r.smv) / 60) : 0;
  const tot = dayRows.filter((x) => x.nv === r.nv && x.sl != null).reduce((s, x) => s + Math.round((x.sl! * x.smv) / 60), 0);
  return (
    <>
      <div className="rounded-card border border-line bg-thead px-3 py-2.5 text-chip leading-relaxed">
        <span className="font-semibold">Trạm {r.tram}</span> · {r.cd} {r.ten} · {who} · <span className="num">{ddmmyyyy(date)}</span>
        {r.sl != null && (
          <div className="mt-1.5 pt-1.5 border-t border-line text-sub text-muted num flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5" />
            <span><b className="text-ink">{m} phút chuẩn</b> ({fmt(r.sl)} × {r.smv}s ÷ 60) · {Math.round(m / 4.8)}% ca 8 giờ{tot !== m && ` · cả ngày: ${tot} phút (${Math.round(tot / 4.8)}%)`}</span>
          </div>
        )}
      </div>
      {r.hist.length ? (
        <ol className="mt-5">
          {r.hist.map((h, i) => {
            const I = SRC_ICON[h.src];
            return (
              <li key={i} className="tl-item relative pl-6 pb-5">
                <span className={cn("absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2", i === 0 ? "border-brand bg-brand-soft" : "border-line-strong bg-surface")} />
                <div className="text-sub text-muted num">{h.t}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-qty font-semibold num">{h.from == null ? fmt(h.to) : `${fmt(h.from)} → ${fmt(h.to)}`}</span>
                  <span className="h-5 px-2 rounded-pill bg-group text-tag font-semibold inline-flex items-center gap-1"><I className="w-3 h-3" />{SRC[h.src].label}</span>
                </div>
                <div className="text-chip mt-1">{h.by}{h.reason && ` — ${h.reason}`}</div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="py-12 flex flex-col items-center gap-2 text-muted text-chip"><History className="w-8 h-8" />Chưa có bản ghi nào cho công đoạn này.</div>
      )}
      {r.st === "warn" && <div className="mt-2 px-3 py-2 rounded-ctl bg-warn-bg text-warn-ink text-chip flex gap-2"><TriangleAlert className="w-4 h-4 mt-0.5" />{r.flag}</div>}
    </>
  );
}

