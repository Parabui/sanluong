"use client";

import { ArrowLeft, Check, KeyRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AuthFrame } from "../auth-frame";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [tried, setTried] = useState(false);

  const rules = [
    { ok: pw.length >= 8, label: "Ít nhất 8 ký tự" },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), label: "Có cả chữ và số" },
    { ok: !!pw && pw !== cur, label: "Khác mật khẩu hiện tại" },
  ];
  const match = !!pw2 && pw === pw2;
  const valid = !!cur && rules.every((r) => r.ok) && match;
  const input = "w-full h-11 px-3 rounded-ctl border bg-surface text-body outline-none focus:border-brand-ink transition-colors duration-fast";

  return (
    <AuthFrame>
      <span className="w-11 h-11 rounded-full bg-brand-soft grid place-items-center"><KeyRound className="w-5 h-5 text-brand-ink" /></span>
      <h2 className="text-[24px] leading-8 font-semibold mt-4">Đổi mật khẩu</h2>
      <p className="text-body text-muted mt-1">Lần đầu đăng nhập hoặc sau khi được đặt lại, bạn phải đổi mật khẩu tạm.</p>

      <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={(e) => { e.preventDefault(); setTried(true); if (valid) router.push("/trang-chu"); }}>
        <div>
          <label htmlFor="c" className="block text-chip font-medium mb-1">Mật khẩu hiện tại (tạm)</label>
          <input id="c" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} className={cn(input, tried && !cur ? "border-danger" : "border-line-strong")} />
          {tried && !cur && <p className="text-sub text-danger mt-1" role="alert">Nhập mật khẩu hiện tại.</p>}
        </div>
        <div>
          <label htmlFor="n" className="block text-chip font-medium mb-1">Mật khẩu mới</label>
          <input id="n" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pw-rules" className={cn(input, "border-line-strong")} />
          <ul id="pw-rules" className="mt-2 flex flex-col gap-1">
            {rules.map((r) => (
              <li key={r.label} className={cn("text-sub flex items-center gap-1.5", r.ok ? "text-closed-ink" : tried ? "text-danger" : "text-muted")}>
                {r.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}{r.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <label htmlFor="n2" className="block text-chip font-medium mb-1">Nhập lại mật khẩu mới</label>
          <input id="n2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={cn(input, pw2 && !match ? "border-danger" : "border-line-strong")} />
          {pw2 && !match && <p className="text-sub text-danger mt-1" role="alert">Mật khẩu nhập lại không khớp.</p>}
        </div>
        <button type="submit" className="h-11 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold transition-colors duration-fast">Lưu mật khẩu mới</button>
        <Link href="/dang-nhap" className="text-chip text-muted hover:text-ink inline-flex items-center gap-1.5 self-start"><ArrowLeft className="w-4 h-4" />Quay lại đăng nhập</Link>
      </form>
    </AuthFrame>
  );
}
