/**
 * Xưởng – Chuyền – Trạm · F9 — bố cục chép từ ui-demo/(web)/danh-muc/chuyen-tram (danh sách chuyền 280px + lưới trạm).
 * Bổ sung so với demo (PRD F9 yêu cầu, demo chưa vẽ): chọn/thêm/sửa/ngưng xưởng, sửa/ngưng chuyền, ngưng trạm.
 * ⏳ In QR (F12, SHOULD) thêm ở giai đoạn 2.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CanhBaoXacNhan, type Chuyen, LOAI_CHUYEN, LoiApi, TEN_LOAI_CHUYEN, type Tram, type Xuong,
  zCanhBaoXacNhan, zChuyen, zTaoChuyen, zTaoXuong, zTram, zXuong,
} from '@vsn/shared';
import {
  Button, cn, EmptyState, Field, IconButton, Input, Menu, MenuItem, Modal, Page, Pill, Select, StatusBar, Toolbar, useToast,
} from '@vsn/ui';
import { Building2, ChevronRight, Factory, MoreHorizontal, Pencil, Plus, Power, PowerOff, Smartphone, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { type FieldValues, type Path, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { api, thongBaoLoi } from '../../lib/api';
import { useShell } from '../../shell/shell-context';

const KHOA = {
  xuong: ['xuong'] as const,
  chuyen: (xuongId: string) => ['chuyen', xuongId] as const,
  tram: (chuyenId: string) => ['tram', chuyenId] as const,
};

/** Lỗi field từ server (vd. TRUNG_MA → field "ma") → hiện ngay tại ô nhập */
function ganLoiField<T extends FieldValues>(form: UseFormReturn<T>, e: unknown): boolean {
  if (e instanceof LoiApi && e.field) {
    form.setError(e.field as Path<T>, { message: e.message });
    return true;
  }
  return false;
}

