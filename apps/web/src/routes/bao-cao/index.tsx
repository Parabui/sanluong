/**
 * Báo cáo sản lượng · F5 — giao diện chép từ ui-demo/(web)/bao-cao
 * (kỳ Ngày / Tuần / Tháng / Khoảng · lọc xưởng, chuyền, mã hàng, công nhân (ô tìm) · chip loại báo cáo · bảng + dòng tổng · Xuất Excel).
 * Màn hình xem từng trang; tổng ở chân bảng là tổng TOÀN BỘ dòng — cùng truy vấn với Excel [TDD 13.2].
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  BAO_CAO_LOC_MA_HANG, congNgay, dinhDangGio, dinhDangNgay, dinhDangSo, dinhDangSoGio, type DongChuyen, type DongCongDoan, type DongCongNhan,
  type DongLichSu, type DongMaHang, homNay as ngayVN, LOAI_BAO_CAO, type LoaiBaoCao, NGUONG_HIEU_SUAT_CAO, TEN_BAO_CAO, TEN_NGUON,
  thuIso, type TrangThaiSoLieu, trongBaThang, zBaoCao, zChuyen, zMaHang, zXuong,
} from '@vsn/shared';
import { Button, cn, Page, Pill, Progress, Segmented, Select, StatusBar, Toolbar, useToast } from '@vsn/ui';
import { type Col, DataTable, TableFooter } from '@vsn/ui/data-table';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { api, taiFile, thongBaoLoi } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { useToi } from '../../lib/xac-thuc';
import { useShell } from '../../shell/shell-context';

type Ky = 'ngay' | 'tuan' | 'thang' | 'khoang';
const p2 = (n: number) => String(n).padStart(2, '0');
/** Khoảng ngày của kỳ chứa ngày mốc (tính trên chuỗi ngày, không đọc đồng hồ máy) */
function khoangKy(ky: Exclude<Ky, 'khoang'>, a: string): { tu: string; den: string } {
  if (ky === 'ngay') return { tu: a, den: a };
  if (ky === 'tuan') { const tu = congNgay(a, 1 - thuIso(a)); return { tu, den: congNgay(tu, 6) }; }
  const [y, m] = a.split('-').map(Number) as [number, number];
  const sau = m === 12 ? `${y + 1}-01-01` : `${y}-${p2(m + 1)}-01`;
  return { tu: `${a.slice(0, 7)}-01`, den: congNgay(sau, -1) };
}
const thuNgan = (d: string) => { const t = thuIso(d); return t === 7 ? 'CN' : `T${t + 1}`; };
const ddmm = (d: string) => dinhDangNgay(d).slice(0, 5);
const luc = (iso: string) => `${dinhDangGio(iso)} ${ddmm(ngayVN(new Date(iso)))}`;
const stPill = (st: TrangThaiSoLieu) => st === 'DA_CHOT' ? <Pill size="sm" tone="closed">Đã chốt</Pill> : st === 'DA_KHOA' ? <Pill size="sm" tone="locked">Đã khóa</Pill> : <Pill size="sm" tone="open">Chưa chốt</Pill>;
const phut = (x: number | null) => (x == null ? <span className="text-muted">—</span> : <span className="num">{dinhDangSo(x, 0)}</span>);
const hieuSuat = (e: number | null, tamTinh = false) => {
  if (e == null) return <span className="inline-flex items-center gap-1 text-sub text-warn-ink"><TriangleAlert className="w-3.5 h-3.5" />Chưa có giờ làm</span>;
  return (
    <span className={cn('inline-flex items-center gap-2 justify-end', e > NGUONG_HIEU_SUAT_CAO && 'text-warn-ink font-semibold')}>
      {tamTinh && <span className="text-tag text-muted" data-tip="Ngày còn mã hàng chưa khóa — số có thể còn đổi">tạm tính</span>}
      <span className="w-14"><Progress value={Math.min(100, e)} tone={e > NGUONG_HIEU_SUAT_CAO ? 'warn' : e >= 80 ? 'success' : 'brand'} /></span>
      <span className="num w-12">{dinhDangSo(e)}%</span>
    </span>
  );
};

