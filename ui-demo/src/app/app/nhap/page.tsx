"use client";

import {
  BookOpen, Calendar, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, CircleDashed, ClipboardX, History, Info,
  Lock, LogOut, Minus, Pencil, Plus, RefreshCw, Save, ScanLine, TrendingDown, TriangleAlert, WifiOff, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEADER, useWorker } from "@/components/mobile/store";
import { BigButton, BottomNav, Sheet, WorkerBar } from "@/components/mobile/ui";
import { C05_MAP, HOURS, NOW, type Op } from "@/lib/demo-data";
import { useStored } from "@/lib/hooks";
import { cn, ddmm, fmt, weekday } from "@/lib/utils";

const DATES = ["2026-09-29", "2026-09-28", "2026-09-27", "2026-09-26"]; // hôm nay + 3 ngày liền trước
const DAY_ST: Record<string, "open" | "off" | "closed"> = { "2026-09-29": "open", "2026-09-28": "open", "2026-09-27": "off", "2026-09-26": "closed" };
const key = (d: string, t: number, cd: string) => `${d}|${t}|${cd}`;
const cap = (d: string, smv: number) => Math.floor((HOURS(d) * 3600) / smv * 1.5);
function parse(v: string): { n?: number; empty?: boolean; bad?: boolean } {
  v = v.trim(); if (v === "") return { empty: true };
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  if (!/^\d+$/.test(v)) return { bad: true };
  const n = +v; return n > 99999 ? { bad: true } : { n };
}

