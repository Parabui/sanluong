"use client";

import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, FileUp, Plus, RefreshCw, Upload } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Button, Field, Input, Modal, Page, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { NOW } from "@/lib/demo-data";
import { addDays, cn, ddmm, fmt, weekdayShort } from "@/lib/utils";

const DAYS = Array.from({ length: 6 }, (_, i) => addDays("2026-09-28", i)); // T2 → T7
const LINES = [
  { ma: "C03", mh: "PL-2588" }, { ma: "C04", mh: "PL-2588" }, { ma: "C05", mh: "PL-2641" }, { ma: "C05", mh: "SH-2655" },
  { ma: "C06", mh: "PL-2641" }, { ma: "C07", mh: "DR-2633" }, { ma: "C08", mh: "JK-2702" },
];
const plan = (li: number, di: number) => (LINES[li].mh === "JK-2702" && di < 3 ? null : [1900, 2000, 2100, 700, 1950, 1400, 900][li] + ((di * 37 + li * 13) % 5) * 50);
const actual = (li: number, di: number) => (DAYS[di] < NOW.date ? Math.round((plan(li, di) ?? 0) * [0.96, 1.02, 0.91, 0.84, 0.99, 1.05, 0][li]) : null);

export default function PlanPage() {
  const toast = useToast();
  const { q } = useShell();
  const [imp, setImp] = useState<0 | 1 | 2>(0);
  const [add, setAdd] = useState(false);
  const s = q.trim().toLowerCase();

  return (
    <>
      <Page>
        <Toolbar title="Kế hoạch sản lượng" right={<>
          <Button icon={Plus} onClick={() => setAdd(true)}>Thêm tay</Button>
          <Button variant="primary" icon={Upload} onClick={() => setImp(1)}>Import Excel</Button>
        </>}>
          <div className="flex items-center" role="group" aria-label="Chọn tuần">
            <button className="w-9 h-9 grid place-items-center rounded-l-ctl border border-line-strong bg-surface hover:bg-hover" aria-label="Tuần trước"><ChevronLeft className="w-[18px] h-[18px]" /></button>
            <span className="h-9 -mx-px px-3 flex items-center border border-line-strong bg-surface text-body num">Tuần 40 · 28/09 – 03/10/2026</span>
            <button className="w-9 h-9 grid place-items-center rounded-r-ctl border border-line-strong bg-surface hover:bg-hover" aria-label="Tuần sau"><ChevronRight className="w-[18px] h-[18px]" /></button>
          </div>
          <Select label="Xưởng" className="w-36"><option>Xưởng May 1</option></Select>
        </Toolbar>

        <section className="bg-surface border border-line rounded-card overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto scroll-area">
            <table className="grid-table hoverable text-body">
              <colgroup><col style={{ width: 170 }} />{DAYS.map((d) => <col key={d} />)}<col style={{ width: 130 }} /></colgroup>
              <thead>
                <tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted">
                  <th className="px-3 text-left">Chuyền · Mã hàng</th>
                  {DAYS.map((d) => <th key={d} className={cn("px-3 text-right", d === NOW.date && "text-brand-ink")}>{weekdayShort(d)} {ddmm(d)}{d === NOW.date && " · Hôm nay"}</th>)}
                  <th className="px-3 text-right">Tổng tuần</th>
                </tr>
              </thead>
              <tbody>
                {LINES.map((l, li) => {
                  if (s && !`${l.ma} ${l.mh}`.toLowerCase().includes(s)) return null;
                  const tot = DAYS.reduce((a, _, di) => a + (plan(li, di) ?? 0), 0);
                  return (
                    <tr key={l.ma + l.mh}>
                      <td className="px-3"><b>{l.ma}</b> <span className="h-[18px] px-1.5 ml-1 rounded-pill bg-group text-tag font-semibold inline-flex items-center">{l.mh}</span></td>
                      {DAYS.map((d, di) => {
                        const p = plan(li, di), a = actual(li, di);
                        const pc = p && a != null ? Math.round((a / p) * 100) : null;
                        return (
                          <td key={d} className={cn("px-3 text-right", d === NOW.date && "bg-brand-soft/50")}>
                            {p == null ? <span className="text-muted">—</span> : (
                              <button onClick={() => toast(d < NOW.date ? "Sửa kế hoạch ngày đã qua — bắt buộc lý do" : `Sửa kế hoạch ${l.ma} ${ddmm(d)}`, "info")}
                                className="w-full flex flex-col items-end leading-tight rounded-ctl px-1 py-0.5 hover:ring-1 hover:ring-line-strong transition duration-fast">
                                <span className="num font-semibold">{fmt(p)}</span>
                                {pc != null && <span className={cn("text-sub num", pc >= 95 ? "text-closed-ink" : pc >= 85 ? "text-muted" : "text-warn-ink")}>TT {fmt(a)} · {pc}%</span>}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 text-right num font-semibold">{fmt(tot)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </Page>
      <StatusBar right={<span>Thực tế = sản lượng công đoạn hoàn thành (QC)</span>}>
        <span>TT = thực tế · % đạt = Thực tế ÷ Kế hoạch</span>
        <span className="text-closed-ink">≥ 95%</span><span className="text-warn-ink">&lt; 85%</span>
      </StatusBar>

      <Modal open={imp > 0} onClose={() => setImp(0)} title="Import kế hoạch từ Excel" width={560}
        footer={imp === 1 ? <><Button onClick={() => setImp(0)}>Hủy</Button><Button variant="primary" onClick={() => setImp(2)}>Kiểm tra file</Button></>
          : <><Button onClick={() => setImp(1)}>Chọn file khác</Button><Button variant="primary" onClick={() => { setImp(0); toast("Đã ghi 84 dòng kế hoạch · bỏ qua 2 dòng lỗi"); }}>Xác nhận ghi 84 dòng</Button></>}>
        {imp === 1 ? (
          <label className="block rounded-card border-2 border-dashed border-line-strong hover:border-brand bg-thead hover:bg-brand-soft/40 transition-colors duration-fast p-8 text-center cursor-pointer">
            <FileUp className="w-8 h-8 mx-auto text-muted" />
            <p className="text-body font-medium mt-2">Kéo thả file .xlsx vào đây hoặc bấm để chọn</p>
            <p className="text-sub text-muted mt-1">Cột: Ngày · Chuyền · Mã hàng · Số lượng kế hoạch · tối đa 10 MB / 5.000 dòng</p>
            <input type="file" accept=".xlsx" className="sr-only" onChange={() => setImp(2)} />
          </label>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-chip text-muted">KeHoach_T10-2026.xlsx · 86 dòng</p>
            <div className="grid grid-cols-3 gap-2">
              {[["Thêm mới", 62, "text-closed-ink", CircleCheck], ["Cập nhật", 22, "text-open-ink", RefreshCw], ["Lỗi", 2, "text-danger", CircleAlert]].map(([l, n, c, I]) => {
                const Ic = I as typeof CircleCheck;
                return <div key={l as string} className="rounded-card border border-line p-3"><div className={cn("flex items-center gap-1.5 text-chip font-medium", c as string)}><Ic className="w-4 h-4" />{l as string}</div><div className="text-[22px] font-semibold mt-1">{n as number}</div></div>;
              })}
            </div>
            <ul className="rounded-card border border-line divide-y divide-line text-chip">
              <li className="px-3 py-2 flex gap-2"><span className="text-muted w-14">Dòng 17</span><span className="text-danger">Mã hàng “PL-2461” không tồn tại</span></li>
              <li className="px-3 py-2 flex gap-2"><span className="text-muted w-14">Dòng 52</span><span className="text-danger">Số lượng ≤ 0</span></li>
              <li className="px-3 py-2 flex gap-2 bg-empty-bg text-empty-ink"><span className="w-14">Cảnh báo</span><span>Tổng kế hoạch JK-2702 vượt số lượng đơn hàng — vẫn lưu</span></li>
            </ul>
          </div>
        )}
      </Modal>

      <Modal open={add} onClose={() => setAdd(false)} title="Thêm kế hoạch"
        footer={<><Button onClick={() => setAdd(false)}>Hủy</Button><Button variant="primary" onClick={() => { setAdd(false); toast("Đã thêm kế hoạch"); }}>Lưu</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày" required><Input type="date" defaultValue="2026-10-01" className="w-full" /></Field>
          <Field label="Chuyền" required><Select label="Chuyền" className="w-full"><option>C05</option><option>C06</option></Select></Field>
          <Field label="Mã hàng" required><Select label="Mã hàng" className="w-full"><option>PL-2641</option><option>SH-2655</option></Select></Field>
          <Field label="Số lượng kế hoạch" required><Input inputMode="numeric" defaultValue="2.100" className="w-full text-right num" /></Field>
        </div>
      </Modal>
    </>
  );
}
