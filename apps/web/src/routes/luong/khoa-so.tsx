/**
 * Khóa sổ Mã hàng × Tháng · F10 — giao diện chép từ ui-demo/(web)/luong/khoa-so
 * (chọn tháng + tiến độ · bảng mã hàng: sản lượng tháng, ngày có SL, ngày chưa chốt, trạng thái · Khóa / Mở khóa (lý do) / Khóa lại ·
 * "Khóa tất cả mã hàng của tháng"). Server kiểm điều kiện và khóa độc quyền [TDD 8.5].
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dinhDangGio, dinhDangNgay, dinhDangSo, type DongKhoaThang, homNay as ngayVN, LoiApi, LY_DO_MO_KHOA, zKetQuaKhoaTatCa, zKhoaThangThang } from '@vsn/shared';
import { Button, cn, Modal, Page, Pill, Progress, ReasonChips, Select, StatusBar, Toolbar, useToast } from '@vsn/ui';
import { type Col, DataTable } from '@vsn/ui/data-table';
import { CalendarX, CircleCheck, Lock, LockOpen, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { api, thongBaoLoi } from '../../lib/api';
import { useShell } from '../../shell/shell-context';

const zKhongNoiDung = z.undefined();
const tenThang = (t: string) => `${t.slice(5)}/${t.slice(0, 4)}`;
const luc = (iso: string) => `${dinhDangGio(iso)} ${dinhDangNgay(ngayVN(new Date(iso))).slice(0, 5)}`;
type St = 'locked' | 'reopened' | 'ready' | 'blocked';
const trangThai = (l: DongKhoaThang): St => (l.khoa?.trangThai === 'KHOA' ? 'locked' : l.chuaChot.length ? 'blocked' : l.khoa?.trangThai === 'MO' ? 'reopened' : 'ready');
const chuaChotText = (l: DongKhoaThang) => l.chuaChot.map((d) => `${d.maChuyen} · ${dinhDangNgay(d.ngay).slice(0, 5)}`);

export function KhoaSoPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { q } = useShell();
  const [thang, setThang] = useState<string | null>(null);
  const dsQ = useQuery({
    queryKey: ['khoa-thang', thang],
    queryFn: ({ signal }) => api.goi(`/khoa-thang${thang ? `?thang=${thang}` : ''}`, { schema: zKhoaThangThang, signal }),
  });
  const t = dsQ.data?.thang ?? thang ?? '';
  const rows = dsQ.data?.dong ?? [];
  const [unlock, setUnlock] = useState<DongKhoaThang | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [blocked, setBlocked] = useState<DongKhoaThang | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const lamMoi = () => queryClient.invalidateQueries({ queryKey: ['khoa-thang'] });

  const khoa = useMutation({
    mutationFn: (l: DongKhoaThang) => api.goi('/khoa-thang/khoa', { method: 'POST', body: { maHangId: l.maHangId, thang: t }, schema: zKhongNoiDung }),
    onSuccess: (_, l) => { toast(`Đã khóa ${l.ma} × ${tenThang(t)} · khóa cả giờ làm liên quan`); void lamMoi(); },
    onError: (e, l) => {
      if (e instanceof LoiApi && e.code === 'CON_NGAY_CHUA_CHOT') setBlocked({ ...l, chuaChot: e.chiTiet as DongKhoaThang['chuaChot'] });
      else toast(thongBaoLoi(e), 'warn');
      void lamMoi();
    },
  });
  const moKhoa = useMutation({
    mutationFn: () => api.goi('/khoa-thang/mo-khoa', { method: 'POST', body: { maHangId: unlock!.maHangId, thang: t, lyDo: reason === 'Khác' ? note.trim() : reason }, schema: zKhongNoiDung }),
    onSuccess: () => { setUnlock(null); toast('Đã mở khóa · tổ trưởng có thể sửa số'); void lamMoi(); },
    onError: (e) => setErr(thongBaoLoi(e)),
  });
  const khoaTatCa = useMutation({
    mutationFn: () => api.goi('/khoa-thang/khoa-tat-ca', { method: 'POST', body: { thang: t }, schema: zKetQuaKhoaTatCa }),
    onSuccess: (kq) => { setAllOpen(false); toast(`Đã khóa ${kq.daKhoa.length} mã hàng · bỏ qua ${kq.boQua.length} mã chưa đủ điều kiện`); void lamMoi(); },
    onError: (e) => { setAllOpen(false); toast(thongBaoLoi(e), 'warn'); void lamMoi(); },
  });

  const s = q.trim().toLowerCase();
  const list = rows.filter((r) => !s || `${r.ma} ${r.ten}`.toLowerCase().includes(s));
  const locked = rows.filter((r) => trangThai(r) === 'locked').length;
  const seKhoa = rows.filter((r) => ['ready', 'reopened'].includes(trangThai(r)) && r.soNgay > 0);
  const boQua = rows.filter((r) => trangThai(r) === 'blocked');

  const cols: Col<DongKhoaThang>[] = [
    { key: 'mh', label: 'Mã hàng', width: 220, render: (l) => <div><div className="font-semibold">{l.ma}</div><div className="text-sub text-muted truncate">{l.ten}</div></div> },
    { key: 'sl', label: `Sản lượng tháng ${t.slice(5)}`, width: 150, align: 'right', render: (l) => <b className="num text-qty">{dinhDangSo(l.sanLuong)}</b> },
    { key: 'ngay', label: 'Ngày có SL', width: 110, align: 'right', render: (l) => <span className="num">{l.soNgay}</span> },
    { key: 'chot', label: 'Ngày chưa chốt', width: 230, render: (l) => l.chuaChot.length
      ? <button type="button" onClick={() => setBlocked(l)} className="inline-flex items-center gap-1.5 text-chip text-empty-ink font-semibold hover:underline text-left"><CalendarX className="w-4 h-4 shrink-0" />{l.chuaChot.length} ngày: {chuaChotText(l).slice(0, 3).join(', ')}{l.chuaChot.length > 3 && '…'}</button>
      : <span className="inline-flex items-center gap-1.5 text-chip text-closed-ink"><CircleCheck className="w-4 h-4" />Đã chốt đủ</span> },
    { key: 'st', label: 'Trạng thái', render: (l) => {
      const st = trangThai(l);
      return (
        <div className="flex flex-col gap-0.5 items-start">
          {st === 'locked' ? <Pill tone="locked" icon={Lock}>Đã khóa</Pill> : st === 'reopened' ? <Pill tone="warn" icon={LockOpen}>Đang mở khóa</Pill> : st === 'ready' ? <Pill tone="open">Sẵn sàng khóa</Pill> : <Pill tone="empty">Chưa đủ điều kiện</Pill>}
          {l.khoa && <span className="text-sub text-muted">{l.khoa.trangThai === 'MO' ? `Mở khóa bởi ${l.khoa.boi} · ${luc(l.khoa.luc)}${l.khoa.lyDo ? ` — ${l.khoa.lyDo}` : ''}` : `${l.khoa.boi} · ${luc(l.khoa.luc)}`}</span>}
        </div>
      );
    } },
    { key: 'act', label: <span className="sr-only">Thao tác</span>, width: 150, align: 'right', render: (l) => {
      const st = trangThai(l);
      return st === 'locked'
        ? <Button size="sm" icon={LockOpen} onClick={() => { setUnlock(l); setReason(''); setNote(''); setErr(''); }}>Mở khóa</Button>
        : <Button size="sm" variant={st === 'blocked' ? 'secondary' : 'primary'} icon={Lock} disabled={khoa.isPending}
          onClick={() => (st === 'blocked' ? setBlocked(l) : khoa.mutate(l))}>{st === 'reopened' ? 'Khóa lại' : 'Khóa'}</Button>;
    } },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Khóa sổ" right={<Button variant="primary" icon={Lock} disabled={!seKhoa.length} onClick={() => setAllOpen(true)}>Khóa tất cả mã hàng của tháng</Button>}>
          <Select label="Tháng" value={t} onChange={(e) => setThang(e.target.value)} className="w-40">
            {(dsQ.data?.dsThang ?? (t ? [t] : [])).map((x) => <option key={x} value={x}>Tháng {tenThang(x)}</option>)}
          </Select>
          <div className="flex items-center gap-2.5 ml-2 text-chip">
            <span className="w-32"><Progress value={rows.length ? (locked / rows.length) * 100 : 0} /></span>
            <span className="text-muted"><b className="text-ink num">{locked}/{rows.length}</b> mã hàng đã khóa</span>
          </div>
        </Toolbar>
        <div className="rounded-card border border-line bg-surface px-4 py-2.5 text-chip text-muted flex items-center gap-2 shrink-0">
          <Lock className="w-4 h-4 shrink-0" /><span>Khóa theo <b className="text-ink">Mã hàng × Tháng</b>. Chỉ khóa được khi mọi ngày liên quan đã chốt. Khóa cũng khóa giờ làm của các NV × ngày có sản lượng thuộc mã hàng đó.</span>
        </div>
        <DataTable cols={cols} rows={list} rowKey={(l) => l.maHangId} dangTai={dsQ.isPending} empty={`Chưa có sản lượng trong tháng ${tenThang(t)}`}
          rowClass={(l) => (trangThai(l) === 'reopened' ? 'bg-warn-bg/40' : undefined)} />
      </Page>
      <StatusBar right={<span>Mã hàng vắt qua 2 tháng được khóa riêng từng tháng</span>}>
        <span>Mở khóa → tổ trưởng sửa (lý do) → khóa lại</span>
      </StatusBar>

      <Modal open={!!unlock} onClose={() => setUnlock(null)} title={`Mở khóa ${unlock?.ma ?? ''} × ${tenThang(t)}?`}
        footer={<><Button onClick={() => setUnlock(null)}>Hủy</Button><Button variant="primary" icon={LockOpen} disabled={moKhoa.isPending} onClick={() => {
          if (!reason) return setErr('Bắt buộc chọn lý do mở khóa.');
          if (reason === 'Khác' && !note.trim()) return setErr('Vui lòng nhập ghi chú khi chọn “Khác”.');
          moKhoa.mutate();
        }}>Mở khóa</Button></>}>
        <p className="text-body text-muted mb-4">Tổ trưởng sẽ sửa được sản lượng và giờ làm của mã hàng này trong tháng {tenThang(t)}. Nhớ khóa lại sau khi sửa xong.</p>
        <ReasonChips name="ul" reasons={LY_DO_MO_KHOA} value={reason} onChange={(v) => { setReason(v); setErr(''); }} />
        {reason === 'Khác' && <textarea rows={2} value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} placeholder="Mô tả ngắn lý do…" aria-label="Ghi chú lý do"
          className="mt-2 w-full px-3 py-2 rounded-ctl border border-line-strong bg-surface text-body resize-none outline-none focus:border-brand-ink" />}
        {err && <p className="text-sub text-danger mt-1.5" role="alert">{err}</p>}
      </Modal>

      <Modal open={!!blocked} onClose={() => setBlocked(null)} title={`Chưa khóa được ${blocked?.ma ?? ''}`}
        footer={<Button variant="primary" onClick={() => setBlocked(null)}>Đã hiểu</Button>}>
        <p className="text-body text-muted">Còn ngày chưa chốt — tổ trưởng phải chốt ngày trước khi khóa:</p>
        <ul className="mt-3 flex flex-col gap-2 max-h-72 overflow-auto">{blocked && chuaChotText(blocked).map((d) => (
          <li key={d} className="flex items-center gap-2.5 px-3 py-2 rounded-ctl bg-empty-bg text-empty-ink text-body"><CalendarX className="w-4 h-4" />{d}</li>))}</ul>
      </Modal>

      <Modal open={allOpen} onClose={() => setAllOpen(false)} title={`Khóa tất cả mã hàng tháng ${tenThang(t)}?`}
        footer={<><Button onClick={() => setAllOpen(false)}>Hủy</Button><Button variant="primary" icon={Lock} disabled={khoaTatCa.isPending} onClick={() => khoaTatCa.mutate()}>Khóa {seKhoa.length} mã hàng</Button></>}>
        <ul className="flex flex-col gap-2">
          {[...seKhoa, ...boQua].map((r) => (
            <li key={r.maHangId} className={cn('flex items-center gap-2.5 px-3 py-2 rounded-ctl border text-body', trangThai(r) === 'blocked' ? 'bg-empty-bg border-transparent text-empty-ink' : 'bg-thead border-line')}>
              {trangThai(r) === 'blocked' ? <TriangleAlert className="w-4 h-4" /> : <CircleCheck className="w-4 h-4 text-closed-ink" />}
              <b>{r.ma}</b><span className="text-sub">{trangThai(r) === 'blocked' ? `bỏ qua — còn ${r.chuaChot.length} ngày chưa chốt` : 'sẽ khóa'}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
