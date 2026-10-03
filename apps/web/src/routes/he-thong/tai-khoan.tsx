/**
 * Tài khoản & phân quyền · F8 — giao diện chép từ ui-demo/(web)/he-thong/tai-khoan
 * (tab Tài khoản: bảng + drawer; tab Phân quyền theo vai trò: ma trận công tắc, "Lưu thay đổi").
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CHUC_NANG, type ChucNang, dinhDangGio, dinhDangNgay, homNay, LoiApi, PHAM_VI_CUA_VAI_TRO, type TaiKhoan,
  TEN_CHUC_NANG, TEN_VAI_TRO, VAI_TRO, type VaiTro, zChuyen, zOQuyen, zTaiKhoan, zXuong,
} from '@vsn/shared';
import { Button, cn, Drawer, Field, Input, Menu, MenuItem, Modal, Page, Pill, Select, StatusBar, Tabs, Toolbar, useToast } from '@vsn/ui';
import { type Col, DataTable } from '@vsn/ui/data-table';
import { KeyRound, MoreHorizontal, Pause, Pencil, Play, Plus, ShieldCheck, Tv, UserCog } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useToi } from '../../lib/xac-thuc';
import { useShell } from '../../shell/shell-context';

const zMaTran = z.array(zOQuyen.extend({ lyDoKhoa: z.string().nullable() }));
type OMaTran = z.infer<typeof zMaTran>[number];

/** Ghi chú phạm vi dưới công tắc đang bật (như demo) */
const GHI_CHU: Partial<Record<VaiTro, Partial<Record<ChucNang, string>>>> = {
  TO_TRUONG: { SO_DO_GAN: 'Chuyền gắn', GIO_LAM_DUYET: 'NV chuyền gốc', SAN_LUONG_SUA: 'Chuyền gắn', CHOT_NGAY: 'Chuyền gắn', BAO_CAO_XEM: 'Chuyền gắn', DASHBOARD_XEM: 'Chuyền gắn', SO_DO_TRAM_XEM: 'Chuyền gắn' },
  QUAN_LY_XUONG: { GIO_MAC_DINH_CAI: 'Xưởng gắn', BAO_CAO_XEM: 'Xưởng gắn', DASHBOARD_XEM: 'Xưởng gắn' },
};
const tenVaiTroNgan = (v: VaiTro) => (v === 'TV' ? 'TV' : TEN_VAI_TRO[v]);
const thoiDiem = (iso: string | null) => (iso ? `${dinhDangGio(iso)} ${dinhDangNgay(homNay(new Date(iso))).slice(0, 5)}` : '—');

