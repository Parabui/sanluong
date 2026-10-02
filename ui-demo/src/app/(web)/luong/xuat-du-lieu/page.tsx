"use client";

import { CircleCheck, Download, FileSpreadsheet, History, Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { Button, Card, CardHeader, Page, Pill, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn, fmt } from "@/lib/utils";

const STYLES = [
  { mh: "TS-2610", sl: 20000, locked: true }, { mh: "DR-2633", sl: 2710, locked: true }, { mh: "PL-2588", sl: 5230, locked: true },
  { mh: "PL-2641", sl: 8640, locked: false }, { mh: "SH-2655", sl: 1210, locked: false },
];
const COLS = ["Mã NV", "Họ tên", "Chuyền", "Ngày", "Mã hàng", "Mã công đoạn", "Sản lượng", "SMV (giây)", "Phút SMV", "Giờ làm"];
const PREVIEW = [
  ["NV00231", "Nguyễn Thị Lan", "C01", "02/09/2026", "TS-2610", "CD-14", "512", "45", "384", "9"],
  ["NV00231", "Nguyễn Thị Lan", "C01", "03/09/2026", "TS-2610", "CD-14", "498", "45", "373,5", "9"],
  ["NV00318", "Trần Văn Hùng", "C02", "02/09/2026", "TS-2610", "CD-12", "760", "30", "380", "9"],
  ["NV00501", "Trịnh Thị Nga", "C07", "15/09/2026", "DR-2633", "CD-09", "210", "58", "203", "9"],
  ["NV00517", "Hồ Thị Bích", "C03", "19/09/2026", "PL-2588", "CD-11", "455", "40", "303,3", "10,5"],
];
const HISTORY = [
  { t: "17:30 27/09/2026", who: "Dương Thị Mỹ", m: "09/2026", rows: 18240, note: "Bản tạm — 3/5 mã hàng" },
  { t: "16:05 05/09/2026", who: "Dương Thị Mỹ", m: "08/2026", rows: 41022, note: "Đủ 7/7 mã hàng" },
  { t: "09:12 05/09/2026", who: "Dương Thị Mỹ", m: "08/2026", rows: 40987, note: "Trước khi mở khóa PL-2510" },
];

export default function PayrollExportPage() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const locked = STYLES.filter((s) => s.locked), open = STYLES.filter((s) => !s.locked);

  return (
    <>
      <Page scroll>
        <Toolbar title="Xuất dữ liệu lương" right={
          <Button variant="primary" icon={busy ? undefined : Download} disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { setBusy(false); toast("Đã xuất SanLuong_09-2026.xlsx · 18.240 dòng"); }, 1200); }}>
            {busy && <span className="spin w-4 h-4 rounded-full border-2 border-current border-t-transparent" />}{busy ? "Đang xuất…" : "Xuất Excel"}
          </Button>}>
          <Select label="Tháng" defaultValue="2026-09" className="w-40"><option value="2026-09">Tháng 09/2026</option><option value="2026-08">Tháng 08/2026</option></Select>
        </Toolbar>

        {open.length > 0 && (
          <div className="rounded-card border border-empty-bar/40 bg-empty-bg px-4 py-3 flex items-center gap-3 text-empty-ink">
            <TriangleAlert className="w-5 h-5 text-empty-bar" />
            <p className="text-body"><b>{open.length} mã hàng chưa khóa</b> — không có trong file: {open.map((s) => s.mh).join(", ")}.</p>
            <Link href="/luong/khoa-so" className="ml-auto text-chip font-semibold hover:underline">Mở Khóa sổ →</Link>
          </div>
        )}

        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
          <Card>
            <CardHeader icon={Lock} title="Trạng thái khóa" sub="tháng 09/2026" />
            <ul className="p-2">
              {STYLES.map((s) => (
                <li key={s.mh} className="h-11 px-2 flex items-center gap-3">
                  {s.locked ? <CircleCheck className="w-[18px] h-[18px] text-closed-ink" /> : <span className="w-[18px] h-[18px] rounded-full border-2 border-dashed border-empty-bar" />}
                  <b className="text-body">{s.mh}</b>
                  <span className="text-sub text-muted num">{fmt(s.sl)} sp</span>
                  <span className="ml-auto">{s.locked ? <Pill size="sm" tone="locked">Đã khóa</Pill> : <Pill size="sm" tone="empty">Chưa khóa</Pill>}</span>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 border-t border-line text-sub text-muted">File chỉ gồm dữ liệu <b className="text-ink">đã khóa</b> · <b className="text-ink num">{fmt(locked.reduce((a, s) => a + s.sl, 0))}</b> sản phẩm</div>
          </Card>

          <Card className="min-w-0">
            <CardHeader icon={FileSpreadsheet} title="Xem trước file" sub="Tên và thứ tự cột cố định giữa các lần xuất" />
            <div className="overflow-x-auto scroll-area">
              <table className="grid-table hoverable text-body" style={{ minWidth: 980 }}>
                <colgroup>{[96, 150, 72, 110, 92, 104, 92, 92, 92, 80].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                <thead><tr className="text-th font-semibold uppercase text-muted">{COLS.map((c, i) => <th key={c} className={cn("px-3 whitespace-nowrap", i >= 6 ? "text-right" : "text-left")}>{c}</th>)}</tr></thead>
                <tbody>{PREVIEW.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className={cn("px-3 whitespace-nowrap truncate", j >= 6 && "text-right num", j === 0 && "font-mono text-[13px]", j === 3 && "num")}>{c}</td>)}</tr>))}</tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-line text-sub text-muted">… 18.235 dòng khác · SMV là số snapshot tại ngày làm việc · Giờ làm: cột tạm chốt</div>
          </Card>
        </div>

        <Card>
          <CardHeader icon={History} title="Lịch sử xuất" />
          <table className="grid-table hoverable text-body">
            <thead><tr className="text-th font-semibold uppercase text-muted"><th className="px-4 text-left">Thời điểm</th><th className="px-4 text-left">Người xuất</th><th className="px-4 text-left">Tháng</th><th className="px-4 text-right">Số dòng</th><th className="px-4 text-left">Ghi chú</th><th className="px-4" /></tr></thead>
            <tbody>{HISTORY.map((h) => (
              <tr key={h.t}><td className="px-4 num text-muted">{h.t}</td><td className="px-4">{h.who}</td><td className="px-4 num">{h.m}</td><td className="px-4 text-right num">{fmt(h.rows)}</td><td className="px-4 text-muted">{h.note}</td>
                <td className="px-4 text-right"><button onClick={() => toast("Tải lại file đã xuất (demo)", "info")} className="text-chip font-semibold text-brand-ink hover:underline">Tải lại</button></td></tr>))}</tbody>
          </table>
        </Card>
      </Page>
      <StatusBar right={<span>Xuất cùng tháng 2 lần không mở khóa ở giữa → 2 file giống hệt</span>}>
        <span>Tổng sản lượng khớp 100% với Báo cáo cùng phạm vi</span>
      </StatusBar>
    </>
  );
}