export function ChuyenTramPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { q } = useShell();

  const xuongQ = useQuery({ queryKey: KHOA.xuong, queryFn: ({ signal }) => api.goi('/xuong', { schema: z.array(zXuong), signal }) });
  const [chonXuong, setChonXuong] = useState<string | null>(null);
  const xuong = xuongQ.data?.find((x) => x.id === chonXuong) ?? xuongQ.data?.find((x) => x.trangThai === 'HOAT_DONG') ?? xuongQ.data?.[0];

  const chuyenQ = useQuery({
    queryKey: KHOA.chuyen(xuong?.id ?? ''),
    queryFn: ({ signal }) => api.goi(`/chuyen?xuongId=${xuong!.id}`, { schema: z.array(zChuyen), signal }),
    enabled: !!xuong,
  });
  const [chonChuyen, setChonChuyen] = useState<string | null>(null);
  const line = chuyenQ.data?.find((c) => c.id === chonChuyen) ?? chuyenQ.data?.[0];

  const tramQ = useQuery({
    queryKey: KHOA.tram(line?.id ?? ''),
    queryFn: ({ signal }) => api.goi(`/chuyen/${line!.id}/tram`, { schema: z.array(zTram), signal }),
    enabled: !!line,
  });

  // ── Xác nhận cảnh báo (409 CAN_XAC_NHAN) → gửi lại với xacNhan: true ──
  const [xacNhan, setXacNhan] = useState<{ tieuDe: string; canhBao: CanhBaoXacNhan; message: string; tiepTuc: () => void } | null>(null);
  const lamMoi = () => queryClient.invalidateQueries({ predicate: (k) => ['xuong', 'chuyen', 'tram'].includes(String(k.queryKey[0])) });
  const baoLoi = (e: unknown) => {
    toast(thongBaoLoi(e), 'warn');
    if (e instanceof LoiApi && e.code === 'DU_LIEU_DA_THAY_DOI') void lamMoi();
  };
  /** Gửi thao tác; nếu server yêu cầu xác nhận thì mở hộp xác nhận */
  const guiCoXacNhan = (tieuDe: string, gui: (xn: boolean) => Promise<unknown>, thanhCong: string) => {
    gui(false)
      .then(() => { toast(thanhCong); void lamMoi(); })
      .catch((e: unknown) => {
        if (e instanceof LoiApi && e.code === 'CAN_XAC_NHAN') {
          setXacNhan({
            tieuDe, message: e.message, canhBao: zCanhBaoXacNhan.parse(e.chiTiet),
            tiepTuc: () => gui(true).then(() => { toast(thanhCong); void lamMoi(); }).catch(baoLoi).finally(() => setXacNhan(null)),
          });
        } else baoLoi(e);
      });
  };

  const suaXuong = (x: Xuong, body: object) => (xn: boolean) => api.goi(`/xuong/${x.id}`, { method: 'PATCH', body: { ...body, version: x.version, xacNhan: xn }, schema: zXuong });
  const suaChuyen = (c: Chuyen, body: object) => (xn: boolean) => api.goi(`/chuyen/${c.id}`, { method: 'PATCH', body: { ...body, version: c.version, xacNhan: xn }, schema: zChuyen });

  const suaTram = useMutation({
    mutationFn: ({ t, body }: { t: Tram; body: object }) => api.goi(`/tram/${t.id}`, { method: 'PATCH', body: { ...body, version: t.version }, schema: zTram }),
    onSuccess: (moi) => {
      queryClient.setQueryData<Tram[]>(KHOA.tram(moi.chuyenId), (ds) => ds?.map((t) => (t.id === moi.id ? moi : t)));
      void queryClient.invalidateQueries({ queryKey: ['chuyen'] });
    },
    onError: baoLoi,
  });

  const [modal, setModal] = useState<'them-xuong' | 'sua-xuong' | 'them-chuyen' | 'sua-chuyen' | null>(null);

  const s = q.trim().toLowerCase();
  const loc = (l: Chuyen) => !s || `${l.ma} ${l.ten}`.toLowerCase().includes(s);
  const sewing = chuyenQ.data?.filter((l) => l.loai === 'CHUYEN_MAY' && loc(l)) ?? [];
  const outer = chuyenQ.data?.filter((l) => l.loai === 'VONG_NGOAI' && loc(l)) ?? [];

  const LineBtn = ({ l }: { l: Chuyen }) => (
    <button type="button" onClick={() => setChonChuyen(l.id)} aria-current={l.id === line?.id}
      className={cn('w-full h-10 px-3 flex items-center gap-2.5 rounded-ctl text-body text-left transition-colors duration-fast', l.id === line?.id ? 'bg-brand-soft text-brand-ink font-semibold' : 'hover:bg-hover')}>
      <span className={cn('w-12 font-semibold', l.trangThai === 'NGUNG' && 'text-disabled-ink line-through')}>{l.ma}</span>
      <span className={cn('truncate', l.id !== line?.id && 'text-muted')}>{l.ten}</span>
      {l.trangThai === 'NGUNG' ? <Pill tone="locked" size="sm" className="ml-auto">Ngưng</Pill>
        : l.soTram > 0 && <span className="ml-auto text-tag text-muted num">{l.soTram} trạm</span>}
    </button>
  );

  return (
    <>
      <Page>
        <Toolbar title="Xưởng – Chuyền – Trạm" right={<>
          <Button icon={Plus} onClick={() => setModal('them-xuong')}>Thêm xưởng</Button>
          <Button variant="primary" icon={Plus} disabled={!xuong || xuong.trangThai !== 'HOAT_DONG'} onClick={() => setModal('them-chuyen')}>Thêm chuyền</Button>
        </>}>
          <span className="text-chip text-muted flex items-center gap-1.5 ml-1 min-w-0">
            <Building2 className="w-4 h-4" />Nhà máy VIETSUN Đồng Nai<ChevronRight className="w-3.5 h-3.5" /><Factory className="w-4 h-4" />
            {xuongQ.data && xuongQ.data.length > 1 ? (
              <Select label="Xưởng" value={xuong?.id} onChange={(e) => { setChonXuong(e.target.value); setChonChuyen(null); }} className="h-8">
                {xuongQ.data.map((x) => <option key={x.id} value={x.id}>{x.ten} ({x.ma}){x.trangThai === 'NGUNG' ? ' · Ngưng' : ''}</option>)}
              </Select>
            ) : xuong && <span className="text-ink font-medium">{xuong.ten} ({xuong.ma})</span>}
          </span>
          {xuong && (
            <Menu align="start" trigger={<IconButton icon={MoreHorizontal} label="Thao tác xưởng" className="w-8 h-8" />}>
              <MenuItem icon={Pencil} onSelect={() => setModal('sua-xuong')}>Sửa xưởng</MenuItem>
              {xuong.trangThai === 'HOAT_DONG'
                ? <MenuItem icon={PowerOff} danger onSelect={() => guiCoXacNhan(`Ngưng xưởng ${xuong.ma}`, suaXuong(xuong, { trangThai: 'NGUNG' }), `Đã ngưng xưởng ${xuong.ma}`)}>Ngưng xưởng</MenuItem>
                : <MenuItem icon={Power} onSelect={() => guiCoXacNhan('', suaXuong(xuong, { trangThai: 'HOAT_DONG' }), `Đã kích hoạt xưởng ${xuong.ma}`)}>Kích hoạt lại</MenuItem>}
            </Menu>
          )}
        </Toolbar>

        {xuongQ.isSuccess && !xuong ? (
          <section className="flex-1 bg-surface border border-line rounded-card grid place-items-center">
            <EmptyState icon={Factory} title="Chưa có xưởng" sub="Tạo xưởng trước, sau đó thêm chuyền / nhóm vào xưởng."
              action={<Button variant="primary" icon={Plus} onClick={() => setModal('them-xuong')}>Thêm xưởng</Button>} />
          </section>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)] gap-4">
            <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-2">
                <div className="h-7 px-3 flex items-center text-tag font-semibold uppercase tracking-[0.06em] text-muted">Chuyền may</div>
                {sewing.map((l) => <LineBtn key={l.id} l={l} />)}
                <div className="h-7 px-3 mt-2 flex items-center text-tag font-semibold uppercase tracking-[0.06em] text-muted">Vòng ngoài</div>
                {outer.map((l) => <LineBtn key={l.id} l={l} />)}
                {chuyenQ.isSuccess && !chuyenQ.data.length && <p className="px-3 py-2 text-chip text-muted">Xưởng chưa có chuyền.</p>}
              </div>
            </section>

            <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
              {line ? (
                <>
                  <div className="px-4 py-3 border-b border-line flex items-center gap-3">
                    <div className="min-w-0">
                      <h2 className="text-h font-semibold">{line.ma} · {line.ten}</h2>
                      <p className="text-sub text-muted">{TEN_LOAI_CHUYEN[line.loai]} · Xưởng {xuong?.ma} · {line.soTram ? `${line.soTram} trạm · ${line.soTramApp} trạm nhập qua app` : 'Không nhập sản lượng qua app (MVP)'}</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1">
                      <Pill tone={line.trangThai === 'HOAT_DONG' ? 'closed' : 'locked'}>{line.trangThai === 'HOAT_DONG' ? 'Hoạt động' : 'Ngưng'}</Pill>
                      <Menu trigger={<IconButton icon={MoreHorizontal} label="Thao tác chuyền" />}>
                        <MenuItem icon={Pencil} onSelect={() => setModal('sua-chuyen')}>Sửa chuyền</MenuItem>
                        {line.trangThai === 'HOAT_DONG'
                          ? <MenuItem icon={PowerOff} danger onSelect={() => guiCoXacNhan(`Ngưng chuyền ${line.ma}`, suaChuyen(line, { trangThai: 'NGUNG' }), `Đã ngưng chuyền ${line.ma}`)}>Ngưng chuyền</MenuItem>
                          : <MenuItem icon={Power} onSelect={() => guiCoXacNhan('', suaChuyen(line, { trangThai: 'HOAT_DONG' }), `Đã kích hoạt chuyền ${line.ma}`)}>Kích hoạt lại</MenuItem>}
                      </Menu>
                    </span>
                  </div>
                  {line.soTram ? (
                    <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-4">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
                        {tramQ.data?.map((t) => (
                          <TramTile key={t.id} t={t} vongNgoai={line.loai === 'VONG_NGOAI'} dangLuu={suaTram.isPending && suaTram.variables.t.id === t.id}
                            onDoi={(body) => suaTram.mutate({ t, body })} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 grid place-items-center text-chip text-muted">Nhóm vòng ngoài chưa có trạm nhập liệu.</div>
                  )}
                </>
              ) : (
                <div className="flex-1 grid place-items-center">
                  <EmptyState icon={Factory} title="Chưa có chuyền" sub="Thêm chuyền — hệ thống tự tạo trạm 1 → N."
                    action={xuong?.trangThai === 'HOAT_DONG' && <Button variant="primary" icon={Plus} onClick={() => setModal('them-chuyen')}>Thêm chuyền</Button>} />
                </div>
              )}
            </section>
          </div>
        )}
      </Page>
      <StatusBar right={<span>Mỗi trạm có mã định danh cố định (UUID) dùng cho QR</span>}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-soft border border-brand" />Nhập qua app (MVP: 12, 25, 26–41)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-thead border border-line" />Chuyền treo JACK ghi nhận</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-page border border-dashed border-line-strong" />Ngưng</span>
      </StatusBar>

      {modal === 'them-xuong' && <ModalXuong onClose={() => setModal(null)} onXong={(x) => { setChonXuong(x.id); void lamMoi(); }} />}
      {modal === 'sua-xuong' && xuong && <ModalXuong xuong={xuong} onClose={() => setModal(null)} onXong={() => void lamMoi()} />}
      {modal === 'them-chuyen' && xuong && <ModalChuyen xuongId={xuong.id} onClose={() => setModal(null)} onXong={(c) => { setChonChuyen(c.id); void lamMoi(); }} />}
      {modal === 'sua-chuyen' && line && <ModalChuyen xuongId={line.xuongId} chuyen={line} onClose={() => setModal(null)} onXong={() => void lamMoi()} />}

      <Modal open={!!xacNhan} onClose={() => setXacNhan(null)} title={xacNhan?.tieuDe ?? ''}
        footer={<><Button onClick={() => setXacNhan(null)}>Hủy</Button><Button variant="danger" onClick={() => xacNhan?.tiepTuc()}>Xác nhận</Button></>}>
        <p className="text-body flex gap-2"><TriangleAlert className="w-[18px] h-[18px] text-warn-bar mt-0.5" />{xacNhan?.message}</p>
        <p className="text-chip text-muted mt-3">{xacNhan?.canhBao.canhBao}</p>
        <ul className="mt-1.5 list-disc pl-5 text-body">{xacNhan?.canhBao.danhSach.map((d) => <li key={d}>{d}</li>)}</ul>
      </Modal>
    </>
  );
}

