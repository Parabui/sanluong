/**
 * Component tĩnh — chép từ ui-demo/src/components/ui/primitives.tsx, GIỮ NGUYÊN class/kích thước [TDD 14.1].
 * Component tương tác (Modal, Drawer, Menu) dựng lại trên Radix ở overlay.tsx / menu.tsx.
 */
import { ChevronDown, type LucideIcon } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';
import { cn } from './cn.js';

/* ─────────── Button ─────────── */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand hover:bg-brand-hover text-ink font-semibold',
  secondary: 'border border-line-strong bg-surface hover:bg-hover text-ink font-medium',
  ghost: 'text-muted hover:bg-hover hover:text-ink font-medium',
  danger: 'bg-danger hover:brightness-110 text-ondark font-semibold',
  subtle: 'bg-group hover:bg-line text-ink font-medium',
};
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  /** Đang gửi: hiện vòng xoay thay icon và khóa nút */
  busy?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, busy, className, children, disabled, type = 'button', ...p },
  ref,
) {
  const iconCls = size === 'md' ? 'w-[18px] h-[18px]' : 'w-4 h-4';
  return (
    <button
      ref={ref}
      type={type}
      {...p}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-ctl whitespace-nowrap transition-colors duration-fast',
        'disabled:bg-disabled-bg disabled:text-disabled-ink disabled:border-transparent disabled:cursor-not-allowed',
        size === 'md' ? 'h-9 px-4 text-body' : 'h-8 px-3 text-chip',
        BTN[variant],
        className,
      )}
    >
      {busy ? <span className={cn('spin rounded-full border-2 border-current border-t-transparent', iconCls)} /> : Icon && <Icon className={iconCls} />}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }
>(function IconButton({ icon: Icon, label, className, type = 'button', ...p }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      {...p}
      aria-label={label}
      data-tip={label}
      className={cn('w-9 h-9 grid place-items-center rounded-ctl text-muted hover:bg-hover hover:text-ink transition-colors duration-fast', className)}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
});

/* ─────────── Card / section ─────────── */
export function Card({ className, children, ...p }: HTMLAttributes<HTMLElement>) {
  return <section {...p} className={cn('bg-surface border border-line rounded-card', className)}>{children}</section>;
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
    <section className="bg-surface border border-line rounded-card px-4 flex items-center gap-2.5 shrink-0 min-w-0" style={{ height: 'var(--toolbar-h)' }} aria-label="Bộ lọc">
      <h1 className="text-title font-semibold whitespace-nowrap">{title}</h1>
      {children}
      {right && <div className="ml-auto shrink-0 flex items-center gap-2">{right}</div>}
    </section>
  );
}

/** Vùng nội dung chuẩn: padding 20, gap 16, max 1440 */
export function Page({ children, className, scroll = false }: { children: ReactNode; className?: string; scroll?: boolean }) {
  return (
    <div className={cn('flex-1 min-h-0 flex flex-col', scroll && 'overflow-y-auto scroll-area')} style={{ padding: 'var(--content-pad)' }}>
      <div className={cn('page-in w-full mx-auto flex flex-col', !scroll && 'flex-1 min-h-0', className)} style={{ maxWidth: 'var(--table-max)', gap: 'var(--block-gap)' }}>
        {children}
      </div>
    </div>
  );
}

/** Thanh trạng thái dưới — cao 40px */
export function StatusBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <footer className="bg-surface border-t border-line px-4 flex items-center gap-4 text-sub text-muted shrink-0" style={{ height: 'var(--statusbar-h)' }}>
      {children}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </footer>
  );
}

