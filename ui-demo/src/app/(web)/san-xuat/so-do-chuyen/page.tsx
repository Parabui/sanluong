"use client";

import { Copy, Flag, GripVertical, Save, Undo2, X } from "lucide-react";
import { useState } from "react";
import { StatusBar } from "@/components/shell/app-shell";
import { useShell } from "@/components/shell/shell-context";
import { Button, Modal, Page, Select, Toolbar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { C05_MAP, STATIONS, UNASSIGNED_OPS, type Op } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type MapT = Record<number, Op[]>;
const MH_COLOR: Record<string, string> = { "PL-2641": "bg-brand-soft text-brand-ink border-brand/30", "SH-2655": "bg-support-bg text-support-ink border-support-ink/20" };
const clone = (m: MapT): MapT => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));

export default function LineMapPage() {
  const toast = useToast();
  const { q } = useShell();
  const [map, setMap] = useState<MapT>(() => clone(C05_MAP));
  const [pool, setPool] = useState<Op[]>(UNASSIGNED_OPS);
  const [dirty, setDirty] = useState(0);
  const [over, setOver] = useState<number | "pool" | null>(null);
  const [picked, setPicked] = useState<{ op: Op; from: number | "pool" } | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);

  const move = (op: Op, from: number | "pool", to: number | "pool") => {
    if (from === to) return;
    if (to !== "pool" && map[to]?.some((o) => o.cd === op.cd && o.mh === op.mh)) return toast(`Trạm ${to} đã có ${op.cd}`, "warn");
    const m = clone(map);
    let p = [...pool];
    if (from === "pool") p = p.filter((o) => !(o.cd === op.cd && o.mh === op.mh));
    else m[from] = m[from].filter((o) => !(o.cd === op.cd && o.mh === op.mh));
    if (to === "pool") { if (!p.some((o) => o.cd === op.cd && o.mh === op.mh)) p.push(op); }
    else m[to] = [...(m[to] || []), op];
    setMap(m); setPool(p); setDirty((d) => d + 1); setPicked(null);
  };

  const drag = (op: Op, from: number | "pool") => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData("text/plain", JSON.stringify({ op, from })); e.dataTransfer.effectAllowed = "move"; },
    onClick: () => setPicked(picked && picked.op.cd === op.cd && picked.from === from ? null : { op, from }),
  });
  const drop = (to: number | "pool") => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(to); },
    onDragLeave: () => setOver((o) => (o === to ? null : o)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(null); try { const { op, from } = JSON.parse(e.dataTransfer.getData("text/plain")); move(op, from, to); } catch {} },
  });

  const s = q.trim().toLowerCase();
  const match = (o: Op) => (!s || `${o.cd} ${o.ten}`.toLowerCase().includes(s)) && (!styleFilter || o.mh === styleFilter);
  const assignedCount = Object.values(map).reduce((n, v) => n + v.length, 0);

  const OpChip = ({ op, from }: { op: Op; from: number | "pool" }) => {
    const sel = picked?.op.cd === op.cd && picked.op.mh === op.mh && picked.from === from;
    const inStation = from !== "pool";
    return (
      <div {...drag(op, from)} role="button" tabIndex={0} aria-pressed={sel} aria-label={`${op.cd} ${op.ten}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(sel ? null : { op, from }); } }}
        className={cn("group/op relative rounded-ctl border text-chip cursor-grab active:cursor-grabbing select-none transition duration-fast",
          inStation ? "px-2 py-1" : "flex items-center gap-1.5 pl-1 pr-1.5 py-1.5",
          MH_COLOR[op.mh], sel && "ring-2 ring-brand-ink", !match(op) && "opacity-30")}>
        {inStation ? (
          <>
            <div className="flex items-center gap-1">
              <span className="font-mono text-tag font-semibold">{op.cd}</span>
              {op.qc && <span className="text-tag font-semibold text-closed-ink">★</span>}
              <span className="ml-auto text-tag opacity-70 num">{op.smv}s</span>
            </div>
            <div className="font-medium truncate leading-4">{op.ten}</div>
            <button onClick={(e) => { e.stopPropagation(); move(op, from, "pool"); }} aria-label={`Gỡ ${op.cd} khỏi trạm ${from}`}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 grid place-items-center rounded-full bg-surface border border-line-strong text-muted hover:text-ink opacity-0 group-hover/op:opacity-100 focus:opacity-100 shadow-pop"><X className="w-3 h-3" /></button>
          </>
        ) : (
          <>
            <GripVertical className="w-3.5 h-3.5 opacity-50" />
            <span className="font-mono text-tag font-semibold">{op.cd}</span>
            <span className="truncate font-medium">{op.ten}</span>
            <span className="ml-auto text-tag opacity-70 num">{op.smv}s</span>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Page>
        <Toolbar title="Sơ đồ chuyền" right={<>
          <Button icon={Copy} onClick={() => setCopyOpen(true)}>Sao chép sơ đồ</Button>
          <Button icon={Flag} onClick={() => setEndOpen(true)}>Kết thúc mã hàng</Button>
          <Button variant="primary" icon={Save} disabled={!dirty} onClick={() => { setDirty(0); toast("Đã lưu sơ đồ · app công nhân cập nhật ở lần mở tiếp theo"); }}>Lưu</Button>
        </>}>
          <Select label="Chuyền" defaultValue="C05" className="w-40"><option value="C05">C05 · Chuyền 5</option><option value="C06">C06 · Chuyền 6</option></Select>
          <div className="flex items-center gap-1.5 ml-1" data-tip="2/2 mã hàng đang chạy trên chuyền · bấm để làm nổi công đoạn của mã">
            {["PL-2641", "SH-2655"].map((mh) => (
              <button key={mh} onClick={() => setStyleFilter(styleFilter === mh ? null : mh)} aria-pressed={styleFilter === mh}
                className={cn("h-8 px-3 rounded-pill border text-chip font-semibold whitespace-nowrap transition duration-fast", MH_COLOR[mh], styleFilter === mh && "ring-2 ring-offset-1 ring-current")}>{mh}</button>
            ))}
          </div>
          {dirty > 0 && <span className="ml-2 text-chip text-brand-ink font-semibold flex items-center gap-1.5 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-brand" />{dirty} thay đổi chưa lưu
            <button onClick={() => { setMap(clone(C05_MAP)); setPool(UNASSIGNED_OPS); setDirty(0); }} className="ml-1 text-muted hover:text-ink inline-flex items-center gap-1 font-medium"><Undo2 className="w-3.5 h-3.5" />Hoàn tác</button></span>}
        </Toolbar>

        <div className="flex-1 min-h-0 grid grid-cols-[264px_minmax(0,1fr)] gap-4">
          {/* Công đoạn chưa gán */}
          <section {...drop("pool")} className={cn("bg-surface border border-line rounded-card flex flex-col min-h-0", over === "pool" && "drop-target")}>
            <div className="h-12 px-4 flex items-center border-b border-line">
              <h2 className="text-h font-semibold">Chưa gán trạm</h2>
              <span className="ml-auto h-[18px] min-w-[18px] px-1.5 rounded-pill bg-empty-bg text-empty-ink text-tag font-semibold grid place-items-center">{pool.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-3 flex flex-col gap-1.5">
              {pool.length ? pool.map((o) => <OpChip key={o.mh + o.cd} op={o} from="pool" />) : <p className="text-chip text-muted text-center py-8">Mọi công đoạn đã được gán.</p>}
            </div>
            <p className="px-4 py-3 border-t border-line text-sub text-muted">Kéo công đoạn thả vào trạm. Hoặc bấm chọn công đoạn rồi bấm vào trạm.</p>
          </section>

          {/* 18 trạm — vừa 1 màn hình 1366×768 */}
          <section className="grid grid-cols-6 grid-rows-3 gap-2 min-h-0">
            {STATIONS.map((t) => {
              const ops = map[t] || [];
              const special = t === 12 ? "QC" : t === 25 ? "Ủi" : null;
              return (
                <div key={t} {...drop(t)}
                  onClick={() => picked && move(picked.op, picked.from, t)}
                  className={cn("bg-surface border rounded-card p-2 flex flex-col gap-1.5 min-h-0 overflow-hidden transition-colors duration-fast",
                    over === t ? "drop-target" : picked ? "border-brand/60 cursor-copy hover:bg-brand-soft" : "border-line")}>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-qty font-semibold num" aria-label={`Trạm ${t}`}><span className="text-sub text-muted font-medium">Trạm </span>{t}</span>
                    {special && <span className="h-[18px] px-1.5 rounded-pill bg-closed-bg text-closed-ink text-tag font-semibold inline-flex items-center">{special}</span>}
                    <span className="ml-auto text-tag text-muted">{ops.length ? `${ops.length} CĐ` : "Trống"}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 min-h-0 overflow-y-auto no-scrollbar pt-1 pr-1">
                    {ops.map((o) => <OpChip key={o.mh + o.cd} op={o} from={t} />)}
                    {!ops.length && <div className="flex-1 min-h-10 rounded-ctl border border-dashed border-line-strong grid place-items-center text-sub text-muted">Thả công đoạn</div>}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </Page>
      <StatusBar right={<span>Phiên bản gán hiện hành: 29/09 07:30 · Nguyễn Văn Bình</span>}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-soft border border-brand" />PL-2641 · Áo polo nam</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-support-bg border border-support-ink" />SH-2655 · Quần short</span>
        <span><b className="text-ink num">{assignedCount}</b> công đoạn đã gán · 18 trạm</span>
      </StatusBar>

      <Modal open={endOpen} onClose={() => setEndOpen(false)} title="Kết thúc mã hàng?"
        footer={<><Button onClick={() => setEndOpen(false)} data-autofocus>Hủy</Button><Button variant="primary" onClick={() => { setEndOpen(false); toast("Đã kết thúc SH-2655 trên C05 · gỡ 3 công đoạn"); const m = clone(map); for (const k in m) m[k] = m[k].filter((o) => o.mh !== "SH-2655"); setMap(m); }}>Kết thúc SH-2655</Button></>}>
        <p className="text-body text-muted">Gỡ toàn bộ công đoạn của mã <b className="text-ink">SH-2655</b> khỏi các trạm C05. Sản lượng đã nhập và sơ đồ các ngày trước <b className="text-ink">không bị ảnh hưởng</b>; công nhân vẫn nhập được số cuối ngày hôm nay.</p>
      </Modal>
      <Modal open={copyOpen} onClose={() => setCopyOpen(false)} title="Sao chép sơ đồ"
        footer={<><Button onClick={() => setCopyOpen(false)}>Hủy</Button><Button variant="primary" onClick={() => { setCopyOpen(false); toast("Đã sao chép bố cục · bỏ qua 1 công đoạn đã ngưng"); }}>Sao chép</Button></>}>
        <div className="flex flex-col gap-3">
          <Select label="Nguồn" className="w-full"><option>C06 · PL-2641 (cùng mã hàng — giữ bố cục + công đoạn)</option><option>C03 · PL-2588 (khác mã — chỉ giữ bố cục trạm)</option></Select>
          <p className="text-sub text-muted">Công đoạn đã Ngưng sẽ bị bỏ qua và báo số lượng.</p>
        </div>
      </Modal>
    </>
  );
}
