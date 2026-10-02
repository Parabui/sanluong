/**
 * Nhập sản lượng · F1 — giao diện chép từ ui-demo/app/nhap (tab theo trạm, chọn ngày, thẻ công đoạn −/ô/+ · +10/+20,
 * thanh Lưu dính dưới, xác nhận trước khi lưu, Ô đã điều chỉnh chỉ đọc).
 * Mất mạng / lỗi: GIỮ NGUYÊN số trên form + "Thử lại" [R 5.3]; Thử lại khi số chưa đổi dùng lại requestId [D19].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dinhDangGio, dinhDangNgay, dinhDangSo, type FormNhap, type GhiSanLuong, LoiApi, thuIso, tranLyThuyet, zFormNhap, zKetQuaGhi,
} from '@vsn/shared';
import { cn } from '@vsn/ui';
import {
  BookOpen, Calendar, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, CircleDashed, ClipboardX, History, Info,
  Lock, LogOut, Minus, Pencil, Plus, RefreshCw, Save, ScanLine, TrendingDown, TriangleAlert, WifiOff, X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, KHOA_KHOI_DONG, laLoiMang, layKhoiDong } from '../lib/api';
import { kho, thuTuTiepTheo, uuid } from '../lib/hooks';
import { dangCoBanMoi, capNhatBanMoi } from '../lib/pwa';
import { BigButton, BottomNav, Sheet, useToast, WorkerBar } from '../ui/mobile';

const thu = (d: string) => { const t = thuIso(d); return t === 7 ? 'Chủ nhật' : `Thứ ${t + 1}`; };
const ddmm = (d: string) => dinhDangNgay(d).slice(0, 5);
const khoa = (d: string, t: string, cd: string) => `${d}|${t}|${cd}`;
/** "1.234" | "1234" → 1234 · trống / sai → cờ */
function parse(v: string): { n?: number; empty?: boolean; bad?: boolean } {
  v = v.trim();
  if (v === '') return { empty: true };
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  if (!/^\d+$/.test(v)) return { bad: true };
  const n = +v;
  return n > 99999 ? { bad: true } : { n };
}
type Cd = FormNhap['congDoan'][number];

