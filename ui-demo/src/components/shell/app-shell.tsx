"use client";

import {
  CalendarClock, ChevronDown, ChevronRight, KeyRound, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen,
  Search, ShieldOff, Smartphone, TriangleAlert, Tv, UserCog, WifiOff,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, EmptyState, Menu, MenuItem, MenuLabel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useMediaQuery, useStored } from "@/lib/hooks";
import { findNav, NAV, ROLES, type Role } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";
import { ShellContext } from "./shell-context";

const PENDING = [
  { line: "C05", date: "2026-09-28", label: "28/09/2026" },
  { line: "C06", date: "2026-09-28", label: "28/09/2026" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [storedRole, storeRole] = useStored("vsn-role", "SA");
  const role: Role = storedRole && storedRole in ROLES ? (storedRole as Role) : "SA";
  const setRole = useCallback((r: Role) => storeRole(r), [storeRole]);
  const [q, setQ] = useState("");
  const [online, setOnline] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  // tự thu gọn sidebar khi màn hình < 1280px; bấm tay chỉ có hiệu lực trong cùng khoảng màn hình
  const narrow = useMediaQuery("(max-width: 1279px)");
  const [manual, setManual] = useState<{ at: boolean; v: boolean } | null>(null);
  const collapsed = manual && manual.at === narrow ? manual.v : narrow;
  const toggleCollapsed = () => setManual({ at: narrow, v: !collapsed });

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener("online", on); addEventListener("offline", off);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);

  // đổi trang → xóa tìm kiếm (điều chỉnh state ngay khi render)
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) { setPrevPath(pathname); setQ(""); }

  // phím "/" → ô tìm kiếm
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !t.matches("input,textarea,select") && !e.ctrlKey && !e.metaKey && searchRef.current) {
        e.preventDefault(); searchRef.current.focus();
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const cur = findNav(pathname);
  const allowed = !cur || cur.item.roles.includes(role);
  const person = ROLES[role];
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
  const showPending = role === "TT" || role === "SA";

  return (
    <ShellContext.Provider value={{ role, setRole, q, setQ, online }}>
      <div className={cn("app-shell", collapsed && "collapsed")}>
        {/* ═════════════ A. SIDEBAR ═════════════ */}
        <aside className="bg-surface border-r border-line flex flex-col min-h-0" aria-label="Điều hướng chính">
          <Link href="/trang-chu" className="brand-row h-header flex items-center gap-2.5 px-4 border-b border-line shrink-0">
            <div className="w-8 h-8 rounded-ctl bg-brand text-ink grid place-items-center text-body font-bold shrink-0" aria-hidden="true">VS</div>
            <div className="hide-collapsed leading-tight min-w-0">
              <div className="text-[15px] font-bold text-ink whitespace-nowrap">VSN Sản Lượng</div>
              <div className="text-tag text-brand-gray whitespace-nowrap">VIETSUN Đồng Nai</div>
            </div>
          </Link>

          <nav className="flex-1 overflow-y-auto scroll-area px-2 py-3">
            {nav.map((g, gi) => (
              <div key={gi} className={cn("nav-group", gi && "mt-4")}>
                {g.title && <div className="hide-collapsed h-7 px-3 flex items-center text-tag font-semibold uppercase tracking-[0.06em] text-muted">{g.title}</div>}
                <ul className="flex flex-col gap-0.5">
                  {g.items.map((it) => {
                    const active = pathname === it.href;
                    const Icon = it.icon;
                    return (
                      <li key={it.href}>
                        <Link href={it.href} aria-current={active ? "page" : undefined} data-tip={it.label} data-tip-when="collapsed"
                          className={cn("nav-item relative h-9 px-3 flex items-center gap-3 rounded-ctl text-body font-medium transition-colors duration-fast",
                            active ? "bg-brand-soft text-brand-ink font-semibold" : "text-ink hover:bg-hover")}>
                          <Icon className={cn("w-[18px] h-[18px]", !active && "text-muted")} />
                          <span className="hide-collapsed truncate">{it.label}</span>
                          {it.badge && (
                            <span className="nav-badge ml-auto h-[18px] min-w-[18px] px-1.5 rounded-pill bg-danger text-ondark text-tag font-semibold grid place-items-center">{it.badge}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-line px-2 py-2 shrink-0">
            <Link href="/man-hinh" data-tip="Tất cả màn hình" data-tip-when="collapsed"
              className="nav-item relative w-full h-9 px-3 flex items-center gap-3 rounded-ctl text-body font-medium text-muted hover:bg-hover transition-colors duration-fast">
              <LayoutGrid className="w-[18px] h-[18px]" />
              <span className="hide-collapsed">Tất cả màn hình</span>
            </Link>
            <button onClick={toggleCollapsed} data-tip="Mở rộng" data-tip-when="collapsed"
              className="nav-item relative w-full h-9 px-3 flex items-center gap-3 rounded-ctl text-body font-medium text-muted hover:bg-hover transition-colors duration-fast"
              aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"} aria-expanded={!collapsed}>
              {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
              <span className="hide-collapsed">Thu gọn</span>
            </button>
            <p className="hide-collapsed px-3 pt-2 text-tag text-muted">v1.0 · © VIETSUN Đồng Nai</p>
          </div>
        </aside>

        {/* ═════════════ B. HEADER ═════════════ */}
        <header className="bg-surface border-b border-line px-5 flex items-center gap-3 min-w-0 relative z-30">
          <nav aria-label="Breadcrumb" className="text-body min-w-0 truncate">
            {cur?.group && (<><span className="text-muted">{cur.group}</span><span className="text-line-strong mx-1.5">/</span></>)}
            <span className="text-ink font-medium" aria-current="page">{cur?.item.label ?? "Tất cả màn hình"}</span>
          </nav>

          {cur?.item.search && allowed && (
            <label className="relative ml-6 shrink-0 hidden lg:block">
              <span className="sr-only">{cur.item.search}</span>
              <Search className="w-4 h-4 text-muted absolute left-3 top-2.5 pointer-events-none" />
              <input ref={searchRef} type="search" autoComplete="off" placeholder={cur.item.search} value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); } }}
                className="w-64 h-9 pl-9 pr-8 rounded-ctl bg-page border border-line text-chip placeholder:text-muted focus:bg-surface focus:border-line-strong outline-none transition-colors duration-fast" />
              {!q && <kbd className="absolute right-2 top-2 h-5 px-1.5 rounded border border-line bg-surface text-tag text-muted grid place-items-center pointer-events-none">/</kbd>}
            </label>
          )}

          <div className="ml-auto flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-sub text-muted" role="status">
              <span className={cn("w-2 h-2 rounded-full", online ? "bg-success" : "bg-danger")} />
              {online ? "Đã kết nối" : "Mất kết nối"}
            </div>

            {showPending && (
              <Menu width="w-60" trigger={(open, toggle) => (
                <button onClick={toggle} aria-haspopup="menu" aria-expanded={open}
                  className="h-8 px-3 rounded-pill bg-empty-bg text-empty-ink text-chip font-semibold flex items-center gap-1.5 hover:brightness-[.98] transition duration-fast">
                  <TriangleAlert className="w-4 h-4" />Còn {PENDING.length} ngày chưa chốt
                </button>
              )}>
                {(close) => (
                  <>
                    <MenuLabel>Ngày chưa chốt</MenuLabel>
                    {PENDING.map((p) => (
                      <MenuItem key={p.line} onClick={() => { close(); router.push(`/san-xuat/bang-san-luong?chuyen=${p.line}&ngay=${p.date}`); }}>
                        <CalendarClock className="w-4 h-4 text-empty-bar" /><span className="font-medium">{p.line}</span><span className="text-muted">·</span>
                        <span className="num">{p.label}</span><ChevronRight className="w-4 h-4 text-muted ml-auto" />
                      </MenuItem>
                    ))}
                  </>
                )}
              </Menu>
            )}

            <span className="w-px h-6 bg-line" aria-hidden="true" />

            <Menu width="w-64" trigger={(open, toggle) => (
              <button onClick={toggle} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2.5 rounded-ctl pl-1 pr-2 py-1 hover:bg-hover transition-colors duration-fast">
                <Avatar text={initials(person.name)} className="text-chip" />
                <span className="text-left leading-tight">
                  <span className="block text-chip font-semibold text-ink">{person.name}</span>
                  <span className="block text-sub text-muted">{ROLES[role].label} · {person.scope}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-muted" />
              </button>
            )}>
              {(close) => (
                <>
                  <MenuLabel>Xem giao diện theo vai trò (demo)</MenuLabel>
                  {(Object.keys(ROLES) as Role[]).map((r) => (
                    <MenuItem key={r} icon={UserCog} active={r === role} onClick={() => { setRole(r); close(); toast(`Đang xem với vai trò ${ROLES[r].label}`, "info"); }}>
                      <span className="flex-1">{ROLES[r].label}</span>
                      <span className="text-sub text-muted">{ROLES[r].scope === "Toàn nhà máy" ? "" : ROLES[r].scope}</span>
                    </MenuItem>
                  ))}
                  <div className="h-px bg-line my-1" />
                  <MenuItem icon={Smartphone} onClick={() => { close(); router.push("/app/nhap"); }}>Mở App công nhân</MenuItem>
                  <MenuItem icon={Tv} onClick={() => { close(); router.push("/tv"); }}>Mở chế độ TV</MenuItem>
                  <div className="h-px bg-line my-1" />
                  <MenuItem icon={KeyRound} onClick={() => { close(); router.push("/doi-mat-khau"); }}>Đổi mật khẩu</MenuItem>
                  <MenuItem icon={LogOut} danger onClick={() => { close(); router.push("/dang-nhap"); }}>Đăng xuất</MenuItem>
                </>
              )}
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
          {allowed ? children : (
            <div className="flex-1 grid place-items-center">
              <EmptyState icon={ShieldOff} title="Không có quyền truy cập"
                sub={`Vai trò ${ROLES[role].label} không được dùng chức năng “${cur?.item.label}”. Đổi vai trò demo ở menu tài khoản góc trên bên phải.`}
                action={<Link href="/trang-chu" className="mt-2 h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink font-semibold text-body inline-flex items-center">Về Trang chủ</Link>} />
            </div>
          )}
        </main>
      </div>
    </ShellContext.Provider>
  );
}

/** Thanh trạng thái dưới — cao 40px */
export function StatusBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <footer className="bg-surface border-t border-line px-4 flex items-center gap-4 text-sub text-muted shrink-0" style={{ height: "var(--statusbar-h)" }}>
      {children}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </footer>
  );
}
