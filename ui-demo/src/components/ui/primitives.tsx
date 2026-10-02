"use client";

import { ChevronDown, X, type LucideIcon } from "lucide-react";
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes,
  type ReactNode, type RefObject, type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/* ─────────── Button ─────────── */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand hover:bg-brand-hover text-ink font-semibold",
  secondary: "border border-line-strong bg-surface hover:bg-hover text-ink font-medium",
  ghost: "text-muted hover:bg-hover hover:text-ink font-medium",
  danger: "bg-danger hover:brightness-110 text-ondark font-semibold",
  subtle: "bg-group hover:bg-line text-ink font-medium",
};
export function Button({
  variant = "secondary", size = "md", icon: Icon, className, children, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; icon?: LucideIcon }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-ctl whitespace-nowrap transition-colors duration-fast",
        "disabled:bg-disabled-bg disabled:text-disabled-ink disabled:border-transparent disabled:cursor-not-allowed",
        size === "md" ? "h-9 px-4 text-body" : "h-8 px-3 text-chip",
        BTN[variant],
        className,
      )}
    >
      {Icon && <Icon className={size === "md" ? "w-[18px] h-[18px]" : "w-4 h-4"} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button {...p} aria-label={label} data-tip={label}
      className={cn("w-9 h-9 grid place-items-center rounded-ctl text-muted hover:bg-hover hover:text-ink transition-colors duration-fast", className)}>
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}

/* ─────────── Card / section ─────────── */
export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLElement>) {
  return <section {...p} className={cn("bg-surface border border-line rounded-card", className)}>{children}</section>;
}

export function CardHeader({ title, sub, right, icon: Icon }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="h-12 px-4 flex items-center gap-2.5 border-b border-line">
      {Icon && <Icon className="w-[18px] h-[18px] text-muted" />}
      <h2 className="text-h font-semibold whitespace-nowrap">{title}</h2>
      {sub && <span className="text-sub text-muted truncate">{sub}</span>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** Thanh tiêu đề & bộ lọc — cao 56px, giống merged.html */
export function Toolbar({ title, children, right }: { title: string; children?: ReactNode; right?: ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-card px-4 flex items-center gap-2.5 shrink-0 min-w-0" style={{ height: "var(--toolbar-h)" }} aria-label="Bộ lọc">
      <h1 className="text-title font-semibold whitespace-nowrap">{title}</h1>
      {children}
      {right && <div className="ml-auto shrink-0 flex items-center gap-2">{right}</div>}
    </section>
  );
}

/** Vùng nội dung chuẩn: padding 20, gap 16, max 1440 */
export function Page({ children, className, scroll = false }: { children: ReactNode; className?: string; scroll?: boolean }) {
  return (
    <div className={cn("flex-1 min-h-0 flex flex-col", scroll && "overflow-y-auto scroll-area")} style={{ padding: "var(--content-pad)" }}>
      <div className={cn("page-in w-full mx-auto flex flex-col", !scroll && "flex-1 min-h-0", className)} style={{ maxWidth: "var(--table-max)", gap: "var(--block-gap)" }}>
        {children}
      </div>
    </div>
  );
}

/* ─────────── Select ─────────── */
export function Select({ className, children, label, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select {...p}
        className={cn("native h-9 pl-3 pr-8 rounded-ctl border border-line-strong bg-surface text-body font-medium hover:border-muted transition-colors duration-fast", className)}>
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
    </label>
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn("h-9 px-3 rounded-ctl border border-line-strong bg-surface text-body placeholder:text-muted focus:border-brand-ink outline-none transition-colors duration-fast", className)} />;
}

export function Field({ label, required, hint, error, children, htmlFor }: { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-chip font-medium mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error ? <p className="text-sub text-danger mt-1" role="alert">{error}</p> : hint ? <p className="text-sub text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

/* ─────────── Switch ─────────── */
export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; className?: string }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("flex items-center gap-2 text-chip text-ink rounded-ctl px-1 py-1 shrink-0", className)}>
      <span className="switch" aria-hidden="true" />
      <span className="text-left leading-4">{label}</span>
    </button>
  );
}

