/**
 * Mã hàng & công đoạn · F3 — giao diện chép từ ui-demo/(web)/danh-muc/ma-hang
 * (danh sách mã hàng 300px + chi tiết: tab Công đoạn / Lịch sử SMV, hộp Đổi SMV).
 * Bổ sung so với demo: thêm/sửa mã hàng, thêm/sửa công đoạn (import quy trình còn chờ file mẫu của IE — việc mở #1).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CongDoan, dinhDangGio, dinhDangNgay, dinhDangSo, homNay, LoiApi, type MaHang, NGAY_SMV_TU_DAU,
  TEN_TRANG_THAI_MA_HANG, zCongDoan, zKetQuaDoiSmv, zLichSuSmv, zMaHang, zSmv, zTaoCongDoan, zTaoMaHang,
} from '@vsn/shared';
import { Button, cn, EmptyState, Field, IconButton, Input, Menu, MenuItem, Modal, Page, Pill, Progress, StatusBar, Tabs, Toolbar, useToast } from '@vsn/ui';
import { History, MoreHorizontal, Pencil, Plus, Shirt, Star, Upload } from 'lucide-react';
import { useState } from 'react';
import { type FieldValues, type Path, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useToi } from '../../lib/xac-thuc';
import { useShell } from '../../shell/shell-context';

const pct = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
const ngayHienThi = (n: string) => (n === NGAY_SMV_TU_DAU ? 'từ đầu' : dinhDangNgay(n));

function ganLoi<T extends FieldValues>(form: UseFormReturn<T>, e: unknown, toast: (m: string, k?: 'warn') => void) {
  if (e instanceof LoiApi && e.field) form.setError(e.field as Path<T>, { message: e.message });
  else toast(e instanceof Error ? e.message : 'Có lỗi xảy ra.', 'warn');
}

export function MaHangPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { q } = useShell();
  const [chon, setChon] = useState<string | null>(null);
  const [tab, setTab] = useState<'cd' | 'smv'>('cd');
  const [modal, setModal] = useState<'them-mh' | 'sua-mh' | 'them-cd' | null>(null);
  const [suaCd, setSuaCd] = useState<CongDoan | null>(null);
  const [smvEdit, setSmvEdit] = useState<CongDoan | null>(null);

  const mhQ = useQuery({ queryKey: ['ma-hang'], queryFn: ({ signal }) => api.goi('/ma-hang', { schema: z.array(zMaHang), signal }) });
  const style = mhQ.data?.find((x) => x.id === chon) ?? mhQ.data?.[0];
  const cdQ = useQuery({
    queryKey: ['cong-doan', style?.id],
    queryFn: ({ signal }) => api.goi(`/ma-hang/${style!.id}/cong-doan`, { schema: z.array(zCongDoan), signal }),
    enabled: !!style,
  });
  const lsQ = useQuery({
    queryKey: ['lich-su-smv', style?.id],
    queryFn: ({ signal }) => api.goi(`/ma-hang/${style!.id}/lich-su-smv`, { schema: z.array(zLichSuSmv), signal }),
    enabled: !!style && tab === 'smv',
  });
  const lamMoi = () => queryClient.invalidateQueries({ predicate: (k) => ['ma-hang', 'cong-doan', 'lich-su-smv'].includes(String(k.queryKey[0])) });

  const doiCd = useMutation({
    mutationFn: ({ cd, body }: { cd: CongDoan; body: object }) => api.goi(`/cong-doan/${cd.id}`, { method: 'PATCH', body: { ...body, version: cd.version }, schema: zCongDoan }),
    onSuccess: () => void lamMoi(),
    onError: (e) => { toast(e.message, 'warn'); if (e instanceof LoiApi && e.code === 'DU_LIEU_DA_THAY_DOI') void lamMoi(); },
  });

  const s = q.trim().toLowerCase();
  const ops = (cdQ.data ?? []).filter((o) => !s || `${o.ma} ${o.ten}`.toLowerCase().includes(s));

  return (
    <>
      <Page>
        <Toolbar title="Mã hàng & công đoạn" right={<>
          <Button icon={Plus} onClick={() => setModal('them-mh')}>Thêm mã hàng</Button>
          <Button variant="primary" icon={Upload} onClick={() => toast('Chờ file mẫu quy trình công nghệ của IE (việc còn mở #1)', 'warn')}>Import quy trình</Button>
        </>} />

        {mhQ.isSuccess && !style ? (
          <section className="flex-1 bg-surface border border-line rounded-card grid place-items-center">
            <EmptyState icon={Shirt} title="Chưa có mã hàng" action={<Button variant="primary" icon={Plus} onClick={() => setModal('them-mh')}>Thêm mã hàng</Button>} />
          </section>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-[300px_minmax(0,1fr)] gap-4">
            <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
              <div className="h-12 px-4 flex items-center border-b border-line"><h2 className="text-h font-semibold">Mã hàng</h2><span className="ml-auto text-sub text-muted">{mhQ.data?.length ?? ''}</span></div>
              <ul className="flex-1 min-h-0 overflow-y-auto scroll-area p-2 flex flex-col gap-1">
                {mhQ.data?.map((x) => {
                  const on = x.id === style?.id, p = pct(x.daLam, x.soLuongDonHang);
                  return (
                    <li key={x.id}>
                      <button type="button" onClick={() => setChon(x.id)} aria-current={on}
                        className={cn('w-full text-left px-3 py-2.5 rounded-ctl transition-colors duration-fast', on ? 'bg-brand-soft' : 'hover:bg-hover')}>
                        <div className="flex items-center gap-2">
                          <b className={cn('text-body', on && 'text-brand-ink')}>{x.ma}</b>
                          <span className="ml-auto"><Pill size="sm" tone={x.trangThai === 'DANG_CHAY' ? 'open' : x.trangThai === 'DA_KET_THUC' ? 'locked' : 'neutral'}>{TEN_TRANG_THAI_MA_HANG[x.trangThai]}</Pill></span>
                        </div>
                        <div className="text-sub text-muted truncate mt-0.5">{x.ten}{x.khachHang ? ` · ${x.khachHang}` : ''}</div>
                        <div className="flex items-center gap-2 mt-1.5"><Progress value={p} className="flex-1" /><span className="text-tag text-muted num w-9 text-right">{p}%</span></div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {style && (
              <section className="bg-surface border border-line rounded-card flex flex-col min-h-0 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-4 border-b border-line">
                  <span className="w-10 h-10 rounded-ctl bg-brand-soft grid place-items-center shrink-0"><Shirt className="w-5 h-5 text-brand-ink" /></span>
                  <div className="min-w-0">
                    <h2 className="text-h font-semibold">{style.ma} · {style.ten}</h2>
                    <p className="text-sub text-muted">{style.khachHang ?? '—'} · Đơn hàng <b className="text-ink num">{dinhDangSo(style.soLuongDonHang)}</b> sp · Đang chạy trên {style.dangChayTren.join(', ') || '—'}</p>
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <div className="text-sub text-muted">Đã làm (QC)</div>
                    <div className="text-h font-semibold">{dinhDangSo(style.daLam)} <span className="text-sub text-muted font-normal">/ {dinhDangSo(style.soLuongDonHang)}</span></div>
                  </div>
                  <Menu trigger={<IconButton icon={MoreHorizontal} label="Thao tác mã hàng" />}>
                    <MenuItem icon={Pencil} onSelect={() => setModal('sua-mh')}>Sửa mã hàng</MenuItem>
                    <MenuItem icon={Plus} onSelect={() => setModal('them-cd')}>Thêm công đoạn</MenuItem>
                  </Menu>
                </div>
                {style.thieuCongDoanHoanThanh && (
                  <p className="px-4 py-2 text-chip bg-empty-bg text-empty-ink border-b border-line">Chưa có công đoạn hoàn thành (QC ★) — “Đã làm” của mã hàng tính theo công đoạn này.</p>
                )}
                <Tabs value={tab} onChange={setTab} options={[{ value: 'cd', label: 'Công đoạn', count: cdQ.data?.length }, { value: 'smv', label: 'Lịch sử SMV' }]} />
                <div className="flex-1 min-h-0 overflow-auto scroll-area">
                  {tab === 'cd' ? (
                    ops.length ? (
                      <table className="grid-table hoverable text-body">
                        <colgroup><col style={{ width: 100 }} /><col /><col style={{ width: 130 }} /><col style={{ width: 170 }} /><col style={{ width: 130 }} /><col style={{ width: 110 }} /></colgroup>
                        <thead><tr className="text-th font-semibold uppercase tracking-[0.02em] text-muted">
                          <th className="px-3 text-left">Mã CĐ</th><th className="px-3 text-left">Tên công đoạn</th><th className="px-3 text-right">SMV (giây)</th><th className="px-3 text-left">Đang gán</th><th className="px-3 text-left">Trạng thái</th><th className="px-3" />
                        </tr></thead>
                        <tbody>{ops.map((o) => {
                          const active = o.trangThai === 'HOAT_DONG';
                          return (
                            <tr key={o.id} className={cn(!active && 'text-muted')}>
                              <td className="px-3 font-mono text-[13px]">{o.ma}</td>
                              <td className="px-3"><span className="flex items-center gap-2">{o.ten}{o.laCongDoanHoanThanh && <span className="h-[18px] px-1.5 rounded-pill bg-closed-bg text-closed-ink text-tag font-semibold inline-flex items-center gap-0.5" data-tip="Công đoạn hoàn thành — dùng tính Đã làm"><Star className="w-3 h-3" />QC</span>}</span></td>
                              <td className="px-3 text-right">
                                <button type="button" onClick={() => setSmvEdit(o)} className="num font-semibold rounded-ctl px-2 py-1 hover:ring-1 hover:ring-line-strong transition duration-fast" aria-label={`Đổi SMV ${o.ma}`}>{o.smv != null ? dinhDangSo(o.smv, 3) : '—'}</button>
                                {o.smvSapApDung && <div className="text-tag text-muted" data-tip="SMV đã đặt cho ngày sau">→ {dinhDangSo(o.smvSapApDung.smv, 3)} từ {dinhDangNgay(o.smvSapApDung.tuNgay).slice(0, 5)}</div>}
                              </td>
                              <td className="px-3 text-chip">{o.dangGan.length ? o.dangGan.map((g) => `${g.maChuyen} · trạm ${g.soTram.join(', ')}`).join(' · ') : <span className="text-muted">—</span>}</td>
                              <td className="px-3">{active ? <Pill tone="closed">Hoạt động</Pill> : <Pill tone="locked">Ngưng</Pill>}</td>
                              <td className="px-3 text-right whitespace-nowrap">
                                <button type="button" disabled={doiCd.isPending} onClick={() => doiCd.mutate({ cd: o, body: { trangThai: active ? 'NGUNG' : 'HOAT_DONG' } })} className="text-chip font-semibold text-muted hover:text-ink">{active ? 'Ngưng' : 'Kích hoạt'}</button>
                                <Menu trigger={<IconButton icon={MoreHorizontal} label={`Thao tác ${o.ma}`} className="w-7 h-7 inline-grid ml-1 align-middle" />}>
                                  <MenuItem icon={Pencil} onSelect={() => setSuaCd(o)}>Sửa công đoạn</MenuItem>
                                  {!o.laCongDoanHoanThanh && active && <MenuItem icon={Star} onSelect={() => doiCd.mutate({ cd: o, body: { laCongDoanHoanThanh: true } })}>Đặt làm công đoạn hoàn thành</MenuItem>}
                                </Menu>
                              </td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    ) : cdQ.isSuccess && (
                      <EmptyState icon={Shirt} title={s ? 'Không tìm thấy công đoạn' : 'Mã hàng chưa có công đoạn'} action={!s && <Button variant="primary" icon={Plus} onClick={() => setModal('them-cd')}>Thêm công đoạn</Button>} />
                    )
                  ) : (
                    <ol className="p-4 flex flex-col gap-3">
                      {lsQ.data?.length === 0 && <p className="text-chip text-muted">Chưa đổi SMV lần nào.</p>}
                      {lsQ.data?.map((h) => (
                        <li key={h.luc + h.maCongDoan} className="rounded-card border border-line p-3 flex items-center gap-3">
                          <History className="w-5 h-5 text-muted shrink-0" />
                          <div className="text-chip">
                            <div><span className="font-mono">{h.maCongDoan}</span> {h.tenCongDoan} · SMV <b className="num">{h.smvCu != null ? `${dinhDangSo(h.smvCu, 3)}s` : '—'} → {dinhDangSo(h.smvMoi, 3)}s</b> · áp dụng {h.apDungTuNgay === NGAY_SMV_TU_DAU ? '' : 'từ '}<b className="num">{ngayHienThi(h.apDungTuNgay)}</b></div>
                            <div className="text-sub text-muted">{h.nguoi ?? '—'} · {dinhDangGio(h.luc)} {dinhDangNgay(homNay(new Date(h.luc))).slice(0, 5)} · tính lại snapshot {dinhDangSo(h.soBanGhiTinhLai)} bản ghi (chỉ ngày chưa khóa)</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </Page>
      <StatusBar right={<span>Mỗi mã hàng có đúng 1 công đoạn hoàn thành (QC ★)</span>}>
        <span>Đổi SMV không làm thay đổi số liệu của ngày đã khóa</span>
      </StatusBar>

      {(modal === 'them-mh' || (modal === 'sua-mh' && style)) && (
        <ModalMaHang mh={modal === 'sua-mh' ? style : undefined} onClose={() => setModal(null)} onXong={(m) => { setChon(m.id); void lamMoi(); }} />
      )}
      {(modal === 'them-cd' || suaCd) && style && (
        <ModalCongDoan maHangId={style.id} cd={suaCd ?? undefined} onClose={() => { setModal(null); setSuaCd(null); }} onXong={() => void lamMoi()} />
      )}
      {smvEdit && style && <ModalDoiSmv cd={smvEdit} somNhat={style.ngaySomNhatDoiSmv} onClose={() => setSmvEdit(null)} onXong={() => void lamMoi()} />}
    </>
  );
}

type FormMh = z.input<typeof zTaoMaHang>;
function ModalMaHang({ mh, onClose, onXong }: { mh?: MaHang; onClose: () => void; onXong: (m: MaHang) => void }) {
  const toast = useToast();
  const form = useForm<FormMh>({ resolver: zodResolver(zTaoMaHang), defaultValues: { ma: mh?.ma ?? '', ten: mh?.ten ?? '', khachHang: mh?.khachHang ?? '', soLuongDonHang: mh?.soLuongDonHang } });
  const luu = useMutation({
    mutationFn: (d: FormMh) => (mh
      ? api.goi(`/ma-hang/${mh.id}`, { method: 'PATCH', body: { ...d, version: mh.version }, schema: zMaHang })
      : api.goi('/ma-hang', { method: 'POST', body: d, schema: zMaHang })),
    onSuccess: (m) => { toast(mh ? `Đã lưu ${m.ma}` : `Đã tạo mã hàng ${m.ma}`); onXong(m); onClose(); },
    onError: (e) => ganLoi(form, e, toast),
  });
  const { errors } = form.formState;
  const gui = form.handleSubmit((d) => luu.mutate(d));
  return (
    <Modal open onClose={onClose} title={mh ? `Sửa mã hàng ${mh.ma}` : 'Thêm mã hàng'}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={luu.isPending} onClick={gui}>{mh ? 'Lưu' : 'Tạo mã hàng'}</Button></>}>
      <form className="grid grid-cols-2 gap-3" onSubmit={gui} noValidate>
        <Field label="Mã hàng" required error={errors.ma?.message} htmlFor="mh-ma"><Input id="mh-ma" {...form.register('ma')} aria-invalid={!!errors.ma} className="w-full uppercase" /></Field>
        <Field label="Tên hàng" required error={errors.ten?.message} htmlFor="mh-ten"><Input id="mh-ten" {...form.register('ten')} aria-invalid={!!errors.ten} className="w-full" /></Field>
        <Field label="Khách hàng" error={errors.khachHang?.message} htmlFor="mh-kh"><Input id="mh-kh" {...form.register('khachHang')} className="w-full" /></Field>
        <Field label="Số lượng đơn hàng" required error={errors.soLuongDonHang?.message} htmlFor="mh-sl">
          <Input id="mh-sl" type="number" inputMode="numeric" min={1} {...form.register('soLuongDonHang', { valueAsNumber: true })} aria-invalid={!!errors.soLuongDonHang} className="w-full num text-right" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

type FormCd = z.input<typeof zTaoCongDoan>;
function ModalCongDoan({ maHangId, cd, onClose, onXong }: { maHangId: string; cd?: CongDoan; onClose: () => void; onXong: () => void }) {
  const toast = useToast();
  const form = useForm<FormCd>({
    resolver: zodResolver(zTaoCongDoan),
    defaultValues: { ma: cd?.ma ?? '', ten: cd?.ten ?? '', smv: cd ? cd.smv : undefined, laCongDoanHoanThanh: cd?.laCongDoanHoanThanh ?? false },
  });
  const luu = useMutation({
    mutationFn: (d: FormCd) => (cd
      ? api.goi(`/cong-doan/${cd.id}`, { method: 'PATCH', body: { ma: d.ma, ten: d.ten, version: cd.version }, schema: zCongDoan })
      : api.goi(`/ma-hang/${maHangId}/cong-doan`, { method: 'POST', body: { ...d, smv: Number.isNaN(d.smv) ? null : d.smv }, schema: zCongDoan })),
    onSuccess: (c) => { toast(cd ? `Đã lưu ${c.ma}` : `Đã thêm công đoạn ${c.ma}`); onXong(); onClose(); },
    onError: (e) => ganLoi(form, e, toast),
  });
  const { errors } = form.formState;
  const gui = form.handleSubmit((d) => luu.mutate(d));
  return (
    <Modal open onClose={onClose} title={cd ? `Sửa công đoạn ${cd.ma}` : 'Thêm công đoạn'}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={luu.isPending} onClick={gui}>Lưu</Button></>}>
      <form className="grid grid-cols-2 gap-3" onSubmit={gui} noValidate>
        <Field label="Mã công đoạn" required error={errors.ma?.message} htmlFor="cd-ma"><Input id="cd-ma" {...form.register('ma')} aria-invalid={!!errors.ma} className="w-full font-mono uppercase" /></Field>
        <Field label="Tên công đoạn" required error={errors.ten?.message} htmlFor="cd-ten"><Input id="cd-ten" {...form.register('ten')} aria-invalid={!!errors.ten} className="w-full" /></Field>
        {!cd && (
          <>
            <Field label="SMV (giây / sản phẩm)" hint="Áp dụng từ đầu · đổi sau bằng Đổi SMV" error={errors.smv?.message} htmlFor="cd-smv">
              <Input id="cd-smv" type="number" step="0.001" min={0} {...form.register('smv', { setValueAs: (v: string) => (v === '' ? null : Number(v)) })} className="w-full num text-right" />
            </Field>
            <label className="flex items-center gap-2 text-chip self-end h-9"><input type="checkbox" {...form.register('laCongDoanHoanThanh')} />Công đoạn hoàn thành (QC ★)</label>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

const zFormSmv = z.object({ smv: zSmv, apDungTuNgay: z.string().min(1, 'Chọn ngày áp dụng.') });
type FormSmv = z.input<typeof zFormSmv>;
function ModalDoiSmv({ cd, somNhat, onClose, onXong }: { cd: CongDoan; somNhat: string | null; onClose: () => void; onXong: () => void }) {
  const toast = useToast();
  const tk = useToi();
  const macDinh = somNhat && tk.homNay < somNhat ? somNhat : tk.homNay;
  const form = useForm<FormSmv>({ resolver: zodResolver(zFormSmv), defaultValues: { smv: cd.smv ?? undefined, apDungTuNgay: macDinh } });
  const doi = useMutation({
    mutationFn: (d: FormSmv) => api.goi(`/cong-doan/${cd.id}/smv`, { method: 'POST', body: d, schema: zKetQuaDoiSmv }),
    onSuccess: (kq) => { toast(`Đã đổi SMV · tính lại ${dinhDangSo(kq.soBanGhiTinhLai)} bản ghi từ ngày áp dụng`); onXong(); onClose(); },
    onError: (e) => ganLoi(form, e, toast),
  });
  const { errors } = form.formState;
  const gui = form.handleSubmit((d) => doi.mutate(d));
  return (
    <Modal open onClose={onClose} title={`Đổi SMV · ${cd.ma} ${cd.ten}`}
      footer={<><Button onClick={onClose}>Hủy</Button><Button variant="primary" busy={doi.isPending} onClick={gui}>Lưu</Button></>}>
      <form className="grid grid-cols-2 gap-3" onSubmit={gui} noValidate>
        <Field label="SMV mới (giây)" required hint={`Hiện tại: ${cd.smv != null ? `${dinhDangSo(cd.smv, 3)}s` : 'chưa có'}`} error={errors.smv?.message} htmlFor="smv-moi">
          <Input id="smv-moi" type="number" step="0.001" min={0} {...form.register('smv', { valueAsNumber: true })} aria-invalid={!!errors.smv} className="w-full text-right num" />
        </Field>
        <Field label="Áp dụng từ ngày" required hint={somNhat ? `Sớm nhất: ${dinhDangNgay(somNhat)} (ngày chưa khóa)` : 'Bản ghi từ ngày này được tính lại SMV'} error={errors.apDungTuNgay?.message} htmlFor="smv-ngay">
          <Input id="smv-ngay" type="date" min={somNhat ?? undefined} {...form.register('apDungTuNgay')} aria-invalid={!!errors.apDungTuNgay} className="w-full" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
