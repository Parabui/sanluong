"use client";

import { CircleAlert, TriangleAlert, User } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ReasonChips } from "@/components/ui/primitives";
import { REASON_CONFIRM, REASON_EDIT, REASON_PROXY, REASON_WARN } from "@/lib/demo-data";
import { cn, ddmmyyyy, fmt, parseQty } from "@/lib/utils";
import { BOARD_EMPLOYEES, type Row } from "./board-data";

/* ─────────── Khung popover neo vào ô ─────────── */
export function Popover({ anchor, label, onCancel, children }: { anchor: HTMLElement; label: string; onCancel: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current; if (!el || !anchor.isConnected) return;
      const a = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      const left = Math.min(Math.max(8, a.right - w), innerWidth - w - 8);
      let top = a.bottom + 4;
      if (top + h > innerHeight - 8) top = Math.max(8, a.top - h - 4);
      el.style.left = left + "px"; el.style.top = top + "px";
    };
    place();
    const sc = document.getElementById("table-scroll");
    sc?.addEventListener("scroll", place);
    addEventListener("resize", place);
    return () => { sc?.removeEventListener("scroll", place); removeEventListener("resize", place); };
  }, [anchor]);

  // bấm ra ngoài → hủy
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !anchor.contains(t)) onCancel();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [anchor, onCancel]);

  return (
    <div ref={ref} role="dialog" aria-label={label} className="pop-in fixed z-50 bg-surface border border-line rounded-card shadow-pop p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
        if (e.key === "Tab") { // giữ focus trong popover
          const f = [...ref.current!.querySelectorAll<HTMLElement>("input,select,textarea,button:not([disabled])")].filter((x) => x.offsetParent);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      }}>
      {children}
    </div>
  );
}

/* ─────────── Phần lý do dùng chung ─────────── */
function useReason() {
  const [rs, setRs] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<{ msg: string; field: "reason" | "note" | "nv" | "qty" } | null>(null);
  const read = () => {
    if (!rs) { setErr({ msg: "Vui lòng chọn lý do (bấm chip, hoặc phím Space / mũi tên).", field: "reason" }); return null; }
    if (rs === "Khác" && !note.trim()) { setErr({ msg: "Vui lòng nhập ghi chú khi chọn “Khác”.", field: "note" }); return null; }
    return { rs, reason: rs === "Khác" ? note.trim() : note.trim() ? `${rs} — ${note.trim()}` : rs };
  };
  return { rs, setRs, note, setNote, err, setErr, read };
}

function ReasonBlock({ name, reasons, r, onSave, onCancel }: { name: string; reasons: string[]; r: ReturnType<typeof useReason>; onSave: () => void; onCancel: () => void }) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <div onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSave(); } }}>
        {/* Enter không tự chọn chip đang focus — lý do phải được chọn chủ động (Space / mũi tên / bấm) */}
        <ReasonChips name={name} reasons={reasons} value={r.rs} onChange={(v) => { r.setRs(v); r.setErr(null); if (v === "Khác") setTimeout(() => noteRef.current?.focus()); }} />
      </div>
      <label className="block text-chip font-medium mt-3 mb-1" htmlFor={`${name}-note`}>
        Ghi chú <span className="text-muted font-normal">(bắt buộc khi chọn “Khác”)</span>
      </label>
      <textarea id={`${name}-note`} ref={noteRef} rows={2} value={r.note} placeholder="Mô tả ngắn lý do…"
        onChange={(e) => { r.setNote(e.target.value); r.setErr(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); } }}
        className={cn("w-full px-3 py-2 rounded-ctl border bg-surface text-body resize-none outline-none focus:border-brand-ink", r.err?.field === "note" ? "border-danger" : "border-line-strong")} />
      {r.err && <p className="text-sub text-danger mt-1.5 flex items-center gap-1" role="alert"><CircleAlert className="w-3.5 h-3.5" />{r.err.msg}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="h-9 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-body font-medium transition-colors duration-fast">Hủy</button>
        <button onClick={onSave} className="h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold transition-colors duration-fast">Lưu</button>
      </div>
    </>
  );
}

const Note = ({ children }: { children: ReactNode }) => (
  <div className="mb-3 px-3 py-2 rounded-ctl bg-warn-bg text-warn-ink text-chip flex items-start gap-2">
    <TriangleAlert className="w-4 h-4 mt-0.5" /><span>{children}</span>
  </div>
);

/* ─────────── Popover lý do điều chỉnh / xác nhận ô cảnh báo ─────────── */
export function ReasonPopover({ row, n, anchor, onCancel, onSave }: { row: Row; n: number; anchor: HTMLElement; onCancel: () => void; onSave: (reason: string, same: boolean) => void }) {
  const warn = row.st === "warn", same = n === row.sl;
  const title = warn && same ? "Xác nhận ô cảnh báo" : "Lý do điều chỉnh";
  const reasons = warn ? (same ? REASON_WARN : REASON_WARN.slice(1)) : REASON_EDIT;
  const r = useReason();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLInputElement>("input[type=radio]")?.focus(); }, []);

  const save = () => {
    const res = r.read(); if (!res) return;
    if (same && res.rs !== REASON_CONFIRM && res.rs !== "Khác") return r.setErr({ msg: `Số chưa đổi — chọn “${REASON_CONFIRM}” nếu giữ nguyên.`, field: "reason" });
    onSave(res.reason, same);
  };

  return (
    <Popover anchor={anchor} label={title} onCancel={onCancel}>
      <div className="w-[320px]" ref={box}>
        <div className="text-h font-semibold">{title}</div>
        <div className="text-sub text-muted mt-0.5 mb-3 num">
          Trạm {row.tram} · {row.cd} {row.ten} · <b className="text-ink">{same ? "giữ nguyên " + fmt(n) : fmt(row.sl) + " → " + fmt(n)}</b>
        </div>
        {warn && <Note>{row.flag}.{same && ` Giữ nguyên số → chọn “${REASON_CONFIRM}”; muốn sửa số → bấm vào ô Số lượng.`}</Note>}
        {!same && row.sl != null && n < row.sl && <Note>Số mới nhỏ hơn số cũ (<b className="num">{fmt(row.sl)} → {fmt(n)}</b>)</Note>}
        <ReasonBlock name="pr-reason" reasons={reasons} r={r} onSave={save} onCancel={onCancel} />
      </div>
    </Popover>
  );
}

