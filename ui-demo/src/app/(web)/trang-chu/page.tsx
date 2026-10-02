"use client";

import {
  ArrowRight, CalendarClock, ChartColumn, CircleDashed, Clock, Gauge, Package, Radio, Table2, TriangleAlert, UserPlus, Users,
} from "lucide-react";
import Link from "next/link";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Card, CardHeader, Page, Pill, Progress, Stat } from "@/components/ui/primitives";
import { NOW } from "@/lib/demo-data";
import { ROLES } from "@/lib/nav";
import { cn, ddmmyyyy, fmt, weekday } from "@/lib/utils";

const MISSING = [
  { line: "C05", tram: 28, login: "NV00509 · Võ Thị Thu", ops: ["CD-08 Ráp vai"] },
  { line: "C05", tram: 34, login: null, ops: ["CD-18 Lên lai áo"] },
  { line: "C05", tram: 40, login: "NV01051 · Tạ Thị Loan", ops: ["CD-04 Tra lưng"] },
  { line: "C06", tram: 31, login: "NV00562 · Kiều Thị Sen", ops: ["CD-14 Can sườn"] },
  { line: "C06", tram: 37, login: null, ops: ["CD-23 Gắn thẻ bài", "CD-24 Gấp xếp"] },
];

const ACTIVITY = [
  { t: "09:12", who: "Phạm Thị Mai", what: "lưu 2 công đoạn · Trạm 27 · C05", icon: Package },
  { t: "09:05", who: "Đặng Thị Vân", what: "gửi yêu cầu sửa giờ 28/09 → 10,5 giờ", icon: Clock },
  { t: "08:07", who: "Nguyễn Văn Bình", what: "sửa Trạm 32 · 460 → 430 (Đếm lại bó hàng)", icon: Table2 },
  { t: "08:05", who: "Nguyễn Văn Bình", what: "nhập hộ Trạm 29 · 610 (Không mang điện thoại)", icon: UserPlus },
  { t: "07:02", who: "Võ Thị Thu", what: "đăng nhập Trạm 28 · C05", icon: Radio },
];

