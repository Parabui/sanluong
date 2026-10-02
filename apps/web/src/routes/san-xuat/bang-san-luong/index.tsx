/**
 * Bảng sản lượng ngày · F10, F19 — giao diện chép từ ui-demo/(web)/san-xuat/bang-san-luong/daily-board.tsx
 * (toolbar chọn chuyền / ngày, chip trạng thái, nút Chốt ngày · dải tóm tắt + chip lọc + "Xử lý tiếp" (phím N) ·
 * bảng nhóm Trạm → Công đoạn, sửa ô tại chỗ (Enter/Tab) → popover lý do, nhập hộ tại ô vàng · drawer lịch sử · modal chốt).
 * Khác demo: dữ liệu thật từ /api/bang-san-luong; phút chuẩn / % hiệu suất lấy từ view (server) [CLAUDE.md #5].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type BangSanLuong, type CanhBaoChot, dinhDangGio, dinhDangNgay, dinhDangSo, dinhDangSoGio, type DongBang, homNay as ngayVN,
  LoiApi, type NguonSanLuong, TEN_NGUON, thuIso, type TrangThaiDong, zBangSanLuong, zChuyen, zKetQuaGhiWeb, zNgayBang,
} from '@vsn/shared';
import { cn, Drawer, Kbd, Modal, Switch, useToast } from '@vsn/ui';
import {
  Calendar, CalendarX, Check, ChevronDown, ChevronLeft, ChevronRight, CircleArrowRight, CircleCheck, CircleDashed, CircleDot,
  Clock, History, Lock, type LucideIcon, Minus, Pencil, Radio, RefreshCw, SearchX, Smartphone, Timer, TriangleAlert, UserPlus, WifiOff, X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { api, thongBaoLoi } from '../../../lib/api';
import { useShell } from '../../../shell/shell-context';
import { docSoLuong, ProxyPopover, ReasonPopover } from './popovers';

const SRC_ICON: Record<NguonSanLuong, LucideIcon> = { APP: Smartphone, OFFLINE: WifiOff, NHAP_HO: UserPlus, SUA_WEB: Pencil };
const ST_CLASS: Record<TrangThaiDong, string> = { CHUA_CO_SO: 'st-empty', CANH_BAO: 'st-warn', DA_DIEU_CHINH: 'st-adjusted', BINH_THUONG: 'st-ok' };
const thu = (d: string) => { const t = thuIso(d); return t === 7 ? 'Chủ nhật' : `Thứ ${t + 1}`; };
const ddmm = (d: string) => dinhDangNgay(d).slice(0, 5);
const luc = (iso: string) => `${dinhDangGio(iso)} ${ddmm(ngayVN(new Date(iso)))}`;
const issuesOf = (rows: DongBang[]) => rows.filter((r) => !r.biKhoa && (r.trangThai === 'CHUA_CO_SO' || r.trangThai === 'CANH_BAO'));
const lastAdj = (r: DongBang) => r.lichSu.find((h) => h.lyDo);
const adjTip = (r: DongBang) => {
  const h = lastAdj(r);
  return h ? `${h.soCu == null ? '—' : dinhDangSo(h.soCu)} → ${dinhDangSo(h.soMoi)} · ${h.lyDo} · ${h.boi} · ${luc(h.luc)}` : '';
};
type Pop = { kind: 'reason'; key: string; n: number; moveNext: boolean; fromEdit: boolean } | { kind: 'proxy'; key: string };
const loiCua = (e: unknown) => (e instanceof LoiApi ? e.message : thongBaoLoi(e));

export function BangSanLuongPage() {
  const [sp, setSp] = useSearchParams();
  const chuyenQ = useQuery({ queryKey: ['chuyen', 'tat-ca'], queryFn: ({ signal }) => api.goi('/chuyen', { schema: z.array(zChuyen), signal }) });
  const lines = (chuyenQ.data ?? []).filter((c) => c.loai === 'CHUYEN_MAY' && c.trangThai === 'HOAT_DONG');
  const line = lines.find((l) => l.id === sp.get('chuyen')) ?? lines[0];
  const ngayQ = useQuery({
    queryKey: ['bang-san-luong', 'ngay', line?.id],
    queryFn: ({ signal }) => api.goi(`/bang-san-luong/ngay?chuyenId=${line!.id}`, { schema: z.array(zNgayBang), signal }),
    enabled: !!line,
  });
  const dates = ngayQ.data ?? [];
  // Mặc định: ngày làm việc gần nhất (trước hôm nay) có số mà chưa chốt — việc buổi sáng của tổ trưởng; không có thì hôm nay
  const macDinh = dates.slice(1).find((d) => d.coSanLuong && !d.daChot && !d.daKhoa)?.ngay ?? dates[0]?.ngay;
  const date = sp.get('ngay') ?? macDinh;

  if (chuyenQ.isSuccess && !lines.length) {
    return <div className="flex-1 grid place-items-center text-muted">Chưa có chuyền may trong phạm vi của bạn</div>;
  }
  if (!line || !date) return <div className="flex-1 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>;
  return (
    <Board key={`${line.id}|${date}`} lines={lines} line={line} date={date} dates={dates}
      go={(chuyen, ngay) => setSp({ chuyen, ngay }, { replace: true })} />
  );
}

function Board({ lines, line, date, dates, go }: {
  lines: z.infer<typeof zChuyen>[]; line: z.infer<typeof zChuyen>; date: string; dates: z.infer<typeof zNgayBang>[];
  go: (chuyen: string, ngay: string) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { q } = useShell();
  const bangQ = useQuery({
    queryKey: ['bang-san-luong', line.id, date],
    queryFn: ({ signal }) => api.goi(`/bang-san-luong?chuyenId=${line.id}&ngay=${date}`, { schema: zBangSanLuong, signal }),
  });
  const d = bangQ.data;
  const all = d?.dong ?? [];
  const [filter, setFilter] = useState<TrangThaiDong | null>(null);
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [edit, setEdit] = useState<{ key: string; value: string; error: string | null } | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [canhBaoServer, setCanhBaoServer] = useState<CanhBaoChot | null>(null);
  const [dateMenu, setDateMenu] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const lamMoi = () => queryClient.invalidateQueries({ queryKey: ['bang-san-luong'] });

  useEffect(() => {
    if (!dateMenu) return;
    const h = (e: MouseEvent) => { if (!dateRef.current?.contains(e.target as Node)) setDateMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dateMenu]);

  const status = !d ? null : d.daKhoa ? 'locked' : d.chot ? 'closed' : 'open';
  const editable = status === 'open' || status === 'closed';
  const canEdit = (r: DongBang) => editable && !r.biKhoa;
  const findRow = (key: string) => all.find((r) => r.key === key);

  const visibleRows = () => {
    let rows = all;
    if (filter) rows = rows.filter((r) => r.trangThai === filter);
    if (onlyTodo) rows = rows.filter((r) => r.trangThai === 'CHUA_CO_SO' || r.trangThai === 'CANH_BAO');
    const s = q.trim().toLowerCase();
    if (s) rows = rows.filter((r) => [r.nhanVien?.maNV, r.nhanVien?.hoTen, r.tenCongDoan, r.maCongDoan, r.dangNhap?.maNV, r.dangNhap?.hoTen, `trạm ${r.soTram}`].some((x) => x?.toLowerCase().includes(s)));
    return rows;
  };
  const rows = visibleRows();

  const $ = (sel: string) => document.querySelector<HTMLElement>(sel);
  const focusLater = (sel: string, scroll = false) => requestAnimationFrame(() => { const el = $(sel); if (scroll) el?.scrollIntoView({ block: 'center' }); el?.focus(); });
  const anchorOf = (key: string) => $(`tr[data-id="${CSS.escape(key)}"] td.qty-td`);

  /* ─── Sửa số ─── */
  const startEdit = (key: string) => {
    const r = findRow(key);
    if (!r || !canEdit(r)) return;
    setPop(null);
    setEdit({ key, value: String(r.soLuong), error: null });
    requestAnimationFrame(() => { const i = $('#qty-input') as HTMLInputElement | null; i?.focus(); i?.select(); });
  };
  const cancelEdit = (focusBack = true) => {
    if (!edit) return;
    const key = edit.key;
    setEdit(null);
    if (focusBack) focusLater(`[data-edit="${CSS.escape(key)}"]`);
  };
  const focusNext = (key: string) => {
    const i = rows.findIndex((r) => r.key === key), n = rows[i + 1];
    if (!n) return;
    if (n.soLuong != null) startEdit(n.key); else focusLater(`[data-proxy="${CSS.escape(n.key)}"]`);
  };
  const submitEdit = (moveNext: boolean) => {
    if (!edit) return;
    const r = findRow(edit.key)!, n = docSoLuong(edit.value);
    if (n == null) { setEdit({ ...edit, error: 'Số lượng phải là số nguyên từ 0 đến 99.999' }); return; }
    if (n === r.soLuong && r.trangThai !== 'CANH_BAO') { setEdit(null); if (moveNext) focusNext(r.key); else focusLater(`[data-edit="${CSS.escape(r.key)}"]`); return; }
    setEdit({ ...edit, error: null });
    setPop({ kind: 'reason', key: r.key, n, moveNext, fromEdit: true });
  };

  /* ─── Luồng "việc tiếp theo" ─── */
  const goIssue = (r?: DongBang) => {
    if (!r) return toast('Không còn ô nào cần xử lý');
    setEdit(null);
    if (!visibleRows().includes(r)) setFilter(null);
    requestAnimationFrame(() => {
      const btn = $(`[data-proxy="${CSS.escape(r.key)}"]`) || $(`[data-confirm="${CSS.escape(r.key)}"]`);
      btn?.scrollIntoView({ block: 'center' });
      setPop(r.trangThai === 'CHUA_CO_SO' ? { kind: 'proxy', key: r.key } : { kind: 'reason', key: r.key, n: r.soLuong!, moveNext: false, fromEdit: false });
    });
  };
  const afterIssueSaved = (r: DongBang, sau: BangSanLuong) => {
    const next = issuesOf(sau.dong)[0];
    toast(next ? `Đã lưu · Trạm ${r.soTram} — tiếp: Trạm ${next.soTram} (Enter hoặc N)` : `Đã lưu · Trạm ${r.soTram} — đã xử lý hết ô cần xử lý`);
    if (!next) return;
    focusLater(`[data-proxy="${CSS.escape(next.key)}"], [data-confirm="${CSS.escape(next.key)}"]`, true);
  };

  const cancelPop = useCallback(() => {
    setPop((p) => {
      if (p?.kind === 'reason' && p.fromEdit) { setEdit(null); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-edit="${CSS.escape(p.key)}"]`)?.focus()); }
      else if (p) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-proxy="${CSS.escape(p.key)}"], [data-confirm="${CSS.escape(p.key)}"]`)?.focus());
      return null;
    });
  }, []);

  const goDate = (iso: string) => { setFilter(null); setEdit(null); setPop(null); go(line.id, iso); };
  const idx = dates.findIndex((x) => x.ngay === date); // dates: mới nhất trước

  // bấm ra ngoài khi đang sửa (chưa mở popover) → hủy sửa
  useEffect(() => {
    if (!edit || pop) return;
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('#qty-input')) setEdit(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [edit, pop]);

  /* ─── Phím tắt N ─── */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey;
      const busy = pop || drawerKey || closeOpen;
      if (!typing && !busy && (e.key === 'n' || e.key === 'N') && editable) { e.preventDefault(); goIssue(issuesOf(all)[0]); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  /* ─── Lưu ─── */
  const taiLai = async () => (await queryClient.fetchQuery({ queryKey: ['bang-san-luong', line.id, date], queryFn: ({ signal }) => api.goi(`/bang-san-luong?chuyenId=${line.id}&ngay=${date}`, { schema: zBangSanLuong, signal }), staleTime: 0 }));
  const saveReason = async (reason: string): Promise<string | null> => {
    if (!pop || pop.kind !== 'reason') return null;
    const r = findRow(pop.key)!;
    const { n, moveNext } = pop, wasIssue = r.trangThai === 'CANH_BAO';
    try {
      await api.goi('/bang-san-luong/o', { method: 'PUT', body: { sanLuongId: r.sanLuongId, soLuong: n, lyDo: reason, version: r.version }, schema: zKetQuaGhiWeb });
    } catch (e) {
      if (e instanceof LoiApi && e.code === 'DU_LIEU_DA_THAY_DOI') void lamMoi();
      return loiCua(e);
    }
    setPop(null); setEdit(null);
    const sau = await taiLai();
    if (wasIssue) { afterIssueSaved(r, sau); return null; }
    toast('Đã lưu');
    if (moveNext) requestAnimationFrame(() => focusNext(r.key)); else focusLater(`[data-edit="${CSS.escape(r.key)}"]`);
    return null;
  };
  const saveProxy = async (nv: { id: string }, n: number, reason: string): Promise<string | null> => {
    if (!pop) return null;
    const r = findRow(pop.key)!;
    try {
      await api.goi('/bang-san-luong/nhap-ho', { method: 'POST', body: { tramId: r.tramId, congDoanId: r.congDoanId, ngay: date, nhanVienId: nv.id, soLuong: n, lyDo: reason }, schema: zKetQuaGhiWeb });
    } catch (e) {
      return loiCua(e);
    }
    setPop(null);
    afterIssueSaved(r, await taiLai());
    return null;
  };

  const chot = useMutation({
    mutationFn: () => api.goi('/chot-ngay', { method: 'POST', body: { chuyenId: line.id, ngay: date, xacNhan: nWarn > 0 ? ack : false }, schema: z.object({ boi: z.string(), luc: z.string() }) }),
    onSuccess: () => { setCloseOpen(false); toast(`Đã chốt ngày ${dinhDangNgay(date)} – ${line.ma}`); void lamMoi(); void queryClient.invalidateQueries({ queryKey: ['chot-ngay'] }); },
    onError: (e) => {
      if (e instanceof LoiApi && e.code === 'CAN_XAC_NHAN') { setCanhBaoServer(e.chiTiet as CanhBaoChot); setAck(false); void lamMoi(); return; }
      setCloseOpen(false);
      toast(loiCua(e), 'warn');
      void lamMoi();
    },
  });

  /* ─── Toolbar ─── */
  const dayMeta = (x: z.infer<typeof zNgayBang>): [string, string, LucideIcon] => {
    if (x.daKhoa) return ['Đã khóa', 'text-locked-ink', Lock];
    if (x.daChot) return ['Đã chốt', 'text-closed-ink', CircleCheck];
    if (x.ngay === dates[0]?.ngay) return ['Hôm nay · đang nhập', 'text-open-ink', Radio];
    if (!x.coSanLuong) return ['Chưa có dữ liệu', 'text-muted', Minus];
    return ['Chưa chốt', 'text-empty-ink', CircleDot];
  };

  const statusChip = () => {
    const m = ({ open: ['bg-open-bg text-open-ink', null, 'Chưa chốt'], closed: ['bg-closed-bg text-closed-ink', Check, 'Đã chốt'], locked: ['bg-locked-bg text-locked-ink', Lock, 'Đã khóa'] } as const)[status ?? 'open'];
    const I = m[1] as LucideIcon | null;
    return <span className={cn('h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold whitespace-nowrap', m[0])}>{I && <I className="w-3.5 h-3.5" />}{m[2]}</span>;
  };

  const closeArea = () => {
    if (!d) return null;
    if (status === 'open') {
      if (!d.duocChot) {
        return <button type="button" className="h-9 px-4 rounded-ctl bg-disabled-bg text-disabled-ink text-body font-semibold flex items-center gap-2 cursor-not-allowed" aria-disabled="true" data-tip={`Chốt được từ ${luc(d.moChotTu).replace(' ', ' ngày ')}`}><CircleCheck className="w-[18px] h-[18px]" />Chốt ngày</button>;
      }
      return <button type="button" onClick={() => { setAck(false); setCanhBaoServer(null); setCloseOpen(true); }} className="h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold flex items-center gap-2 transition-colors duration-fast"><CircleCheck className="w-[18px] h-[18px]" />Chốt ngày</button>;
    }
    if (status === 'closed') {
      return <span className="text-sub text-closed-ink flex flex-col items-end leading-4" aria-label={`Đã chốt bởi ${d.chot!.boi} lúc ${luc(d.chot!.luc)}`}><span className="font-semibold whitespace-nowrap num">Đã chốt · {luc(d.chot!.luc)}</span><span className="whitespace-nowrap">{d.chot!.boi}</span></span>;
    }
    return <span className="text-chip text-locked-ink flex items-center gap-1.5"><Lock className="w-4 h-4" />Kỳ lương đã khóa sổ</span>;
  };

  /* ─── Tóm tắt ─── */
  const c = all.reduce((acc, r) => ((acc[r.trangThai] = (acc[r.trangThai] ?? 0) + 1), acc), {} as Partial<Record<TrangThaiDong, number>>);
  const tramCount = new Set(all.map((r) => r.tramId)).size;
  const hoanThanh = all.filter((r) => r.laHoanThanh && r.soLuong != null);
  const tongHoanThanh = hoanThanh.reduce((s, r) => s + r.soLuong!, 0);
  const filled = all.filter((r) => r.soLuong != null).length, pctFilled = all.length ? Math.round((filled / all.length) * 100) : 0;
  const todo = issuesOf(all).length;
  const chip = (key: TrangThaiDong, n: number | undefined, text: string, cls: string, Icon?: LucideIcon) => !n ? null : (
    <button type="button" onClick={() => { setFilter(filter === key ? null : key); setEdit(null); }} aria-pressed={filter === key}
      className={cn('h-8 px-3 rounded-pill inline-flex items-center gap-1.5 text-chip whitespace-nowrap border transition-colors duration-fast', cls, filter === key && 'ring-2 ring-offset-1 ring-current')}>
      {Icon && <Icon className="w-3.5 h-3.5" />}<b className="font-semibold num">{n}</b> {text}{filter === key && <X className="w-3.5 h-3.5 -mr-1" />}
    </button>
  );

  /* ─── Bảng ─── */
  const statusPill = (r: DongBang) => {
    if (r.trangThai === 'CHUA_CO_SO') return <span className="h-6 px-2.5 rounded-pill inline-flex items-center text-sub font-semibold bg-surface/60 text-empty-ink border border-empty-bar/40 whitespace-nowrap">Chưa có số</span>;
    if (r.trangThai === 'CANH_BAO') return canEdit(r)
      ? <button type="button" data-confirm={r.key} onClick={() => setPop({ kind: 'reason', key: r.key, n: r.soLuong!, moveNext: false, fromEdit: false })} className="h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold bg-surface text-warn-ink border border-warn-bar/60 hover:border-warn-bar whitespace-nowrap transition-colors duration-fast" data-tip={`${r.canhBao.join(' · ')} — bấm để xem lại`}><TriangleAlert className="w-3.5 h-3.5" />Cần xem lại</button>
      : <span className="h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold bg-surface/60 text-warn-ink border border-warn-bar/40 whitespace-nowrap" data-tip={r.canhBao.join(' · ')}><TriangleAlert className="w-3.5 h-3.5" />Cần xem lại</span>;
    if (r.trangThai === 'DA_DIEU_CHINH') {
      const h = lastAdj(r), same = h && h.soCu === h.soMoi;
      return <span tabIndex={0} className="h-6 px-2.5 rounded-pill inline-flex items-center gap-1 text-sub font-semibold bg-adjust-bg text-adjust-ink whitespace-nowrap cursor-help" data-tip={adjTip(r)}>{same ? <><Check className="w-3.5 h-3.5" />Đã xác nhận</> : 'Đã điều chỉnh'}</span>;
    }
    return r.biKhoa ? <span className="text-sub text-locked-ink inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" />Đã khóa</span> : null;
  };

  const qtyCell = (r: DongBang) => {
    if (edit?.key === r.key) return (
      <div className="flex flex-col items-end gap-1">
        <input id="qty-input" inputMode="numeric" autoComplete="off" value={edit.value} aria-label="Số lượng mới"
          aria-invalid={!!edit.error} aria-describedby={edit.error ? 'qty-err' : undefined}
          onChange={(e) => setEdit({ ...edit, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submitEdit(false); }
            else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); submitEdit(true); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(true); }
          }}
          className={cn('num w-full h-8 px-2 text-right text-qty font-semibold rounded-ctl border-2 outline-none bg-surface', edit.error ? 'border-danger' : 'border-brand-ink')} />
        {edit.error && <p id="qty-err" className="text-sub text-danger text-right leading-tight whitespace-normal">{edit.error}</p>}
      </div>
    );
    if (r.soLuong == null) return (
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-muted" aria-hidden="true">—</span>
        {canEdit(r) && <button type="button" data-proxy={r.key} onClick={() => { setEdit(null); setPop({ kind: 'proxy', key: r.key }); }} className="h-7 px-1.5 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-chip font-medium inline-flex items-center gap-1 whitespace-nowrap transition-colors duration-fast"><UserPlus className="w-3.5 h-3.5" />Nhập hộ</button>}
      </div>
    );
    const adj = r.trangThai === 'DA_DIEU_CHINH';
    const inner = <>{adj && <Pencil className="w-3.5 h-3.5 text-adjust-ink" />}<span className="num text-qty font-semibold">{dinhDangSo(r.soLuong)}</span></>;
    if (!canEdit(r)) return <div className="flex items-center justify-end gap-1.5">{inner}</div>;
    return (
      <button type="button" data-edit={r.key} onClick={() => startEdit(r.key)} aria-label={`Sửa số lượng ${dinhDangSo(r.soLuong)}`} data-tip={adj ? adjTip(r) : undefined} style={{ width: 'calc(100% + 16px)' }}
        className="w-full h-8 -my-1 px-2 -mx-2 flex items-center justify-end gap-1.5 rounded-ctl hover:bg-surface hover:ring-1 hover:ring-line-strong transition duration-fast">
        {inner}
      </button>
    );
  };

  const empty = (Icon: LucideIcon, text: string, sub = '') => (
    <tr><td colSpan={8} className="!h-auto !border-0"><div className="py-16 flex flex-col items-center gap-3 text-center">
      <Icon className="w-10 h-10 text-muted" /><p className="text-body text-ink font-medium">{text}</p>{sub && <p className="text-sub text-muted">{sub}</p>}
    </div></td></tr>
  );

  const tableBody = () => {
    if (!d) return empty(RefreshCw, bangQ.isError ? loiCua(bangQ.error) : 'Đang tải…');
    if (!all.length) return empty(CalendarX, `Không có dữ liệu ngày ${dinhDangNgay(date)} (${thu(date)})`, 'Chuyền chưa có sơ đồ công đoạn cho ngày này.');
    if (!rows.length) return q.trim()
      ? empty(SearchX, `Không tìm thấy “${q.trim()}”`, 'Thử mã NV, tên công nhân hoặc tên công đoạn. Nhấn Esc để xóa tìm kiếm.')
      : empty(CircleCheck, 'Không còn dòng nào cần xử lý', 'Bấm lại chip lọc hoặc tắt công tắc để xem toàn bộ.');
    const groups: { tram: string; rows: DongBang[] }[] = [];
    rows.forEach((r) => { const g = groups[groups.length - 1]; if (g && g.tram === r.tramId) g.rows.push(r); else groups.push({ tram: r.tramId, rows: [r] }); });
    return groups.map((g) => g.rows.map((r, i) => {
      const first = i === 0, span = g.rows.length, last = i === span - 1, isEmpty = r.trangThai === 'CHUA_CO_SO';
      const SIcon = r.nguon ? SRC_ICON[r.nguon] : null;
      return (
        <tr key={r.key} className={cn(ST_CLASS[r.trangThai], last && 'grp-end')} data-id={r.key}>
          {first && <td rowSpan={span} className={cn(span > 1 ? 'tram-span bg-surface' : 'lead', 'px-3 text-center align-middle text-qty font-semibold num')}>{r.soTram}</td>}
          <td className={cn((!first || span > 1) && 'lead', 'px-3 py-0.5')}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-[18px] px-1.5 rounded-pill bg-group text-tag font-semibold text-ink shrink-0 inline-flex items-center">{r.maMaHang}</span>
              <span className="font-medium truncate">{r.tenCongDoan}</span>
              {r.laHoanThanh && <span className="h-[18px] px-1.5 rounded-pill bg-closed-bg text-closed-ink text-tag font-semibold shrink-0 inline-flex items-center">QC ★</span>}
            </div>
            <div className="text-sub text-muted num"><span className="font-mono text-tag">{r.maCongDoan}</span>{r.smv != null && ` · SMV ${dinhDangSo(r.smv, 3)}s`}</div>
          </td>
          <td className={cn('px-3 font-mono text-[13px]', isEmpty && 'italic text-muted')}>{isEmpty ? (r.dangNhap ? r.dangNhap.maNV : '—') : r.nhanVien?.maNV}</td>
          <td className="px-3 py-0.5">
            {isEmpty
              ? <span className="italic text-muted truncate block">{r.dangNhap ? r.dangNhap.hoTen : 'Chưa có người đăng nhập'}</span>
              : <span className="truncate block">{r.nhanVien?.hoTen}</span>}
            {r.hoTroTu && <span className="mt-0.5 h-[18px] px-1.5 rounded-pill bg-support-bg text-support-ink text-tag font-semibold inline-flex items-center">Hỗ trợ từ {r.hoTroTu}</span>}
          </td>
          <td className="qty-td px-3 text-right relative">{qtyCell(r)}</td>
          <td className="px-3">{r.nguon && SIcon ? <span className="inline-flex items-center gap-1.5 text-chip text-ink whitespace-nowrap"><SIcon className="w-3.5 h-3.5 text-muted" />{TEN_NGUON[r.nguon]}</span> : <span className="text-muted">—</span>}</td>
          <td className="px-3">{statusPill(r)}</td>
          <td className="px-3 text-center">
            <button type="button" onClick={() => setDrawerKey(r.key)} className="row-action opacity-0 focus:opacity-100 w-8 h-8 grid place-items-center rounded-ctl text-muted hover:bg-group hover:text-ink transition duration-fast mx-auto"
              aria-label={`Lịch sử trạm ${r.soTram} ${r.maCongDoan}`} data-tip="Lịch sử"><History className="w-4 h-4" /></button>
          </td>
        </tr>
      );
    }));
  };

  const popRow = pop ? findRow(pop.key) : undefined;
  const popAnchor = pop ? anchorOf(pop.key) : null;
  const dr = drawerKey ? findRow(drawerKey) : undefined;

  /* ─── Modal chốt ngày ─── */
  const soChuaCo = canhBaoServer?.oChuaCoSo.length ?? c.CHUA_CO_SO ?? 0;
  const soCanhBao = canhBaoServer?.oCanhBao ?? c.CANH_BAO ?? 0;
  const soGio = canhBaoServer?.yeuCauGioChoDuyet ?? d?.gioChoDuyet ?? 0;
  const warns: [LucideIcon, string, React.ReactNode, 'empty' | 'warn' | 'time'][] = [];
  if (soChuaCo) warns.push([CircleDashed, 'text-empty-bar', <>Còn <b className="num">{soChuaCo}</b> ô chưa có số</>, 'empty']);
  if (soCanhBao) warns.push([TriangleAlert, 'text-warn-bar', <>Còn <b className="num">{soCanhBao}</b> ô cần xem lại</>, 'warn']);
  if (soGio) warns.push([Clock, 'text-muted', <>Còn <b className="num">{soGio}</b> yêu cầu giờ chờ duyệt</>, 'time']);
  const nWarn = soChuaCo + soCanhBao + soGio;
  const dsChuaCo = canhBaoServer?.oChuaCoSo ?? all.filter((r) => r.trangThai === 'CHUA_CO_SO').map((r) => ({ soTram: r.soTram, maCongDoan: r.maCongDoan, nhanVien: r.dangNhap ? `${r.dangNhap.maNV} ${r.dangNhap.hoTen}` : null }));

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col" style={{ padding: 'var(--content-pad)', gap: 'var(--block-gap)' }}>
        <div className="page-in w-full mx-auto flex-1 min-h-0 flex flex-col" style={{ maxWidth: 'var(--table-max)', gap: 'var(--block-gap)' }}>

          {/* ① Thanh tiêu đề & bộ lọc */}
          <section className="bg-surface border border-line rounded-card px-4 flex items-center gap-2.5 shrink-0" style={{ height: 'var(--toolbar-h)' }} aria-label="Bộ lọc">
            <h1 className="text-title font-semibold whitespace-nowrap">Bảng sản lượng ngày</h1>

            <label className="relative shrink-0">
              <span className="sr-only">Chuyền</span>
              <select value={line.id} onChange={(e) => go(e.target.value, date)}
                className="native w-40 h-9 pl-3 pr-8 rounded-ctl border border-line-strong bg-surface text-body font-medium hover:border-muted transition-colors duration-fast">
                {lines.map((l) => <option key={l.id} value={l.id}>{l.ma} · {l.ten}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
            </label>

            <div ref={dateRef} className="relative flex items-center shrink-0" role="group" aria-label="Chọn ngày">
              <button type="button" onClick={() => { const x = dates[idx + 1]; if (x) goDate(x.ngay); }} disabled={idx < 0 || idx >= dates.length - 1}
                className="w-9 h-9 grid place-items-center rounded-l-ctl border border-line-strong bg-surface hover:bg-hover disabled:text-disabled-ink disabled:hover:bg-surface disabled:cursor-not-allowed transition-colors duration-fast" aria-label="Ngày trước"><ChevronLeft className="w-[18px] h-[18px]" /></button>
              <button type="button" onClick={() => setDateMenu((o) => !o)} aria-haspopup="menu" aria-expanded={dateMenu} aria-label="Chọn ngày"
                className="w-[180px] h-9 -ml-px -mr-px px-3 flex items-center gap-2 border border-line-strong bg-surface text-body hover:bg-hover transition-colors duration-fast">
                <Calendar className="w-4 h-4 text-muted" /><span className="num whitespace-nowrap">{thu(date)}, {dinhDangNgay(date)}</span>
              </button>
              {dateMenu && (
                <div role="menu" className="pop-in absolute left-9 top-11 w-[300px] max-h-[420px] overflow-auto bg-surface border border-line rounded-card shadow-pop p-1 z-40">
                  <div className="px-3 pt-2 pb-1 text-tag font-semibold uppercase tracking-[0.06em] text-muted">14 ngày gần nhất · {line.ma}</div>
                  {dates.map((x) => {
                    const [label, cls, Icon] = dayMeta(x), cur = x.ngay === date;
                    return (
                      <button type="button" key={x.ngay} role="menuitem" onClick={() => { setDateMenu(false); goDate(x.ngay); }} aria-current={cur ? 'date' : undefined}
                        className={cn('w-full h-10 px-3 flex items-center gap-2.5 rounded-ctl text-body hover:bg-hover', cur && 'bg-brand-soft')}>
                        <span className={cn('num', cur && 'font-semibold')}>{thu(x.ngay)}, {dinhDangNgay(x.ngay)}</span>
                        <span className={cn('ml-auto inline-flex items-center gap-1 text-sub font-semibold', cls)}><Icon className="w-3.5 h-3.5" />{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button type="button" onClick={() => { const x = dates[idx - 1]; if (x) goDate(x.ngay); }} disabled={idx <= 0}
                className="w-9 h-9 grid place-items-center rounded-r-ctl border border-line-strong bg-surface hover:bg-hover disabled:text-disabled-ink disabled:hover:bg-surface disabled:cursor-not-allowed transition-colors duration-fast" aria-label="Ngày sau"><ChevronRight className="w-[18px] h-[18px]" /></button>
            </div>

            <span className="shrink-0">{d && statusChip()}</span>

            <Switch checked={onlyTodo} onChange={(v) => { setOnlyTodo(v); setEdit(null); }} label={<span className="whitespace-normal w-[92px] block">Chỉ hiện dòng cần xử lý</span>} />

            <div className="ml-auto shrink-0 flex items-center">{closeArea()}</div>
          </section>

          {/* ② Dải tóm tắt */}
          <section className="flex items-center gap-2 shrink-0 min-w-0" style={{ height: 'var(--summary-h)', margin: '-4px 0' }} aria-label="Tóm tắt">
            <span className="h-8 px-3 rounded-pill inline-flex items-center gap-2 text-chip bg-surface border border-line whitespace-nowrap">
              <span><b className="font-semibold num">{tramCount}</b> trạm · <b className="font-semibold num">{all.length}</b> dòng</span>
              {all.length > 0 && (<>
                <span className="w-10 h-1.5 rounded-pill bg-group overflow-hidden" role="progressbar" aria-valuenow={pctFilled} aria-valuemin={0} aria-valuemax={100} aria-label="Tỉ lệ dòng đã có số">
                  <span className="block h-full bg-success" style={{ width: `${pctFilled}%` }} />
                </span>
                <span className="text-muted num" data-tip={`${filled}/${all.length} dòng đã có số`}>{filled}/{all.length}</span>
              </>)}
            </span>
            {chip('CHUA_CO_SO', c.CHUA_CO_SO, 'ô chưa có số', 'bg-empty-bg text-empty-ink border-transparent hover:border-empty-bar')}
            {chip('CANH_BAO', c.CANH_BAO, 'ô cảnh báo', 'bg-warn-bg text-warn-ink border-transparent hover:border-warn-bar', TriangleAlert)}
            {chip('DA_DIEU_CHINH', c.DA_DIEU_CHINH, 'ô đã điều chỉnh', 'bg-adjust-bg text-adjust-ink border-transparent hover:border-adjust-ink')}
            {!!d?.gioChoDuyet && (
              <Link to="/san-xuat/duyet-gio" className="h-8 px-3 rounded-pill inline-flex items-center gap-1.5 text-chip text-muted bg-surface border border-line hover:bg-hover whitespace-nowrap transition-colors duration-fast">
                <Clock className="w-3.5 h-3.5" /><b className="font-semibold num text-ink">{d.gioChoDuyet}</b> giờ làm chờ duyệt
              </Link>
            )}
            {todo > 0 && editable && (
              <button type="button" onClick={() => goIssue(issuesOf(all)[0])} className="h-8 pl-2.5 pr-2 rounded-pill inline-flex items-center gap-1.5 text-chip font-semibold text-ink bg-surface border border-line-strong hover:bg-hover whitespace-nowrap transition-colors duration-fast" data-tip="Mở ô cần xử lý kế tiếp · phím N">
                <CircleArrowRight className="w-4 h-4 text-brand-ink" />Xử lý tiếp
              </button>
            )}
            {hoanThanh.length > 0 && (
              <span className="ml-auto min-w-0 truncate text-chip text-muted whitespace-nowrap">
                <span data-tip="Số sản phẩm qua công đoạn hoàn thành (QC ★)">Hoàn thành: <b className="font-semibold text-ink num">{dinhDangSo(tongHoanThanh)}</b> sp</span>
              </span>
            )}
          </section>

          {/* ③ Bảng dữ liệu */}
          <section className="bg-surface border border-line rounded-card overflow-hidden flex-1 min-h-0 flex flex-col" aria-label="Bảng sản lượng">
            <div id="table-scroll" className="flex-1 min-h-0 overflow-auto scroll-area">
              <table className="grid-table text-body">
                <colgroup>
                  <col style={{ width: 64 }} /><col style={{ minWidth: 260 }} /><col style={{ width: 96 }} /><col style={{ width: 180 }} />
                  <col style={{ width: 110 }} /><col style={{ width: 104 }} /><col style={{ width: 160 }} /><col style={{ width: 56 }} />
                </colgroup>
                <thead>
                  <tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted">
                    <th scope="col" className="px-3 text-center">Trạm</th>
                    <th scope="col" className="px-3 text-left">Công đoạn</th>
                    <th scope="col" className="px-3 text-left">Mã NV</th>
                    <th scope="col" className="px-3 text-left">Họ tên</th>
                    <th scope="col" className="px-3 text-right">Số lượng</th>
                    <th scope="col" className="px-3 text-left">Nguồn</th>
                    <th scope="col" className="px-3 text-left">Trạng thái</th>
                    <th scope="col" className="px-3"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>{tableBody()}</tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* ④ Thanh trạng thái dưới */}
      <footer className="bg-surface border-t border-line px-4 flex items-center gap-4 text-sub text-muted shrink-0" style={{ height: 'var(--statusbar-h)' }}>
        <ul className="flex items-center gap-4" aria-label="Chú thích màu">
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-empty-bg border border-empty-bar" />Chưa có số</li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warn-bg border border-warn-bar" />Cần xem lại</li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-adjust-bg border border-adjust-ink" />Đã điều chỉnh</li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-support-bg border border-support-ink" />Hỗ trợ chuyền khác</li>
        </ul>
        <span className="ml-auto hidden 2xl:inline-flex items-center gap-1.5"><Kbd>/</Kbd> tìm · <Kbd>N</Kbd> ô cần xử lý kế tiếp · <Kbd>Tab</Kbd> dòng dưới</span>
        <div className="ml-auto 2xl:ml-0 flex items-center gap-2">
          <span>Cập nhật lúc {d ? dinhDangGio(d.capNhatLuc) : '—'}</span>
          <button type="button" onClick={() => { void lamMoi(); toast('Đã tải lại dữ liệu'); }} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-hover text-muted transition-colors duration-fast" aria-label="Tải lại" data-tip="Tải lại"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </footer>

      {/* Popover */}
      {pop && popRow && popAnchor && (pop.kind === 'reason'
        ? <ReasonPopover key={`${pop.key}r`} row={popRow} n={pop.n} anchor={popAnchor} onCancel={cancelPop} onSave={saveReason} />
        : <ProxyPopover key={`${pop.key}p`} row={popRow} ngay={date} anchor={popAnchor} onCancel={cancelPop} onSave={saveProxy} />)}

      {/* Drawer lịch sử */}
      <Drawer open={!!dr} onClose={() => setDrawerKey(null)} title="Lịch sử bản ghi">
        {dr && <HistoryBody r={dr} date={date} />}
      </Drawer>

      {/* Modal chốt ngày */}
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title={`Chốt ngày ${dinhDangNgay(date)} – ${line.ma}?`}
        footer={<>
          <button type="button" data-autofocus={nWarn ? undefined : true} onClick={() => setCloseOpen(false)} className="h-9 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-body font-medium transition-colors duration-fast">Hủy</button>
          <button type="button" disabled={(nWarn > 0 && !ack) || chot.isPending} onClick={() => chot.mutate()} className="h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold flex items-center gap-2 transition-colors duration-fast disabled:bg-disabled-bg disabled:text-disabled-ink disabled:cursor-not-allowed">
            <CircleCheck className="w-[18px] h-[18px]" />{nWarn ? 'Vẫn chốt ngày' : 'Chốt ngày'}
          </button>
        </>}>
        {warns.length > 0 && (
          <ul className="flex flex-col gap-2">
            {warns.map(([I, cls, text, key]) => (
              <li key={key} className="flex items-center gap-2.5 px-3 py-2 rounded-ctl bg-thead border border-line text-body">
                <I className={cn('w-[18px] h-[18px]', cls)} /><span>{text}</span>
                {key === 'time'
                  ? <Link to="/san-xuat/duyet-gio" className="ml-auto text-chip font-semibold text-brand-ink hover:underline">Mở Duyệt giờ</Link>
                  : <button type="button" onClick={() => { setCloseOpen(false); goIssue(issuesOf(all).find((r) => r.trangThai === (key === 'empty' ? 'CHUA_CO_SO' : 'CANH_BAO'))); }} className="ml-auto text-chip font-semibold text-brand-ink hover:underline">Xử lý ngay</button>}
              </li>
            ))}
          </ul>
        )}
        {dsChuaCo.length > 0 && (
          <div className="mt-3 max-h-36 overflow-auto rounded-ctl border border-line px-3 py-2 text-sub">
            <div className="text-muted mb-1">Ô chưa có số (NV × trạm):</div>
            <ul className="flex flex-col gap-0.5 num">{dsChuaCo.map((o) => <li key={`${o.soTram}|${o.maCongDoan}`}>Trạm {o.soTram} · {o.maCongDoan} · {o.nhanVien ?? 'chưa có người đăng nhập'}</li>)}</ul>
          </div>
        )}
        <p className="mt-4 text-body text-muted">Sau khi chốt, công nhân không nhập được số của ngày này. Tổ trưởng vẫn sửa được (bắt buộc lý do). Không có thao tác bỏ chốt.</p>
        {nWarn > 0 && (
          <label className="mt-4 flex items-start gap-2.5 text-body cursor-pointer">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--text)]" />
            <span>Tôi đã kiểm tra và vẫn muốn chốt khi còn <b className="num">{nWarn}</b> mục chưa xử lý.</span>
          </label>
        )}
      </Modal>
    </>
  );
}

function HistoryBody({ r, date }: { r: DongBang; date: string }) {
  const who = r.nhanVien ? `${r.nhanVien.maNV} ${r.nhanVien.hoTen}` : 'Chưa có người nhập';
  const n = r.nvNgay;
  return (
    <>
      <div className="rounded-card border border-line bg-thead px-3 py-2.5 text-chip leading-relaxed">
        <span className="font-semibold">Trạm {r.soTram}</span> · {r.maCongDoan} {r.tenCongDoan} · {who} · <span className="num">{dinhDangNgay(date)}</span>
        {r.phutSmv != null && (
          <div className="mt-1.5 pt-1.5 border-t border-line text-sub text-muted num flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <span>
              <b className="text-ink">{dinhDangSo(r.phutSmv)} phút chuẩn</b>
              {n && n.phutSmv != null && ` · cả ngày: ${dinhDangSo(n.phutSmv)} phút${n.hieuSuat != null ? ` (${dinhDangSo(n.hieuSuat, 0)}% ca ${dinhDangSoGio(n.gioLam)} giờ)` : ''}`}
            </span>
          </div>
        )}
      </div>
      {r.lichSu.length ? (
        <ol className="mt-5">
          {r.lichSu.map((h, i) => {
            const I = SRC_ICON[h.nguon];
            return (
              <li key={i} className="tl-item relative pl-6 pb-5">
                <span className={cn('absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2', i === 0 ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface')} />
                <div className="text-sub text-muted num">{luc(h.luc)}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-qty font-semibold num">{h.soCu == null ? dinhDangSo(h.soMoi) : `${dinhDangSo(h.soCu)} → ${dinhDangSo(h.soMoi)}`}</span>
                  <span className="h-5 px-2 rounded-pill bg-group text-tag font-semibold inline-flex items-center gap-1"><I className="w-3 h-3" />{TEN_NGUON[h.nguon]}</span>
                </div>
                <div className="text-chip mt-1">{h.boi}{h.lyDo && ` — ${h.lyDo}`}</div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="py-12 flex flex-col items-center gap-2 text-muted text-chip"><History className="w-8 h-8" />Chưa có bản ghi nào cho công đoạn này.</div>
      )}
      {r.trangThai === 'CANH_BAO' && <div className="mt-2 px-3 py-2 rounded-ctl bg-warn-bg text-warn-ink text-chip flex gap-2"><TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />{r.canhBao.join(' · ')}</div>}
    </>
  );
}
