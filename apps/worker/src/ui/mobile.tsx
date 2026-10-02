/**
 * Thành phần giao diện app công nhân — chép từ ui-demo/src/components/mobile/ui.tsx (app bar, thanh dưới, bottom sheet,
 * nút 48px, toast). Dữ liệu demo (ME, LEADER) thay bằng dữ liệu thật từ GET /api/cn/khoi-dong.
 */
import { cn } from '@vsn/ui';
import { ChevronLeft, CircleAlert, CircleCheck, Clock, EllipsisVertical, PencilLine, UserRound, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useOnline } from '../lib/hooks';

const chuCaiDau = (hoTen: string) => {
  const p = hoTen.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? (p.at(-1)?.[0] ?? '') : '')).toUpperCase();
};

/** App bar sau đăng nhập: người dùng + trạng thái kết nối */
export function WorkerBar({ nhanVien, onMenu, children }: { nhanVien: { maNV: string; hoTen: string; maChuyen: string } | null; onMenu?: () => void; children?: ReactNode }) {
  const online = useOnline();
  return (
    <header className="bg-surface shrink-0 z-20" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center gap-3 px-4" style={{ height: 'var(--appbar-h)' }}>
        <span className="w-10 h-10 rounded-full bg-brand-soft text-brand-ink grid place-items-center text-[15px] font-semibold shrink-0" aria-hidden="true">{nhanVien ? chuCaiDau(nhanVien.hoTen) : '?'}</span>
        <div className="min-w-0 leading-tight">
          <div className="text-[16px] font-semibold truncate">{nhanVien?.hoTen ?? 'VSN Sản Lượng'}</div>
          {nhanVien && <div className="text-[13px] text-muted whitespace-nowrap"><span className="font-mono">{nhanVien.maNV}</span> · {nhanVien.maChuyen}</div>}
        </div>
        <span role="status" className={cn('ml-auto h-7 px-2.5 rounded-pill text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0', online ? 'bg-closed-bg text-closed-ink' : 'bg-danger-bg text-danger')}>
          <span className={cn('w-2 h-2 rounded-full', online ? 'bg-success' : 'bg-danger')} />{online ? 'Trực tuyến' : 'Mất mạng'}
        </span>
        {onMenu && <button type="button" onClick={onMenu} className="w-11 h-11 -mr-2 grid place-items-center rounded-full hover:bg-hover" aria-label="Tùy chọn" aria-haspopup="dialog"><EllipsisVertical className="w-5 h-5" /></button>}
      </div>
      {children}
    </header>
  );
}

/** App bar đơn giản cho màn trước đăng nhập */
export function TopBar({ title, back }: { title: string; back?: string }) {
  const navigate = useNavigate();
  return (
    <header className="bg-surface border-b border-line shrink-0 flex items-center gap-1 px-2" style={{ height: 'var(--appbar-h)', paddingTop: 'env(safe-area-inset-top)' }}>
      {back ? <button type="button" onClick={() => void navigate(back)} className="w-11 h-11 grid place-items-center rounded-full hover:bg-hover" aria-label="Quay lại"><ChevronLeft className="w-6 h-6" /></button> : <span className="w-3" />}
      <h1 className="text-[18px] font-semibold">{title}</h1>
    </header>
  );
}

const NAV = [
  { href: '/nhap', label: 'Nhập', icon: PencilLine },
  { href: '/cua-toi', label: 'Của tôi', icon: UserRound },
  { href: '/gio-lam', label: 'Giờ làm', icon: Clock },
];
export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="shrink-0 bg-surface border-t border-line safe-b z-20" aria-label="Điều hướng">
      <div className="grid grid-cols-3" style={{ height: 'var(--nav-h)' }}>
        {NAV.map((n) => {
          const on = pathname === n.href || (n.href !== '/nhap' && pathname.startsWith(n.href));
          const I = n.icon;
          return (
            <Link key={n.href} to={n.href} aria-current={on ? 'page' : undefined}
              className={cn('flex flex-col items-center justify-center gap-0.5 text-[12px] transition-colors duration-fast', on ? 'text-brand-ink font-semibold' : 'text-muted hover:text-ink')}>
              <span className={cn('w-16 h-8 rounded-pill grid place-items-center transition-colors duration-fast', on && 'bg-brand-soft')}><I className="w-[22px] h-[22px]" /></span>
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Bottom sheet */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <>
      <div className={cn('veil', open && 'open')} onClick={onClose} />
      <section className={cn('sheet shadow-pop', open && 'open')} role="dialog" aria-modal="true" aria-hidden={!open}>
        <div className="pt-2 pb-1 grid place-items-center"><span className="w-10 h-1 rounded-full bg-line-strong" /></div>
        <div className="px-5 pb-2 flex items-center gap-2">
          <h2 className="text-[18px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="ml-auto w-11 h-11 -mr-3 grid place-items-center rounded-full hover:bg-hover text-muted" aria-label="Đóng"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto no-scrollbar">{open && children}</div>
        {footer && <div className="px-5 pb-5 pt-1 flex gap-2 safe-b">{footer}</div>}
      </section>
    </>
  );
}

/** Nút lớn chuẩn App (cao 48px) */
export function BigButton({ children, variant = 'primary', className, type = 'button', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return (
    <button type={type} {...p} className={cn('h-12 px-5 rounded-ctl text-[16px] font-semibold flex items-center justify-center gap-2 transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink disabled:border-transparent disabled:cursor-not-allowed',
      variant === 'primary' ? 'bg-brand hover:bg-brand-hover text-ink' : variant === 'danger' ? 'bg-danger text-ondark hover:brightness-110' : 'border border-line-strong bg-surface hover:bg-hover text-ink', className)}>
      {children}
    </button>
  );
}

// ── Toast ──
type Toast = { id: number; msg: string; kind: 'ok' | 'err' };
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = ++seq;
    setList((l) => [...l.slice(-1), { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === 'err' ? 4000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="absolute left-4 right-4 z-[60] flex flex-col items-center gap-2 pointer-events-none" style={{ top: 116 }} aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="toast-in min-h-11 px-4 py-2 rounded-card bg-toast text-ondark text-[15px] font-medium flex items-center gap-2 shadow-pop">
            {t.kind === 'ok' ? <CircleCheck className="w-5 h-5 text-closed-bg shrink-0" /> : <CircleAlert className="w-5 h-5 text-warn-bg shrink-0" />}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
