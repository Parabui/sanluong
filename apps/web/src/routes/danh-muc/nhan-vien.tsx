/**
 * Nhân viên · F2 — giao diện chép từ ui-demo/(web)/danh-muc/nhan-vien (toolbar lọc, bảng, drawer sửa, modal import 2 bước).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LoiApi, type NhanVien, type TaoNhanVien, type XemTruocImport,
  zChuyen, zKetQuaImport, zKetQuaPhanTrang, zNhanVien, zTaoNhanVien, zXemTruocImport,
} from '@vsn/shared';
import { Button, cn, Drawer, Field, Input, Menu, MenuItem, Modal, Page, Pill, Segmented, Select, StatusBar, Toolbar, useToast } from '@vsn/ui';
import { type Col, DataTable, TableFooter } from '@vsn/ui/data-table';
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Download, FileUp, MoreHorizontal, Pause, Pencil, Play, RefreshCw, Trash2, TriangleAlert, Upload, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { useToi } from '../../lib/xac-thuc';
import { useShell } from '../../shell/shell-context';

const KICH_THUOC = 100;
type LocTrangThai = 'HOAT_DONG' | 'NGUNG' | 'TAT_CA';

export function NhanVienPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const tk = useToi();
  const { q } = useShell();
  const tim = useDebounced(q.trim());
  const [chuyenId, setChuyenId] = useState('');
  const [st, setSt] = useState<LocTrangThai>('HOAT_DONG');
  const [trang, setTrang] = useState(1);
  const [edit, setEdit] = useState<NhanVien | 'new' | null>(null);
  const [imp, setImp] = useState(false);
  const [xoa, setXoa] = useState<NhanVien | null>(null);

  // đổi bộ lọc → về trang 1 (điều chỉnh state ngay khi render)
  const khoaLoc = `${chuyenId}|${st}|${tim}`;
  const [locCu, setLocCu] = useState(khoaLoc);
  if (locCu !== khoaLoc) { setLocCu(khoaLoc); setTrang(1); }

  const chuyenQ = useQuery({ queryKey: ['chuyen', 'tat-ca'], queryFn: ({ signal }) => api.goi('/chuyen', { schema: z.array(zChuyen), signal }) });
  const nvQ = useQuery({
    queryKey: ['nhan-vien', chuyenId, st, tim, trang],
    queryFn: ({ signal }) => {
      const p = new URLSearchParams({ trangThai: st, trang: String(trang), kichThuoc: String(KICH_THUOC) });
      if (chuyenId) p.set('chuyenId', chuyenId);
      if (tim) p.set('q', tim);
      return api.goi(`/nhan-vien?${p}`, { schema: zKetQuaPhanTrang(zNhanVien), signal });
    },
    placeholderData: keepPreviousData,
  });
  const lamMoi = () => queryClient.invalidateQueries({ queryKey: ['nhan-vien'] });
  const baoLoi = (e: Error) => { toast(e.message, 'warn'); if (e instanceof LoiApi && e.code === 'DU_LIEU_DA_THAY_DOI') void lamMoi(); };

  const doiTrangThai = useMutation({
    mutationFn: (e: NhanVien) => api.goi(`/nhan-vien/${e.id}`, { method: 'PATCH', body: { trangThai: e.trangThai === 'HOAT_DONG' ? 'NGUNG' : 'HOAT_DONG', version: e.version }, schema: zNhanVien }),
    onSuccess: (e) => { toast(e.trangThai === 'NGUNG' ? `Đã ngưng ${e.maNV} · tự đăng xuất khỏi mọi trạm` : `Đã kích hoạt lại ${e.maNV}`); void lamMoi(); },
    onError: baoLoi,
  });
  const xoaHan = useMutation({
    mutationFn: (e: NhanVien) => api.goi(`/nhan-vien/${e.id}`, { method: 'DELETE', schema: z.undefined() }),
    onSuccess: (_, e) => { toast(`Đã xóa hẳn ${e.maNV}`); setXoa(null); void lamMoi(); },
    onError: baoLoi,
  });

  const rows = nvQ.data?.duLieu ?? [];
  const tong = nvQ.data?.tong ?? 0;
  const soTrang = Math.max(1, Math.ceil(tong / KICH_THUOC));
  const laSA = tk.vaiTro === 'SUPERADMIN';

  const cols: Col<NhanVien>[] = [
    { key: 'nv', label: 'Mã NV', width: 110, render: (e) => <span className="font-mono text-[13px]">{e.maNV}</span> },
    { key: 'ten', label: 'Họ tên', render: (e) => <span className={cn('font-medium', e.trangThai === 'NGUNG' && 'text-muted')}>{e.hoTen}</span> },
    { key: 'ch', label: 'Chuyền / Nhóm', width: 180, render: (e) => <span>{e.maChuyen} · {e.tenChuyen}</span> },
    { key: 'bac', label: 'Bậc tay nghề', width: 120, align: 'center', render: (e) => <span className="num">{e.bacTayNghe ?? '—'}</span> },
    { key: 'st', label: 'Trạng thái', width: 140, render: (e) => e.trangThai === 'HOAT_DONG' ? <Pill tone="closed">Hoạt động</Pill> : <Pill tone="locked">Ngưng</Pill> },
    { key: 'act', label: <span className="sr-only">Thao tác</span>, width: 64, align: 'center', render: (e) => (
      <Menu width="w-52" trigger={<button type="button" aria-label={`Thao tác ${e.maNV}`} className="w-8 h-8 grid place-items-center rounded-ctl text-muted hover:bg-group hover:text-ink mx-auto"><MoreHorizontal className="w-4 h-4" /></button>}>
        <MenuItem icon={Pencil} onSelect={() => setEdit(e)}>Sửa thông tin</MenuItem>
        <MenuItem icon={e.trangThai === 'HOAT_DONG' ? Pause : Play} onSelect={() => doiTrangThai.mutate(e)}>{e.trangThai === 'HOAT_DONG' ? 'Ngưng hoạt động' : 'Kích hoạt lại'}</MenuItem>
        {laSA && !e.coSanLuong && <MenuItem icon={Trash2} danger onSelect={() => setXoa(e)}>Xóa hẳn</MenuItem>}
      </Menu>) },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Nhân viên" right={<>
          <Button icon={UserPlus} onClick={() => setEdit('new')}>Thêm nhân viên</Button>
          <Button variant="primary" icon={Upload} onClick={() => setImp(true)}>Import Excel</Button>
        </>}>
          <Select label="Chuyền" value={chuyenId} onChange={(e) => setChuyenId(e.target.value)} className="w-48">
            <option value="">Tất cả chuyền</option>
            {chuyenQ.data?.map((c) => <option key={c.id} value={c.id}>{c.ma} · {c.ten}</option>)}
          </Select>
          <Segmented label="Trạng thái" value={st} onChange={setSt} options={[{ value: 'HOAT_DONG', label: 'Hoạt động' }, { value: 'NGUNG', label: 'Ngưng' }, { value: 'TAT_CA', label: 'Tất cả' }]} />
        </Toolbar>
        <DataTable cols={cols} rows={rows} rowKey={(e) => e.id} emptyIcon={Users} empty="Không tìm thấy nhân viên" dangTai={nvQ.isPending}
          footer={<TableFooter>
            <span><b className="text-ink num">{tong.toLocaleString('vi-VN')}</b> nhân viên</span>
            {soTrang > 1 && (
              <span className="flex items-center gap-1">
                <button type="button" aria-label="Trang trước" disabled={trang <= 1} onClick={() => setTrang(trang - 1)} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-group disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <span className="num">Trang {trang}/{soTrang}</span>
                <button type="button" aria-label="Trang sau" disabled={trang >= soTrang} onClick={() => setTrang(trang + 1)} className="w-7 h-7 grid place-items-center rounded-ctl hover:bg-group disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </span>
            )}
            <span className="ml-auto">Mã NV lưu dạng text, tự trim + viết hoa · không bao giờ tái sử dụng</span>
          </TableFooter>} />
      </Page>
      <StatusBar>
        <span>Xóa hẳn chỉ áp dụng cho NV chưa có sản lượng (Superadmin)</span>
      </StatusBar>

      {edit && <DrawerNhanVien nv={edit === 'new' ? null : edit} chuyen={chuyenQ.data ?? []} onClose={() => setEdit(null)} onXong={() => void lamMoi()} />}
      {imp && <ModalImport onClose={() => setImp(false)} onXong={() => void lamMoi()} />}

      <Modal open={!!xoa} onClose={() => setXoa(null)} title={`Xóa hẳn ${xoa?.maNV ?? ''}?`}
        footer={<><Button onClick={() => setXoa(null)}>Hủy</Button><Button variant="danger" busy={xoaHan.isPending} onClick={() => xoa && xoaHan.mutate(xoa)}>Xóa hẳn</Button></>}>
        <p className="text-body">Xóa vĩnh viễn <b>{xoa?.hoTen}</b> ({xoa?.maNV}). Chỉ dùng khi import nhầm — nhân viên nghỉ việc thì chọn <b>Ngưng hoạt động</b>.</p>
      </Modal>
    </>
  );
}

const zFormNhanVien = zTaoNhanVien;
type FormNhanVien = z.input<typeof zFormNhanVien>;

function DrawerNhanVien({ nv, chuyen, onClose, onXong }: { nv: NhanVien | null; chuyen: z.infer<typeof zChuyen>[]; onClose: () => void; onXong: () => void }) {
  const toast = useToast();
  const form = useForm<FormNhanVien>({
    resolver: zodResolver(zFormNhanVien),
    defaultValues: { maNV: nv?.maNV ?? '', hoTen: nv?.hoTen ?? '', chuyenId: nv?.chuyenId ?? '', bacTayNghe: nv?.bacTayNghe ?? '' },
  });
  const luu = useMutation({
    mutationFn: (d: TaoNhanVien) =>
      nv
        ? api.goi(`/nhan-vien/${nv.id}`, { method: 'PATCH', body: { hoTen: d.hoTen, chuyenId: d.chuyenId, bacTayNghe: d.bacTayNghe ?? null, version: nv.version }, schema: zNhanVien })
        : api.goi('/nhan-vien', { method: 'POST', body: d, schema: zNhanVien }),
    onSuccess: (e) => { toast(nv ? `Đã lưu ${e.maNV}` : `Đã thêm ${e.maNV}`); onXong(); onClose(); },
    onError: (e) => {
      if (e instanceof LoiApi && e.field) form.setError(e.field as keyof FormNhanVien, { message: e.message });
      else toast(e.message, 'warn');
    },
  });
  const { errors } = form.formState;
  const gui = form.handleSubmit((d) => luu.mutate(zTaoNhanVien.parse(d)));
  const dangChay = chuyen.filter((c) => c.trangThai === 'HOAT_DONG' || c.id === nv?.chuyenId);
  return (
    <Drawer open onClose={onClose} title={nv ? 'Sửa nhân viên' : 'Thêm nhân viên'}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={luu.isPending} onClick={gui}>Lưu</Button></>}>
      <form className="flex flex-col gap-4" onSubmit={gui} noValidate>
        <Field label="Mã NV" required hint="Giữ nguyên số 0 đầu · tự viết hoa" error={errors.maNV?.message} htmlFor="nv-ma">
          <Input id="nv-ma" {...form.register('maNV')} readOnly={!!nv} placeholder="VD: NV01088" aria-invalid={!!errors.maNV}
            className={cn('w-full font-mono uppercase', nv && 'bg-disabled-bg')} />
        </Field>
        <Field label="Họ tên" required error={errors.hoTen?.message} htmlFor="nv-ten"><Input id="nv-ten" {...form.register('hoTen')} aria-invalid={!!errors.hoTen} className="w-full" /></Field>
        <Field label="Chuyền / Nhóm" required hint="Đổi chuyền có hiệu lực từ hôm nay; các ngày trước giữ chuyền cũ" error={errors.chuyenId?.message}>
          <Select label="Chuyền" {...form.register('chuyenId')} className="w-full">
            <option value="" disabled>Chọn chuyền…</option>
            {dangChay.map((c) => <option key={c.id} value={c.id}>{c.ma} · {c.ten}</option>)}
          </Select>
        </Field>
        <Field label="Bậc tay nghề" error={errors.bacTayNghe?.message} htmlFor="nv-bac"><Input id="nv-bac" {...form.register('bacTayNghe')} className="w-full" /></Field>
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

function ModalImport({ onClose, onXong }: { onClose: () => void; onXong: () => void }) {
  const toast = useToast();
  const [xt, setXt] = useState<XemTruocImport | null>(null);
  const [daXem, setDaXem] = useState(false);
  const [keo, setKeo] = useState(false);

  const kiemTra = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.goi('/import/nhan-vien/xem-truoc', { method: 'POST', body: fd, schema: zXemTruocImport });
    },
    onSuccess: (kq) => { setXt(kq); setDaXem(false); },
  });
  const xacNhan = useMutation({
    mutationFn: () => api.goi(`/import/${xt!.importId}/xac-nhan`, { method: 'POST', body: { xacNhanCanhBao: daXem }, schema: zKetQuaImport }),
    onSuccess: (kq) => {
      toast(`Đã ghi ${kq.them + kq.capNhat} dòng (thêm ${kq.them}, cập nhật ${kq.capNhat})${xt!.loi ? ` · bỏ qua ${xt!.loi} dòng lỗi` : ''}`);
      onXong();
      onClose();
    },
    onError: (e) => toast(e.message, 'warn'),
  });
  const chon = (f: File | undefined) => { if (f) kiemTra.mutate(f); };
  const coCanhBao = !!xt && xt.canhBao > 0;
  const ghiDuoc = !!xt && xt.them + xt.capNhat > 0;

  return (
    <Modal open onClose={onClose} title="Import nhân viên từ Excel" width={560}
      footer={!xt
        ? <a href="/api/import/nhan-vien/mau" download className="h-9 px-4 rounded-ctl border border-line-strong bg-surface hover:bg-hover text-ink font-medium text-body inline-flex items-center gap-2"><Download className="w-[18px] h-[18px]" />Tải file mẫu</a>
        : <><Button onClick={() => { setXt(null); kiemTra.reset(); }}>Chọn file khác</Button>
            <Button variant="primary" busy={xacNhan.isPending} disabled={!ghiDuoc || (coCanhBao && !daXem)} onClick={() => xacNhan.mutate()}>Xác nhận</Button></>}>
      {!xt ? (
        <>
          <label
            onDragOver={(e) => { e.preventDefault(); setKeo(true); }} onDragLeave={() => setKeo(false)}
            onDrop={(e) => { e.preventDefault(); setKeo(false); chon(e.dataTransfer.files[0]); }}
            className={cn('block rounded-card border-2 border-dashed border-line-strong hover:border-brand bg-thead hover:bg-brand-soft/40 transition-colors duration-fast p-8 text-center cursor-pointer', keo && 'drop-target')}>
            {kiemTra.isPending ? <span className="spin w-8 h-8 mx-auto block rounded-full border-2 border-muted border-t-transparent" /> : <FileUp className="w-8 h-8 mx-auto text-muted" />}
            <p className="text-body font-medium mt-2">{kiemTra.isPending ? 'Đang kiểm tra file…' : 'Kéo thả file .xlsx hoặc bấm để chọn'}</p>
            <p className="text-sub text-muted mt-1">Cột bắt buộc: Mã NV · Họ tên · Chuyền/Nhóm · (Bậc tay nghề) · tối đa 10 MB, 5.000 dòng</p>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={kiemTra.isPending}
              onChange={(e) => { chon(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {kiemTra.error && <p className="text-sub text-danger mt-3 flex items-center gap-1.5" role="alert"><CircleAlert className="w-4 h-4" />{kiemTra.error.message}</p>}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-chip text-muted">{xt.tenFile} · {xt.tongDong.toLocaleString('vi-VN')} dòng{xt.khongDoi ? ` · ${xt.khongDoi} dòng không đổi` : ''}</p>
          <div className="grid grid-cols-3 gap-2">
            {([['Thêm mới', xt.them, 'text-closed-ink', CircleCheck], ['Cập nhật', xt.capNhat, 'text-open-ink', RefreshCw], ['Lỗi', xt.loi, 'text-danger', CircleAlert]] as const).map(([l, n, c, I]) => (
              <div key={l} className="rounded-card border border-line p-3"><div className={cn('flex items-center gap-1.5 text-chip font-medium', c)}><I className="w-4 h-4" />{l}</div><div className="text-[22px] font-semibold mt-1 num">{n.toLocaleString('vi-VN')}</div></div>
            ))}
          </div>
          {(xt.dsLoi.length > 0 || xt.dsCanhBao.length > 0) && (
            <ul className="rounded-card border border-line divide-y divide-line text-chip max-h-60 overflow-y-auto scroll-area">
              {xt.dsLoi.map((d) => <li key={`l${d.dong.join()}`} className="px-3 py-2 flex gap-2"><span className="text-muted w-24 shrink-0">Dòng {d.dong.join(', ')}</span><span className="text-danger">{d.lyDo}</span></li>)}
              {xt.dsCanhBao.map((d) => <li key={`c${d.dong.join()}`} className="px-3 py-2 flex gap-2 bg-empty-bg text-empty-ink"><span className="w-24 shrink-0">Dòng {d.dong.join(', ')}</span><span>{d.lyDo}</span></li>)}
            </ul>
          )}
          {xt.loi > 0 && <p className="text-sub text-muted">Dòng lỗi sẽ không được ghi; các dòng hợp lệ vẫn được ghi.</p>}
          {coCanhBao && (
            <label className="flex items-start gap-2 text-chip">
              <input type="checkbox" checked={daXem} onChange={(e) => setDaXem(e.target.checked)} className="mt-0.5" />
              <span><TriangleAlert className="w-4 h-4 inline text-warn-bar mr-1" />Tôi đã kiểm tra {xt.canhBao} dòng cảnh báo — vẫn ghi các dòng này.</span>
            </label>
          )}
          {!ghiDuoc && <p className="text-sub text-muted">Không có dòng nào cần thêm hoặc cập nhật.</p>}
        </div>
      )}
    </Modal>
  );
}
