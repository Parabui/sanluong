"use client";

import { ArrowRight, CircleCheck, KeyRound, QrCode, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BigButton } from "@/components/mobile/ui";
import { cn } from "@/lib/utils";

/* F18: 4 màn, mỗi màn 1 hình minh họa + tối đa 2 câu, có Bỏ qua */
const STEPS: { icon: LucideIcon; title: string; text: string; art: React.ReactNode }[] = [
  {
    icon: QrCode, title: "Chọn trạm", text: "Quét mã QR dán tại trạm. QR hỏng thì chọn trạm trong danh sách.",
    art: (
      <div className="relative w-40 h-40 rounded-[28px] bg-surface shadow-pop grid place-items-center">
        <QrCode className="w-24 h-24 text-ink" strokeWidth={1.25} />
        <span className="absolute inset-x-6 top-1/2 h-0.5 bg-brand rounded-full live-dot" />
      </div>
    ),
  },
  {
    icon: KeyRound, title: "Đăng nhập mã NV", text: "Nhập mã nhân viên của bạn. Mỗi ngày đăng nhập lại một lần.",
    art: (
      <div className="w-52 rounded-card bg-surface shadow-pop p-4">
        <div className="text-[12px] text-muted">Mã nhân viên</div>
        <div className="mt-1 h-12 rounded-ctl border-2 border-brand-ink px-3 flex items-center font-mono text-[20px] font-semibold tracking-wider">NV00127<span className="w-0.5 h-6 bg-ink ml-0.5 live-dot" /></div>
        <div className="mt-3 h-10 rounded-ctl bg-brand grid place-items-center text-[14px] font-semibold">Đăng nhập</div>
      </div>
    ),
  },
  {
    icon: CircleCheck, title: "Nhập & lưu", text: "Nhập tổng số đã làm từ đầu ngày cho từng công đoạn. Bấm Lưu — số mới ghi đè số cũ.",
    art: (
      <div className="w-56 rounded-card bg-surface shadow-pop p-4">
        <div className="text-[14px] font-semibold">Tra cổ</div>
        <div className="mt-2 flex gap-1.5">
          <span className="w-10 h-11 rounded-ctl border border-line-strong grid place-items-center text-[20px]">−</span>
          <span className="flex-1 h-11 rounded-ctl border-2 border-brand-ink grid place-items-center text-[22px] font-semibold num">120</span>
          <span className="w-10 h-11 rounded-ctl border border-line-strong grid place-items-center text-[20px]">+</span>
        </div>
        <div className="mt-3 h-10 rounded-ctl bg-brand grid place-items-center text-[14px] font-semibold">Lưu (1)</div>
      </div>
    ),
  },
  {
    icon: UserRound, title: "Xem “Của tôi”", text: "Xem lại sản lượng và hiệu suất 30 ngày. Sai số thì báo tổ trưởng trước khi khóa sổ.",
    art: (
      <div className="w-56 rounded-card bg-surface shadow-pop p-3 flex flex-col gap-2">
        {[["T2 28/09", "778", "Đã chốt"], ["T7 26/09", "802", "Đã chốt"], ["T6 25/09", "760", "Đã khóa"]].map(([d, n, s]) => (
          <div key={d} className="flex items-center gap-2 text-[13px]"><span className="text-muted w-16">{d}</span><b className="num">{n}</b><span className="ml-auto h-5 px-2 rounded-pill bg-closed-bg text-closed-ink text-[11px] font-semibold grid place-items-center">{s}</span></div>
        ))}
      </div>
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const s = STEPS[i], last = i === STEPS.length - 1;
  const done = () => { try { localStorage.setItem("vsn-onboarded", "1"); } catch {} router.push("/app/chon-tram"); };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-surface">
      <div className="h-14 px-4 flex items-center shrink-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <span className="text-[14px] text-muted num">{i + 1} / {STEPS.length}</span>
        <button onClick={done} className="ml-auto h-11 px-4 -mr-2 rounded-pill text-[15px] font-medium text-muted hover:bg-hover">Bỏ qua</button>
      </div>
      <div key={i} className="page-in flex-1 min-h-0 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-full aspect-square max-w-[280px] rounded-[40px] bg-brand-soft grid place-items-center">{s.art}</div>
        <h1 className="text-[24px] font-bold mt-8">{s.title}</h1>
        <p className="text-[16px] text-muted mt-2 max-w-[300px]">{s.text}</p>
      </div>
      <div className="px-5 pb-6 flex flex-col gap-4 safe-b">
        <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Bước hướng dẫn">
          {STEPS.map((x, j) => <button key={x.title} role="tab" aria-selected={i === j} aria-label={x.title} onClick={() => setI(j)} className={cn("h-2 rounded-full transition-all duration-300", i === j ? "w-7 bg-brand" : "w-2 bg-line-strong")} />)}
        </div>
        <BigButton onClick={() => (last ? done() : setI(i + 1))} className="w-full">
          {last ? "Bắt đầu" : "Tiếp"}<ArrowRight className="w-5 h-5" />
        </BigButton>
      </div>
    </div>
  );
}