export function NhapPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const kdQ = useQuery({ queryKey: KHOA_KHOI_DONG, queryFn: layKhoiDong });
  const kd = kdQ.data;

  const ngayCo = [...new Set((kd?.phien ?? []).map((p) => p.ngayLamViec))].sort().reverse();
  const [ngayChon, setNgay] = useState<string | null>(null);
  const date = ngayChon && ngayCo.includes(ngayChon) ? ngayChon : (kd && ngayCo.includes(kd.homNay) ? kd.homNay : ngayCo[0]) ?? kd?.homNay ?? '';
  const list = (kd?.phien ?? []).filter((p) => p.ngayLamViec === date).sort((a, b) => a.soTram - b.soTram);
  const tramParam = params.get('tram');
  const phien = list.find((p) => p.tramId === tramParam) ?? list[0];
  const tram = phien?.tramId;
  const today = date === kd?.homNay;

  const formQ = useQuery({
    queryKey: ['cn', 'form', tram, date],
    queryFn: ({ signal }) => api.goi(`/cn/form?tramId=${tram}&ngay=${date}`, { schema: zFormNhap, signal }),
    enabled: !!tram,
  });
  const ops = formQ.data?.congDoan ?? [];

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [loiLuu, setLoiLuu] = useState<{ mang: boolean; msg: string } | null>(null);
  const [hintOff, setHintOff] = useState(() => kho.doc('vsn-hint-total') === '1');
  const [sheet, setSheet] = useState<null | 'date' | 'menu' | 'confirm'>(null);
  const [confirmItems, setConfirmItems] = useState<{ kind: 'lower' | 'high'; ten: string; msg: React.ReactNode }[]>([]);
  const [anTb, setAnTb] = useState<string[]>(() => JSON.parse(sessionStorage.getItem('vsn-an-tb') ?? '[]') as string[]);
  /** Lần gửi gần nhất bị lỗi: Thử lại với CÙNG nội dung → dùng lại requestId + bộ đếm [D19] */
  const lanCuoi = useRef<{ noiDung: string; body: GhiSanLuong } | null>(null);

  const changes = (t = tram, ds: Cd[] = ops) => (t !== tram ? [] : ds).filter((o) => {
    const dr = draft[khoa(date, t!, o.congDoanId)];
    if (dr == null || o.trangThai === 'DA_DIEU_CHINH') return false;
    const p = parse(dr);
    return p.bad || p.empty || (p.n != null && p.n !== o.soLuong);
  });
  const dirtyTram = (t: string) => Object.entries(draft).some(([k, v]) => {
    if (!k.startsWith(`${date}|${t}|`)) return false;
    const o = t === tram ? ops.find((x) => k.endsWith(x.congDoanId)) : undefined;
    return o ? parse(v).n !== o.soLuong : t !== tram;
  });
  const ch = changes();

  const setVal = (k: string, v: string) => { setDraft((d) => ({ ...d, [k]: v })); setErr((e) => ({ ...e, [k]: '' })); };
  const step = (k: string, o: Cd, by: number) => {
    const cur = parse(draft[k] ?? String(o.soLuong ?? ''));
    setVal(k, String(Math.min(99999, Math.max(0, (cur.n ?? 0) + by))));
  };

  const luu = useMutation({
    mutationFn: async (body: GhiSanLuong) => {
      const ac = new AbortController();
      const hen = setTimeout(() => ac.abort(), 15_000); // 15 giây chờ [TDD 14.2]
      try {
        return await api.goi('/cn/san-luong', { method: 'PUT', body, schema: zKetQuaGhi, signal: ac.signal });
      } finally {
        clearTimeout(hen);
      }
    },
    onSuccess: (kq, body) => {
      lanCuoi.current = null;
      setLoiLuu(null);
      setDraft((d) => { const n = { ...d }; for (const x of body.dong) delete n[khoa(body.ngay, body.tramId, x.congDoanId)]; return n; });
      const daLuu = kq.dong.filter((x) => x.ketQua === 'DA_LUU').length;
      const cu = kq.dong.filter((x) => x.ketQua === 'GOI_CU_BO_QUA');
      const dc = kq.dong.filter((x) => x.ketQua === 'O_DA_DIEU_CHINH');
      if (dc.length) toast('Tổ trưởng đã điều chỉnh số này — không ghi đè được', 'err');
      else if (cu.length) toast(`Máy chủ đã có số mới hơn: ${cu.map((x) => dinhDangSo(x.soHienTai)).join(', ')}`, 'err');
      else toast(daLuu ? `Đã lưu ${daLuu} công đoạn · Trạm ${formQ.data?.soTram ?? ''}` : 'Số không đổi');
      void queryClient.invalidateQueries({ queryKey: ['cn', 'form'] });
      if (dangCoBanMoi()) capNhatBanMoi(); // áp dụng bản mới NGAY SAU khi Lưu thành công [TDD 14.2]
    },
    onError: (e) => {
      if (laLoiMang(e)) setLoiLuu({ mang: true, msg: 'Chưa lưu được – kiểm tra mạng' });
      else {
        lanCuoi.current = null;
        setLoiLuu({ mang: false, msg: e instanceof LoiApi ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.' });
        if (e instanceof LoiApi && ['PHIEN_KHONG_CON', 'NGAY_DA_CHOT', 'NGAY_KHONG_MO_NHAP'].includes(e.code)) void queryClient.invalidateQueries({ queryKey: KHOA_KHOI_DONG });
      }
      document.getElementById('scroller')?.scrollTo({ top: 0 });
    },
  });
  const saving = luu.isPending;

  /** Các dòng sẽ gửi (đã sắp theo công đoạn) + chuỗi so sánh để biết Thử lại có cùng nội dung không */
  const dongGui = () => {
    const dong = ch.map((o) => ({ congDoanId: o.congDoanId, soLuong: parse(draft[khoa(date, tram!, o.congDoanId)]!).n! })).sort((x, y) => x.congDoanId.localeCompare(y.congDoanId));
    return { dong, noiDung: JSON.stringify([tram, date, dong]) };
  };
  const trySave = () => {
    if (saving || !ch.length || !tram) return;
    // Thử lại sau lỗi mạng, số chưa đổi → gửi lại ngay (đã xác nhận ở lần trước)
    if (loiLuu?.mang && lanCuoi.current?.noiDung === dongGui().noiDung) return doSave();
    const items: typeof confirmItems = [];
    let bad: string | null = null;
    const e: Record<string, string> = {};
    for (const o of ops) {
      const k = khoa(date, tram, o.congDoanId), dr = draft[k];
      if (dr == null || o.trangThai === 'DA_DIEU_CHINH') continue;
      const p = parse(dr);
      if (p.empty) { e[k] = 'Nhập số lượng, hoặc bấm − để về số đã lưu'; bad ??= k; continue; }
      if (p.bad) { e[k] = 'Số lượng phải là số nguyên từ 0 đến 99.999'; bad ??= k; continue; }
      if (o.soLuong != null && p.n! < o.soLuong) items.push({ kind: 'lower', ten: o.ten, msg: <>Số mới <b className="num">{dinhDangSo(p.n)}</b> nhỏ hơn số đã lưu <b className="num">{dinhDangSo(o.soLuong)}</b>. Ghi đè?</> });
      const tran = tranLyThuyet(formQ.data?.gioLam ?? null, o.smv);
      if (tran != null && p.n! > tran) items.push({ kind: 'high', ten: o.ten, msg: <>Số <b className="num">{dinhDangSo(p.n)}</b> cao bất thường (tối đa khoảng <b className="num">{dinhDangSo(tran)}</b> cho ca {dinhDangSo(formQ.data?.gioLam)} giờ). Bạn chắc chắn?</> });
    }
    setErr(e);
    if (bad) return document.querySelector<HTMLInputElement>(`[data-input="${bad}"]`)?.focus();
    if (items.length) { setConfirmItems(items); setSheet('confirm'); return; }
    doSave();
  };
  const doSave = () => {
    if (!tram) return;
    const { dong, noiDung } = dongGui();
    const cu = lanCuoi.current;
    const body: GhiSanLuong = cu && cu.noiDung === noiDung ? cu.body : (() => {
      const thuTu = thuTuTiepTheo();
      const lucThietBi = new Date().toISOString();
      return { requestId: uuid(), tramId: tram, ngay: date, dong: dong.map((d) => ({ ...d, thuTuThietBi: thuTu, lucThietBi })) };
    })();
    lanCuoi.current = { noiDung, body };
    setLoiLuu(null);
    luu.mutate(body);
  };

  const dangXuat = useMutation({
    mutationFn: (id: string) => api.goi(`/cn/phien-tram/${id}`, { method: 'DELETE', schema: zKetQuaGhi.optional() }),
    onSuccess: () => { toast(`Đã đăng xuất Trạm ${phien?.soTram}`); void queryClient.invalidateQueries({ queryKey: KHOA_KHOI_DONG }); setParams({}); },
    onError: (e) => toast(e.message, 'err'),
  });

  const lastAt = ops.map((o) => o.capNhatLuc).filter(Boolean).sort().pop();
  const thongBao = (kd?.thongBao ?? []).filter((x) => !anTb.includes(x.luc));
  const anThongBao = (luc: string) => { const n = [...anTb, luc]; setAnTb(n); sessionStorage.setItem('vsn-an-tb', JSON.stringify(n)); };

  if (kdQ.isPending) return <div className="flex-1 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>;

  return (
    <>
      <WorkerBar nhanVien={kd?.nhanVien ?? null} onMenu={list.length ? () => setSheet('menu') : undefined}>
        {list.length > 0 && (
          <div className="border-b border-line">
            <div className="no-scrollbar overflow-x-auto flex items-end gap-1 px-2" style={{ height: 'var(--tabs-h)' }} role="tablist" aria-label="Trạm đang đăng nhập">
              {list.map((p) => {
                const on = p.tramId === tram, dirty = dirtyTram(p.tramId) && ch.length > 0 && on;
                return (
                  <button key={p.id} type="button" role="tab" aria-selected={on} onClick={() => setParams({ tram: p.tramId })}
                    className={cn('relative h-11 px-4 rounded-t-ctl text-[15px] whitespace-nowrap flex items-center gap-1.5 transition-colors duration-fast', on ? 'font-semibold text-ink' : 'text-muted hover:text-ink')}>
                    Trạm {p.soTram}{dirty && <span className="w-2 h-2 rounded-full bg-brand" aria-label="chưa lưu" />}
                    {on && <span className="absolute left-3 right-3 bottom-0 h-[3px] rounded-t bg-brand" />}
                  </button>
                );
              })}
              {today && <button type="button" onClick={() => void navigate('/chon-tram')} className="h-11 px-3 ml-1 text-[15px] font-medium text-brand-ink flex items-center gap-1 whitespace-nowrap rounded-ctl hover:bg-brand-soft"><Plus className="w-[18px] h-[18px]" />Thêm trạm</button>}
            </div>
          </div>
        )}
      </WorkerBar>

      <main className="flex-1 min-h-0 flex flex-col">
        {list.length > 0 && (
          <div className="shrink-0 bg-surface border-b border-line px-4 py-2.5 flex items-center gap-2">
            <button type="button" onClick={() => setSheet('date')} aria-haspopup="dialog"
              className={cn('h-11 pl-3 pr-2.5 rounded-ctl border flex items-center gap-2 text-[15px]', today ? 'border-line-strong bg-surface' : 'border-empty-bar bg-empty-bg text-empty-ink')}>
              <Calendar className="w-[18px] h-[18px]" /><span className="font-semibold">{today && 'Hôm nay · '}{thu(date)}, {ddmm(date)}</span><ChevronDown className="w-4 h-4 opacity-70" />
            </button>
            <span className="ml-auto text-[13px] text-muted">{formQ.data?.gioLam ? `Ca ${dinhDangSo(formQ.data.gioLam)} giờ` : ''}</span>
          </div>
        )}

        <div id="scroller" className="no-scrollbar overflow-y-auto overscroll-contain flex-1 min-h-0">
          <div className="px-4 pt-3 flex flex-col gap-2 empty:hidden" aria-live="polite">
            {thongBao.map((x) => (
              <div key={x.luc} className="pop-in rounded-card bg-warn-bg text-warn-ink p-3 flex gap-3">
                <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
                <div className="flex-1 text-[14px] leading-snug">
                  {x.loai === 'CHUYEN_THIET_BI'
                    ? <><div className="font-semibold">Phiên Trạm {x.soTram} đã chuyển sang thiết bị khác lúc {dinhDangGio(x.luc)}</div><div>Không phải bạn? Báo tổ trưởng ngay.</div></>
                    : <><div className="font-semibold">Bạn đã bị đăng xuất khỏi Trạm {x.soTram} lúc {dinhDangGio(x.luc)}{x.boi ? ` bởi ${x.boi}` : ''}</div>{x.lyDo && <div>Lý do: {x.lyDo}</div>}</>}
                </div>
                <button type="button" onClick={() => anThongBao(x.luc)} className="self-start w-9 h-9 -mr-1 -mt-1 grid place-items-center rounded-full hover:bg-surface/70" aria-label="Ẩn thông báo"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {loiLuu && (
              <div className="pop-in rounded-card bg-danger-bg border border-danger/30 p-3 flex gap-3" role="alert">
                {loiLuu.mang ? <WifiOff className="w-5 h-5 text-danger mt-0.5 shrink-0" /> : <CircleAlert className="w-5 h-5 text-danger mt-0.5 shrink-0" />}
                <div className="flex-1 text-[14px] leading-snug"><div className="font-semibold text-danger">{loiLuu.msg}</div><div>Số bạn nhập vẫn còn trên màn hình.{loiLuu.mang && ' Có mạng lại thì bấm Thử lại.'}</div></div>
              </div>
            )}
            {list.length > 0 && !today && (
              <div className="rounded-card bg-empty-bg border border-empty-bar/40 p-3 flex gap-3">
                <History className="w-5 h-5 text-empty-ink mt-0.5 shrink-0" />
                <div className="flex-1 text-[14px] leading-snug text-empty-ink"><div className="font-semibold">Đang nhập cho {thu(date)}, {ddmm(date)} — không phải hôm nay</div><div>Chỉ nhập bổ sung khi ngày này chưa chốt.</div></div>
                {ngayCo.includes(kd!.homNay) && <button type="button" onClick={() => setNgay(kd!.homNay)} className="self-center h-10 px-3 rounded-ctl bg-surface border border-empty-bar/50 text-[14px] font-semibold text-empty-ink whitespace-nowrap">Hôm nay</button>}
              </div>
            )}
            {!hintOff && today && ops.length > 0 && (
              <div className="rounded-card bg-open-bg p-3 flex gap-3">
                <Info className="w-5 h-5 text-open-ink mt-0.5 shrink-0" />
                <div className="flex-1 text-[14px] leading-snug"><div className="font-semibold text-open-ink">Nhập TỔNG số đã làm từ đầu ngày</div><div>Ví dụ: sáng làm 60, chiều thêm 40 → nhập <b>100</b>. Số mới sẽ thay số cũ.</div></div>
                <button type="button" onClick={() => { kho.ghi('vsn-hint-total', '1'); setHintOff(true); }} className="self-start w-9 h-9 -mr-1 -mt-1 grid place-items-center rounded-full hover:bg-surface/70" aria-label="Đã hiểu, ẩn hướng dẫn"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          <div className="px-4 py-3 flex flex-col gap-3">
            {!list.length ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <ScanLine className="w-12 h-12 text-muted" /><p className="text-[17px] font-semibold">Chưa đăng nhập trạm nào</p>
                <p className="text-[14px] text-muted max-w-[260px]">Quét mã QR dán tại trạm hoặc chọn trạm từ danh sách.</p>
                <BigButton onClick={() => void navigate('/chon-tram')}><Plus className="w-5 h-5" />Thêm trạm</BigButton>
              </div>
            ) : formQ.isPending ? (
              <div className="py-16 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>
            ) : formQ.isError ? (
              <p className="rounded-card bg-danger-bg text-danger p-4 text-[15px]" role="alert">{formQ.error.message}</p>
            ) : !ops.length ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <ClipboardX className="w-12 h-12 text-muted" /><p className="text-[17px] font-semibold">Trạm {formQ.data?.soTram} chưa có công đoạn</p>
                <p className="text-[14px] text-muted max-w-[260px]">Trạm chưa có công đoạn, liên hệ tổ trưởng.</p>
              </div>
            ) : (
              <>
                {ops.map((o) => {
                  const k = khoa(date, tram!, o.congDoanId), dr = draft[k];
                  const head = (
                    <>
                      <div className="flex items-center gap-2 text-[13px] text-muted">
                        <span className="h-6 px-2 rounded-pill bg-group text-ink text-[12px] font-semibold inline-flex items-center">{o.maMaHang}</span>
                        <span className="font-mono text-[12px]">{o.ma}</span>{o.smv != null && <span>· SMV {dinhDangSo(o.smv, 3)}s</span>}
                        <span className="ml-auto">
                          {o.trangThai === 'DA_DIEU_CHINH' ? <span className="inline-flex items-center gap-1 text-adjust-ink font-medium"><Pencil className="w-3.5 h-3.5" />Đã điều chỉnh</span>
                            : o.trangThai === 'DA_LUU' ? <span className="inline-flex items-center gap-1 text-closed-ink font-medium"><CircleCheck className="w-4 h-4" />Đã lưu {o.capNhatLuc && dinhDangGio(o.capNhatLuc)}</span>
                              : <span className="inline-flex items-center gap-1 text-empty-ink font-medium"><CircleDashed className="w-4 h-4" />Chưa nhập</span>}
                        </span>
                      </div>
                      <h3 className="text-[18px] font-semibold mt-1.5 leading-snug">{o.ten}</h3>
                      {o.daGo && <p className="text-[13px] text-warn-ink mt-0.5">Đã gỡ khỏi trạm hôm nay — vẫn nhập được số đến hết ngày</p>}
                    </>
                  );
                  if (o.trangThai === 'DA_DIEU_CHINH') return (
                    <article key={k} className="rounded-card border border-line bg-surface p-4">
                      {head}
                      <div className="mt-3 rounded-ctl bg-adjust-bg text-adjust-ink p-3 flex gap-3">
                        <Pencil className="w-5 h-5 mt-0.5 shrink-0" />
                        <div className="text-[14px] leading-snug"><div className="font-semibold">Tổ trưởng đã điều chỉnh: <span className="num text-[20px] align-[-2px]">{dinhDangSo(o.soLuong)}</span></div>
                          {o.dieuChinh && <><div>{o.dieuChinh.lyDo ?? '—'} · {dinhDangSo(o.dieuChinh.soCu)} → {dinhDangSo(o.soLuong)}</div><div className="text-[13px] opacity-80">{o.dieuChinh.boi ?? '—'} · {dinhDangGio(o.dieuChinh.luc)}</div></>}
                        </div>
                      </div>
                      <p className="text-[13px] text-muted mt-2 flex items-center gap-1.5"><Lock className="w-4 h-4" />Không sửa được trên app. Sai số? Báo tổ trưởng.</p>
                    </article>
                  );
                  const val = dr ?? (o.soLuong != null ? String(o.soLuong) : '');
                  const dirty = ch.some((c) => c.congDoanId === o.congDoanId);
                  const p = dr != null ? parse(dr) : null;
                  const r = o.soLuong;
                  return (
                    <article key={k} className={cn('rounded-card border bg-surface p-4 transition-colors duration-fast', dirty ? 'border-brand' : 'border-line')}>
                      {head}
                      <div className="mt-3 flex items-stretch gap-2">
                        <button type="button" onClick={() => step(k, o, -1)} className="w-[52px] h-[56px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover active:bg-group" aria-label="Bớt 1"><Minus className="w-6 h-6" /></button>
                        <input data-input={k} inputMode="numeric" enterKeyHint="next" autoComplete="off" value={val} placeholder="0" onChange={(e) => setVal(k, e.target.value)}
                          aria-label={`Tổng số đã làm – ${o.ten}`} aria-invalid={!!err[k]}
                          className={cn('num flex-1 min-w-0 h-[56px] rounded-ctl border-2 bg-surface text-center font-semibold outline-none transition-colors duration-fast', err[k] ? 'border-danger' : 'border-line-strong focus:border-brand-ink')}
                          style={{ fontSize: 'var(--fs-qty-input)' }} />
                        <button type="button" onClick={() => step(k, o, 1)} className="w-[52px] h-[56px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover active:bg-group" aria-label="Thêm 1"><Plus className="w-6 h-6" /></button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {[10, 20].map((n) => <button key={n} type="button" onClick={() => step(k, o, n)} className="h-10 px-3.5 rounded-pill border border-line-strong text-[14px] font-medium hover:bg-hover active:bg-group">+{n}</button>)}
                        <span className="ml-auto text-[13px] text-right leading-tight">
                          {dr == null ? (r != null ? <span className="text-muted">Đã lưu <b className="num text-ink">{dinhDangSo(r)}</b></span> : <span className="text-muted">Nhập tổng số từ đầu ngày</span>)
                            : p?.bad || p?.empty ? null
                              : r == null ? <span className="text-brand-ink font-semibold">Chưa lưu</span>
                                : p!.n === r ? <span className="text-muted">Không đổi</span>
                                  : <><span className={cn('font-semibold num', p!.n! < r ? 'text-warn-ink' : 'text-brand-ink')}>{dinhDangSo(r)} → {dinhDangSo(p!.n)} ({p!.n! > r ? '+' : '−'}{dinhDangSo(Math.abs(p!.n! - r))})</span><br /><span className="text-muted">chưa lưu</span></>}
                        </span>
                      </div>
                      {err[k] && <p className="text-[14px] text-danger mt-1.5 flex items-center gap-1" role="alert"><CircleAlert className="w-4 h-4" />{err[k]}</p>}
                    </article>
                  );
                })}
                <p className="text-[13px] text-muted text-center pt-1 pb-2">Trạm {formQ.data?.soTram} · {ops.length} công đoạn được gán hôm {today ? 'nay' : ddmm(date)}</p>
              </>
            )}
          </div>
        </div>

        {list.length > 0 && ops.length > 0 && (
          <div className="shrink-0 bg-surface shadow-bar px-4 py-3 z-10">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0 text-[14px] leading-tight">
                {saving ? <span className="text-muted">Đang gửi lên máy chủ…</span>
                  : loiLuu && ch.length ? <span className="text-danger font-semibold">{ch.length} công đoạn chưa lưu</span>
                    : ch.length ? <span><b className="text-brand-ink num">{ch.length}</b> công đoạn chưa lưu</span>
                      : <span className="text-closed-ink flex items-center gap-1.5"><CircleCheck className="w-4 h-4" />{lastAt ? `Đã lưu hết · ${dinhDangGio(lastAt)}` : 'Chưa có số nào'}</span>}
              </div>
              <button type="button" onClick={trySave} disabled={saving || !ch.length} aria-busy={saving}
                className="h-[52px] px-6 min-w-[140px] rounded-ctl bg-brand hover:bg-brand-hover text-ink text-[17px] font-semibold flex items-center justify-center gap-2 transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink disabled:cursor-not-allowed">
                {saving ? <><span className="spin w-5 h-5 rounded-full border-2 border-current border-t-transparent" />Đang lưu…</>
                  : loiLuu?.mang && ch.length ? <><RefreshCw className="w-5 h-5" />Thử lại</> : <><Save className="w-5 h-5" />Lưu</>}
              </button>
            </div>
          </div>
        )}
      </main>
      <BottomNav />

      <Sheet open={sheet === 'date'} onClose={() => setSheet(null)} title="Chọn ngày làm việc"
        footer={<BigButton variant="secondary" className="w-full" onClick={() => setSheet(null)}>Đóng</BigButton>}>
        <p className="text-[14px] text-muted -mt-1 mb-3">Chỉ nhập được hôm nay và ngày làm việc liền trước chưa chốt mà máy còn giữ phiên trạm.</p>
        <div className="flex flex-col gap-1 -mx-2">
          {ngayCo.map((d) => {
            const cur = d === date;
            return (
              <button key={d} type="button" disabled={ch.length > 0 && !cur} onClick={() => { setNgay(d); setParams({}); setSheet(null); }}
                className={cn('w-full min-h-[60px] px-3 flex items-center gap-3 rounded-card text-left disabled:opacity-60', cur ? 'bg-brand-soft' : 'hover:bg-hover')}>
                <span className="w-11 text-center leading-none"><span className="block text-[12px] text-muted font-semibold uppercase">{thu(d).replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</span><span className="block text-[20px] font-semibold num mt-1">{d.slice(8)}</span></span>
                <span className="flex-1"><span className="block text-[16px] font-medium">{thu(d)}, {ddmm(d)}</span><span className="block text-[13px] text-muted">{d === kd?.homNay ? 'Hôm nay' : 'Chưa chốt · nhập bổ sung được'}</span></span>
                {cur ? <Check className="w-5 h-5 text-brand-ink" /> : <ChevronRight className="w-5 h-5 text-muted" />}
              </button>
            );
          })}
        </div>
        {ch.length > 0 && <p className="mt-2 text-[13px] text-warn-ink">Lưu số đang nhập trước khi đổi ngày.</p>}
        <p className="mt-3 text-[13px] text-muted flex gap-2"><Info className="w-4 h-4 mt-0.5 shrink-0" />Thiếu phiên hoặc ngày đã chốt → nhờ tổ trưởng nhập hộ.</p>
      </Sheet>

      <Sheet open={sheet === 'confirm'} onClose={() => setSheet(null)} title="Kiểm tra lại trước khi lưu"
        footer={<><BigButton variant="secondary" className="flex-1" onClick={() => setSheet(null)}>Sửa lại</BigButton><BigButton className="flex-1" onClick={() => { setSheet(null); doSave(); }}>Vẫn lưu</BigButton></>}>
        <ul className="flex flex-col gap-2">
          {confirmItems.map((it, i) => (
            <li key={i} className={cn('rounded-card p-3 flex gap-3', it.kind === 'lower' ? 'bg-warn-bg text-warn-ink' : 'bg-danger-bg text-danger')}>
              {it.kind === 'lower' ? <TrendingDown className="w-5 h-5 mt-0.5 shrink-0" /> : <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />}
              <div className="text-[15px] leading-snug"><div className="font-semibold">{it.ten}</div><div>{it.msg}</div></div>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Tùy chọn"
        footer={<BigButton variant="secondary" className="w-full" onClick={() => setSheet(null)}>Đóng</BigButton>}>
        <div className="flex flex-col -mx-2">
          {phien && (
            <button type="button" disabled={ch.length > 0 || dangXuat.isPending} onClick={() => { setSheet(null); dangXuat.mutate(phien.id); }}
              className="h-14 px-3 rounded-card flex items-center gap-3 text-[16px] hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-left">
              <LogOut className="w-5 h-5 text-muted" />
              <span>Đăng xuất Trạm {phien.soTram}{ch.length > 0 && <span className="block text-[13px] text-warn-ink">Lưu số đang nhập trước khi đăng xuất</span>}</span>
            </button>
          )}
          <button type="button" onClick={() => { setSheet(null); void navigate('/huong-dan'); }} className="h-14 px-3 rounded-card flex items-center gap-3 text-[16px] hover:bg-hover"><BookOpen className="w-5 h-5 text-muted" />Hướng dẫn sử dụng</button>
          <button type="button" onClick={() => { kho.ghi('vsn-hint-total', null); setHintOff(false); setSheet(null); }} className="h-14 px-3 rounded-card flex items-center gap-3 text-[16px] hover:bg-hover"><Info className="w-5 h-5 text-muted" />Hiện lại gợi ý “Nhập tổng số”</button>
        </div>
      </Sheet>
    </>
  );
}
