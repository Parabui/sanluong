/**
 * Khung ứng dụng Web — chép từ ui-demo/src/components/shell/app-shell.tsx (sidebar 232px, header 56px, breadcrumb,
 * ô tìm kiếm "/", trạng thái kết nối, menu tài khoản). Khác demo: menu lọc theo ChucNang thật của tài khoản,
 * bỏ bộ chuyển vai trò demo và các số liệu giả (badge). "Còn X ngày chưa chốt" lấy từ GET /api/chot-ngay/chua-chot [F10].
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TEN_VAI_TRO, zKhongNoiDung } from '@vsn/shared';
import { Avatar, chuCaiDau, cn, EmptyState, Menu, MenuItem, MenuLabel, MenuSeparator } from '@vsn/ui';
import { ChevronDown, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, Search, ShieldOff, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useMediaQuery, useOnline } from '../lib/hooks';
import { coChucNang, useToi } from '../lib/xac-thuc';
import { NgayChuaChot } from './ngay-chua-chot';
import { duocXem, NAV, timNav } from '../nav';
import { ShellContext } from './shell-context';

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tk = useToi();
  const online = useOnline();
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // tự thu gọn sidebar khi màn hình < 1280px; bấm tay chỉ có hiệu lực trong cùng khoảng màn hình
  const narrow = useMediaQuery('(max-width: 1279px)');
  const [manual, setManual] = useState<{ at: boolean; v: boolean } | null>(null);
  const collapsed = manual && manual.at === narrow ? manual.v : narrow;
  const toggleCollapsed = () => setManual({ at: narrow, v: !collapsed });

  // đổi trang → xóa tìm kiếm (điều chỉnh state ngay khi render)
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setQ('');
  }

  // phím "/" → ô tìm kiếm
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !t.matches('input,textarea,select') && !e.ctrlKey && !e.metaKey && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  const dangXuat = useMutation({
    mutationFn: () => api.goi('/auth/dang-xuat', { method: 'POST', schema: zKhongNoiDung }),
    onSettled: () => {
      queryClient.clear();
      void navigate('/dang-nhap', { replace: true });
    },
  });

  const cur = timNav(pathname);
  const allowed = !cur || duocXem(cur.item, tk.chucNang);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => duocXem(i, tk.chucNang)) })).filter((g) => g.items.length);

  return (
    <ShellContext.Provider value={{ q, setQ, online }}>
      <div className={cn('app-shell', collapsed && 'collapsed')}>
        {/* ═════════════ A. SIDEBAR ═════════════ */}
        <aside className="bg-surface border-r border-line flex flex-col min-h-0" aria-label="Điều hướng chính">
          <Link to="/trang-chu" className="brand-row h-header flex items-center gap-2.5 px-4 border-b border-line shrink-0">
            <div className="w-8 h-8 rounded-ctl bg-brand text-ink grid place-items-center text-body font-bold shrink-0" aria-hidden="true">VS</div>
            <div className="hide-collapsed leading-tight min-w-0">
              <div className="text-[15px] font-bold text-ink whitespace-nowrap">VSN Sản Lượng</div>
              <div className="text-tag text-brand-gray whitespace-nowrap">VIETSUN Đồng Nai</div>
            </div>
          </Link>

          <nav className="flex-1 overflow-y-auto scroll-area px-2 py-3">
            {nav.map((g, gi) => (
              <div key={gi} className={cn('nav-group', gi && 'mt-4')}>
                {g.title && <div className="hide-collapsed h-7 px-3 flex items-center text-tag font-semibold uppercase tracking-[0.06em] text-muted">{g.title}</div>}
                <ul className="flex flex-col gap-0.5">
                  {g.items.map((it) => {
                    const active = pathname === it.href;
                    const Icon = it.icon;
                    return (
                      <li key={it.href}>
                        <Link to={it.href} aria-current={active ? 'page' : undefined} data-tip={it.label} data-tip-when="collapsed"
                          className={cn('nav-item relative h-9 px-3 flex items-center gap-3 rounded-ctl text-body font-medium transition-colors duration-fast',
                            active ? 'bg-brand-soft text-brand-ink font-semibold' : 'text-ink hover:bg-hover')}>
                          <Icon className={cn('w-[18px] h-[18px]', !active && 'text-muted')} />
                          <span className="hide-collapsed truncate">{it.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-line px-2 py-2 shrink-0">
            <button type="button" onClick={toggleCollapsed} data-tip="Mở rộng" data-tip-when="collapsed"
              className="nav-item relative w-full h-9 px-3 flex items-center gap-3 rounded-ctl text-body font-medium text-muted hover:bg-hover transition-colors duration-fast"
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} aria-expanded={!collapsed}>
              {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
              <span className="hide-collapsed">Thu gọn</span>
            </button>
            <p className="hide-collapsed px-3 pt-2 text-tag text-muted">v{__APP_VERSION__} · © VIETSUN Đồng Nai</p>
          </div>
        </aside>

        {/* ═════════════ B. HEADER ═════════════ */}
        <header className="bg-surface border-b border-line px-5 flex items-center gap-3 min-w-0 relative z-30">
          <nav aria-label="Breadcrumb" className="text-body min-w-0 truncate">
            {cur?.group && (<><span className="text-muted">{cur.group}</span><span className="text-line-strong mx-1.5">/</span></>)}
            <span className="text-ink font-medium" aria-current="page">{cur?.item.label ?? 'Không tìm thấy trang'}</span>
          </nav>

          {cur?.item.search && allowed && (
            <label className="relative ml-6 shrink-0 hidden lg:block">
              <span className="sr-only">{cur.item.search}</span>
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5 pointer-events-none" />
              <input ref={searchRef} type="search" autoComplete="off" placeholder={cur.item.search} value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }}
                className="w-64 h-9 pl-9 pr-8 rounded-ctl bg-page border border-line text-chip placeholder:text-muted focus:bg-surface focus:border-line-strong outline-none transition-colors duration-fast" />
              {!q && <kbd className="absolute right-2 top-2 h-5 px-1.5 rounded border border-line bg-surface text-tag text-muted grid place-items-center pointer-events-none">/</kbd>}
            </label>
          )}

          <div className="ml-auto flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-sub text-muted" role="status">
              <span className={cn('w-2 h-2 rounded-full', online ? 'bg-success' : 'bg-danger')} />
              {online ? 'Đã kết nối' : 'Mất kết nối'}
            </div>

            {coChucNang(tk, 'CHOT_NGAY') && <NgayChuaChot />}

            <span className="w-px h-6 bg-line" aria-hidden="true" />

            <Menu width="w-64" trigger={
              <button type="button" className="flex items-center gap-2.5 rounded-ctl pl-1 pr-2 py-1 hover:bg-hover transition-colors duration-fast">
                <Avatar text={chuCaiDau(tk.hoTen)} className="text-chip" />
                <span className="text-left leading-tight">
                  <span className="block text-chip font-semibold text-ink">{tk.hoTen}</span>
                  <span className="block text-sub text-muted">{TEN_VAI_TRO[tk.vaiTro]} · {tk.tenPhamVi}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-muted" />
              </button>
            }>
              <MenuLabel>{tk.tenDangNhap}</MenuLabel>
              <MenuItem icon={KeyRound} onSelect={() => void navigate('/doi-mat-khau')}>Đổi mật khẩu</MenuItem>
              <MenuSeparator />
              <MenuItem icon={LogOut} danger disabled={dangXuat.isPending} onSelect={() => dangXuat.mutate()}>Đăng xuất</MenuItem>
            </Menu>
          </div>
        </header>

        {/* ═════════════ C. VÙNG NỘI DUNG ═════════════ */}
        <main className="flex flex-col min-h-0 min-w-0">
          {!online && (
            <div className="h-8 shrink-0 bg-danger text-ondark text-chip font-medium flex items-center justify-center gap-2" role="alert">
              <WifiOff className="w-4 h-4" />Mất kết nối — thay đổi chưa được lưu lên máy chủ. Đang thử kết nối lại…
            </div>
          )}
          {allowed ? <Outlet /> : (
            <div className="flex-1 grid place-items-center">
              <EmptyState icon={ShieldOff} title="Không có quyền truy cập"
                sub={`Tài khoản của bạn không được dùng chức năng “${cur?.item.label}”.`}
                action={<Link to="/trang-chu" className="mt-2 h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink font-semibold text-body inline-flex items-center">Về Trang chủ</Link>} />
            </div>
          )}
        </main>
      </div>
    </ShellContext.Provider>
  );
}