export function TaiKhoanPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const toi = useToi();
  const { q } = useShell();
  const [tab, setTab] = useState<'acc' | 'perm'>('acc');
  const [edit, setEdit] = useState<TaiKhoan | 'new' | null>(null);
  const [datLai, setDatLai] = useState<TaiKhoan | null>(null);

  const dsQ = useQuery({ queryKey: ['tai-khoan'], queryFn: ({ signal }) => api.goi('/tai-khoan', { schema: z.array(zTaiKhoan), signal }) });
  const lamMoi = () => queryClient.invalidateQueries({ queryKey: ['tai-khoan'] });
  const baoLoi = (e: Error) => { toast(e.message, 'warn'); if (e instanceof LoiApi && e.code === 'DU_LIEU_DA_THAY_DOI') void lamMoi(); };

  const doiTrangThai = useMutation({
    mutationFn: (a: TaiKhoan) => api.goi(`/tai-khoan/${a.id}`, { method: 'PATCH', body: { trangThai: a.trangThai === 'HOAT_DONG' ? 'NGUNG' : 'HOAT_DONG', version: a.version }, schema: zTaiKhoan }),
    onSuccess: (a) => { toast(a.trangThai === 'NGUNG' ? `Đã vô hiệu hóa ${a.tenDangNhap}` : `Đã kích hoạt lại ${a.tenDangNhap}`); void lamMoi(); },
    onError: baoLoi,
  });
  const thuHoi = useMutation({
    mutationFn: (a: TaiKhoan) => api.goi(`/tai-khoan/${a.id}/thu-hoi-phien`, { method: 'POST', schema: z.object({ soPhien: z.number() }) }),
    onSuccess: () => toast('Đã thu hồi phiên TV · bắt buộc đăng nhập lại'),
    onError: baoLoi,
  });

  const s = q.trim().toLowerCase();
  const rows = (dsQ.data ?? []).filter((a) => !s || `${a.tenDangNhap} ${a.hoTen}`.toLowerCase().includes(s));
  const cols: Col<TaiKhoan>[] = [
    { key: 'u', label: 'Tài khoản', width: 260, render: (a) => (<div className="flex items-center gap-2.5">
      <span className={cn('w-8 h-8 rounded-full grid place-items-center text-chip font-semibold shrink-0', a.vaiTro === 'TV' ? 'bg-group text-ink' : 'bg-brand-soft text-brand-ink')}>{a.vaiTro === 'TV' ? <Tv className="w-4 h-4" /> : (a.hoTen.split(' ').slice(-1)[0]?.[0] ?? '?')}</span>
      <div className="min-w-0"><div className={cn('font-medium truncate', a.trangThai === 'NGUNG' && 'text-muted')}>{a.hoTen}</div><div className="text-sub text-muted font-mono truncate">{a.tenDangNhap}</div></div></div>) },
    { key: 'r', label: 'Vai trò', width: 150, render: (a) => <Pill tone={a.vaiTro === 'SUPERADMIN' ? 'brand' : 'neutral'}>{tenVaiTroNgan(a.vaiTro)}</Pill> },
    { key: 's', label: 'Phạm vi', render: (a) => <span className={cn(a.tenPhamVi === 'Toàn nhà máy' && 'text-muted')}>{a.tenPhamVi}</span> },
    { key: 'l', label: 'Đăng nhập gần nhất', width: 170, render: (a) => <span className="num text-muted">{thoiDiem(a.lanDangNhapCuoi)}</span> },
    { key: 'st', label: 'Trạng thái', width: 150, render: (a) => a.trangThai !== 'HOAT_DONG' ? <Pill tone="locked">Vô hiệu hóa</Pill>
      : a.khoaDen && new Date(a.khoaDen) > new Date() ? <Pill tone="warn">Khóa đến {dinhDangGio(a.khoaDen)}</Pill>
        : a.phaiDoiMatKhau ? <Pill tone="empty">Chờ đổi mật khẩu</Pill> : <Pill tone="closed">Hoạt động</Pill> },
    { key: 'a', label: <span className="sr-only">Thao tác</span>, width: 60, align: 'center', render: (a) => (
      <Menu width="w-56" trigger={<button type="button" aria-label={`Thao tác ${a.tenDangNhap}`} className="w-8 h-8 grid place-items-center rounded-ctl text-muted hover:bg-group hover:text-ink mx-auto"><MoreHorizontal className="w-4 h-4" /></button>}>
        <MenuItem icon={Pencil} onSelect={() => setEdit(a)}>Sửa vai trò & phạm vi</MenuItem>
        <MenuItem icon={KeyRound} onSelect={() => setDatLai(a)}>Đặt lại mật khẩu</MenuItem>
        {a.vaiTro === 'TV' && <MenuItem icon={Tv} onSelect={() => thuHoi.mutate(a)}>Thu hồi phiên TV</MenuItem>}
        {a.id !== toi.id && (a.trangThai === 'HOAT_DONG'
          ? <MenuItem icon={Pause} danger onSelect={() => doiTrangThai.mutate(a)}>Vô hiệu hóa</MenuItem>
          : <MenuItem icon={Play} onSelect={() => doiTrangThai.mutate(a)}>Kích hoạt lại</MenuItem>)}
      </Menu>) },
  ];

  return (
    <>
      <Page>
        <Toolbar title="Tài khoản & phân quyền" right={tab === 'acc' && <Button variant="primary" icon={Plus} onClick={() => setEdit('new')}>Thêm tài khoản</Button>} />
        <section className="bg-surface border border-line rounded-card flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={tab} onChange={setTab} options={[{ value: 'acc', label: 'Tài khoản', count: dsQ.data?.length }, { value: 'perm', label: 'Phân quyền theo vai trò' }]} />
          {tab === 'acc'
            ? <DataTable cols={cols} rows={rows} rowKey={(a) => a.id} className="border-0 rounded-none" dangTai={dsQ.isPending} empty="Không tìm thấy tài khoản" />
            : <MaTranQuyen />}
        </section>
      </Page>
      <StatusBar right={<span>Luôn còn ít nhất 1 Superadmin</span>}>
        <span className="flex items-center gap-1.5"><UserCog className="w-3.5 h-3.5" />Vai trò = làm chức năng gì · Phạm vi (chuyền / xưởng) = thấy dữ liệu nào</span>
      </StatusBar>

      {edit && <DrawerTaiKhoan tk={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onXong={() => void lamMoi()} />}
      {datLai && <ModalDatLai tk={datLai} onClose={() => setDatLai(null)} onXong={() => void lamMoi()} />}
    </>
  );
}