export default function EnterOutputPage() {
  const router = useRouter();
  const w = useWorker();
  const { date, rec, online, scenario } = w;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [hintOff, setHintOff] = useStored("vsn-hint-total");
  const hint = !hintOff;
  const [sheet, setSheet] = useState<null | "date" | "menu" | "confirm">(null);
  const [confirmItems, setConfirmItems] = useState<{ kind: "lower" | "high"; ten: string; msg: React.ReactNode }[]>([]);

  // đổi kịch bản demo → xóa số đang gõ (điều chỉnh state ngay khi render)
  const [prevScenario, setPrevScenario] = useState(scenario);
  if (prevScenario !== scenario) { setPrevScenario(scenario); setDraft({}); setErr({}); setOfflineBanner(false); }

  const list = w.sessions[date] || [];
  const tram = w.active[date];
  const ops: Op[] = scenario === "noops" && date === NOW.date ? [] : C05_MAP[tram] ?? [];
  const today = date === NOW.date;

  const changes = (t = tram) => (scenario === "noops" && date === NOW.date ? [] : C05_MAP[t] ?? []).filter((o) => {
    const k = key(date, t, o.cd), dr = draft[k]; if (dr == null) return false;
    const r = rec[k]; if (r?.adj) return false;
    const p = parse(dr); return p.bad || p.empty || (p.n != null && p.n !== r?.v);
  });
  const ch = changes();

  const setVal = (k: string, v: string) => { setDraft((d) => ({ ...d, [k]: v })); setErr((e) => ({ ...e, [k]: "" })); };
  const step = (k: string, by: number) => {
    const cur = parse(draft[k] ?? String(rec[k]?.v ?? ""));
    setVal(k, String(Math.min(99999, Math.max(0, (cur.n ?? 0) + by))));
  };

  const trySave = () => {
    if (saving || !ch.length) return;
    const items: typeof confirmItems = []; let bad: string | null = null; const e: Record<string, string> = {};
    for (const o of ops) {
      const k = key(date, tram, o.cd), dr = draft[k]; if (dr == null || rec[k]?.adj) continue;
      const p = parse(dr), r = rec[k];
      if (p.empty) { e[k] = "Nhập số lượng, hoặc bấm − để về số đã lưu"; bad ??= k; continue; }
      if (p.bad) { e[k] = "Số lượng phải là số nguyên từ 0 đến 99.999"; bad ??= k; continue; }
      if (r && p.n! < r.v) items.push({ kind: "lower", ten: o.ten, msg: <>Số mới <b className="num">{fmt(p.n)}</b> nhỏ hơn số đã lưu <b className="num">{fmt(r.v)}</b>. Ghi đè?</> });
      if (p.n! > cap(date, o.smv)) items.push({ kind: "high", ten: o.ten, msg: <>Số <b className="num">{fmt(p.n)}</b> cao bất thường (tối đa khoảng <b className="num">{fmt(cap(date, o.smv))}</b> cho ca {HOURS(date)} giờ). Bạn chắc chắn?</> });
    }
    setErr(e);
    if (bad) return document.querySelector<HTMLInputElement>(`[data-input="${bad}"]`)?.focus();
    if (items.length) { setConfirmItems(items); setSheet("confirm"); return; }
    doSave();
  };
  const doSave = () => {
    setSaving(true); setOfflineBanner(false);
    setTimeout(() => {
      setSaving(false);
      if (!online) { setOfflineBanner(true); document.getElementById("scroller")?.scrollTo({ top: 0 }); return; }
      const at = today ? NOW.time : `${NOW.time} ${ddmm(NOW.date)}`;
      ch.forEach((o) => { const k = key(date, tram, o.cd); w.saveRec(k, parse(draft[k]).n!, at); });
      setDraft((d) => { const n = { ...d }; ch.forEach((o) => delete n[key(date, tram, o.cd)]); return n; });
      w.toast(`Đã lưu ${ch.length} công đoạn · Trạm ${tram}`);
    }, 700);
  };

  const lastAt = ops.map((o) => rec[key(date, tram, o.cd)]?.at).filter(Boolean).sort().pop();

  return (
    <>
      <WorkerBar onMenu={() => setSheet("menu")}>
        <div className="border-b border-line">
          <div className="no-scrollbar overflow-x-auto flex items-end gap-1 px-2" style={{ height: "var(--tabs-h)" }} role="tablist" aria-label="Trạm đang đăng nhập">
            {list.map((t) => {
              const on = t === tram, dirty = changes(t).length > 0;
              return (
                <button key={t} role="tab" aria-selected={on} onClick={() => w.setActive(date, t)}
                  className={cn("relative h-11 px-4 rounded-t-ctl text-[15px] whitespace-nowrap flex items-center gap-1.5 transition-colors duration-fast", on ? "font-semibold text-ink" : "text-muted hover:text-ink")}>
                  Trạm {t}{dirty && <span className="w-2 h-2 rounded-full bg-brand" aria-label="chưa lưu" />}
                  {on && <span className="absolute left-3 right-3 bottom-0 h-[3px] rounded-t bg-brand" />}
                </button>
              );
            })}
            {today && <button onClick={() => router.push("/app/chon-tram")} className="h-11 px-3 ml-1 text-[15px] font-medium text-brand-ink flex items-center gap-1 whitespace-nowrap rounded-ctl hover:bg-brand-soft"><Plus className="w-[18px] h-[18px]" />Thêm trạm</button>}
          </div>
        </div>
      </WorkerBar>

      <main className="flex-1 min-h-0 flex flex-col">
        {/* Thanh ngày */}
        <div className="shrink-0 bg-surface border-b border-line px-4 py-2.5 flex items-center gap-2">
          <button onClick={() => setSheet("date")} aria-haspopup="dialog"
            className={cn("h-11 pl-3 pr-2.5 rounded-ctl border flex items-center gap-2 text-[15px]", today ? "border-line-strong bg-surface" : "border-empty-bar bg-empty-bg text-empty-ink")}>
            <Calendar className="w-[18px] h-[18px]" /><span className="font-semibold">{today && "Hôm nay · "}{weekday(date)}, {ddmm(date)}</span><ChevronDown className="w-4 h-4 opacity-70" />
          </button>
          <span className="ml-auto text-[13px] text-muted">{HOURS(date) ? `Ca ${HOURS(date)} giờ` : ""}</span>
        </div>

        <div id="scroller" className="no-scrollbar overflow-y-auto overscroll-contain flex-1 min-h-0">
          <div className="px-4 pt-3 flex flex-col gap-2 empty:hidden" aria-live="polite">
            {offlineBanner && (
              <div className="pop-in rounded-card bg-danger-bg border border-danger/30 p-3 flex gap-3">
                <WifiOff className="w-5 h-5 text-danger mt-0.5" />
                <div className="flex-1 text-[14px] leading-snug"><div className="font-semibold text-danger">Chưa lưu được – kiểm tra mạng</div><div>Số bạn nhập vẫn còn trên màn hình. Có mạng lại thì bấm Thử lại.</div></div>
              </div>
            )}
            {!today && (
              <div className="rounded-card bg-empty-bg border border-empty-bar/40 p-3 flex gap-3">
                <History className="w-5 h-5 text-empty-ink mt-0.5" />
                <div className="flex-1 text-[14px] leading-snug text-empty-ink"><div className="font-semibold">Đang nhập cho {weekday(date)}, {ddmm(date)} — không phải hôm nay</div><div>Chỉ nhập bổ sung khi ngày này chưa chốt.</div></div>
                <button onClick={() => w.setDate(NOW.date)} className="self-center h-10 px-3 rounded-ctl bg-surface border border-empty-bar/50 text-[14px] font-semibold text-empty-ink whitespace-nowrap">Hôm nay</button>
              </div>
            )}
            {hint && today && (
              <div className="rounded-card bg-open-bg p-3 flex gap-3">
                <Info className="w-5 h-5 text-open-ink mt-0.5" />
                <div className="flex-1 text-[14px] leading-snug"><div className="font-semibold text-open-ink">Nhập TỔNG số đã làm từ đầu ngày</div><div>Ví dụ: sáng làm 60, chiều thêm 40 → nhập <b>100</b>. Số mới sẽ thay số cũ.</div></div>
                <button onClick={() => setHintOff("1")} className="self-start w-9 h-9 -mr-1 -mt-1 grid place-items-center rounded-full hover:bg-surface/70" aria-label="Đã hiểu, ẩn hướng dẫn"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          <div className="px-4 py-3 flex flex-col gap-3">
            {!list.length ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <ScanLine className="w-12 h-12 text-muted" /><p className="text-[17px] font-semibold">Chưa đăng nhập trạm nào</p>
                <p className="text-[14px] text-muted max-w-[260px]">Quét mã QR dán tại trạm hoặc chọn trạm từ danh sách.</p>
                <BigButton onClick={() => router.push("/app/chon-tram")}><Plus className="w-5 h-5" />Thêm trạm</BigButton>
              </div>
            ) : !ops.length ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <ClipboardX className="w-12 h-12 text-muted" /><p className="text-[17px] font-semibold">Trạm {tram} chưa có công đoạn</p>
                <p className="text-[14px] text-muted max-w-[260px]">Hôm nay trạm chưa được gán công đoạn nào. Liên hệ tổ trưởng.</p>
              </div>
            ) : (
              <>
                {ops.map((o) => {
                  const k = key(date, tram, o.cd), r = rec[k], dr = draft[k];
                  const head = (
                    <>
                      <div className="flex items-center gap-2 text-[13px] text-muted">
                        <span className="h-6 px-2 rounded-pill bg-group text-ink text-[12px] font-semibold inline-flex items-center">{o.mh}</span>
                        <span className="font-mono text-[12px]">{o.cd}</span><span>· SMV {o.smv}s</span>
                        <span className="ml-auto">
                          {r?.adj ? <span className="inline-flex items-center gap-1 text-adjust-ink font-medium"><Pencil className="w-3.5 h-3.5" />Đã điều chỉnh</span>
                            : r ? <span className="inline-flex items-center gap-1 text-closed-ink font-medium"><CircleCheck className="w-4 h-4" />Đã lưu {r.at.split(" ")[0]}</span>
                              : <span className="inline-flex items-center gap-1 text-empty-ink font-medium"><CircleDashed className="w-4 h-4" />Chưa nhập</span>}
                        </span>
                      </div>
                      <h3 className="text-[18px] font-semibold mt-1.5 leading-snug">{o.ten}</h3>
                    </>
                  );
                  if (r?.adj) return (
                    <article key={k} className="rounded-card border border-line bg-surface p-4">
                      {head}
                      <div className="mt-3 rounded-ctl bg-adjust-bg text-adjust-ink p-3 flex gap-3">
                        <Pencil className="w-5 h-5 mt-0.5" />
                        <div className="text-[14px] leading-snug"><div className="font-semibold">Tổ trưởng đã điều chỉnh: <span className="num text-[20px] align-[-2px]">{fmt(r.v)}</span></div>
                          <div>{r.adj.reason} · {fmt(r.adj.old)} → {fmt(r.v)}</div><div className="text-[13px] opacity-80">{r.adj.by} · {r.adj.at}</div></div>
                      </div>
                      <p className="text-[13px] text-muted mt-2 flex items-center gap-1.5"><Lock className="w-4 h-4" />Không sửa được trên app. Sai số? Báo tổ trưởng.</p>
                    </article>
                  );
                  const val = dr ?? (r ? String(r.v) : "");
                  const dirty = ch.some((c) => c.cd === o.cd);
                  const p = dr != null ? parse(dr) : null;
                  return (
                    <article key={k} className={cn("rounded-card border bg-surface p-4 transition-colors duration-fast", dirty ? "border-brand" : "border-line")}>
                      {head}
                      <div className="mt-3 flex items-stretch gap-2">
                        <button onClick={() => step(k, -1)} className="w-[52px] h-[56px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover active:bg-group" aria-label="Bớt 1"><Minus className="w-6 h-6" /></button>
                        <input data-input={k} inputMode="numeric" enterKeyHint="next" autoComplete="off" value={val} placeholder="0" onChange={(e) => setVal(k, e.target.value)}
                          aria-label={`Tổng số đã làm – ${o.ten}`} aria-invalid={!!err[k]}
                          className={cn("num flex-1 min-w-0 h-[56px] rounded-ctl border-2 bg-surface text-center font-semibold outline-none transition-colors duration-fast", err[k] ? "border-danger" : "border-line-strong focus:border-brand-ink")}
                          style={{ fontSize: "var(--fs-qty-input)" }} />
                        <button onClick={() => step(k, 1)} className="w-[52px] h-[56px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover active:bg-group" aria-label="Thêm 1"><Plus className="w-6 h-6" /></button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {[10, 20].map((n) => <button key={n} onClick={() => step(k, n)} className="h-10 px-3.5 rounded-pill border border-line-strong text-[14px] font-medium hover:bg-hover active:bg-group">+{n}</button>)}
                        <span className="ml-auto text-[13px] text-right leading-tight">
                          {dr == null ? (r ? <span className="text-muted">Đã lưu <b className="num text-ink">{fmt(r.v)}</b></span> : <span className="text-muted">Nhập tổng số từ đầu ngày</span>)
                            : p?.bad || p?.empty ? null
                              : !r ? <span className="text-brand-ink font-semibold">Chưa lưu</span>
                                : p!.n === r.v ? <span className="text-muted">Không đổi</span>
                                  : <><span className={cn("font-semibold num", p!.n! < r.v ? "text-warn-ink" : "text-brand-ink")}>{fmt(r.v)} → {fmt(p!.n)} ({p!.n! > r.v ? "+" : "−"}{fmt(Math.abs(p!.n! - r.v))})</span><br /><span className="text-muted">chưa lưu</span></>}
                        </span>
                      </div>
                      {err[k] && <p className="text-[14px] text-danger mt-1.5 flex items-center gap-1" role="alert"><CircleAlert className="w-4 h-4" />{err[k]}</p>}
                    </article>
                  );
                })}
                <p className="text-[13px] text-muted text-center pt-1 pb-2">Trạm {tram} · {ops.length} công đoạn được gán hôm {today ? "nay" : ddmm(date)}</p>
              </>
            )}
          </div>
        </div>

        {/* Thanh Lưu */}
        {list.length > 0 && ops.length > 0 && (
          <div className="shrink-0 bg-surface shadow-bar px-4 py-3 z-10">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0 text-[14px] leading-tight">
                {saving ? <span className="text-muted">Đang gửi lên máy chủ…</span>
                  : offlineBanner && ch.length ? <span className="text-danger font-semibold">{ch.length} công đoạn chưa lưu</span>
                    : ch.length ? <span><b className="text-brand-ink num">{ch.length}</b> công đoạn chưa lưu</span>
                      : <span className="text-closed-ink flex items-center gap-1.5"><CircleCheck className="w-4 h-4" />{lastAt ? `Đã lưu hết · ${lastAt.split(" ")[0]}` : "Chưa có số nào"}</span>}
              </div>
              <button onClick={trySave} disabled={saving || !ch.length} aria-busy={saving}
                className="h-[52px] px-6 min-w-[140px] rounded-ctl bg-brand hover:bg-brand-hover text-ink text-[17px] font-semibold flex items-center justify-center gap-2 transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink disabled:cursor-not-allowed">
                {saving ? <><span className="spin w-5 h-5 rounded-full border-2 border-current border-t-transparent" />Đang lưu…</>
                  : offlineBanner && ch.length ? <><RefreshCw className="w-5 h-5" />Thử lại</> : <><Save className="w-5 h-5" />Lưu</>}
              </button>
            </div>
          </div>
        )}
      </main>
      <BottomNav />

      {/* Chọn ngày */}
      <Sheet open={sheet === "date"} onClose={() => setSheet(null)} title="Chọn ngày làm việc"
        footer={<BigButton variant="secondary" className="w-full" onClick={() => setSheet(null)}>Đóng</BigButton>}>
        <p className="text-[14px] text-muted -mt-1 mb-3">Chỉ nhập được hôm nay và ngày chưa chốt trong 3 ngày gần nhất mà máy còn giữ phiên trạm.</p>
        <div className="flex flex-col gap-1 -mx-2">
          {DATES.map((d) => {
            const st = DAY_ST[d], has = (w.sessions[d] || []).length > 0, ok = st === "open" && has, cur = d === date;
            const note = d === NOW.date ? "Hôm nay" : st === "off" ? "Nghỉ — không có ca" : st === "closed" ? "Đã chốt" : !has ? "Không còn phiên trên máy" : "Chưa chốt · nhập bổ sung được";
            return (
              <button key={d} disabled={!ok} onClick={() => { w.setDate(d); setSheet(null); }}
                className={cn("w-full min-h-[60px] px-3 flex items-center gap-3 rounded-card text-left", cur ? "bg-brand-soft" : ok ? "hover:bg-hover" : "opacity-60 cursor-not-allowed")}>
                <span className="w-11 text-center leading-none"><span className="block text-[12px] text-muted font-semibold uppercase">{weekday(d).replace("Thứ ", "T").replace("Chủ nhật", "CN")}</span><span className="block text-[20px] font-semibold num mt-1">{d.slice(8)}</span></span>
                <span className="flex-1"><span className="block text-[16px] font-medium">{weekday(d)}, {ddmm(d)}</span><span className="block text-[13px] text-muted">{note}</span></span>
                {cur ? <Check className="w-5 h-5 text-brand-ink" /> : ok ? <ChevronRight className="w-5 h-5 text-muted" /> : <Lock className="w-4 h-4 text-muted" />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-muted flex gap-2"><Info className="w-4 h-4 mt-0.5 shrink-0" />Thiếu phiên hoặc ngày đã chốt → nhờ tổ trưởng nhập hộ.</p>
      </Sheet>

      {/* Xác nhận trước khi lưu */}
      <Sheet open={sheet === "confirm"} onClose={() => setSheet(null)} title="Kiểm tra lại trước khi lưu"
        footer={<><BigButton variant="secondary" className="flex-1" onClick={() => setSheet(null)}>Sửa lại</BigButton><BigButton className="flex-1" onClick={() => { setSheet(null); doSave(); }}>Vẫn lưu</BigButton></>}>
        <ul className="flex flex-col gap-2">
          {confirmItems.map((it, i) => (
            <li key={i} className={cn("rounded-card p-3 flex gap-3", it.kind === "lower" ? "bg-warn-bg text-warn-ink" : "bg-danger-bg text-danger")}>
              {it.kind === "lower" ? <TrendingDown className="w-5 h-5 mt-0.5 shrink-0" /> : <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />}
              <div className="text-[15px] leading-snug"><div className="font-semibold">{it.ten}</div><div>{it.msg}</div></div>
            </li>
          ))}
        </ul>
      </Sheet>

      {/* Menu */}
      <Sheet open={sheet === "menu"} onClose={() => setSheet(null)} title="Tùy chọn"
        footer={<BigButton variant="secondary" className="w-full" onClick={() => setSheet(null)}>Đóng</BigButton>}>
        <div className="flex flex-col -mx-2">
          {today && tram && <button onClick={() => { setSheet(null); w.toast(`Đã đăng xuất Trạm ${tram}`); router.push("/app/chon-tram"); }} className="h-14 px-3 rounded-card flex items-center gap-3 text-[16px] hover:bg-hover"><LogOut className="w-5 h-5 text-muted" />Đăng xuất Trạm {tram}</button>}
          <button onClick={() => { setSheet(null); router.push("/app/huong-dan"); }} className="h-14 px-3 rounded-card flex items-center gap-3 text-[16px] hover:bg-hover"><BookOpen className="w-5 h-5 text-muted" />Hướng dẫn sử dụng</button>
          <button onClick={() => { setHintOff(null); setSheet(null); }} className="h-14 px-3 rounded-card flex items-center gap-3 text-[16px] hover:bg-hover"><Info className="w-5 h-5 text-muted" />Hiện lại gợi ý “Nhập tổng số”</button>
          <button onClick={() => { w.setOnline(!online); setSheet(null); }} className="h-14 px-3 rounded-card flex items-center gap-3 text-[16px] hover:bg-hover"><WifiOff className="w-5 h-5 text-muted" />{online ? "Giả lập mất mạng" : "Kết nối lại mạng"}</button>
        </div>
        <p className="text-[13px] text-muted mt-2">Tổ trưởng phụ trách: {LEADER}</p>
      </Sheet>
    </>
  );
}