/** Ô trạm — bấm để bật/tắt "Nhập qua app" (như demo); menu "…" để ngưng / kích hoạt trạm */
function TramTile({ t, vongNgoai, dangLuu, onDoi }: { t: Tram; vongNgoai: boolean; dangLuu: boolean; onDoi: (body: object) => void }) {
  const on = t.nhapQuaApp && t.trangThai === 'HOAT_DONG';
  const ngung = t.trangThai === 'NGUNG';
  const nhan = ngung ? 'Ngưng' : vongNgoai ? 'Vòng ngoài' : t.soTram === 12 && on ? 'QC · app' : t.soTram === 25 && on ? 'Ủi · app' : on ? 'Nhập qua app' : 'JACK';
  return (
    <div className="relative group">
      <button type="button" role="switch" aria-checked={on} aria-label={`Trạm ${t.soTram} nhập qua app`} disabled={ngung || vongNgoai || dangLuu}
        onClick={() => onDoi({ nhapQuaApp: !t.nhapQuaApp })}
        className={cn('w-full h-16 rounded-card border px-2.5 py-2 flex flex-col text-left transition-colors duration-fast disabled:cursor-not-allowed',
          ngung ? 'border-dashed border-line-strong bg-page text-disabled-ink'
            : on ? 'border-brand/50 bg-brand-soft hover:border-brand' : 'border-line bg-thead hover:border-line-strong',
          dangLuu && 'opacity-60')}>
        <span className="flex items-center gap-1 w-full whitespace-nowrap"><b className="text-qty num">Trạm {t.soTram}</b>{on && <Smartphone className="w-3.5 h-3.5 ml-auto text-brand-ink" />}</span>
        <span className={cn('text-tag mt-auto', on ? 'text-brand-ink font-semibold' : 'text-muted')}>
          {nhan}{t.maNVDangDangNhap && <span className="font-mono"> · {t.maNVDangDangNhap}</span>}
        </span>
      </button>
      <div className="absolute right-1 bottom-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-fast">
        <Menu trigger={<IconButton icon={MoreHorizontal} label={`Thao tác trạm ${t.soTram}`} className="w-6 h-6" />}>
          {ngung
            ? <MenuItem icon={Power} onSelect={() => onDoi({ trangThai: 'HOAT_DONG' })}>Kích hoạt lại trạm</MenuItem>
            : <MenuItem icon={PowerOff} danger onSelect={() => onDoi({ trangThai: 'NGUNG' })}>Ngưng trạm</MenuItem>}
        </Menu>
      </div>
    </div>
  );
}