/* ─────────── Segmented tabs ─────────── */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="h-9 p-0.5 rounded-ctl bg-group inline-flex items-center gap-0.5 shrink-0">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-8 px-3 rounded-[5px] text-chip whitespace-nowrap transition-colors duration-fast",
            value === o.value ? "bg-surface text-ink font-semibold shadow-[0_1px_2px_rgba(16,24,40,.08)]" : "text-muted hover:text-ink font-medium")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div role="tablist" className="flex items-end gap-1 border-b border-line px-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={cn("relative h-11 px-3 text-body whitespace-nowrap flex items-center gap-1.5 transition-colors duration-fast", on ? "font-semibold text-ink" : "text-muted hover:text-ink")}>
            {o.label}
            {o.count != null && <span className={cn("h-[18px] min-w-[18px] px-1.5 rounded-pill text-tag font-semibold grid place-items-center", on ? "bg-brand-soft text-brand-ink" : "bg-group text-muted")}>{o.count}</span>}
            {on && <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────── Pills ─────────── */
export type Tone = "open" | "closed" | "locked" | "empty" | "warn" | "adjust" | "support" | "brand" | "neutral" | "danger";
const TONE: Record<Tone, string> = {
  open: "bg-open-bg text-open-ink", closed: "bg-closed-bg text-closed-ink", locked: "bg-locked-bg text-locked-ink",
  empty: "bg-empty-bg text-empty-ink", warn: "bg-warn-bg text-warn-ink", adjust: "bg-adjust-bg text-adjust-ink",
  support: "bg-support-bg text-support-ink", brand: "bg-brand-soft text-brand-ink", neutral: "bg-group text-ink",
  danger: "bg-danger-bg text-danger",
};
export function Pill({ tone = "neutral", icon: Icon, children, className, size = "md", ...p }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; size?: "sm" | "md" } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...p} className={cn("rounded-pill inline-flex items-center gap-1 font-semibold whitespace-nowrap", size === "md" ? "h-6 px-2.5 text-sub" : "h-[18px] px-1.5 text-tag", TONE[tone], className)}>
      {Icon && <Icon className={size === "md" ? "w-3.5 h-3.5" : "w-3 h-3"} />}
      {children}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("h-[18px] px-1.5 rounded-pill bg-group text-tag font-semibold text-ink shrink-0 inline-flex items-center", className)}>{children}</span>;
}

/* ─────────── Stat tile ─────────── */
export function Stat({ label, value, unit, sub, tone, icon: Icon }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: "up" | "down" | "warn"; icon?: LucideIcon }) {
  return (
    <Card className="p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 text-chip text-muted">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] leading-8 font-semibold">{value}</span>
        {unit && <span className="text-chip text-muted">{unit}</span>}
      </div>
      {sub && <div className={cn("text-sub", tone === "up" ? "text-closed-ink" : tone === "down" ? "text-danger" : tone === "warn" ? "text-warn-ink" : "text-muted")}>{sub}</div>}
    </Card>
  );
}

export function Progress({ value, className, tone = "success" }: { value: number; className?: string; tone?: "success" | "brand" | "warn" }) {
  return (
    <span className={cn("block h-1.5 rounded-pill bg-group overflow-hidden", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className={cn("block h-full rounded-pill transition-[width] duration-300", tone === "success" ? "bg-success" : tone === "brand" ? "bg-brand" : "bg-warn-bar")} style={{ width: `${Math.min(100, value)}%` }} />
    </span>
  );
}

/* ─────────── Empty state ─────────── */
export function EmptyState({ icon: Icon, title, sub, action }: { icon: LucideIcon; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      <Icon className="w-10 h-10 text-muted" />
      <p className="text-body text-ink font-medium">{title}</p>
      {sub && <p className="text-sub text-muted max-w-sm">{sub}</p>}
      {action}
    </div>
  );
}

/* ─────────── Hooks ─────────── */
export function useOutside(ref: RefObject<HTMLElement | null>, onOut: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onOut(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [ref, onOut, active]);
}

/* ─────────── Dropdown menu ─────────── */
/** Menu thả xuống — vị trí fixed theo nút bấm để không bị cắt trong vùng cuộn (bảng); tự lật lên khi sát đáy */
export function Menu({ trigger, children, align = "right", width = "w-56" }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutside(ref, close, open);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = ref.current?.getBoundingClientRect(), m = menuRef.current;
      if (!a || !m) return;
      const h = m.offsetHeight, w = m.offsetWidth;
      const top = a.bottom + 6 + h > innerHeight - 8 ? Math.max(8, a.top - h - 6) : a.bottom + 6;
      const left = align === "right" ? Math.max(8, a.right - w) : Math.min(a.left, innerWidth - w - 8);
      m.style.top = top + "px"; m.style.left = left + "px";
    };
    place();
    document.addEventListener("scroll", close, true);
    addEventListener("resize", place);
    return () => { document.removeEventListener("scroll", close, true); removeEventListener("resize", place); };
  }, [open, align, close]);
  return (
    <div className="relative" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div ref={menuRef} role="menu" className={cn("pop-in fixed bg-surface border border-line rounded-card shadow-pop p-1 z-[60]", width)}>
          {children(close)}
        </div>
      )}
    </div>
  );
}
export function MenuItem({ icon: Icon, children, onClick, danger, active }: { icon?: LucideIcon; children: ReactNode; onClick?: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick}
      className={cn("w-full min-h-9 px-3 py-1.5 flex items-center gap-2.5 rounded-ctl text-body text-left hover:bg-hover", danger && "text-danger", active && "bg-brand-soft font-semibold")}>
      {Icon && <Icon className={cn("w-4 h-4", !danger && "text-muted")} />}
      {children}
    </button>
  );
}
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pt-2 pb-1 text-tag font-semibold uppercase tracking-[0.06em] text-muted">{children}</div>;
}