export default function HomePage() {
  const { role } = useShell();
  const person = ROLES[role];
  const firstName = person.name.split(" ").slice(-1)[0];

  return (
    <>
      <Page scroll>
        <div className="flex items-end gap-4">
          <div>
            <p className="text-chip text-muted num">{weekday(NOW.date)}, {ddmmyyyy(NOW.date)} · {NOW.time}</p>
            <h1 className="text-[24px] leading-8 font-semibold mt-0.5">Chào {firstName}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Link href="/bao-cao/dashboard" className="h-9 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-body font-medium inline-flex items-center gap-2 transition-colors duration-fast"><ChartColumn className="w-[18px] h-[18px]" />Dashboard</Link>
            <Link href="/san-xuat/bang-san-luong" className="h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold inline-flex items-center gap-2 transition-colors duration-fast"><Table2 className="w-[18px] h-[18px]" />Mở Bảng sản lượng</Link>
          </div>
        </div>

        {/* Cảnh báo ngày chưa chốt (F10) */}
        <div className="rounded-card border border-empty-bar/40 bg-empty-bg px-4 py-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-surface grid place-items-center shrink-0"><TriangleAlert className="w-5 h-5 text-empty-bar" /></span>
          <div className="min-w-0">
            <p className="text-body font-semibold text-empty-ink">Còn 2 ngày chưa chốt</p>
            <p className="text-chip text-empty-ink/90">Từ 08:00 hôm nay đã chốt được ngày 28/09. Xử lý ô vàng / cam trước khi chốt.</p>
          </div>
          <div className="ml-auto flex gap-2 shrink-0">
            {["C05", "C06"].map((l) => (
              <Link key={l} href={`/san-xuat/bang-san-luong?chuyen=${l}&ngay=2026-09-28`} className="h-8 px-3 rounded-pill bg-surface border border-empty-bar/40 hover:border-empty-bar text-chip font-semibold text-empty-ink inline-flex items-center gap-1.5 transition-colors duration-fast">
                <CalendarClock className="w-4 h-4" />{l} · 28/09<ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Stat icon={Package} label="Hoàn thành hôm nay (QC)" value={fmt(412)} unit="sp" sub="C05 + C06 · cập nhật 09:15" />
          <Stat icon={Radio} label="Trạm đã nhập hôm nay" value="10" unit="/ 36" sub="26 trạm chưa có số" tone="warn" />
          <Stat icon={Gauge} label="Hiệu suất ngày chốt gần nhất" value="81,6" unit="%" sub="▲ 2,1 điểm so với 25/09" tone="up" />
          <Stat icon={Clock} label="Giờ làm chờ duyệt" value="3" unit="yêu cầu" sub={<Link href="/san-xuat/duyet-gio" className="text-brand-ink font-semibold hover:underline">Mở Duyệt giờ làm →</Link>} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          {/* F13: Trạm chưa nhập */}
          <Card>
            <CardHeader icon={CircleDashed} title="Trạm chưa nhập ngày 28/09" sub="Thứ 2 · các chuyền được gắn"
              right={<span className="flex items-center gap-1.5 text-sub text-muted"><span className="live-dot w-2 h-2 rounded-full bg-success" />Tự cập nhật</span>} />
            <ul>
              {MISSING.map((m, i) => (
                <li key={i}>
                  <Link href={`/san-xuat/bang-san-luong?chuyen=${m.line}&ngay=2026-09-28`}
                    className={cn("group h-[60px] px-4 flex items-center gap-4 hover:bg-hover transition-colors duration-fast", i && "border-t border-line")}>
                    <span className="w-12 h-9 rounded-ctl bg-empty-bg text-empty-ink grid place-items-center font-semibold num text-qty shrink-0">{m.tram}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><Pill size="sm" tone="neutral">{m.line}</Pill><span className="text-body font-medium truncate">{m.ops.join(" · ")}</span></div>
                      <div className={cn("text-sub mt-0.5", m.login ? "text-muted" : "text-muted italic")}>{m.login ? `Đăng nhập: ${m.login}` : "Chưa có người đăng nhập"}</div>
                    </div>
                    <span className="text-chip font-semibold text-brand-ink inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-fast"><UserPlus className="w-4 h-4" />Nhập hộ</span>
                    <ArrowRight className="w-4 h-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader icon={Users} title="Tiến độ nhập hôm nay" />
              <div className="p-4 flex flex-col gap-3">
                {[["C05", 10, 18], ["C06", 0, 18]].map(([l, a, b]) => (
                  <div key={l as string}>
                    <div className="flex items-center text-chip mb-1.5"><span className="font-semibold">{l}</span><span className="ml-auto num text-muted">{a}/{b} trạm</span></div>
                    <Progress value={((a as number) / (b as number)) * 100} tone={(a as number) ? "success" : "warn"} />
                  </div>
                ))}
                <p className="text-sub text-muted">Công nhân thường nhập cuối ca (16:00–18:00).</p>
              </div>
            </Card>
            <Card>
              <CardHeader icon={Clock} title="Hoạt động gần đây" />
              <ol className="p-4 flex flex-col gap-3">
                {ACTIVITY.map((a, i) => {
                  const I = a.icon;
                  return (
                    <li key={i} className="flex gap-3 text-chip">
                      <span className="w-7 h-7 rounded-full bg-group grid place-items-center shrink-0"><I className="w-3.5 h-3.5 text-muted" /></span>
                      <div className="min-w-0"><b className="font-semibold">{a.who}</b> <span className="text-muted">{a.what}</span><div className="text-sub text-muted num">{a.t}</div></div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </div>
        </div>
      </Page>
      <StatusBar right={<span>Cập nhật lúc {NOW.time}</span>}>
        <span>Giờ mở chốt ngày: <b className="text-ink">08:00</b></span>
      </StatusBar>
    </>
  );
}
