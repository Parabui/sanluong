"use client";

import { Building2, ChevronRight, Factory, Plus, Printer, QrCode, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Button, Field, Input, Modal, Page, Pill, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { LINES } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const APP_STATIONS = new Set([12, 25, ...Array.from({ length: 16 }, (_, i) => 26 + i)]);
const uuid = (line: string, t: number) => `7f3c${line.toLowerCase()}-${String(t).padStart(4, "0")}-4a1e-9b2d-0c5e${(t * 7919).toString(16).padStart(8, "0")}`;

export default function LinesPage() {
  const toast = useToast();
  const { q } = useShell();
  const [sel, setSel] = useState("C05");
  const [app, setApp] = useState(() => new Set(APP_STATIONS));
  const [qr, setQr] = useState(false);
  const [add, setAdd] = useState(false);
  const s = q.trim().toLowerCase();
  const line = LINES.find((l) => l.ma === sel)!;
  const sewing = LINES.filter((l) => l.loai === "Chuyền may" && (!s || `${l.ma} ${l.ten}`.toLowerCase().includes(s)));
  const outer = LINES.filter((l) => l.loai === "Vòng ngoài" && (!s || `${l.ma} ${l.ten}`.toLowerCase().includes(s)));

  const LineBtn = ({ l }: { l: (typeof LINES)[number] }) => (
    <button onClick={() => setSel(l.ma)} aria-current={l.ma === sel}
      className={cn("w-full h-10 px-3 flex items-center gap-2.5 rounded-ctl text-body text-left transition-colors duration-fast", l.ma === sel ? "bg-brand-soft text-brand-ink font-semibold" : "hover:bg-hover")}>
      <span className="w-12 font-semibold">{l.ma}</span><span className={cn("truncate", l.ma !== sel && "text-muted")}>{l.ten}</span>
      {l.soTram > 0 && <span className="ml-auto text-tag text-muted num">{l.soTram} trạm</span>}
    </button>
  );

  return (
    <>
      <Page>
        <Toolbar title="Xưởng – Chuyền – Trạm" right={<>
          <Button icon={Plus} onClick={() => setAdd(true)}>Thêm chuyền</Button>
          <Button variant="primary" icon={Printer} onClick={() => setQr(true)}>In QR {sel}</Button>
        </>}>
          <span className="text-chip text-muted flex items-center gap-1.5 ml-1"><Building2 className="w-4 h-4" />Nhà máy VIETSUN Đồng Nai<ChevronRight className="w-3.5 h-3.5" /><Factory className="w-4 h-4" />Xưởng May 1 (X1)</span>
        </Toolbar>

        <div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)] gap-4">
          <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-2">
              <div className="h-7 px-3 flex items-center text-tag font-semibold uppercase tracking-[0.06em] text-muted">Chuyền may</div>
              {sewing.map((l) => <LineBtn key={l.ma} l={l} />)}
              <div className="h-7 px-3 mt-2 flex items-center text-tag font-semibold uppercase tracking-[0.06em] text-muted">Vòng ngoài</div>
              {outer.map((l) => <LineBtn key={l.ma} l={l} />)}
            </div>
          </section>

          <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center gap-3">
              <div>
                <h2 className="text-h font-semibold">{line.ma} · {line.ten}</h2>
                <p className="text-sub text-muted">{line.loai} · Xưởng X1 · {line.soTram ? `${line.soTram} trạm · ${[...app].length} trạm nhập qua app` : "Không nhập sản lượng qua app (MVP)"}</p>
              </div>
              <span className="ml-auto"><Pill tone="closed">Hoạt động</Pill></span>
            </div>
            {line.soTram ? (
              <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-4">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
                  {Array.from({ length: line.soTram }, (_, i) => i + 1).map((t) => {
                    const on = app.has(t);
                    return (
                      <button key={t} role="switch" aria-checked={on} onClick={() => { const n = new Set(app); if (on) n.delete(t); else n.add(t); setApp(n); }}
                        className={cn("h-16 rounded-card border px-2.5 py-2 flex flex-col text-left transition-colors duration-fast",
                          on ? "border-brand/50 bg-brand-soft hover:border-brand" : "border-line bg-thead hover:border-line-strong")}>
                        <span className="flex items-center gap-1 w-full whitespace-nowrap"><b className="text-qty num">Trạm {t}</b>{on && <Smartphone className="w-3.5 h-3.5 ml-auto text-brand-ink" />}</span>
                        <span className={cn("text-tag mt-auto", on ? "text-brand-ink font-semibold" : "text-muted")}>{t === 12 ? "QC · app" : t === 25 ? "Ủi · app" : on ? "Nhập qua app" : "JACK"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 grid place-items-center text-chip text-muted">Nhóm vòng ngoài chưa có trạm nhập liệu.</div>
            )}
          </section>
        </div>
      </Page>
      <StatusBar right={<span>Mỗi trạm có mã định danh cố định (UUID) dùng cho QR</span>}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-soft border border-brand" />Nhập qua app (MVP: 12, 25, 26–41)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-thead border border-line" />Chuyền treo JACK ghi nhận</span>
      </StatusBar>

      <Modal open={qr} onClose={() => setQr(false)} title={`In QR trạm · ${sel}`} width={720}
        footer={<><Button onClick={() => setQr(false)}>Đóng</Button><Button variant="primary" icon={Printer} onClick={() => { setQr(false); toast("Đã tạo PDF · A4, 12 QR/trang · 2 trang"); }}>Tải PDF</Button></>}>
        <p className="text-chip text-muted mb-3 flex items-center gap-1.5"><QrCode className="w-4 h-4" />Xem trước trang 1/2 · QR chỉ chứa mã định danh trạm</p>
        <div className="rounded-card border border-line bg-page p-4">
          <div className="mx-auto bg-surface shadow-pop rounded-sm p-5 grid grid-cols-4 gap-4" style={{ width: 560 }}>
            {[...app].sort((a, b) => a - b).slice(0, 12).map((t) => (
              <div key={t} className="border border-dashed border-line-strong rounded-sm p-2 flex flex-col items-center gap-1.5">
                <QRCodeSVG value={uuid(sel, t)} size={84} level="M" />
                <div className="text-center leading-tight"><div className="text-tag text-muted">VSN Sản Lượng · {sel}</div><div className="text-body font-bold">Trạm {t}</div></div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={add} onClose={() => setAdd(false)} title="Thêm chuyền / nhóm"
        footer={<><Button onClick={() => setAdd(false)}>Hủy</Button><Button variant="primary" onClick={() => { setAdd(false); toast("Đã tạo C16 · tự tạo trạm 1 → 41"); }}>Tạo chuyền</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mã chuyền" required><Input defaultValue="C16" className="w-full" /></Field>
          <Field label="Tên" required><Input defaultValue="Chuyền 16" className="w-full" /></Field>
          <Field label="Loại" required><Select label="Loại" className="w-full"><option>Chuyền may</option><option>Vòng ngoài</option></Select></Field>
          <Field label="Số trạm" required hint="Tự tạo trạm 1 → N"><Input defaultValue="41" inputMode="numeric" className="w-full num text-right" /></Field>
        </div>
      </Modal>
    </>
  );
}
