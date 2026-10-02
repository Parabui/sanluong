/**
 * Popover neo vào ô Số lượng — chép từ ui-demo/(web)/san-xuat/bang-san-luong/popovers.tsx:
 * lý do điều chỉnh / xác nhận ô cảnh báo, nhập hộ (tìm NV đang hoạt động ở mọi chuyền).
 */
import { useQuery } from '@tanstack/react-query';
import { dinhDangNgay, dinhDangSo, type DongBang, LY_DO_CANH_BAO, LY_DO_NHAP_HO, LY_DO_SUA, LY_DO_XAC_NHAN, zNvTimDuoc } from '@vsn/shared';
import { cn, ReasonChips } from '@vsn/ui';
import { CircleAlert, TriangleAlert, User } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { api } from '../../../lib/api';
import { useDebounced } from '../../../lib/hooks';

/** "1.234" | "1234" → 1234 · sai → null */
export function docSoLuong(v: string): number | null {
  let s = v.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 99_999 ? null : n;
}

/* ─────────── Khung popover neo vào ô ─────────── */
export function Popover({ anchor, label, onCancel, children }: { anchor: HTMLElement; label: string; onCancel: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el || !anchor.isConnected) return;
      const a = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      const left = Math.min(Math.max(8, a.right - w), innerWidth - w - 8);
      let top = a.bottom + 4;
      if (top + h > innerHeight - 8) top = Math.max(8, a.top - h - 4);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };
    place();
    const sc = document.getElementById('table-scroll');
    sc?.addEventListener('scroll', place);
    addEventListener('resize', place);
    return () => { sc?.removeEventListener('scroll', place); removeEventListener('resize', place); };
  }, [anchor]);

  // bấm ra ngoài → hủy
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !anchor.contains(t)) onCancel();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [anchor, onCancel]);

  return (
    <div ref={ref} role="dialog" aria-label={label} className="pop-in fixed z-50 bg-surface border border-line rounded-card shadow-pop p-4"
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
        if (e.key === 'Tab') { // giữ focus trong popover
          const f = [...ref.current!.querySelectorAll<HTMLElement>('input,select,textarea,button:not([disabled])')].filter((x) => x.offsetParent);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1]!.focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0]!.focus(); }
        }
      }}>
      {children}
    </div>
  );
}

/* ─────────── Phần lý do dùng chung ─────────── */
type TruongLoi = 'reason' | 'note' | 'nv' | 'qty' | 'server';
function useReason() {
  const [rs, setRs] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<{ msg: string; field: TruongLoi } | null>(null);
  const read = () => {
    if (!rs) { setErr({ msg: 'Vui lòng chọn lý do (bấm chip, hoặc phím Space / mũi tên).', field: 'reason' }); return null; }
    if (rs === 'Khác' && !note.trim()) { setErr({ msg: 'Vui lòng nhập ghi chú khi chọn “Khác”.', field: 'note' }); return null; }
    return { rs, reason: rs === 'Khác' ? note.trim() : note.trim() ? `${rs} — ${note.trim()}` : rs };
  };
  return { rs, setRs, note, setNote, err, setErr, read };
}

function ReasonBlock({ name, reasons, r, onSave, onCancel, busy }: { name: string; reasons: string[]; r: ReturnType<typeof useReason>; onSave: () => void; onCancel: () => void; busy: boolean }) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <div onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(); } }}>
        {/* Enter không tự chọn chip đang focus — lý do phải được chọn chủ động (Space / mũi tên / bấm) */}
        <ReasonChips name={name} reasons={reasons} value={r.rs} onChange={(v) => { r.setRs(v); r.setErr(null); if (v === 'Khác') setTimeout(() => noteRef.current?.focus()); }} />
      </div>
      <label className="block text-chip font-medium mt-3 mb-1" htmlFor={`${name}-note`}>
        Ghi chú <span className="text-muted font-normal">(bắt buộc khi chọn “Khác”)</span>
      </label>
      <textarea id={`${name}-note`} ref={noteRef} rows={2} value={r.note} placeholder="Mô tả ngắn lý do…"
        onChange={(e) => { r.setNote(e.target.value); r.setErr(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); } }}
        className={cn('w-full px-3 py-2 rounded-ctl border bg-surface text-body resize-none outline-none focus:border-brand-ink', r.err?.field === 'note' ? 'border-danger' : 'border-line-strong')} />
      {r.err && <p className="text-sub text-danger mt-1.5 flex items-center gap-1" role="alert"><CircleAlert className="w-3.5 h-3.5 shrink-0" />{r.err.msg}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel} className="h-9 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-body font-medium transition-colors duration-fast">Hủy</button>
        <button type="button" onClick={onSave} disabled={busy} className="h-9 px-4 rounded-ctl bg-brand hover:bg-brand-hover text-ink text-body font-semibold transition-colors duration-fast disabled:opacity-60">Lưu</button>
      </div>
    </>
  );
}

