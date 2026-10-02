"use client";

import { Camera, ChevronRight, QrCode, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BigButton, Sheet, TopBar } from "@/components/mobile/ui";
import { STATIONS } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const OCC: Record<number, string> = { 12: "Nguyễn Thị Lan", 25: "Trần Văn Hùng", 26: "Lê Thị Hoa", 28: "Võ Thị Thu", 29: "Đỗ Thị Ngọc", 30: "Huỳnh Thị Kim", 31: "Bùi Thị Hạnh", 32: "Ngô Thị Yến", 33: "Lý Thị Trang", 35: "Phan Thị Nhung", 36: "Đặng Thị Vân", 37: "Trương Thị Hằng", 38: "Mai Thị Diễm", 39: "Châu Thị Thảo", 40: "Tạ Thị Loan" };
const LINES = Array.from({ length: 15 }, (_, i) => `C${String(i + 1).padStart(2, "0")}`);

export default function PickStationPage() {
  const router = useRouter();
  const [line, setLine] = useState("C05");
  const [scan, setScan] = useState(false);

  useEffect(() => {
    if (!scan) return;
    const t = setTimeout(() => { setScan(false); router.push("/app/dang-nhap?tram=27"); }, 1800);
    return () => clearTimeout(t);
  }, [scan, router]);

  return (
    <>
      <TopBar title="Chọn trạm" />
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="p-4">
          <button onClick={() => setScan(true)} className="w-full rounded-card bg-ink text-ondark p-5 flex items-center gap-4 text-left hover:brightness-110 transition duration-fast">
            <span className="w-14 h-14 rounded-ctl bg-brand text-ink grid place-items-center shrink-0"><QrCode className="w-8 h-8" /></span>
            <span><span className="block text-[18px] font-semibold">Quét QR tại trạm</span><span className="block text-[14px] opacity-80">Nhanh nhất · không chọn nhầm trạm</span></span>
            <ChevronRight className="w-6 h-6 ml-auto opacity-70" />
          </button>
        </div>

        <div className="px-4 flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />hoặc chọn trong danh sách<span className="h-px flex-1 bg-line" /></div>

        <div className="px-4 pt-4">
          <div className="text-[13px] text-muted mb-2">Xưởng May 1 · Chuyền</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {LINES.map((l) => (
              <button key={l} onClick={() => setLine(l)} aria-pressed={line === l}
                className={cn("h-11 px-4 rounded-pill border text-[15px] shrink-0 transition-colors duration-fast", line === l ? "bg-ink text-surface border-ink font-semibold" : "bg-surface border-line-strong hover:bg-hover")}>{l}</button>
            ))}
          </div>
        </div>

        <div className="p-4 grid grid-cols-3 gap-2">
          {STATIONS.map((t) => {
            const who = line === "C05" ? OCC[t] : undefined;
            const mine = line === "C05" && t === 27; // NV00127 đã có phiên Trạm 27 hôm nay
            return (
              <button key={t} onClick={() => router.push(mine ? "/app/nhap" : `/app/dang-nhap?tram=${t}&chuyen=${line}`)}
                className={cn("h-[76px] rounded-card border p-2.5 text-left flex flex-col transition-colors duration-fast", mine ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand active:bg-brand-soft")}>
                <span className="text-[16px] font-semibold num">Trạm {t}</span>
                <span className={cn("mt-auto text-[12px] leading-tight flex items-center gap-1 truncate", mine ? "text-brand-ink font-semibold" : who ? "text-muted" : "text-closed-ink font-medium")}>
                  {mine ? "Của bạn" : who ? <><UserRound className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{who.split(" ").slice(-2).join(" ")}</span></> : "Trống"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Sheet open={scan} onClose={() => setScan(false)} title="Quét mã QR">
        <div className="relative aspect-square rounded-card bg-[#111418] overflow-hidden grid place-items-center">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,#3a4150,transparent_60%)]" />
          <div className="relative w-2/3 aspect-square">
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"].map((c) => (
              <span key={c} className={cn("absolute w-10 h-10 border-brand", c)} />
            ))}
            <span className="absolute inset-x-3 top-1/2 h-0.5 bg-brand live-dot" />
          </div>
          <span className="absolute bottom-3 text-[14px] text-ondark/90 flex items-center gap-1.5"><Camera className="w-4 h-4" />Đang tìm mã QR…</span>
        </div>
        <p className="text-[14px] text-muted mt-3">Không có quyền camera? Vào Cài đặt trình duyệt để cho phép, hoặc chọn trạm thủ công.</p>
        <BigButton variant="secondary" className="w-full mt-3" onClick={() => setScan(false)}>Chọn thủ công</BigButton>
      </Sheet>
    </>
  );
}
