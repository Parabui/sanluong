import { ArrowUpRight, KeyRound, LogIn, Monitor, Smartphone, Tv } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NAV } from "@/lib/nav";

export const metadata: Metadata = { title: "Tất cả màn hình" };

const APP = [
  { href: "/app/huong-dan", label: "Hướng dẫn lần đầu", f: "F18" },
  { href: "/app/chon-tram", label: "Chọn trạm / quét QR", f: "F1, F12" },
  { href: "/app/dang-nhap", label: "Đăng nhập mã NV", f: "F1" },
  { href: "/app/nhap", label: "Nhập sản lượng", f: "F1, F14" },
  { href: "/app/cua-toi", label: "Của tôi — 30 ngày", f: "F11" },
  { href: "/app/cua-toi/2026-09-28", label: "Chi tiết một ngày", f: "F11" },
  { href: "/app/gio-lam", label: "Giờ làm", f: "F6" },
];

function Tile({ href, label, sub, first }: { href: string; label: string; sub?: string; first?: boolean }) {
  return (
    <Link href={href} className="group h-14 px-4 rounded-card border border-line bg-surface hover:border-brand hover:shadow-pop flex items-center gap-3 transition duration-fast">
      <div className="min-w-0">
        <div className="text-body font-medium truncate flex items-center gap-2">{label}{first && <span className="h-[18px] px-1.5 rounded-pill bg-brand-soft text-brand-ink text-tag font-semibold">Màn đầu tiên</span>}</div>
        {sub && <div className="text-sub text-muted truncate font-mono">{sub}</div>}
      </div>
      <ArrowUpRight className="w-4 h-4 text-muted ml-auto group-hover:text-brand-ink transition-colors duration-fast" />
    </Link>
  );
}

export default function ScreensPage() {
  return (
    <div className="min-h-screen bg-page">
      <div className="page-in max-w-[1200px] mx-auto px-5 py-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-ctl bg-brand text-ink grid place-items-center font-bold">VS</div>
          <div>
            <h1 className="text-[24px] leading-8 font-semibold">VSN Sản Lượng — tất cả màn hình</h1>
            <p className="text-body text-muted">Bản demo giao diện theo PRD v2 · giả lập 09:15 Thứ 3, 29/09/2026 · chưa có logic thật</p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-h font-semibold flex items-center gap-2"><Monitor className="w-5 h-5 text-muted" />Web quản lý <span className="text-sub text-muted font-normal">· tối thiểu 1366×768</span></h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Tile href="/dang-nhap" label="Đăng nhập" sub="/dang-nhap" />
            <Tile href="/doi-mat-khau" label="Đổi mật khẩu" sub="/doi-mat-khau" />
            {NAV.flatMap((g) => g.items.map((it) => (
              <Tile key={it.href} href={it.href} label={`${g.title ? g.title + " · " : ""}${it.label}`} sub={it.href} first={it.href === "/san-xuat/bang-san-luong"} />
            )))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-h font-semibold flex items-center gap-2"><Smartphone className="w-5 h-5 text-muted" />App công nhân <span className="text-sub text-muted font-normal">· PWA điện thoại</span></h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {APP.map((a) => <Tile key={a.href} href={a.href} label={`${a.label} · ${a.f}`} sub={a.href} />)}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-h font-semibold flex items-center gap-2"><Tv className="w-5 h-5 text-muted" />TV tại xưởng <span className="text-sub text-muted font-normal">· 1920×1080</span></h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Tile href="/tv" label="Dashboard toàn màn hình · F7" sub="/tv" />
          </div>
        </section>

        <p className="mt-10 text-sub text-muted flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5" />Đổi vai trò demo ở menu tài khoản (góc trên phải) để xem menu theo phân quyền</span>
          <span className="inline-flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />Phím tắt: / tìm · N ô cần xử lý kế tiếp</span>
        </p>
      </div>
    </div>
  );
}
