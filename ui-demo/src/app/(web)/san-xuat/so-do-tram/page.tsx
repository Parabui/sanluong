"use client";

import { CircleCheck, CircleDashed, LogOut, Smartphone, UserRound, UserX } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Button, Drawer, Page, Pill, ReasonChips, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { C05_MAP, STATIONS } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type Occ = { nv: string; hoTen: string; since: string; entered: boolean; device: string } | null;
const INIT: Record<number, Occ> = {
  12: { nv: "NV00231", hoTen: "Nguyễn Thị Lan", since: "07:01", entered: true, device: "Android · Chrome" },
  25: { nv: "NV00318", hoTen: "Trần Văn Hùng", since: "07:04", entered: true, device: "iPhone · Safari" },
  26: { nv: "NV00412", hoTen: "Lê Thị Hoa", since: "06:58", entered: true, device: "Android · Chrome" },
  27: { nv: "NV00127", hoTen: "Phạm Thị Mai", since: "07:00", entered: true, device: "Android · Chrome" },
  28: { nv: "NV00509", hoTen: "Võ Thị Thu", since: "07:02", entered: false, device: "Android · Chrome" },
  29: { nv: "NV01022", hoTen: "Đỗ Thị Ngọc", since: "07:10", entered: false, device: "Android · Chrome" },
  30: { nv: "NV00788", hoTen: "Huỳnh Thị Kim", since: "07:06", entered: true, device: "Android · Chrome" },
  31: { nv: "NV00655", hoTen: "Bùi Thị Hạnh", since: "07:03", entered: false, device: "iPhone · Safari" },
  32: { nv: "NV00702", hoTen: "Ngô Thị Yến", since: "07:05", entered: false, device: "Android · Chrome" },
  33: { nv: "NV00833", hoTen: "Lý Thị Trang", since: "07:08", entered: false, device: "Android · Chrome" },
  34: null,
  35: { nv: "NV00914", hoTen: "Phan Thị Nhung", since: "06:55", entered: true, device: "Android · Chrome" },
  36: { nv: "NV00956", hoTen: "Đặng Thị Vân", since: "07:12", entered: false, device: "Android · Chrome" },
  37: { nv: "NV00987", hoTen: "Trương Thị Hằng", since: "07:09", entered: false, device: "iPhone · Safari" },
  38: { nv: "NV01003", hoTen: "Mai Thị Diễm", since: "07:15", entered: false, device: "Android · Chrome" },
  39: { nv: "NV01045", hoTen: "Châu Thị Thảo", since: "07:02", entered: true, device: "Android · Chrome" },
  40: { nv: "NV01051", hoTen: "Tạ Thị Loan", since: "07:20", entered: false, device: "Android · Chrome" },
  41: null,
};
const REASONS = ["Đăng nhập nhầm trạm", "Đổi vị trí làm việc", "Công nhân nghỉ giữa ca", "Khác"];