const cotCongNhan = (nhieuNgay: boolean): Col<DongCongNhan>[] => [
  ...(nhieuNgay ? [{ key: 'ngay', label: 'Ngày', width: 90, render: (w: DongCongNhan) => <span className="num whitespace-nowrap">{thuNgan(w.ngay)}, {ddmm(w.ngay)}</span> }] : []),
  { key: 'nv', label: 'Mã NV', width: 96, render: (w) => <span className="font-mono text-[13px]">{w.maNV}</span> },
  { key: 'ten', label: 'Họ tên', width: 200, render: (w) => <span className="flex items-center gap-1.5 flex-wrap">{w.hoTen}{w.hoTroTu && <Pill size="sm" tone="support">Hỗ trợ từ {w.hoTroTu}</Pill>}</span> },
  { key: 'tram', label: 'Trạm', width: 90, align: 'center', render: (w) => <span className="num">{w.maChuyen} · {w.tram.join(', ')}</span> },
  { key: 'cd', label: 'Công đoạn', render: (w) => <span className="font-mono text-tag">{w.congDoan.join(', ')}</span> },
  { key: 'sl', label: 'Sản lượng', width: 100, align: 'right', render: (w) => <b className="num text-qty">{dinhDangSo(w.sanLuong)}</b> },
  { key: 'smv', label: 'Phút SMV', width: 96, align: 'right', render: (w) => phut(w.phutSmv) },
  { key: 'gio', label: 'Giờ làm', width: 84, align: 'right', render: (w) => w.gioLam != null
    ? <span className={cn('num', w.gioChoDuyet && 'text-warn-ink')} data-tip={w.gioChoDuyet ? 'Giờ làm chờ duyệt — đang tính giờ mặc định' : undefined}>{dinhDangSoGio(Math.round(w.gioLam * 100) / 100)}</span>
    : <span className="text-warn-ink">—</span> },
  { key: 'eff', label: '% Hiệu suất', width: 170, align: 'right', render: (w) => hieuSuat(w.hieuSuat, w.tamTinh) },
  { key: 'st', label: 'Trạng thái', width: 110, render: (w) => stPill(w.trangThai) },
];
const cotCongDoan: Col<DongCongDoan>[] = [
  { key: 'tram', label: 'Trạm', width: 100, align: 'center', render: (r) => <b className="num">{r.maChuyen} · {r.soTram}</b> },
  { key: 'mh', label: 'Mã hàng', width: 100, render: (r) => <Pill size="sm">{r.maMaHang}</Pill> },
  { key: 'cd', label: 'Công đoạn', render: (r) => <span><span className="font-mono text-tag text-muted mr-2">{r.maCongDoan}</span>{r.tenCongDoan}</span> },
  { key: 'smv', label: 'SMV (giây)', width: 100, align: 'right', render: (r) => r.smv == null ? <span className="text-muted" data-tip="Chưa có SMV hoặc nhiều mức SMV trong kỳ">—</span> : <span className="num">{dinhDangSo(r.smv, 3)}</span> },
  { key: 'sl', label: 'Sản lượng', width: 110, align: 'right', render: (r) => <b className="num text-qty">{dinhDangSo(r.sanLuong)}</b> },
  { key: 'min', label: 'Phút SMV', width: 100, align: 'right', render: (r) => phut(r.phutSmv) },
];
const cotChuyen: Col<DongChuyen>[] = [
  { key: 'ma', label: 'Chuyền', width: 120, render: (r) => <span><b>{r.maChuyen}</b> <span className="text-muted">· {r.tenChuyen}</span></span> },
  { key: 'qc', label: 'Hoàn thành (QC)', width: 150, align: 'right', render: (r) => <span className="num">{dinhDangSo(r.hoanThanh)}</span> },
  { key: 'sl', label: 'Sản lượng', width: 120, align: 'right', render: (r) => <span className="num">{dinhDangSo(r.sanLuong)}</span> },
  { key: 'smv', label: 'Phút SMV', width: 110, align: 'right', render: (r) => phut(r.phutSmv) },
  { key: 'lam', label: 'Phút làm', width: 110, align: 'right', render: (r) => phut(r.phutLam) },
  { key: 'nv', label: 'Số NV', width: 80, align: 'right', render: (r) => <span className="num">{r.soNv}</span> },
  { key: 'eff', label: '% Hiệu suất chuyền', align: 'right', render: (r) => r.hieuSuat == null ? <span className="text-muted">—</span>
    : <b className={cn('num', r.hieuSuat >= 85 ? 'text-closed-ink' : r.hieuSuat < 72 ? 'text-warn-ink' : '')}>{r.tamTinh && <span className="text-tag text-muted font-normal mr-1.5">tạm tính</span>}{dinhDangSo(r.hieuSuat)}%</b> },
];
const cotMaHang = (thang: string): Col<DongMaHang>[] => [
  { key: 'ma', label: 'Mã hàng', width: 110, render: (s) => <b>{s.ma}</b> },
  { key: 'ten', label: 'Tên hàng', render: (s) => <span>{s.ten}<span className="text-muted text-sub block">{s.congDoan.map((c) => `${c.ma}: ${dinhDangSo(c.sanLuong)}`).join(' · ')}</span></span> },
  { key: 'ky', label: 'Đã làm (kỳ)', width: 110, align: 'right', render: (s) => <b className="num">{dinhDangSo(s.daLamKy)}</b> },
  { key: 'lk', label: 'Lũy kế', width: 100, align: 'right', render: (s) => <span className="num">{dinhDangSo(s.daLamLuyKe)}</span> },
  { key: 'tot', label: 'Tổng đơn', width: 100, align: 'right', render: (s) => <span className="num text-muted">{dinhDangSo(s.soLuongDonHang)}</span> },
  { key: 'left', label: 'Còn lại', width: 100, align: 'right', render: (s) => <span className="num">{dinhDangSo(s.conLai)}</span> },
  { key: 'pct', label: '% Hoàn thành', width: 180, align: 'right', render: (s) => s.phanTram == null ? <span className="text-muted">—</span> : <span className="inline-flex items-center gap-2 justify-end"><span className="w-24"><Progress value={Math.min(100, s.phanTram)} /></span><span className="num w-10">{dinhDangSo(s.phanTram, 0)}%</span></span> },
  { key: 'st', label: `Trạng thái tháng ${thang}`, width: 150, render: (s) => s.trangThaiThang === 'KHOA' ? <Pill size="sm" tone="locked">Đã khóa</Pill> : <Pill size="sm" tone="open">Chưa khóa</Pill> },
];
const cotLichSu: Col<DongLichSu>[] = [
  { key: 't', label: 'Thời điểm', width: 110, render: (h) => <span className="num text-muted whitespace-nowrap">{luc(h.luc)}</span> },
  { key: 'who', label: 'Người thực hiện', width: 170, render: (h) => h.nguoi },
  { key: 'where', label: 'Chuyền · Trạm', width: 110, render: (h) => <span className="num">{h.maChuyen} · {h.soTram}</span> },
  { key: 'cd', label: 'Công đoạn · NV', width: 170, render: (h) => <span className="font-mono text-tag" data-tip={`${h.hoTenNV} · ngày ${dinhDangNgay(h.ngay)}`}>{h.maCongDoan} · {h.maNV}</span> },
  { key: 'val', label: 'Số cũ → mới', width: 130, align: 'right', render: (h) => <b className="num">{h.soCu == null ? dinhDangSo(h.soMoi) : `${dinhDangSo(h.soCu)} → ${dinhDangSo(h.soMoi)}`}</b> },
  { key: 'src', label: 'Nguồn', width: 100, render: (h) => <Pill size="sm" tone={h.nguon === 'SUA_WEB' || h.nguon === 'NHAP_HO' ? 'adjust' : h.nguon === 'OFFLINE' ? 'warn' : 'neutral'}>{TEN_NGUON[h.nguon]}</Pill> },
  { key: 'r', label: 'Lý do', render: (h) => <span className="text-muted">{h.lyDo ?? '—'}</span> },
];

