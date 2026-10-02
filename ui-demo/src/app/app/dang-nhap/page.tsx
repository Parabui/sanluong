"use client";

import { CircleAlert, LogIn, LogOut, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useWorker } from "@/components/mobile/store";
import { BigButton, Sheet, TopBar } from "@/components/mobile/ui";
import { C05_MAP, EMPLOYEES } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const OCC: Record<number, { nv: string; name: string; at: string }> = {
  28: { nv: "NV00509", name: "Võ Thị Thu", at: "07:02" }, 29: { nv: "NV01022", name: "Đỗ Thị Ngọc", at: "07:10" },
  35: { nv: "NV00914", name: "Phan Thị Nhung", at: "06:55" }, 40: { nv: "NV01051", name: "Tạ Thị Loan", at: "07:20" },
};

function LoginForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const { addSession, toast } = useWorker();
  const tram = Number(sp.get("tram") ?? 27);
  const line = sp.get("chuyen") ?? "C05";
  const [occ, setOcc] = useState<(typeof OCC)[number] | undefined>(OCC[tram]);
  const [kick, setKick] = useState(false);
  const [nv, setNv] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ops = C05_MAP[tram] ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = nv.trim().toUpperCase();
    if (!code) return setErr("Nhập mã nhân viên của bạn.");
    const emp = EMPLOYEES.find((x) => x.nv === code);
    if (!emp || !emp.active) return setErr("Mã NV không hợp lệ.");
    if (occ) return setErr("Trạm đang có người khác đăng nhập — đăng xuất người đó trước.");
    setErr(""); setBusy(true);
    setTimeout(() => { addSession(tram); toast(`Đã đăng nhập Trạm ${tram}`); router.push("/app/nhap"); }, 700);
  };

  return (
    <>
      <TopBar title={`Trạm ${tram} · ${line}`} back="/app/chon-tram" />
      <form onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4" noValidate>
        <section className="rounded-card border border-line bg-surface p-4">
          <div className="text-[13px] text-muted">Công đoạn tại trạm hôm nay</div>
          {ops.length ? (
            <ul className="mt-2 flex flex-col gap-1.5">{ops.map((o) => (
              <li key={o.cd} className="flex items-center gap-2 text-[15px]"><span className="h-6 px-2 rounded-pill bg-group text-[12px] font-semibold inline-flex items-center">{o.mh}</span><span className="font-medium">{o.ten}</span><span className="ml-auto font-mono text-[12px] text-muted">{o.cd}</span></li>))}</ul>
          ) : <p className="mt-1 text-[15px] text-empty-ink">Trạm chưa có công đoạn, liên hệ tổ trưởng.</p>}
        </section>

        {occ && (
          <section className="rounded-card border border-empty-bar/40 bg-empty-bg p-4 text-empty-ink">
            <div className="flex gap-3">
              <UserRound className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="text-[15px] leading-snug"><b>{occ.name}</b> <span className="font-mono text-[13px]">({occ.nv})</span> đang đăng nhập trạm này từ {occ.at}.</div>
            </div>
            <BigButton type="button" variant="secondary" className="w-full mt-3" onClick={() => setKick(true)}><LogOut className="w-5 h-5" />Đăng xuất người này</BigButton>
          </section>
        )}

        <div>
          <label htmlFor="nv" className="block text-[15px] font-medium mb-1.5">Mã nhân viên</label>
          <input id="nv" value={nv} onChange={(e) => { setNv(e.target.value.toUpperCase()); setErr(""); }} autoComplete="off" autoCapitalize="characters" enterKeyHint="go"
            placeholder="VD: NV00127" aria-invalid={!!err} aria-describedby={err ? "nv-err" : "nv-hint"}
            className={cn("w-full h-14 px-4 rounded-ctl border-2 bg-surface font-mono text-[22px] font-semibold tracking-wider outline-none placeholder:font-sans placeholder:text-[16px] placeholder:font-normal placeholder:tracking-normal transition-colors duration-fast",
              err ? "border-danger" : "border-line-strong focus:border-brand-ink")} />
          {err ? <p id="nv-err" className="text-[14px] text-danger mt-1.5 flex items-center gap-1.5" role="alert"><CircleAlert className="w-4 h-4" />{err}</p>
            : <p id="nv-hint" className="text-[13px] text-muted mt-1.5">Thử: <button type="button" className="font-mono text-brand-ink font-semibold" onClick={() => setNv("NV00127")}>NV00127</button> (Phạm Thị Mai)</p>}
        </div>

        <BigButton type="submit" disabled={busy} className="w-full mt-auto">
          {busy ? <span className="spin w-5 h-5 rounded-full border-2 border-current border-t-transparent" /> : <LogIn className="w-5 h-5" />}
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </BigButton>
        <p className="text-[13px] text-muted text-center -mt-1">Phiên đăng nhập có hiệu lực cho <b className="text-ink">hôm nay</b>. Một điện thoại = một mã NV / ngày.</p>
      </form>

      <Sheet open={kick} onClose={() => setKick(false)} title="Đăng xuất người đang ở trạm?"
        footer={<><BigButton variant="secondary" className="flex-1" onClick={() => setKick(false)}>Hủy</BigButton><BigButton variant="danger" className="flex-1" onClick={() => { setOcc(undefined); setKick(false); toast(`Đã đăng xuất ${occ?.name}`); }}>Đăng xuất</BigButton></>}>
        <p className="text-[15px] text-muted">{occ?.name} sẽ bị đăng xuất khỏi Trạm {tram}. Thao tác được ghi lại (audit log) và tổ trưởng xem được.</p>
      </Sheet>
    </>
  );
}

export default function WorkerLoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
