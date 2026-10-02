"use client";

import { ArrowLeft, Monitor } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SCENARIOS, useWorker, WorkerProvider } from "@/components/mobile/store";
import { PhoneToasts } from "@/components/mobile/ui";
import { cn } from "@/lib/utils";

const SCREENS = [
  { href: "/app/huong-dan", label: "Hướng dẫn lần đầu", f: "F18" },
  { href: "/app/chon-tram", label: "Chọn trạm / quét QR", f: "F1 · F12" },
  { href: "/app/dang-nhap", label: "Đăng nhập mã NV", f: "F1" },
  { href: "/app/nhap", label: "Nhập sản lượng", f: "F1 · F14" },
  { href: "/app/cua-toi", label: "Của tôi — 30 ngày", f: "F11" },
  { href: "/app/gio-lam", label: "Giờ làm", f: "F6" },
];

function DemoPanel() {
  const path = usePathname();
  const { scenario, setScenario } = useWorker();
  return (
    <aside className="demo-panel w-[340px] self-center bg-surface border border-line rounded-card p-5 text-[14px]">
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">App công nhân · PWA</div>
      <h1 className="text-[20px] font-semibold leading-tight mt-1">VSN Sản Lượng</h1>
      <p className="text-[13px] text-muted mt-1">Giả lập 09:15 Thứ 3, 29/09/2026 · C05 · Phạm Thị Mai (NV00127)</p>

      <h2 className="text-[13px] font-semibold mt-5 mb-2">Màn hình</h2>
      <nav className="flex flex-col gap-1">
        {SCREENS.map((s) => {
          const on = path === s.href || (s.href === "/app/cua-toi" && path.startsWith("/app/cua-toi"));
          return (
            <Link key={s.href} href={s.href} aria-current={on ? "page" : undefined}
              className={cn("h-10 px-3 rounded-ctl flex items-center gap-2 transition-colors duration-fast", on ? "bg-brand-soft text-brand-ink font-semibold" : "hover:bg-hover")}>
              {s.label}<span className="ml-auto text-[12px] text-muted font-normal">{s.f}</span>
            </Link>
          );
        })}
      </nav>

      <h2 className="text-[13px] font-semibold mt-5 mb-2">Kịch bản màn Nhập</h2>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Kịch bản demo">
        {SCENARIOS.map(([k, label, sub]) => (
          <button key={k} role="radio" aria-checked={scenario === k} onClick={() => setScenario(k)}
            className={cn("text-left rounded-ctl border px-3 py-2 transition-colors duration-fast", scenario === k ? "border-brand bg-brand-soft" : "border-line hover:bg-hover")}>
            <div className="font-medium">{label}</div><div className="text-[12px] text-muted">{sub}</div>
          </button>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-line flex flex-col gap-1.5 text-[13px]">
        <Link href="/san-xuat/bang-san-luong" className="inline-flex items-center gap-1.5 text-muted hover:text-ink"><Monitor className="w-4 h-4" />Xem số trên Web (Bảng sản lượng ngày)</Link>
        <Link href="/man-hinh" className="inline-flex items-center gap-1.5 text-muted hover:text-ink"><ArrowLeft className="w-4 h-4" />Tất cả màn hình</Link>
      </div>
    </aside>
  );
}

export default function WorkerAppLayout({ children }: { children: ReactNode }) {
  return (
    <WorkerProvider>
      <div className="stage mobile bg-page">
        <div className="phone">
          <div className="phone-app">{children}</div>
          <PhoneToasts />
        </div>
        <DemoPanel />
      </div>
    </WorkerProvider>
  );
}