/* ─────────── Modal ─────────── */
export function Modal({ open, onClose, title, children, footer, width }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input,textarea,select,button[data-autofocus]")?.focus(), 30);
    return () => { document.removeEventListener("keydown", k); clearTimeout(t); };
  }, [open, onClose]);
  return (
    <div className={cn("overlay fade fixed inset-0 z-50 grid place-items-center p-4", open && "open")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" className="pop-in bg-surface rounded-card shadow-pop w-full max-h-[calc(100vh-32px)] flex flex-col" style={{ maxWidth: width ?? "var(--modal-w)" }}>
          <div className="px-5 pt-5 pb-1 flex items-start gap-3">
            <h2 className="text-h font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Đóng" className="ml-auto -mt-1.5 -mr-2 w-9 h-9 grid place-items-center rounded-ctl hover:bg-hover text-muted"><X className="w-[18px] h-[18px]" /></button>
          </div>
          <div className="px-5 pb-5 pt-2 overflow-y-auto scroll-area">{children}</div>
          {footer && <div className="px-5 pb-5 flex justify-end gap-2">{footer}</div>}
        </div>
      )}
    </div>
  );
}

/* ─────────── Drawer ─────────── */
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <>
      <div className={cn("overlay fade fixed inset-0 z-40", open && "open")} onClick={onClose} />
      <aside className={cn("drawer fixed top-0 right-0 bottom-0 z-50 bg-surface shadow-pop flex flex-col", open && "open")} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div className="h-header px-4 flex items-center border-b border-line shrink-0">
          <h2 className="text-h font-semibold">{title}</h2>
          <button onClick={onClose} className="ml-auto w-9 h-9 grid place-items-center rounded-ctl hover:bg-hover text-muted" aria-label="Đóng"><X className="w-[18px] h-[18px]" /></button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-area p-4">{open && children}</div>
        {footer && open && <div className="border-t border-line p-4 flex justify-end gap-2">{footer}</div>}
      </aside>
    </>
  );
}

/* ─────────── Chip radio (lý do) ─────────── */
export function ReasonChips({ name, reasons, value, onChange }: { name: string; reasons: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="text-chip font-medium mb-1.5">Lý do <span className="text-danger">*</span></legend>
      <div role="radiogroup" className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <label key={r} className="chip-radio cursor-pointer">
            <input type="radio" name={name} value={r} checked={value === r} onChange={() => onChange(r)} className="sr-only" />
            <span className="inline-flex items-center h-8 px-3 rounded-pill border border-line-strong bg-surface text-chip font-medium hover:bg-hover transition-colors duration-fast">{r}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-1 border border-line rounded text-tag">{children}</kbd>;
}

export function Avatar({ text, size = 32, className }: { text: string; size?: number; className?: string }) {
  return (
    <span className={cn("rounded-full bg-brand-soft text-brand-ink grid place-items-center font-semibold shrink-0", className)} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {text}
    </span>
  );
}