/* ─────────── Popover nhập hộ ─────────── */
export function ProxyPopover({ row, date, anchor, onCancel, onSave }: { row: Row; date: string; anchor: HTMLElement; onCancel: () => void; onSave: (emp: { nv: string; hoTen: string }, n: number, reason: string) => void }) {
  const pre = row.login;
  const [nv, setNv] = useState(pre?.nv ?? "");
  const [qty, setQty] = useState("");
  const [hi, setHi] = useState(-1);
  const [listOpen, setListOpen] = useState(false);
  const r = useReason();
  const nvRef = useRef<HTMLInputElement>(null), qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (pre ? qtyRef : nvRef).current?.focus(); }, [pre]);

  const q = nv.trim().toUpperCase();
  const matches = q ? BOARD_EMPLOYEES.filter((e) => e.nv.startsWith(q) || e.hoTen.toUpperCase().includes(q)).slice(0, 6) : [];
  const exact = BOARD_EMPLOYEES.find((e) => e.nv === q);
  const pick = (e: { nv: string }) => { setNv(e.nv); setListOpen(false); setHi(-1); r.setErr(null); qtyRef.current?.focus(); };

  const save = () => {
    if (!exact) return r.setErr({ msg: "Mã NV không tồn tại — chọn từ danh sách gợi ý.", field: "nv" });
    const n = parseQty(qty);
    if (n == null) return r.setErr({ msg: "Số lượng phải là số nguyên từ 0 đến 99.999", field: "qty" });
    const res = r.read(); if (!res) return;
    onSave(exact, n, res.reason);
  };

  return (
    <Popover anchor={anchor} label="Nhập hộ" onCancel={onCancel}>
      <div className="w-[320px]">
        <div className="text-h font-semibold">Nhập hộ</div>
        <div className="text-sub text-muted mt-0.5 mb-3 num">Trạm {row.tram} · {row.cd} {row.ten} · {ddmmyyyy(date)}</div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <div className="relative">
            <label className="block text-chip font-medium mb-1" htmlFor="px-nv">Mã NV <span className="text-danger">*</span></label>
            <input id="px-nv" ref={nvRef} role="combobox" aria-expanded={listOpen && matches.length > 0} aria-controls="px-list" aria-autocomplete="list" autoComplete="off"
              aria-activedescendant={hi >= 0 ? `px-o${hi}` : undefined}
              value={nv} placeholder="VD: NV005…"
              onChange={(e) => { setNv(e.target.value); setHi(-1); setListOpen(true); r.setErr(null); }}
              onBlur={() => setTimeout(() => setListOpen(false), 100)}
              onKeyDown={(e) => {
                if (!listOpen || !matches.length) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % matches.length); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); }
                else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(matches[hi]); }
                else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setListOpen(false); }
              }}
              className={cn("num w-full h-9 px-3 rounded-ctl border bg-surface text-body uppercase outline-none focus:border-brand-ink", r.err?.field === "nv" ? "border-danger" : "border-line-strong")} />
            {listOpen && matches.length > 0 && (
              <ul id="px-list" role="listbox" className="absolute left-0 right-[-122px] top-[62px] z-10 bg-surface border border-line rounded-card shadow-pop p-1 max-h-52 overflow-auto">
                {matches.map((e, i) => (
                  <li key={e.nv} id={`px-o${i}`} role="option" aria-selected={i === hi} onMouseDown={(ev) => { ev.preventDefault(); pick(e); }}
                    className={cn("h-9 px-3 flex items-center gap-3 rounded-ctl cursor-pointer text-body", i === hi ? "bg-brand-soft" : "hover:bg-hover")}>
                    <span className="num font-medium w-[72px]">{e.nv}</span><span className="text-muted truncate">{e.hoTen}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-chip font-medium mb-1" htmlFor="px-qty">Số lượng <span className="text-danger">*</span></label>
            <input id="px-qty" ref={qtyRef} inputMode="numeric" autoComplete="off" value={qty}
              onChange={(e) => { setQty(e.target.value); r.setErr(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
              className={cn("num w-full h-9 px-3 rounded-ctl border bg-surface text-body text-right font-semibold outline-none focus:border-brand-ink", r.err?.field === "qty" ? "border-danger" : "border-line-strong")} />
          </div>
        </div>
        <p className={cn("text-sub mt-1 mb-3 flex items-center gap-1", exact || pre ? "text-ink" : "text-muted")}>
          {exact ? (<><User className="w-3.5 h-3.5" />{exact.hoTen}{pre && exact.nv === pre.nv && <span className="text-muted">· đang đăng nhập trạm</span>}</>)
            : nv ? "Nhập mã hoặc tên để tìm nhân viên" : "Chưa có người đăng nhập trạm"}
        </p>
        <ReasonBlock name="px-reason" reasons={REASON_PROXY} r={r} onSave={save} onCancel={onCancel} />
      </div>
    </Popover>
  );
}