/** Ma trận công tắc vai trò × chức năng — sửa tại chỗ, bấm "Lưu thay đổi" mới gửi */
function MaTranQuyen() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const mtQ = useQuery({ queryKey: ['quyen-vai-tro'], queryFn: ({ signal }) => api.goi('/quyen-vai-tro', { schema: zMaTran, signal }) });
  const [doi, setDoi] = useState<Record<string, boolean>>({});
  const khoa = (v: VaiTro, c: ChucNang) => `${v}|${c}`;
  const o = new Map((mtQ.data ?? []).map((x) => [khoa(x.vaiTro, x.chucNang), x]));
  const luu = useMutation({
    mutationFn: () => api.goi('/quyen-vai-tro', {
      method: 'PUT',
      body: { thayDoi: Object.entries(doi).map(([k, batTat]) => { const [vaiTro, chucNang] = k.split('|'); return { vaiTro, chucNang, batTat }; }) },
      schema: zMaTran,
    }),
    onSuccess: (mt) => { queryClient.setQueryData(['quyen-vai-tro'], mt); setDoi({}); toast('Đã lưu ma trận quyền · có hiệu lực ngay, đã ghi lịch sử'); },
    onError: (e) => toast(e.message, 'warn'),
  });
  const soDoi = Object.keys(doi).length;
  const bat = (x: OMaTran) => doi[khoa(x.vaiTro, x.chucNang)] ?? x.batTat;

  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto scroll-area">
        <table className="grid-table hoverable text-body">
          <colgroup><col style={{ width: 300 }} />{VAI_TRO.map((v) => <col key={v} />)}</colgroup>
          <thead><tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted"><th className="px-4 text-left">Chức năng</th>{VAI_TRO.map((v) => <th key={v} className="px-2 text-center">{tenVaiTroNgan(v)}</th>)}</tr></thead>
          <tbody>{CHUC_NANG.map((c) => (
            <tr key={c}>
              <td className="px-4 font-medium">{TEN_CHUC_NANG[c]}</td>
              {VAI_TRO.map((v) => {
                const x = o.get(khoa(v, c));
                if (!x) return <td key={v} />;
                const on = bat(x);
                const ghiChu = GHI_CHU[v]?.[c];
                return (
                  <td key={v} className={cn('px-2 text-center', doi[khoa(v, c)] !== undefined && 'bg-brand-soft/60')}>
                    <button type="button" role="switch" aria-checked={on} aria-label={`${TEN_CHUC_NANG[c]} — ${tenVaiTroNgan(v)}`} disabled={!!x.lyDoKhoa}
                      data-tip={x.lyDoKhoa ?? ghiChu}
                      onClick={() => setDoi((d) => {
                        const n = { ...d };
                        if (!on === x.batTat) delete n[khoa(v, c)]; else n[khoa(v, c)] = !on;
                        return n;
                      })}
                      className="inline-flex flex-col items-center gap-0.5 disabled:opacity-60 disabled:cursor-not-allowed">
                      <span className="switch" aria-hidden="true" />
                      {on && ghiChu && <span className="text-tag text-muted whitespace-nowrap">{ghiChu}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>))}</tbody>
        </table>
      </div>
      <div className="h-12 shrink-0 border-t border-line px-4 flex items-center gap-3 bg-thead">
        <span className="text-sub text-muted">{soDoi ? `${soDoi} ô thay đổi chưa lưu` : 'Bật/tắt chức năng theo vai trò. Phạm vi dữ liệu gắn theo từng tài khoản.'}</span>
        <span className="ml-auto flex gap-2">
          {soDoi > 0 && <Button size="sm" onClick={() => setDoi({})}>Hoàn tác</Button>}
          <Button size="sm" variant="primary" icon={ShieldCheck} disabled={!soDoi} busy={luu.isPending} onClick={() => luu.mutate()}>Lưu thay đổi</Button>
        </span>
      </div>
    </>
  );
}

const zFormTaiKhoan = z.object({
  tenDangNhap: z.string(),
  hoTen: z.string(),
  matKhauTam: z.string(),
  vaiTro: z.enum(VAI_TRO),
  chuyenIds: z.array(z.string()),
  xuongIds: z.array(z.string()),
});
type FormTaiKhoan = z.infer<typeof zFormTaiKhoan>;

function DrawerTaiKhoan({ tk, onClose, onXong }: { tk: TaiKhoan | null; onClose: () => void; onXong: () => void }) {
  const toast = useToast();
  const chuyenQ = useQuery({ queryKey: ['chuyen', 'tat-ca'], queryFn: ({ signal }) => api.goi('/chuyen', { schema: z.array(zChuyen), signal }) });
  const xuongQ = useQuery({ queryKey: ['xuong'], queryFn: ({ signal }) => api.goi('/xuong', { schema: z.array(zXuong), signal }) });
  const form = useForm<FormTaiKhoan>({
    resolver: zodResolver(zFormTaiKhoan),
    defaultValues: { tenDangNhap: tk?.tenDangNhap ?? '', hoTen: tk?.hoTen ?? '', matKhauTam: '', vaiTro: tk?.vaiTro ?? 'TO_TRUONG', chuyenIds: tk?.chuyenIds ?? [], xuongIds: tk?.xuongIds ?? [] },
  });
  const [vaiTro, chuyenIds, xuongIds] = useWatch({ control: form.control, name: ['vaiTro', 'chuyenIds', 'xuongIds'] });
  const pv = PHAM_VI_CUA_VAI_TRO[vaiTro];
  const luu = useMutation({
    mutationFn: (d: FormTaiKhoan) => {
      const phamVi = { chuyenIds: pv === 'CHUYEN' ? d.chuyenIds : [], xuongIds: pv === 'XUONG' ? d.xuongIds : [] };
      return tk
        ? api.goi(`/tai-khoan/${tk.id}`, { method: 'PATCH', body: { hoTen: d.hoTen, vaiTro: d.vaiTro, ...phamVi, version: tk.version }, schema: zTaiKhoan })
        : api.goi('/tai-khoan', { method: 'POST', body: { tenDangNhap: d.tenDangNhap, hoTen: d.hoTen, matKhauTam: d.matKhauTam, vaiTro: d.vaiTro, ...phamVi }, schema: zTaiKhoan });
    },
    onSuccess: () => { toast(tk ? 'Đã lưu · có hiệu lực ngay' : 'Đã tạo tài khoản · bắt buộc đổi mật khẩu lần đầu'); onXong(); onClose(); },
    onError: (e) => {
      if (e instanceof LoiApi && e.field) form.setError(e.field as keyof FormTaiKhoan, { message: e.message });
      else toast(e.message, 'warn');
    },
  });
  const { errors } = form.formState;
  const gui = form.handleSubmit((d) => luu.mutate(d));
  const doiChon = (truong: 'chuyenIds' | 'xuongIds', id: string) => {
    const ds = truong === 'chuyenIds' ? chuyenIds : xuongIds;
    form.setValue(truong, ds.includes(id) ? ds.filter((x) => x !== id) : [...ds, id], { shouldDirty: true });
    form.clearErrors(truong);
  };
  const luaChon = pv === 'CHUYEN'
    ? (chuyenQ.data ?? []).filter((c) => c.loai === 'CHUYEN_MAY' && (c.trangThai === 'HOAT_DONG' || chuyenIds.includes(c.id))).map((c) => ({ id: c.id, ten: c.ma }))
    : (xuongQ.data ?? []).filter((x) => x.trangThai === 'HOAT_DONG' || xuongIds.includes(x.id)).map((x) => ({ id: x.id, ten: x.ten }));
  const daChon = pv === 'CHUYEN' ? chuyenIds : xuongIds;
  const loiPhamVi = errors.chuyenIds?.message ?? errors.xuongIds?.message;

  return (
    <Drawer open onClose={onClose} title={tk ? 'Sửa tài khoản' : 'Thêm tài khoản'}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={luu.isPending} onClick={gui}>Lưu</Button></>}>
      <form className="flex flex-col gap-4" onSubmit={gui} noValidate>
        <Field label="Tên đăng nhập" required error={errors.tenDangNhap?.message} htmlFor="tk-u">
          <Input id="tk-u" {...form.register('tenDangNhap')} readOnly={!!tk} autoComplete="off" aria-invalid={!!errors.tenDangNhap} className={cn('w-full font-mono', tk && 'bg-disabled-bg')} />
        </Field>
        <Field label="Họ tên" required error={errors.hoTen?.message} htmlFor="tk-ten"><Input id="tk-ten" {...form.register('hoTen')} aria-invalid={!!errors.hoTen} className="w-full" /></Field>
        {!tk && (
          <Field label="Mật khẩu tạm" required hint="≥ 8 ký tự, có chữ và số · người dùng phải đổi ở lần đăng nhập đầu" error={errors.matKhauTam?.message} htmlFor="tk-p">
            <Input id="tk-p" type="password" autoComplete="new-password" {...form.register('matKhauTam')} aria-invalid={!!errors.matKhauTam} className="w-full" />
          </Field>
        )}
        <Field label="Vai trò" required error={errors.vaiTro?.message}>
          <Select label="Vai trò" {...form.register('vaiTro')} className="w-full">{VAI_TRO.map((v) => <option key={v} value={v}>{TEN_VAI_TRO[v]}</option>)}</Select>
        </Field>
        {pv && (
          <Field label={pv === 'CHUYEN' ? 'Chuyền phụ trách' : 'Xưởng phụ trách'} required hint={pv === 'CHUYEN' ? 'Phải gắn ít nhất 1 chuyền' : 'Phải gắn ít nhất 1 xưởng'} error={loiPhamVi}>
            <div className="flex flex-wrap gap-1.5" role="group">
              {luaChon.map((c) => (
                <label key={c.id} className="chip-radio">
                  <input type="checkbox" className="sr-only" checked={daChon.includes(c.id)} onChange={() => doiChon(pv === 'CHUYEN' ? 'chuyenIds' : 'xuongIds', c.id)} />
                  <span className="inline-flex items-center h-8 px-3 rounded-pill border border-line-strong bg-surface text-chip font-medium hover:bg-hover transition-colors duration-fast">{c.ten}</span>
                </label>
              ))}
            </div>
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

function ModalDatLai({ tk, onClose, onXong }: { tk: TaiKhoan; onClose: () => void; onXong: () => void }) {
  const toast = useToast();
  const [mk, setMk] = useState('');
  const datLai = useMutation({
    mutationFn: () => api.goi(`/tai-khoan/${tk.id}/dat-lai-mat-khau`, { method: 'POST', body: { matKhauTam: mk }, schema: zTaiKhoan }),
    onSuccess: () => { toast(`Đã đặt lại mật khẩu ${tk.tenDangNhap} · phải đổi ở lần đăng nhập sau`); onXong(); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title={`Đặt lại mật khẩu · ${tk.tenDangNhap}`}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={datLai.isPending} disabled={!mk} onClick={() => datLai.mutate()}>Đặt lại</Button></>}>
      <Field label="Mật khẩu tạm mới" required hint="Mọi phiên đang mở của tài khoản bị thu hồi; tài khoản được mở khóa nếu đang bị khóa." error={datLai.error?.message} htmlFor="dl-p">
        <Input id="dl-p" type="password" autoComplete="new-password" value={mk} onChange={(e) => { setMk(e.target.value); datLai.reset(); }} className="w-full" />
      </Field>
    </Modal>
  );
}