export default function LiveStationsPage() {
  const toast = useToast();
  const { q } = useShell();
  const [occ, setOcc] = useState(INIT);
  const [sel, setSel] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const vals = Object.values(occ);
  const inCount = vals.filter(Boolean).length, entered = vals.filter((o) => o?.entered).length;
  const s = q.trim().toLowerCase();
  const o = sel != null ? occ[sel] : null;

  return (
    <>
      <Page>
        <Toolbar title="Sơ đồ trạm trực tiếp" right={<span className="flex items-center gap-1.5 text-chip text-muted"><span className="live-dot w-2 h-2 rounded-full bg-success" />Trực tiếp · cập nhật ≤ 10 giây</span>}>
          <Select label="Chuyền" defaultValue="C05" className="w-40"><option value="C05">C05 · Chuyền 5</option><option value="C06">C06 · Chuyền 6</option></Select>
          <div className="flex items-center gap-2 ml-2">
            <Pill tone="closed" icon={UserRound}>{inCount} đang đăng nhập</Pill>
            <Pill tone="neutral">{18 - inCount} trống</Pill>
            <Pill tone="empty" icon={CircleDashed}>{inCount - entered} chưa nhập hôm nay</Pill>
          </div>
        </Toolbar>

        <section className="flex-1 min-h-0 grid grid-cols-6 grid-rows-3 gap-3">
          {STATIONS.map((t) => {
            const x = occ[t];
            const hit = !s || `trạm ${t} ${x?.nv ?? ""} ${x?.hoTen ?? ""}`.toLowerCase().includes(s);
            return (
              <button key={t} onClick={() => { setSel(t); setReason(""); setErr(""); }}
                className={cn("text-left bg-surface border rounded-card p-3 flex flex-col gap-2 min-h-0 hover:shadow-pop hover:border-line-strong transition duration-fast",
                  x ? (x.entered ? "border-line" : "border-empty-bar/50") : "border-dashed border-line-strong bg-thead", !hit && "opacity-30")}>
                <div className="flex items-center gap-1.5 w-full">
                  <span className="text-h font-semibold num">Trạm {t}</span>
                  {x && <span className={cn("ml-auto w-2 h-2 rounded-full", x.entered ? "bg-success" : "bg-empty-bar")} aria-hidden="true" />}
                </div>
                {x ? (
                  <>
                    <div className="min-w-0">
                      <div className="text-body font-medium truncate">{x.hoTen}</div>
                      <div className="text-sub text-muted"><span className="font-mono">{x.nv}</span> · từ {x.since}</div>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      {x.entered ? <Pill size="sm" tone="closed" icon={CircleCheck}>Đã nhập</Pill> : <Pill size="sm" tone="empty">Chưa nhập</Pill>}
                      <span className="text-tag text-muted truncate">{C05_MAP[t]?.map((o) => o.cd).join(", ")}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted text-chip gap-1"><UserX className="w-5 h-5" />Trống</div>
                )}
              </button>
            );
          })}
        </section>
      </Page>
      <StatusBar right={<span>Heartbeat 30 giây · SSE</span>}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" />Đã nhập hôm nay</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-empty-bar" />Đăng nhập nhưng chưa nhập</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-line-strong" />Trống</span>
      </StatusBar>

      <Drawer open={sel != null} onClose={() => setSel(null)} title={`Trạm ${sel ?? ""} · C05`}
        footer={o ? <><Button onClick={() => setSel(null)}>Đóng</Button><Button variant="danger" icon={LogOut} onClick={() => {
          if (!reason) return setErr("Vui lòng chọn lý do đăng xuất hộ.");
          setOcc({ ...occ, [sel!]: null }); setSel(null); toast(`Đã đăng xuất ${o.hoTen} khỏi Trạm ${sel}`);
        }}>Đăng xuất hộ</Button></> : undefined}>
        {o ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-card border border-line bg-thead p-3 flex gap-3">
              <span className="w-10 h-10 rounded-full bg-brand-soft text-brand-ink grid place-items-center font-semibold">{o.hoTen.split(" ").slice(-1)[0][0]}</span>
              <div className="text-chip leading-relaxed">
                <div className="text-body font-semibold">{o.hoTen}</div>
                <div className="text-muted"><span className="font-mono">{o.nv}</span> · đăng nhập {o.since}</div>
                <div className="text-muted flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" />{o.device}</div>
              </div>
            </div>
            <div>
              <h3 className="text-chip font-semibold mb-2">Công đoạn tại trạm hôm nay</h3>
              <ul className="flex flex-col gap-1.5">{(C05_MAP[sel!] || []).map((op) => (
                <li key={op.cd} className="flex items-center gap-2 text-chip"><span className="font-mono text-tag">{op.cd}</span>{op.ten}
                  <span className="ml-auto">{o.entered ? <Pill size="sm" tone="closed">Đã nhập</Pill> : <Pill size="sm" tone="empty">Chưa nhập</Pill>}</span></li>))}</ul>
            </div>
            <div className="h-px bg-line" />
            <div>
              <ReasonChips name="lo-reason" reasons={REASONS} value={reason} onChange={(v) => { setReason(v); setErr(""); }} />
              {err && <p className="text-sub text-danger mt-1.5" role="alert">{err}</p>}
              <p className="text-sub text-muted mt-3">Công nhân thấy thông báo ở lần mở app kế tiếp. Bản ghi offline (nếu có) vẫn được tính cho người đã nhập.</p>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center gap-2 text-muted text-chip"><UserX className="w-8 h-8" />Trạm đang trống. Công nhân quét QR tại trạm để đăng nhập.</div>
        )}
      </Drawer>
    </>
  );
}