const KICH_THUOC = 100;

export function BaoCaoPage() {
  const toast = useToast();
  const toi = useToi();
  const { q } = useShell();
  const qTim = useDebounced(q.trim(), 300);
  const [kind, setKind] = useState<LoaiBaoCao>('cong-nhan');
  const [ky, setKy] = useState<Ky>('ngay');
  const [moc, setMoc] = useState(toi.homNay);
  const [khoang, setKhoang] = useState({ tu: toi.homNay, den: toi.homNay });
  const [xuongId, setXuongId] = useState('');
  const [chuyenId, setChuyenId] = useState('');
  const [maHangId, setMaHangId] = useState('');
  const [trang, setTrang] = useState(1);

  const laToTruong = toi.phamVi.loai === 'CHUYEN';
  const xuongQ = useQuery({ queryKey: ['xuong'], queryFn: ({ signal }) => api.goi('/xuong', { schema: z.array(zXuong), signal }), enabled: !laToTruong });
  const chuyenQ = useQuery({ queryKey: ['chuyen', 'tat-ca'], queryFn: ({ signal }) => api.goi('/chuyen', { schema: z.array(zChuyen), signal }) });
  const mhQ = useQuery({ queryKey: ['ma-hang'], queryFn: ({ signal }) => api.goi('/ma-hang', { schema: z.array(zMaHang), signal }) });
  const dsChuyen = (chuyenQ.data ?? []).filter((c) => !xuongId || c.xuongId === xuongId);

  const { tu, den } = ky === 'khoang' ? khoang : khoangKy(ky, moc);
  const khoangSai = ky === 'khoang' && (khoang.tu > khoang.den ? 'Ngày bắt đầu phải trước ngày kết thúc.' : !trongBaThang(khoang.tu, khoang.den) ? 'Chọn tối đa 3 tháng.' : null);
  const thamSo = new URLSearchParams({ tu, den });
  if (xuongId) thamSo.set('xuongId', xuongId);
  if (chuyenId) thamSo.set('chuyenId', chuyenId);
  if (maHangId && BAO_CAO_LOC_MA_HANG[kind]) thamSo.set('maHangId', maHangId);
  if (qTim) thamSo.set('q', qTim);
  const loc = thamSo.toString();

  const bcQ = useQuery({
    queryKey: ['bao-cao', kind, loc, trang],
    queryFn: ({ signal }) => api.goi(`/bao-cao/${kind}?${loc}&trang=${trang}&kichThuoc=${KICH_THUOC}`, { schema: zBaoCao(kind), signal }),
    enabled: !khoangSai,
    placeholderData: keepPreviousData,
  });
  const d = bcQ.data?.loai === kind ? bcQ.data : undefined;
  const soTrang = d ? Math.max(1, Math.ceil(d.tongDong / KICH_THUOC)) : 1;
  const doi = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setTrang(1); };

  const xuat = useMutation({
    mutationFn: () => taiFile(`/bao-cao/${kind}/xuat?${loc}`),
    onSuccess: () => toast('Đã xuất Excel · đúng dữ liệu đang xem'),
    onError: (e) => toast(thongBaoLoi(e), 'warn'),
  });

  const tc = d?.tongCong ?? {};
  const footer = d && d.tongDong > 0 && (
    <TableFooter>
      <span><b className="text-ink num">{dinhDangSo(d.tongDong)}</b> dòng</span>
      {tc['sanLuong'] != null && <span>Tổng sản lượng <b className="text-ink num">{dinhDangSo(tc['sanLuong'])}</b></span>}
      {tc['hoanThanh'] != null && <span>Hoàn thành <b className="text-ink num">{dinhDangSo(tc['hoanThanh'])}</b></span>}
      {tc['daLamKy'] != null && <span>Đã làm trong kỳ <b className="text-ink num">{dinhDangSo(tc['daLamKy'])}</b></span>}
      {tc['phutSmv'] != null && <span>Tổng phút SMV <b className="text-ink num">{dinhDangSo(tc['phutSmv'], 0)}</b></span>}
      {tc['hieuSuat'] != null && <span>% hiệu suất chung <b className="text-ink num">{dinhDangSo(tc['hieuSuat'])}%</b></span>}
      <span className="ml-auto flex items-center gap-2">
        {kind === 'cong-nhan' && <span className="hidden xl:inline">% hiệu suất = Phút SMV ÷ (giờ làm × 60)</span>}
        {soTrang > 1 && (<>
          <button type="button" disabled={trang <= 1} onClick={() => setTrang(trang - 1)} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-hover disabled:opacity-40" aria-label="Trang trước"><ChevronLeft className="w-4 h-4" /></button>
          <span className="num">Trang {trang}/{soTrang}</span>
          <button type="button" disabled={trang >= soTrang} onClick={() => setTrang(trang + 1)} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-hover disabled:opacity-40" aria-label="Trang sau"><ChevronRight className="w-4 h-4" /></button>
        </>)}
      </span>
    </TableFooter>
  );
  const chung = { rowKey: (_: unknown, i: number) => String(i), footer: footer || undefined, dangTai: bcQ.isPending && !khoangSai, empty: khoangSai || (bcQ.isError ? thongBaoLoi(bcQ.error) : 'Không có dữ liệu') };
  const table = () => {
    const rows = d?.dong ?? [];
    switch (kind) {
      case 'cong-nhan': return <DataTable {...chung} cols={cotCongNhan(tu !== den)} rows={rows as DongCongNhan[]} rowClass={(w) => ((w.hieuSuat ?? 0) > NGUONG_HIEU_SUAT_CAO ? 'bg-warn-bg/40' : undefined)} />;
      case 'cong-doan': return <DataTable {...chung} cols={cotCongDoan} rows={rows as DongCongDoan[]} />;
      case 'chuyen': return <DataTable {...chung} cols={cotChuyen} rows={rows as DongChuyen[]} />;
      case 'ma-hang': return <DataTable {...chung} cols={cotMaHang(den.slice(5, 7))} rows={rows as DongMaHang[]} />;
      case 'lich-su': return <DataTable {...chung} cols={cotLichSu} rows={rows as DongLichSu[]} />;
    }
  };

  const nhanKy = ky === 'ngay' ? `${thuNgan(tu)}, ${dinhDangNgay(tu)}` : ky === 'tuan' ? `${ddmm(tu)} – ${dinhDangNgay(den)}` : ky === 'thang' ? `Tháng ${tu.slice(5, 7)}/${tu.slice(0, 4)}` : '';
  const dichKy = (buoc: -1 | 1) => doi(setMoc)(ky === 'ngay' ? congNgay(moc, buoc) : ky === 'tuan' ? congNgay(moc, 7 * buoc) : buoc < 0 ? congNgay(`${moc.slice(0, 7)}-01`, -1) : congNgay(khoangKy('thang', moc).den, 1));

  return (
    <>
      <Page>
        <Toolbar title="Báo cáo" right={<Button variant="primary" icon={Download} disabled={xuat.isPending || !d?.tongDong} onClick={() => xuat.mutate()}>Xuất Excel</Button>}>
          <Segmented label="Kỳ báo cáo" value={ky} onChange={doi(setKy)} options={[{ value: 'ngay', label: 'Ngày' }, { value: 'tuan', label: 'Tuần' }, { value: 'thang', label: 'Tháng' }, { value: 'khoang', label: 'Khoảng' }]} />
          {ky === 'khoang' ? (
            <span className="flex items-center gap-1.5 shrink-0">
              <input type="date" aria-label="Từ ngày" value={khoang.tu} onChange={(e) => e.target.value && doi(setKhoang)({ ...khoang, tu: e.target.value })} className="h-9 px-2 rounded-ctl border border-line-strong bg-surface text-body num" />
              <span className="text-muted">–</span>
              <input type="date" aria-label="Đến ngày" value={khoang.den} onChange={(e) => e.target.value && doi(setKhoang)({ ...khoang, den: e.target.value })} className={cn('h-9 px-2 rounded-ctl border bg-surface text-body num', khoangSai ? 'border-danger' : 'border-line-strong')} />
            </span>
          ) : (
            <span className="flex items-center shrink-0" role="group" aria-label="Chọn kỳ">
              <button type="button" onClick={() => dichKy(-1)} className="w-9 h-9 grid place-items-center rounded-l-ctl border border-line-strong bg-surface hover:bg-hover" aria-label="Kỳ trước"><ChevronLeft className="w-[18px] h-[18px]" /></button>
              <label className="relative h-9 -mx-px px-3 flex items-center gap-2 border border-line-strong bg-surface text-body hover:bg-hover cursor-pointer">
                <span className="num whitespace-nowrap">{nhanKy}</span>
                <input type="date" aria-label="Ngày trong kỳ" value={moc} onChange={(e) => e.target.value && doi(setMoc)(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <button type="button" onClick={() => dichKy(1)} className="w-9 h-9 grid place-items-center rounded-r-ctl border border-line-strong bg-surface hover:bg-hover" aria-label="Kỳ sau"><ChevronRight className="w-[18px] h-[18px]" /></button>
            </span>
          )}
          {!laToTruong && (
            <Select label="Xưởng" className="w-36" value={xuongId} onChange={(e) => { doi(setXuongId)(e.target.value); setChuyenId(''); }}>
              <option value="">Tất cả xưởng</option>
              {(xuongQ.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.ten}</option>)}
            </Select>
          )}
          <Select label="Chuyền" className="w-40" value={chuyenId} onChange={(e) => doi(setChuyenId)(e.target.value)}>
            <option value="">{laToTruong ? 'Chuyền của tôi' : 'Tất cả chuyền'}</option>
            {dsChuyen.map((c) => <option key={c.id} value={c.id}>{c.ma} · {c.ten}</option>)}
          </Select>
          {BAO_CAO_LOC_MA_HANG[kind] && (
            <Select label="Mã hàng" className="w-40" value={maHangId} onChange={(e) => doi(setMaHangId)(e.target.value)}>
              <option value="">Tất cả mã hàng</option>
              {(mhQ.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.ma}</option>)}
            </Select>
          )}
        </Toolbar>

        <div className="flex items-center gap-2 -my-1 shrink-0 overflow-x-auto no-scrollbar">
          {LOAI_BAO_CAO.map((k) => (
            <button key={k} type="button" onClick={() => doi(setKind)(k)} aria-pressed={kind === k}
              className={cn('h-8 px-3.5 rounded-pill text-chip whitespace-nowrap border transition-colors duration-fast',
                kind === k ? 'bg-ink text-surface border-ink font-semibold' : 'bg-surface border-line text-ink hover:bg-hover font-medium')}>{TEN_BAO_CAO[k]}</button>
          ))}
          <span className="ml-auto text-sub text-muted whitespace-nowrap flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" />Tổng trên màn hình = tổng trong file Excel</span>
        </div>

        {table()}
      </Page>
      <StatusBar right={<span>Dữ liệu {tu === den ? dinhDangNgay(tu) : `${dinhDangNgay(tu)} – ${dinhDangNgay(den)}`} · lấy số nhập cuối cùng của mỗi bản ghi</span>}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warn-bg border border-warn-bar" />% hiệu suất &gt; {NGUONG_HIEU_SUAT_CAO}%</span>
        <span>“—” = chưa có giờ làm / SMV</span>
        {qTim && <span>Lọc công nhân: “{qTim}”</span>}
      </StatusBar>
    </>
  );
}