const Note = ({ children }: { children: ReactNode }) => (
  <div className="mb-3 px-3 py-2 rounded-ctl bg-warn-bg text-warn-ink text-chip flex items-start gap-2">
    <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /><span>{children}</span>
  </div>
);


/* ─────────── Popover lý do điều chỉnh / xác nhận ô cảnh báo ─────────── */
export function ReasonPopover({ row, n, anchor, onCancel, onSave }: {
  row: DongBang; n: number; anchor: HTMLElement; onCancel: () => void; onSave: (reason: string) => Promise<string | null>;
}) {
  const warn = row.trangThai === 'CANH_BAO', same = n === row.soLuong;
  const title = warn && same ? 'Xác nhận ô cảnh báo' : 'Lý do điều chỉnh';
  const reasons = warn ? (same ? LY_DO_CANH_BAO : LY_DO_CANH_BAO.slice(1)) : LY_DO_SUA;
  const r = useReason();
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLInputElement>('input[type=radio]')?.focus(); }, []);

  const save = async () => {
    const res = r.read();
    if (!res) return;
    if (same && res.rs !== LY_DO_XAC_NHAN && res.rs !== 'Khác') return r.setErr({ msg: `Số chưa đổi — chọn “${LY_DO_XAC_NHAN}” nếu giữ nguyên.`, field: 'reason' });
    setBusy(true);
    const loi = await onSave(res.reason);
    setBusy(false);
    if (loi) r.setErr({ msg: loi, field: 'server' });
  };

  return (
    <Popover anchor={anchor} label={title} onCancel={onCancel}>
      <div className="w-[320px]" ref={box}>
        <div className="text-h font-semibold">{title}</div>
        <div className="text-sub text-muted mt-0.5 mb-3 num">
          Trạm {row.soTram} · {row.maCongDoan} {row.tenCongDoan} · <b className="text-ink">{same ? `giữ nguyên ${dinhDangSo(n)}` : `${dinhDangSo(row.soLuong)} → ${dinhDangSo(n)}`}</b>
        </div>
        {warn && <Note>{row.canhBao.join(' · ')}.{same && ` Giữ nguyên số → chọn “${LY_DO_XAC_NHAN}”; muốn sửa số → bấm vào ô Số lượng.`}</Note>}
        {!same && row.soLuong != null && n < row.soLuong && <Note>Số mới nhỏ hơn số cũ (<b className="num">{dinhDangSo(row.soLuong)} → {dinhDangSo(n)}</b>)</Note>}
        <ReasonBlock name="pr-reason" reasons={reasons} r={r} onSave={() => void save()} onCancel={onCancel} busy={busy} />
      </div>
    </Popover>
  );
}