const zFormXuong = zTaoXuong;
type FormXuong = z.input<typeof zFormXuong>;

function ModalXuong({ xuong, onClose, onXong }: { xuong?: Xuong; onClose: () => void; onXong: (x: Xuong) => void }) {
  const toast = useToast();
  const form = useForm<FormXuong>({ resolver: zodResolver(zFormXuong), defaultValues: { ma: xuong?.ma ?? '', ten: xuong?.ten ?? '' } });
  const luu = useMutation({
    mutationFn: (d: FormXuong) =>
      xuong
        ? api.goi(`/xuong/${xuong.id}`, { method: 'PATCH', body: { ...d, version: xuong.version }, schema: zXuong })
        : api.goi('/xuong', { method: 'POST', body: d, schema: zXuong }),
    onSuccess: (x) => { toast(xuong ? `Đã lưu xưởng ${x.ma}` : `Đã tạo xưởng ${x.ma}`); onXong(x); onClose(); },
    onError: (e) => { if (!ganLoiField(form, e)) toast(e.message, 'warn'); },
  });
  const { errors } = form.formState;
  return (
    <Modal open onClose={onClose} title={xuong ? `Sửa xưởng ${xuong.ma}` : 'Thêm xưởng'}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={luu.isPending} onClick={form.handleSubmit((d) => luu.mutate(d))}>{xuong ? 'Lưu' : 'Tạo xưởng'}</Button></>}>
      <form className="grid grid-cols-2 gap-3" onSubmit={form.handleSubmit((d) => luu.mutate(d))} noValidate>
        <Field label="Mã xưởng" required error={errors.ma?.message} htmlFor="x-ma"><Input id="x-ma" {...form.register('ma')} aria-invalid={!!errors.ma} className="w-full uppercase" /></Field>
        <Field label="Tên" required error={errors.ten?.message} htmlFor="x-ten"><Input id="x-ten" {...form.register('ten')} aria-invalid={!!errors.ten} className="w-full" /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

type FormChuyen = z.input<typeof zTaoChuyen>;

function ModalChuyen({ xuongId, chuyen, onClose, onXong }: { xuongId: string; chuyen?: Chuyen; onClose: () => void; onXong: (c: Chuyen) => void }) {
  const toast = useToast();
  const form = useForm<FormChuyen>({
    resolver: zodResolver(zTaoChuyen),
    defaultValues: { ma: chuyen?.ma ?? '', ten: chuyen?.ten ?? '', loai: chuyen?.loai ?? 'CHUYEN_MAY', xuongId, soTram: chuyen?.soTram ?? 41 },
  });
  const luu = useMutation({
    mutationFn: (d: FormChuyen) =>
      chuyen
        ? api.goi(`/chuyen/${chuyen.id}`, { method: 'PATCH', body: { ma: d.ma, ten: d.ten, loai: d.loai, version: chuyen.version }, schema: zChuyen })
        : api.goi('/chuyen', { method: 'POST', body: d, schema: zChuyen }),
    onSuccess: (c) => {
      toast(chuyen ? `Đã lưu chuyền ${c.ma}` : `Đã tạo ${c.ma} · tự tạo ${c.soTram ? `trạm 1 → ${c.soTram}` : '0 trạm'}`);
      onXong(c);
      onClose();
    },
    onError: (e) => { if (!ganLoiField(form, e)) toast(e.message, 'warn'); },
  });
  const { errors } = form.formState;
  const gui = form.handleSubmit((d) => luu.mutate(d));
  return (
    <Modal open onClose={onClose} title={chuyen ? `Sửa chuyền ${chuyen.ma}` : 'Thêm chuyền / nhóm'}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={luu.isPending} onClick={gui}>{chuyen ? 'Lưu' : 'Tạo chuyền'}</Button></>}>
      <form className="grid grid-cols-2 gap-3" onSubmit={gui} noValidate>
        <Field label="Mã chuyền" required error={errors.ma?.message} htmlFor="c-ma"><Input id="c-ma" {...form.register('ma')} aria-invalid={!!errors.ma} className="w-full uppercase" /></Field>
        <Field label="Tên" required error={errors.ten?.message} htmlFor="c-ten"><Input id="c-ten" {...form.register('ten')} aria-invalid={!!errors.ten} className="w-full" /></Field>
        <Field label="Loại" required error={errors.loai?.message}>
          <Select label="Loại" {...form.register('loai')} className="w-full">
            {LOAI_CHUYEN.map((l) => <option key={l} value={l}>{TEN_LOAI_CHUYEN[l]}</option>)}
          </Select>
        </Field>
        <Field label="Số trạm" required error={errors.soTram?.message} hint={chuyen ? 'Không đổi sau khi tạo' : 'Tự tạo trạm 1 → N'} htmlFor="c-so">
          <Input id="c-so" inputMode="numeric" type="number" min={0} readOnly={!!chuyen} {...form.register('soTram', { valueAsNumber: true })}
            aria-invalid={!!errors.soTram} className="w-full num text-right" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
