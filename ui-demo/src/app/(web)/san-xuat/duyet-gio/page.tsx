"use client";

import { Check, CheckCheck, Clock, Pencil, X } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { DataTable, type Col } from "@/components/ui/data-table";
import { Button, Field, Input, Modal, Page, Pill, ReasonChips, Select, Tabs, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn, ddmm, ddmmyyyy, fmtH, weekdayShort } from "@/lib/utils";

type Req = {
  id: number; nv: string; hoTen: string; date: string; def: number; req: number; sent: string;
  status: "CHO" | "DUYET" | "TU_CHOI"; by?: string; reason?: string; sl: string; support?: string;
};
const INIT: Req[] = [
  { id: 1, nv: "NV00956", hoTen: "Đặng Thị Vân", date: "2026-09-28", def: 9, req: 10.5, sent: "09:05 29/09", status: "CHO", sl: "C05 · 1.350 sp" },
  { id: 2, nv: "NV00914", hoTen: "Phan Thị Nhung", date: "2026-09-28", def: 9, req: 7, sent: "18:40 28/09", status: "CHO", sl: "C05 · 2.200 sp" },
  { id: 3, nv: "NV00788", hoTen: "Huỳnh Thị Kim", date: "2026-09-28", def: 9, req: 11, sent: "20:12 28/09", status: "CHO", sl: "C05 · 455 sp", support: "C03" },
  { id: 4, nv: "NV00412", hoTen: "Lê Thị Hoa", date: "2026-09-26", def: 8, req: 9.5, sent: "17:30 26/09", status: "DUYET", by: "Nguyễn Văn Bình · 08:12 28/09", sl: "C05 · 530 sp" },
  { id: 5, nv: "NV00655", hoTen: "Bùi Thị Hạnh", date: "2026-09-25", def: 9, req: 12, sent: "19:02 25/09", status: "TU_CHOI", by: "Nguyễn Văn Bình · 08:20 26/09", reason: "Không có lệnh tăng ca", sl: "C05 · 470 sp" },
  { id: 6, nv: "NV00231", hoTen: "Nguyễn Thị Lan", date: "2026-09-25", def: 9, req: 10, sent: "17:55 25/09", status: "DUYET", by: "Nguyễn Văn Bình · 08:18 26/09", sl: "C05 · 420 sp" },
];
const REJECT = ["Không có lệnh tăng ca", "Số giờ không khớp chấm công", "Nhập nhầm ngày", "Khác"];