/* ─────────── Popover nhập hộ ─────────── */
type Nv = z.infer<typeof zNvTimDuoc>;
export function ProxyPopover({ row, ngay, anchor, onCancel, onSave }: {
  row: DongBang; ngay: string; anchor: HTMLElement; onCancel: () => void; onSave: (nv: Nv, n: number, reason: string) => Promise<string | null>;
}) {
  const pre = row.dangNhap;
  const [nv, setNv] = useState(pre?.maNV ?? '');
  const [chon, setChon] = useState<Nv | null>(pre ? { ...pre, maChuyen: null } : null);
  const [qty, setQty] = useState('');
  const [hi, setHi] = useState(-1);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const r = useReason();
  const nvRef = useRef<HTMLInputElement>(null), qtyRef = useRef<HTMLInputElement>(null);
  useEffect(() => { (pre ? qtyRef : nvRef).current?.focus(); }, [pre]);

  const q = useDebounced(nv.trim(), 200);
  const timQ = useQuery({
    queryKey: ['bang-san-luong', 'nhan-vien', q],
    queryFn: ({ signal }) => api.goi(`/bang-san-luong/nhan-vien?q=${encodeURIComponent(q)}`, { schema: z.array(zNvTimDuoc), signal }),
    enabled: q.length > 0 && listOpen,
  });
  const matches = (timQ.data ?? []).slice(0, 6);
  const pick = (e: Nv) => { setNv(e.maNV); setChon(e); setListOpen(false); setHi(-1); r.setErr(null); qtyRef.current?.focus(); };

  const save = async () => {
    const exact = chon && chon.maNV === nv.trim().toUpperCase() ? chon : matches.find((m) => m.maNV === nv.trim().toUpperCase());
    if (!exact) return r.setErr({ msg: 'Mã NV không tồn tại — chọn từ danh sách gợi ý.', field: 'nv' });
    const n = docSoLuong(qty);
    if (n == null) return r.setErr({ msg: 'Số lượng phải là số nguyên từ 0 đến 99.999', field: 'qty' });
    const res = r.read();
    if (!res) return;
    setBusy(true);
    const loi = await onSave(exact, n, res.reason);
    setBusy(false);
    if (loi) r.setErr({ msg: loi, field: 'server' });
  };

  return (
    <Popover anchor={anchor} label="Nhập hộ" onCancel={onCancel}>
      <div className="w-[320px]">
        <div className="text-h font-semibold">Nhập hộ</div>
        <div className="text-sub text-muted mt-0.5 mb-3 num">Trạm {row.soTram} · {row.maCongDoan} {row.tenCongDoan} · {dinhDangNgay(ngay)}</div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <div className="relative">
            <label className="block text-chip font-medium mb-1" htmlFor="px-nv">Mã NV <span className="text-danger">*</span></label>
            <input id="px-nv" ref={nvRef} role="combobox" aria-expanded={listOpen && matches.length > 0} aria-controls="px-list" aria-autocomplete="list" autoComplete="off"
              aria-activedescendant={hi >= 0 ? `px-o${hi}` : undefined}
              value={nv} placeholder="VD: NV005…"
              onChange={(e) => { setNv(e.target.value); setChon(null); setHi(-1); setListOpen(true); r.setErr(null); }}
              onBlur={() => setTimeout(() => setListOpen(false), 100)}
              onKeyDown={(e) => {
                if (!listOpen || !matches.length) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % matches.length); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); }
                else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(matches[hi]!); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setListOpen(false); }
              }}
              className={cn('num w-full h-9 px-3 rounded-ctl border bg-surface text-body uppercase outline-none focus:border-brand-ink', r.err?.field === 'nv' ? 'border-danger' : 'border-line-strong')} />
            {listOpen && matches.length > 0 && (
              <ul id="px-list" role="listbox" className="absolute left-0 right-[-122px] top-[62px] z-10 bg-surface border border-line rounded-card shadow-pop p-1 max-h-52 overflow-auto">
                {matches.map((e, i) => (
                  <li key={e.id} id={`px-o${i}`} role="option" aria-selected={i === hi} onMouseDown={(ev) => { ev.preventDefault(); pick(e); }}
                    className={cn('h-9 px-3 flex items-center gap-3 rounded-ctl cursor-pointer text-body', i === hi ? 'bg-brand-soft' : 'hover:bg-hover')}>
                    <span className="num font-medium w-[72px]">{e.maNV}</span><span className="text-muted truncate">{e.hoTen}</span>
                    {e.maChuyen && <span className="ml-auto text-tag text-muted">{e.maChuyen}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-chip font-medium mb-1" htmlFor="px-qty">Số lượng <span className="text-danger">*</span></label>
            <input id="px-qty" ref={qtyRef} inputMode="numeric" autoComplete="off" value={qty}
              onChange={(e) => { setQty(e.target.value); r.setErr(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
              className={cn('num w-full h-9 px-3 rounded-ctl border bg-surface text-body text-right font-semibold outline-none focus:border-brand-ink', r.err?.field === 'qty' ? 'border-danger' : 'border-line-strong')} />
          </div>
        </div>
        <p className={cn('text-sub mt-1 mb-3 flex items-center gap-1', chon ? 'text-ink' : 'text-muted')}>
          {chon ? (<><User className="w-3.5 h-3.5" />{chon.hoTen}{pre && chon.id === pre.id && <span className="text-muted">· đang đăng nhập trạm</span>}</>)
            : nv ? 'Nhập mã hoặc tên để tìm nhân viên' : 'Chưa có người đăng nhập trạm'}
        </p>
        <ReasonBlock name="px-reason" reasons={LY_DO_NHAP_HO} r={r} onSave={() => void save()} onCancel={onCancel} busy={busy} />
      </div>
    </Popover>
  );
}
