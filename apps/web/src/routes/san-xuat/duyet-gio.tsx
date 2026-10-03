/**
 * Duyệt giờ làm · F6 — giao diện chép từ ui-demo/(web)/san-xuat/duyet-gio
 * (lọc chuyền gốc, tab Chờ duyệt / Đã duyệt / Từ chối, Duyệt · Từ chối có lý do, Duyệt tất cả, Sửa giờ trực tiếp).
 * Phạm vi: NV có chuyền gốc TẠI NGÀY của yêu cầu thuộc chuyền được gắn [R 5.8] [D18] — server kiểm lại mọi thao tác.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dinhDangGio, dinhDangNgay, dinhDangSo, dinhDangSoGio, docSoGio, homNay as ngayVN, LOI_SO_GIO, thuIso,
  type TrangThaiYeuCauGio, type YeuCauGioDuyet, zChuyen, zDsYeuCauGio, zKetQuaGioLam, zNvGioLam,
} from '@vsn/shared';
import { Button, cn, EmptyState, Field, Input, Modal, Page, Pill, ReasonChips, Select, StatusBar, Tabs, Toolbar, useToast } from '@vsn/ui';
import { type Col, DataTable } from '@vsn/ui/data-table';
import { Check, CheckCheck, Clock, Lock, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { api, thongBaoLoi } from '../../lib/api';
import { useShell } from '../../shell/shell-context';

const TU_CHOI = ['Không có lệnh tăng ca', 'Số giờ không khớp chấm công', 'Nhập nhầm ngày', 'Khác'];
const thuNgan = (d: string) => { const t = thuIso(d); return t === 7 ? 'CN' : `T${t + 1}`; };
const ddmm = (d: string) => dinhDangNgay(d).slice(0, 5);
const luc = (iso: string) => `${dinhDangGio(iso)} ${ddmm(ngayVN(new Date(iso)))}`;
const zKhongNoiDung = z.undefined();

export function DuyetGioPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { q } = useShell();
  const chuyenQ = useQuery({ queryKey: ['chuyen', 'tat-ca'], queryFn: ({ signal }) => api.goi('/chuyen', { schema: z.array(zChuyen), signal }) });
  const dsChuyen = (chuyenQ.data ?? []).filter((c) => c.trangThai === 'HOAT_DONG');
  const [chuyenChon, setChuyen] = useState<string | null>(null);
  const chuyenId = chuyenChon ?? dsChuyen[0]?.id;
  const [tab, setTab] = useState<TrangThaiYeuCauGio>('CHO');
  const [rej, setRej] = useState<YeuCauGioDuyet | null>(null);
  const [sua, setSua] = useState(false);

  const dsQ = useQuery({
    queryKey: ['gio-lam', 'yeu-cau', chuyenId, tab],
    queryFn: ({ signal }) => api.goi(`/gio-lam/cho-duyet?chuyenId=${chuyenId}&trangThai=${tab}`, { schema: zDsYeuCauGio, signal }),
    enabled: !!chuyenId,
  });
  const lamMoi = () => queryClient.invalidateQueries({ queryKey: ['gio-lam'] });

  const s = q.trim().toLowerCase();
  const rows = (dsQ.data?.ds ?? []).filter((r) => !s || `${r.nhanVien.maNV} ${r.nhanVien.hoTen}`.toLowerCase().includes(s));
  const dem = dsQ.data?.dem ?? { CHO: 0, DUYET: 0, TU_CHOI: 0 };

  const duyet = useMutation({
    mutationFn: async (ds: YeuCauGioDuyet[]) => {
      let ok = 0;
      const loi: string[] = [];
      // Duyệt tuần tự từng yêu cầu: mỗi yêu cầu kiểm khóa tháng / phiên bản riêng [TDD 7.3]
      for (const r of ds) {
        try {
          await api.goi(`/gio-lam/${r.id}/duyet`, { method: 'POST', body: { version: r.version }, schema: zKetQuaGioLam });
          ok++;
        } catch (e) {
          loi.push(`${r.nhanVien.hoTen}: ${thongBaoLoi(e)}`);
        }
      }
      return { ok, loi };
    },
    onSuccess: ({ ok, loi }) => {
      if (loi.length) toast(ok ? `Đã duyệt ${ok} · ${loi.length} lỗi — ${loi[0]}` : loi[0]!, 'warn');
      else toast(ok > 1 ? `Đã duyệt ${ok} yêu cầu` : 'Đã duyệt · báo cáo dùng giờ mới');
      void lamMoi();
    },
  });

  const cols: Col<YeuCauGioDuyet>[] = [
    { key: 'nv', label: 'Công nhân', width: 200, render: (r) => (<div><div className="font-medium">{r.nhanVien.hoTen}</div><div className="text-sub text-muted"><span className="font-mono">{r.nhanVien.maNV}</span> · chuyền gốc {r.chuyenGoc?.ma ?? '—'}</div></div>) },
    { key: 'date', label: 'Ngày làm việc', width: 120, render: (r) => <span className="num whitespace-nowrap">{thuNgan(r.ngay)}, {ddmm(r.ngay)}</span> },
    { key: 'def', label: 'Mặc định', width: 90, align: 'right', render: (r) => <span className="num text-muted">{dinhDangSoGio(r.gioMacDinh)}</span> },
    { key: 'req', label: 'Đề nghị', width: 120, align: 'right', render: (r) => {
      const d = r.gioMacDinh == null ? null : r.soGio - r.gioMacDinh;
      return <span className="inline-flex items-center gap-2 justify-end"><b className="num text-qty">{dinhDangSoGio(r.soGio)}</b>{d != null && d !== 0 && <span className={cn('text-sub font-semibold num', d > 0 ? 'text-open-ink' : 'text-warn-ink')}>{d > 0 ? '+' : '−'}{dinhDangSoGio(Math.abs(d))}</span>}</span>;
    } },
    { key: 'sl', label: 'Sản lượng ngày đó', render: (r) => r.sanLuong.length ? (
      <span className="flex items-center gap-1.5 flex-wrap">{r.sanLuong.map((x) => (
        <span key={x.maChuyen} className="inline-flex items-center gap-1.5">{x.maChuyen} · {dinhDangSo(x.soLuong)} sp{x.hoTro && <Pill size="sm" tone="support">Hỗ trợ {x.maChuyen}</Pill>}</span>))}
      </span>) : <span className="text-muted">Chưa có</span> },
    { key: 'sent', label: tab === 'CHO' ? 'Gửi lúc' : 'Xử lý', width: tab === 'CHO' ? 110 : 230, render: (r) => tab === 'CHO' ? <span className="num text-muted whitespace-nowrap">{luc(r.guiLuc)}</span> : (
      <div className="text-sub"><div className="text-muted">{r.xuLy ? `${r.xuLy.boi ?? '—'} · ${luc(r.xuLy.luc)}` : '—'}</div>{r.lyDoTuChoi && <div className="text-danger">Lý do: {r.lyDoTuChoi}</div>}</div>) },
    { key: 'act', label: <span className="sr-only">Thao tác</span>, width: tab === 'CHO' ? 224 : 130, align: 'right', render: (r) => tab === 'CHO' ? (
      r.biKhoa ? <Pill tone="locked" icon={Lock}>Đã khóa sổ</Pill> : (
        <span className="inline-flex gap-1.5 whitespace-nowrap">
          <Button size="sm" icon={X} onClick={() => setRej(r)}>Từ chối</Button>
          <Button size="sm" variant="primary" icon={Check} disabled={duyet.isPending} onClick={() => duyet.mutate([r])}>Duyệt</Button>
        </span>)) : r.trangThai === 'DUYET' ? <Pill tone="closed" icon={Check}>Đã duyệt</Pill> : <Pill tone="danger" icon={X}>Từ chối</Pill> },
  ];

  const choDuyet = rows.filter((r) => r.trangThai === 'CHO' && !r.biKhoa);
  const md = dsQ.data?.macDinh;

  if (chuyenQ.isSuccess && !dsChuyen.length) {
    return <Page><Toolbar title="Duyệt giờ làm" /><section className="flex-1 bg-surface border border-line rounded-card grid place-items-center"><EmptyState icon={Clock} title="Chưa có chuyền trong phạm vi của bạn" /></section></Page>;
  }

  return (
    <>
      <Page>
        <Toolbar title="Duyệt giờ làm" right={<>
          <Button icon={Pencil} disabled={!chuyenId} onClick={() => setSua(true)}>Sửa giờ trực tiếp</Button>
          {tab === 'CHO' && choDuyet.length > 0 && <Button variant="primary" icon={CheckCheck} disabled={duyet.isPending} onClick={() => duyet.mutate(choDuyet)}>Duyệt tất cả ({choDuyet.length})</Button>}
        </>}>
          <Select label="Chuyền gốc" value={chuyenId ?? ''} onChange={(e) => setChuyen(e.target.value)} className="w-40">
            {dsChuyen.map((c) => <option key={c.id} value={c.id}>{c.ma} · {c.ten}</option>)}
          </Select>
          <span className="text-sub text-muted ml-2 max-w-[320px] leading-4">Duyệt cho NV thuộc chuyền gốc của bạn — kể cả khi họ hỗ trợ chuyền khác.</span>
        </Toolbar>

        <section className="bg-surface border border-line rounded-card flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={tab} onChange={setTab} options={[{ value: 'CHO', label: 'Chờ duyệt', count: dem.CHO }, { value: 'DUYET', label: 'Đã duyệt', count: dem.DUYET }, { value: 'TU_CHOI', label: 'Từ chối', count: dem.TU_CHOI }]} />
          <DataTable cols={cols} rows={rows} rowKey={(r) => r.id} className="border-0 rounded-none" emptyIcon={CheckCheck} dangTai={dsQ.isPending}
            empty={tab === 'CHO' ? 'Không còn yêu cầu chờ duyệt' : 'Chưa có dữ liệu'} />
        </section>
      </Page>
      <StatusBar right={md && <span>Giờ mặc định {md.tenXuong}: T2–T6 {dinhDangSoGio(md.gio.T2_T6)} giờ · T7 {dinhDangSoGio(md.gio.T7)} giờ · CN {md.gio.CN == null ? 'trống' : `${dinhDangSoGio(md.gio.CN)} giờ`}</span>}>
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Chưa duyệt → báo cáo tạm tính giờ mặc định</span>
      </StatusBar>

      <TuChoiModal yc={rej} onClose={() => setRej(null)} onXong={() => { setRej(null); toast('Đã từ chối · công nhân thấy lý do trên app'); void lamMoi(); }} />
      {sua && chuyenId && dsQ.data && <SuaTrucTiepModal chuyenId={chuyenId} homNay={dsQ.data.homNay} onClose={() => setSua(false)}
        onXong={() => { setSua(false); toast('Đã sửa giờ làm · ghi lịch sử'); void lamMoi(); }} />}
    </>
  );
}

function TuChoiModal({ yc, onClose, onXong }: { yc: YeuCauGioDuyet | null; onClose: () => void; onXong: () => void }) {
  const [chon, setChon] = useState('');
  const [khac, setKhac] = useState('');
  const [err, setErr] = useState('');
  const lyDo = chon === 'Khác' ? khac.trim() : chon;
  const m = useMutation({
    mutationFn: () => api.goi(`/gio-lam/${yc!.id}/tu-choi`, { method: 'POST', body: { version: yc!.version, lyDo }, schema: zKhongNoiDung }),
    onSuccess: () => { setChon(''); setKhac(''); onXong(); },
    onError: (e) => setErr(thongBaoLoi(e)),
  });
  const dong = () => { setChon(''); setKhac(''); setErr(''); onClose(); };
  return (
    <Modal open={!!yc} onClose={dong} title="Từ chối yêu cầu sửa giờ"
      footer={<><Button onClick={dong}>Hủy</Button><Button variant="danger" disabled={m.isPending} onClick={() => {
        if (!lyDo) return setErr('Bắt buộc chọn lý do khi từ chối.');
        m.mutate();
      }}>Từ chối</Button></>}>
      {yc && <p className="text-body text-muted mb-4">{yc.nhanVien.hoTen} · {dinhDangNgay(yc.ngay)} · đề nghị <b className="text-ink num">{dinhDangSoGio(yc.soGio)} giờ</b> (mặc định {dinhDangSoGio(yc.gioMacDinh)})</p>}
      <ReasonChips name="rej" reasons={TU_CHOI} value={chon} onChange={(v) => { setChon(v); setErr(''); }} />
      {chon === 'Khác' && <Input autoFocus value={khac} onChange={(e) => { setKhac(e.target.value); setErr(''); }} placeholder="Nhập lý do" className="w-full mt-2" aria-label="Lý do khác" />}
      {err && <p className="text-sub text-danger mt-1.5" role="alert">{err}</p>}
    </Modal>
  );
}

function SuaTrucTiepModal({ chuyenId, homNay, onClose, onXong }: { chuyenId: string; homNay: string; onClose: () => void; onXong: () => void }) {
  const [ngay, setNgay] = useState(homNay);
  const [nvId, setNvId] = useState('');
  const [gio, setGio] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const nvQ = useQuery({
    queryKey: ['gio-lam', 'nhan-vien', chuyenId, ngay],
    queryFn: ({ signal }) => api.goi(`/gio-lam/nhan-vien?chuyenId=${chuyenId}&ngay=${ngay}`, { schema: z.array(zNvGioLam), signal }),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(ngay),
  });
  const nv = nvQ.data?.find((n) => n.id === nvId);
  const m = useMutation({
    mutationFn: () => api.goi('/gio-lam/truc-tiep', { method: 'PUT', body: { nhanVienId: nvId, ngay, soGio: gio, lyDo }, schema: zKetQuaGioLam }),
    onSuccess: onXong,
    onError: (e) => setErr({ chung: thongBaoLoi(e) }),
  });
  const luu = () => {
    const e: Record<string, string> = {};
    if (!nvId) e['nv'] = 'Chọn công nhân.';
    const n = docSoGio(gio);
    if (n == null || !(n > 0 && n <= 16)) e['gio'] = LOI_SO_GIO;
    if (!lyDo.trim()) e['lyDo'] = 'Bắt buộc nhập lý do.';
    setErr(e);
    if (!Object.keys(e).length) m.mutate();
  };
  return (
    <Modal open onClose={onClose} title="Sửa giờ làm trực tiếp"
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" disabled={m.isPending} onClick={luu}>Lưu</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Công nhân" required error={err['nv']} hint={nv ? `Đang tính ${dinhDangSoGio(nv.gioHieuLuc)} giờ (${nv.nguon === 'MAC_DINH' ? 'mặc định' : nv.nguon === 'YEU_CAU_DUYET' ? 'đã duyệt' : 'tổ trưởng sửa'})${nv.biKhoa ? ' · đã khóa sổ' : ''}` : undefined}>
            <Select label="Công nhân" className="w-full" value={nvId} onChange={(e) => { setNvId(e.target.value); setErr({}); }}>
              <option value="">{nvQ.isPending ? 'Đang tải…' : nvQ.data?.length ? 'Chọn công nhân' : 'Không có NV chuyền gốc ngày này'}</option>
              {nvQ.data?.map((n) => <option key={n.id} value={n.id} disabled={n.biKhoa}>{n.maNV} · {n.hoTen}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Ngày làm việc" required>
          <Input type="date" value={ngay} max={homNay} onChange={(e) => { setNgay(e.target.value); setNvId(''); }} className="w-full" />
        </Field>
        <Field label="Số giờ" required hint="> 0 và ≤ 16, VD 9,5" error={err['gio']}>
          <Input value={gio} onChange={(e) => setGio(e.target.value)} placeholder={nv ? dinhDangSoGio(nv.gioHieuLuc) : '9,5'} inputMode="decimal" className="w-full num text-right" aria-invalid={!!err['gio']} />
        </Field>
        <div className="col-span-2">
          <Field label="Lý do" required error={err['lyDo']}>
            <Input value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="VD: Làm lẫn trạm JACK buổi chiều" className="w-full" aria-invalid={!!err['lyDo']} />
          </Field>
        </div>
      </div>
      {err['chung'] && <p className="text-sub text-danger mt-3" role="alert">{err['chung']}</p>}
    </Modal>
  );
}
