"use client";

import { CircleAlert, Eye, EyeOff, LogIn, Smartphone, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AuthFrame } from "../auth-frame";

export default function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [user, setUser] = useState("tt.binh");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim()) return setErr("Nhập tên đăng nhập.");
    if (!pw) return setErr("Nhập mật khẩu.");
    // demo: mật khẩu "sai" để xem trạng thái lỗi; mọi mật khẩu khác đều vào được
    if (pw === "sai") {
      const n = fails + 1; setFails(n);
      return setErr(n >= 5 ? "Sai mật khẩu 5 lần — tài khoản bị khóa 15 phút." : `Tên đăng nhập hoặc mật khẩu không đúng (${n}/5).`);
    }
    setErr(""); setBusy(true);
    setTimeout(() => router.push("/trang-chu"), 600);
  };

  return (
    <AuthFrame>
      <Image src="/logo.png" alt="VIETSUN" width={140} height={57} className="lg:hidden mb-8" />
      <h2 className="text-[24px] leading-8 font-semibold">Đăng nhập</h2>
      <p className="text-body text-muted mt-1">Dành cho tổ trưởng, quản lý, IE, HR, kế hoạch, BGĐ.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="u" className="block text-chip font-medium mb-1">Tên đăng nhập</label>
          <input id="u" value={user} onChange={(e) => { setUser(e.target.value); setErr(""); }} autoComplete="username" autoFocus
            className="w-full h-11 px-3 rounded-ctl border border-line-strong bg-surface text-body outline-none focus:border-brand-ink transition-colors duration-fast" />
        </div>
        <div>
          <label htmlFor="p" className="block text-chip font-medium mb-1">Mật khẩu</label>
          <div className="relative">
            <input id="p" type={show ? "text" : "password"} value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} autoComplete="current-password"
              aria-invalid={!!err} aria-describedby={err ? "login-err" : undefined}
              className={cn("w-full h-11 pl-3 pr-11 rounded-ctl border bg-surface text-body outline-none focus:border-brand-ink transition-colors duration-fast", err ? "border-danger" : "border-line-strong")} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-1 top-1 w-9 h-9 grid place-items-center rounded-ctl text-muted hover:bg-hover">{show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}</button>
          </div>
          {err && <p id="login-err" className="text-sub text-danger mt-1.5 flex items-center gap-1" role="alert"><CircleAlert className="w-3.5 h-3.5" />{err}</p>}
        </div>
        <button type="submit" disabled={busy || fails >= 5}
          className="h-11 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold flex items-center justify-center gap-2 transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink disabled:cursor-not-allowed">
          {busy ? <span className="spin w-4 h-4 rounded-full border-2 border-current border-t-transparent" /> : <LogIn className="w-[18px] h-[18px]" />}
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
        <p className="text-sub text-muted">Quên mật khẩu? Liên hệ Superadmin để đặt lại. <Link href="/doi-mat-khau" className="text-brand-ink font-semibold hover:underline">Lần đầu đăng nhập</Link></p>
      </form>

      <div className="mt-8 pt-6 border-t border-line">
        <p className="text-sub text-muted mb-2">Không phải tài khoản Web?</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/app/chon-tram" className="h-10 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-chip font-medium flex items-center justify-center gap-2 transition-colors duration-fast"><Smartphone className="w-4 h-4" />App công nhân</Link>
          <Link href="/tv" className="h-10 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-chip font-medium flex items-center justify-center gap-2 transition-colors duration-fast"><Tv className="w-4 h-4" />Chế độ TV</Link>
        </div>
        <p className="text-tag text-muted mt-3">Demo: nhập bất kỳ mật khẩu nào để vào; gõ “sai” để xem thông báo lỗi.</p>
      </div>
    </AuthFrame>
  );
}
