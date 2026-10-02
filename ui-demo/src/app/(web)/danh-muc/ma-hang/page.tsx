"use client";

import { History, Plus, Shirt, Star, Upload } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Button, Field, Input, Modal, Page, Pill, Progress, Tabs, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { C05_MAP, STYLES, UNASSIGNED_OPS, type Op } from "@/lib/demo-data";
import { cn, fmt, pct } from "@/lib/utils";

const opsOf = (mh: string): (Op & { active: boolean; stations: number[] })[] => {
  const all = new Map<string, Op & { active: boolean; stations: number[] }>();
  Object.entries(C05_MAP).forEach(([t, ops]) => ops.filter((o) => o.mh === mh).forEach((o) => {
    const x = all.get(o.cd) ?? { ...o, active: true, stations: [] };
    x.stations.push(+t); all.set(o.cd, x);
  }));
  UNASSIGNED_OPS.filter((o) => o.mh === mh).forEach((o) => all.set(o.cd, { ...o, active: true, stations: [] }));
  if (mh === "PL-2641") all.set("CD-19", { mh, cd: "CD-19", ten: "Vắt sổ lai (cũ)", smv: 22, active: false, stations: [] });
  return [...all.values()].sort((a, b) => a.cd.localeCompare(b.cd));
};
const SMV_HIST = [
  { cd: "CD-06", from: 55, to: 52, day: "22/09/2026", by: "Phùng Thị Hà", at: "14:10 21/09", n: 312 },
  { cd: "CD-13", from: 50, to: 48, day: "15/09/2026", by: "Phùng Thị Hà", at: "09:02 15/09", n: 0 },
];