export default function ApproveHoursPage() {
  const toast = useToast();
  const { q } = useShell();
  const [list, setList] = useState(INIT);
  const [tab, setTab] = useState<Req["status"]>("CHO");
  const [rej, setRej] = useState<Req | null>(null);
  const [rejReason, setRejReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [err, setErr] = useState("");

  const cnt = (s: Req["status"]) => list.filter((r) => r.status === s).length;
  const s = q.trim().toLowerCase();
  const rows = list.filter((r) => r.status === tab && (!s || `${r.nv} ${r.hoTen}`.toLowerCase().includes(s)));
  const approve = (ids: number[]) => {
    setList(list.map((r) => (ids.includes(r.id) ? { ...r, status: "DUYET", by: "Nguyễn Văn Bình · 09:15 29/09" } : r)));
    toast(ids.length > 1 ? `Đã duyệt ${ids.length} yêu cầu` : "Đã duyệt · báo cáo dùng giờ mới");
  };

  const cols: Col<Req>[] = [
    { key: "nv", label: "Công nhân", width: 200, render: (r) => (<div><div className="font-medium">{r.hoTen}</div><div className="text-sub text-muted"><span className="font-mono">{r.nv}</span> · chuyền gốc C05</div></div>) },
    { key: "date", label: "Ngày làm việc", width: 120, render: (r) => <span className="num whitespace-nowrap">{weekdayShort(r.date)}, {ddmm(r.date)}</span> },
    { key: "def", label: "Mặc định", width: 90, align: "right", render: (r) => <span className="num text-muted">{fmtH(r.def)}</span> },
    { key: "req", label: "Đề nghị", width: 120, align: "right", render: (r) => {
      const d = r.req - r.def;
      return <span className="inline-flex items-center gap-2 justify-end"><b className="num text-qty">{fmtH(r.req)}</b><span className={cn("text-sub font-semibold num", d > 0 ? "text-open-ink" : "text-warn-ink")}>{d > 0 ? "+" : "−"}{fmtH(Math.abs(d))}</span></span>;
    } },
    { key: "sl", label: "Sản lượng ngày đó", render: (r) => (<span className="flex items-center gap-1.5 flex-wrap">{r.sl}{r.support && <Pill size="sm" tone="support">Hỗ trợ {r.support}</Pill>}</span>) },
    { key: "sent", label: tab === "CHO" ? "Gửi lúc" : "Xử lý", width: tab === "CHO" ? 110 : 230, render: (r) => tab === "CHO" ? <span className="num text-muted whitespace-nowrap">{r.sent}</span> : (
      <div className="text-sub"><div className="text-muted">{r.by}</div>{r.reason && <div className="text-danger">Lý do: {r.reason}</div>}</div>) },
    { key: "act", label: <span className="sr-only">Thao tác</span>, width: tab === "CHO" ? 224 : 130, align: "right", render: (r) => tab === "CHO" ? (
      <span className="inline-flex gap-1.5 whitespace-nowrap">
        <Button size="sm" icon={X} onClick={() => { setRej(r); setRejReason(""); setErr(""); }}>Từ chối</Button>
        <Button size="sm" variant="primary" icon={Check} onClick={() => approve([r.id])}>Duyệt</Button>
      </span>) : r.status === "DUYET" ? <Pill tone="closed" icon={Check}>Đã duyệt</Pill> : <Pill tone="danger" icon={X}>Từ chối</Pill> },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Duyệt giờ làm" right={<>
          <Button icon={Pencil} onClick={() => setEditOpen(true)}>Sửa giờ trực tiếp</Button>
          {tab === "CHO" && cnt("CHO") > 0 && <Button variant="primary" icon={CheckCheck} onClick={() => approve(list.filter((r) => r.status === "CHO").map((r) => r.id))}>Duyệt tất cả ({cnt("CHO")})</Button>}
        </>}>
          <Select label="Chuyền gốc" defaultValue="C05" className="w-40"><option value="C05">C05 · Chuyền 5</option><option value="C06">C06 · Chuyền 6</option></Select>
          <span className="text-sub text-muted ml-2 max-w-[320px] leading-4">Duyệt cho NV thuộc chuyền gốc của bạn — kể cả khi họ hỗ trợ chuyền khác.</span>
        </Toolbar>

        <section className="bg-surface border border-line rounded-card flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={tab} onChange={setTab} options={[{ value: "CHO", label: "Chờ duyệt", count: cnt("CHO") }, { value: "DUYET", label: "Đã duyệt", count: cnt("DUYET") }, { value: "TU_CHOI", label: "Từ chối", count: cnt("TU_CHOI") }]} />
          <DataTable cols={cols} rows={rows} rowKey={(r) => String(r.id)} className="border-0 rounded-none" emptyIcon={CheckCheck}
            empty={tab === "CHO" ? "Không còn yêu cầu chờ duyệt" : "Chưa có dữ liệu"} />
        </section>
      </Page>
      <StatusBar right={<span>Giờ mặc định X1: T2–T6 9 giờ · T7 8 giờ · CN trống</span>}>
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Chưa duyệt → báo cáo tạm tính giờ mặc định</span>
      </StatusBar>

      <Modal open={!!rej} onClose={() => setRej(null)} title="Từ chối yêu cầu sửa giờ"
        footer={<><Button onClick={() => setRej(null)}>Hủy</Button><Button variant="danger" onClick={() => {
          if (!rejReason) return setErr("Bắt buộc chọn lý do khi từ chối.");
          setList(list.map((r) => (r.id === rej!.id ? { ...r, status: "TU_CHOI", reason: rejReason, by: "Nguyễn Văn Bình · 09:15 29/09" } : r)));
          setRej(null); toast("Đã từ chối · công nhân thấy lý do trên app");
        }}>Từ chối</Button></>}>
        {rej && <p className="text-body text-muted mb-4">{rej.hoTen} · {ddmmyyyy(rej.date)} · đề nghị <b className="text-ink num">{fmtH(rej.req)} giờ</b> (mặc định {fmtH(rej.def)})</p>}
        <ReasonChips name="rej" reasons={REJECT} value={rejReason} onChange={(v) => { setRejReason(v); setErr(""); }} />
        {err && <p className="text-sub text-danger mt-1.5" role="alert">{err}</p>}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Sửa giờ làm trực tiếp"
        footer={<><Button onClick={() => setEditOpen(false)}>Hủy</Button><Button variant="primary" onClick={() => { setEditOpen(false); toast("Đã sửa giờ làm · ghi lịch sử"); }}>Lưu</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Công nhân" required><Select label="Công nhân" className="w-full"><option>NV00127 · Phạm Thị Mai</option><option>NV00412 · Lê Thị Hoa</option></Select></Field></div>
          <Field label="Ngày làm việc" required><Input type="date" defaultValue="2026-09-28" className="w-full" /></Field>
          <Field label="Số giờ" required hint="> 0 và ≤ 16, VD 9,5"><Input defaultValue="9,5" inputMode="decimal" className="w-full num text-right" /></Field>
          <div className="col-span-2"><Field label="Lý do" required><Input placeholder="VD: Làm lẫn trạm JACK buổi chiều" className="w-full" /></Field></div>
        </div>
      </Modal>
    </>
  );
}
