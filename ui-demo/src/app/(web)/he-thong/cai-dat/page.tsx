"use client";

import { CalendarClock, Clock, LayoutDashboard, Save, Tv } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Button, Card, CardHeader, Field, Input, Page, Pill, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const toast = useToast();
  const { role } = useShell();
  const sa = role === "SA";
  const [hours, setHours] = useState({ t26: "9", t7: "8", cn: "" });
  const [dirty, setDirty] = useState(false);
  const bad = (v: string) => v !== "" && !(Number(v.replace(",", ".")) > 0 && Number(v.replace(",", ".")) <= 16);

  return (
    <>
      <Page scroll>
        <Toolbar title="Cài đặt" right={<Button variant="primary" icon={Save} disabled={!dirty} onClick={() => { setDirty(false); toast("Đã lưu cài đặt · áp dụng từ hôm nay"); }}>Lưu</Button>}>
          {!sa && <Pill tone="neutral">Quản lý xưởng — chỉ sửa giờ mặc định của xưởng được gắn</Pill>}
        </Toolbar>

        <div className="grid grid-cols-2 gap-4 items-start">
          <Card>
            <CardHeader icon={Clock} title="Giờ làm mặc định" sub="theo xưởng, theo thứ trong tuần" right={<Select label="Xưởng" className="w-36"><option>Xưởng May 1</option></Select>} />
            <div className="p-4 flex flex-col gap-3">
              {([["t26", "Thứ 2 – Thứ 6"], ["t7", "Thứ 7"], ["cn", "Chủ nhật"]] as const).map(([k, label]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-32 text-body font-medium">{label}</span>
                  <Input value={hours[k]} onChange={(e) => { setHours({ ...hours, [k]: e.target.value }); setDirty(true); }} inputMode="decimal" placeholder="Trống"
                    aria-invalid={bad(hours[k])} className={cn("w-28 text-right num", bad(hours[k]) && "border-danger")} />
                  <span className="text-chip text-muted">giờ</span>
                  {bad(hours[k]) && <span className="text-sub text-danger">Trong khoảng &gt; 0 và ≤ 16</span>}
                  {k === "cn" && !hours.cn && <span className="text-sub text-muted">Có sản lượng mà không có giờ → % hiệu suất “—”</span>}
                </div>
              ))}
              <div className="rounded-ctl bg-thead border border-line px-3 py-2 text-sub text-muted">Đổi giờ mặc định chỉ áp dụng từ ngày thay đổi trở đi. Lịch sử: 9 / 8 / trống — từ 01/07/2026.</div>
            </div>
          </Card>

          <Card className={cn(!sa && "opacity-60 pointer-events-none")} aria-disabled={!sa}>
            <CardHeader icon={CalendarClock} title="Chốt ngày" sub="dùng chung cho F10 và F13" />
            <div className="p-4 flex flex-col gap-4">
              <Field label="Giờ mở chốt ngày" hint="Từ mốc này tổ trưởng được chốt ngày hôm trước và trang chủ bắt đầu cảnh báo trạm chưa nhập">
                <Input type="time" defaultValue="08:00" onChange={() => setDirty(true)} className="w-32 num" />
              </Field>
              <Field label="Số ngày mở nhập lùi" hint="Hôm nay + các ngày chưa chốt trong N ngày lịch liền trước">
                <Input defaultValue="3" disabled className="w-20 num text-right disabled:bg-disabled-bg" />
              </Field>
            </div>
          </Card>

          <Card className={cn(!sa && "opacity-60 pointer-events-none")}>
            <CardHeader icon={LayoutDashboard} title="Dashboard" />
            <div className="p-4 flex flex-col gap-4">
              <Field label="Chu kỳ tự làm mới" hint="1 – 60 phút"><div className="flex items-center gap-2"><Input defaultValue="5" onChange={() => setDirty(true)} className="w-20 num text-right" /><span className="text-chip text-muted">phút</span></div></Field>
              <Field label="Ngưỡng cảnh báo % hiệu suất" hint="Tô màu cảnh báo khi vượt"><div className="flex items-center gap-2"><Input defaultValue="150" disabled className="w-20 num text-right disabled:bg-disabled-bg" /><span className="text-chip text-muted">%</span></div></Field>
            </div>
          </Card>

          <Card className={cn(!sa && "opacity-60 pointer-events-none")}>
            <CardHeader icon={Tv} title="Phiên TV" sub="không hết hạn · thu hồi được" />
            <ul className="p-2">
              {[["TV Xưởng May 1 — cổng chính", "Tải lại lúc 05:00 hôm nay"], ["TV Xưởng May 1 — khu QC", "Tải lại lúc 05:00 hôm nay"]].map(([n, s]) => (
                <li key={n} className="h-12 px-2 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-group grid place-items-center"><Tv className="w-4 h-4 text-muted" /></span>
                  <div className="min-w-0"><div className="text-body font-medium">{n}</div><div className="text-sub text-muted">{s}</div></div>
                  <Button size="sm" className="ml-auto" onClick={() => toast("Đã thu hồi phiên TV · bắt buộc đăng nhập lại")}>Thu hồi</Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Page>
      <StatusBar right={<span>Mọi thay đổi ghi vào Audit log</span>} />
    </>
  );
}