export default function StylesPage() {
  const toast = useToast();
  const { q } = useShell();
  const [sel, setSel] = useState("PL-2641");
  const [tab, setTab] = useState<"cd" | "smv">("cd");
  const [smvEdit, setSmvEdit] = useState<Op | null>(null);
  const s = q.trim().toLowerCase();
  const style = STYLES.find((x) => x.ma === sel)!;
  const ops = opsOf(sel).filter((o) => !s || `${o.cd} ${o.ten}`.toLowerCase().includes(s));

  return (
    <>
      <Page>
        <Toolbar title="Mã hàng & công đoạn" right={<>
          <Button icon={Plus} onClick={() => toast("Thêm mã hàng (demo)", "info")}>Thêm mã hàng</Button>
          <Button variant="primary" icon={Upload} onClick={() => toast("Chờ file mẫu quy trình công nghệ của IE (việc còn mở #1)", "warn")}>Import quy trình</Button>
        </>} />

        <div className="flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)] gap-4">
          <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
            <div className="h-12 px-4 flex items-center border-b border-line"><h2 className="text-h font-semibold">Mã hàng</h2><span className="ml-auto text-sub text-muted">{STYLES.length}</span></div>
            <ul className="flex-1 min-h-0 overflow-y-auto scroll-area p-2 flex flex-col gap-1">
              {STYLES.map((x) => {
                const on = x.ma === sel, p = pct(x.daLam, x.soLuong);
                return (
                  <li key={x.ma}>
                    <button onClick={() => setSel(x.ma)} aria-current={on}
                      className={cn("w-full text-left px-3 py-2.5 rounded-ctl transition-colors duration-fast", on ? "bg-brand-soft" : "hover:bg-hover")}>
                      <div className="flex items-center gap-2">
                        <b className={cn("text-body", on && "text-brand-ink")}>{x.ma}</b>
                        <span className="ml-auto">{x.trangThai === "Đang chạy" ? <Pill size="sm" tone="open">Đang chạy</Pill> : x.trangThai === "Đã xong" ? <Pill size="sm" tone="locked">Đã xong</Pill> : <Pill size="sm">Sắp chạy</Pill>}</span>
                      </div>
                      <div className="text-sub text-muted truncate mt-0.5">{x.ten} · {x.khach}</div>
                      <div className="flex items-center gap-2 mt-1.5"><Progress value={p} className="flex-1" /><span className="text-tag text-muted num w-9 text-right">{p}%</span></div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-4 border-b border-line">
              <span className="w-10 h-10 rounded-ctl bg-brand-soft grid place-items-center"><Shirt className="w-5 h-5 text-brand-ink" /></span>
              <div className="min-w-0">
                <h2 className="text-h font-semibold">{style.ma} · {style.ten}</h2>
                <p className="text-sub text-muted">{style.khach} · Đơn hàng <b className="text-ink num">{fmt(style.soLuong)}</b> sp · Đang chạy trên {style.chuyen.join(", ") || "—"}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-sub text-muted">Đã làm (QC)</div>
                <div className="text-h font-semibold">{fmt(style.daLam)} <span className="text-sub text-muted font-normal">/ {fmt(style.soLuong)}</span></div>
              </div>
            </div>
            <Tabs value={tab} onChange={setTab} options={[{ value: "cd", label: "Công đoạn", count: opsOf(sel).length }, { value: "smv", label: "Lịch sử SMV" }]} />
            <div className="flex-1 min-h-0 overflow-auto scroll-area">
              {tab === "cd" ? (
                <table className="grid-table hoverable text-body">
                  <colgroup><col style={{ width: 100 }} /><col /><col style={{ width: 110 }} /><col style={{ width: 150 }} /><col style={{ width: 150 }} /><col style={{ width: 90 }} /></colgroup>
                  <thead><tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted">
                    <th className="px-3 text-left">Mã CĐ</th><th className="px-3 text-left">Tên công đoạn</th><th className="px-3 text-right">SMV (giây)</th><th className="px-3 text-left">Đang gán</th><th className="px-3 text-left">Trạng thái</th><th className="px-3" />
                  </tr></thead>
                  <tbody>{ops.map((o) => (
                    <tr key={o.cd} className={cn(!o.active && "text-muted")}>
                      <td className="px-3 font-mono text-[13px]">{o.cd}</td>
                      <td className="px-3"><span className="flex items-center gap-2">{o.ten}{o.qc && <span className="h-[18px] px-1.5 rounded-pill bg-closed-bg text-closed-ink text-tag font-semibold inline-flex items-center gap-0.5" data-tip="Công đoạn hoàn thành — dùng tính Đã làm"><Star className="w-3 h-3" />QC</span>}</span></td>
                      <td className="px-3 text-right"><button onClick={() => setSmvEdit(o)} className="num font-semibold rounded-ctl px-2 py-1 hover:ring-1 hover:ring-line-strong transition duration-fast" aria-label={`Đổi SMV ${o.cd}`}>{o.smv}</button></td>
                      <td className="px-3 text-chip">{o.stations.length ? `C05 · trạm ${o.stations.join(", ")}` : <span className="text-muted">—</span>}</td>
                      <td className="px-3">{o.active ? <Pill tone="closed">Hoạt động</Pill> : <Pill tone="locked">Ngưng</Pill>}</td>
                      <td className="px-3 text-right">
                        {o.active && <button onClick={() => o.stations.length ? toast(`Công đoạn đang gán tại trạm ${o.stations.join(", ")} — gỡ khỏi trạm trước khi ngưng`, "warn") : toast(`Đã ngưng ${o.cd}`)} className="text-chip font-semibold text-muted hover:text-ink">Ngưng</button>}
                      </td>
                    </tr>))}</tbody>
                </table>
              ) : (
                <ol className="p-4 flex flex-col gap-3">
                  {SMV_HIST.map((h) => (
                    <li key={h.cd} className="rounded-card border border-line p-3 flex items-center gap-3">
                      <History className="w-5 h-5 text-muted" />
                      <div className="text-chip">
                        <div><span className="font-mono">{h.cd}</span> · SMV <b className="num">{h.from}s → {h.to}s</b> · áp dụng từ <b className="num">{h.day}</b></div>
                        <div className="text-sub text-muted">{h.by} · {h.at} · tính lại snapshot {fmt(h.n)} bản ghi (chỉ ngày chưa khóa)</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      </Page>
      <StatusBar right={<span>Mỗi mã hàng có đúng 1 công đoạn hoàn thành (QC ★)</span>}>
        <span>Đổi SMV không làm thay đổi số liệu của ngày đã khóa</span>
      </StatusBar>

      <Modal open={!!smvEdit} onClose={() => setSmvEdit(null)} title={`Đổi SMV · ${smvEdit?.cd ?? ""} ${smvEdit?.ten ?? ""}`}
        footer={<><Button onClick={() => setSmvEdit(null)}>Hủy</Button><Button variant="primary" onClick={() => { setSmvEdit(null); toast("Đã đổi SMV · tính lại 312 bản ghi từ ngày áp dụng"); }}>Lưu</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SMV mới (giây)" required hint={`Hiện tại: ${smvEdit?.smv}s`}><Input defaultValue={smvEdit?.smv} inputMode="numeric" className="w-full text-right num" /></Field>
          <Field label="Áp dụng từ ngày" required hint="Sớm nhất: 01/09/2026 (ngày chưa khóa)"><Input type="date" defaultValue="2026-09-29" min="2026-09-01" className="w-full" /></Field>
        </div>
      </Modal>
    </>
  );
}