/* ─────────── Select / Input / Field ─────────── */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label: string }>(function Select(
  { className, children, label, ...p },
  ref,
) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        ref={ref}
        {...p}
        className={cn('native h-9 pl-3 pr-8 rounded-ctl border border-line-strong bg-surface text-body font-medium hover:border-muted transition-colors duration-fast', className)}
      >
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
    </label>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return (
    <input
      ref={ref}
      {...p}
      className={cn(
        'h-9 px-3 rounded-ctl border border-line-strong bg-surface text-body placeholder:text-muted focus:border-brand-ink outline-none transition-colors duration-fast',
        p['aria-invalid'] && 'border-danger',
        className,
      )}
    />
  );
});

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
export function Switch({ checked, onChange, label, className, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn('flex items-center gap-2 text-chip text-ink rounded-ctl px-1 py-1 shrink-0 disabled:opacity-50', className)}>
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
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-8 px-3 rounded-[5px] text-chip whitespace-nowrap transition-colors duration-fast',
            value === o.value ? 'bg-surface text-ink font-semibold shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted hover:text-ink font-medium')}>
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
          <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
            className={cn('relative h-11 px-3 text-body whitespace-nowrap flex items-center gap-1.5 transition-colors duration-fast', on ? 'font-semibold text-ink' : 'text-muted hover:text-ink')}>
            {o.label}
            {o.count != null && <span className={cn('h-[18px] min-w-[18px] px-1.5 rounded-pill text-tag font-semibold grid place-items-center', on ? 'bg-brand-soft text-brand-ink' : 'bg-group text-muted')}>{o.count}</span>}
            {on && <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────── Pills ─────────── */
export type Tone = 'open' | 'closed' | 'locked' | 'empty' | 'warn' | 'adjust' | 'support' | 'brand' | 'neutral' | 'danger';
const TONE: Record<Tone, string> = {
  open: 'bg-open-bg text-open-ink', closed: 'bg-closed-bg text-closed-ink', locked: 'bg-locked-bg text-locked-ink',
  empty: 'bg-empty-bg text-empty-ink', warn: 'bg-warn-bg text-warn-ink', adjust: 'bg-adjust-bg text-adjust-ink',
  support: 'bg-support-bg text-support-ink', brand: 'bg-brand-soft text-brand-ink', neutral: 'bg-group text-ink',
  danger: 'bg-danger-bg text-danger',
};
export function Pill({ tone = 'neutral', icon: Icon, children, className, size = 'md', ...p }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; size?: 'sm' | 'md' } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...p} className={cn('rounded-pill inline-flex items-center gap-1 font-semibold whitespace-nowrap', size === 'md' ? 'h-6 px-2.5 text-sub' : 'h-[18px] px-1.5 text-tag', TONE[tone], className)}>
      {Icon && <Icon className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />}
      {children}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('h-[18px] px-1.5 rounded-pill bg-group text-tag font-semibold text-ink shrink-0 inline-flex items-center', className)}>{children}</span>;
}

/* ─────────── Stat tile ─────────── */
export function Stat({ label, value, unit, sub, tone, icon: Icon }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: 'up' | 'down' | 'warn'; icon?: LucideIcon }) {
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
      {sub && <div className={cn('text-sub', tone === 'up' ? 'text-closed-ink' : tone === 'down' ? 'text-danger' : tone === 'warn' ? 'text-warn-ink' : 'text-muted')}>{sub}</div>}
    </Card>
  );
}

export function Progress({ value, className, tone = 'success' }: { value: number; className?: string; tone?: 'success' | 'brand' | 'warn' }) {
  return (
    <span className={cn('block h-1.5 rounded-pill bg-group overflow-hidden', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className={cn('block h-full rounded-pill transition-[width] duration-300', tone === 'success' ? 'bg-success' : tone === 'brand' ? 'bg-brand' : 'bg-warn-bar')} style={{ width: `${Math.min(100, value)}%` }} />
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

/* ─────────── Chip radio (lý do) — Enter KHÔNG tự chọn lý do ─────────── */
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
    <span className={cn('rounded-full bg-brand-soft text-brand-ink grid place-items-center font-semibold shrink-0', className)} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {text}
    </span>
  );
}

/** "Nguyễn Văn Bình" → "NB" */
export const chuCaiDau = (hoTen: string) => {
  const p = hoTen.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? (p[p.length - 1]?.[0] ?? '') : '')).toUpperCase();
};
