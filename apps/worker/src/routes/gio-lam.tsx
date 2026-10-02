/**
 * Giờ làm · F6 — giao diện chép từ ui-demo/app/gio-lam:
 * "Ngày đang mở" (giờ mặc định, giờ tính hiệu suất, yêu cầu đang chờ) + "Yêu cầu đã gửi" + sheet sửa giờ (−/ô/+ 0,5 giờ, chọn nhanh).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dinhDangGio, dinhDangNgay, dinhDangSoGio, docSoGio, type GioLamCuaToi, homNay as ngayVN, LOI_SO_GIO, LoiApi, thuIso, zGioLamCuaToi } from '@vsn/shared';
import { cn } from '@vsn/ui';
import { Check, CircleAlert, Clock, Lock, Minus, Plus, ScanLine, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api, KHOA_KHOI_DONG, layKhoiDong } from '../lib/api';
import { BigButton, BottomNav, Sheet, useToast, WorkerBar } from '../ui/mobile';

const KHOA_GIO = ['cn', 'gio-lam'] as const;
const thu = (d: string) => { const t = thuIso(d); return t === 7 ? 'Chủ nhật' : `Thứ ${t + 1}`; };
const ddmm = (d: string) => dinhDangNgay(d).slice(0, 5);
/** Thời điểm → 'HH:mm dd/mm' theo giờ VN */
const luc = (iso: string) => `${dinhDangGio(iso)} ${ddmm(ngayVN(new Date(iso)))}`;
const hopLe = (n: number | null): n is number => n != null && n > 0 && n <= 16;

export function GioLamPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const kdQ = useQuery({ queryKey: KHOA_KHOI_DONG, queryFn: layKhoiDong });
  const gioQ = useQuery({ queryKey: KHOA_GIO, queryFn: ({ signal }) => api.goi('/cn/gio-lam', { schema: zGioLamCuaToi, signal }) });
  const [open, setOpen] = useState<GioLamCuaToi['ngayMo'][number] | null>(null);
  const [val, setVal] = useState('9');
  const [loi, setLoi] = useState('');
  const num = docSoGio(val);
  const bad = !hopLe(num);

  const gui = useMutation({
    mutationFn: (b: { ngay: string; soGio: string }) => api.goi('/cn/gio-lam', { method: 'POST', body: b, schema: zGioLamCuaToi }),
    onSuccess: (d) => { queryClient.setQueryData(KHOA_GIO, d); setOpen(null); toast('Đã gửi duyệt · tổ trưởng sẽ xem'); },
    onError: (e) => setLoi(e instanceof LoiApi ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.'),
  });

  const moSheet = (d: GioLamCuaToi['ngayMo'][number]) => {
    setOpen(d);
    setLoi('');
    setVal(dinhDangSoGio(d.yeuCauCho?.soGio ?? d.gioHieuLuc ?? d.gioMacDinh ?? 9));
  };
  const buoc = (by: number) => setVal(dinhDangSoGio(Math.min(16, Math.max(0.5, (num ?? 0) + by))));
  const homNay = kdQ.data?.homNay;
  const d = gioQ.data;

  return (
    <>
      <WorkerBar nhanVien={kdQ.data?.nhanVien ?? null} />
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4">
        {gioQ.isPending ? (
          <div className="py-16 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>
        ) : gioQ.isError ? (
          <p className="rounded-card bg-danger-bg text-danger p-4 text-[15px]" role="alert">{gioQ.error.message}</p>
        ) : !d?.ngayMo.length && !d?.yeuCau.length ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <ScanLine className="w-12 h-12 text-muted" /><p className="text-[17px] font-semibold">Chưa đăng nhập trạm nào</p>
            <p className="text-[14px] text-muted max-w-[260px]">Đăng nhập trạm để xem giờ làm và gửi yêu cầu sửa giờ.</p>
            <BigButton onClick={() => void navigate('/chon-tram')}><Plus className="w-5 h-5" />Thêm trạm</BigButton>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-[15px] font-semibold mb-2">Ngày đang mở</h2>
              <ul className="flex flex-col gap-2">
                {d.ngayMo.map((n) => (
                  <li key={n.ngay} className="rounded-card border border-line bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-[16px] font-semibold">{n.ngay === homNay && 'Hôm nay · '}{thu(n.ngay)}, {ddmm(n.ngay)}</div>
                        <div className="text-[14px] text-muted">{n.gioMacDinh != null ? <>Giờ mặc định <b className="text-ink num">{dinhDangSoGio(n.gioMacDinh)} giờ</b></> : 'Không có giờ mặc định'}</div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-[24px] leading-7 font-bold num">{dinhDangSoGio(n.gioHieuLuc)}</div>
                        <div className="text-[12px] text-muted">{n.nguon === 'MAC_DINH' ? 'giờ tính hiệu suất' : n.nguon === 'YEU_CAU_DUYET' ? 'đã duyệt' : 'tổ trưởng sửa'}</div>
                      </div>
                    </div>
                    {n.yeuCauCho && (
                      <div className="mt-3 rounded-ctl bg-empty-bg text-empty-ink px-3 py-2 text-[14px] flex items-center gap-2"><Clock className="w-4 h-4" />Chờ duyệt: <b className="num">{dinhDangSoGio(n.yeuCauCho.soGio)} giờ</b> · gửi {luc(n.yeuCauCho.guiLuc)}</div>
                    )}
                    {n.biKhoa ? (
                      <p className="mt-3 text-[13px] text-muted flex items-center gap-1.5"><Lock className="w-4 h-4" />Ngày này đã khóa sổ — không sửa giờ được.</p>
                    ) : (
                      <BigButton variant="secondary" className="w-full mt-3" onClick={() => moSheet(n)}>
                        {n.yeuCauCho ? 'Sửa yêu cầu' : 'Về sớm / tăng ca? Sửa giờ'}
                      </BigButton>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-[15px] font-semibold mb-2">Yêu cầu đã gửi</h2>
              {d.yeuCau.length ? (
                <ul className="rounded-card border border-line bg-surface divide-y divide-line">
                  {d.yeuCau.map((r) => (
                    <li key={r.id} className="px-4 py-3 flex items-center gap-3">
                      <span className={cn('w-9 h-9 rounded-full grid place-items-center shrink-0', r.trangThai === 'CHO' ? 'bg-empty-bg text-empty-ink' : r.trangThai === 'DUYET' ? 'bg-closed-bg text-closed-ink' : 'bg-danger-bg text-danger')}>
                        {r.trangThai === 'CHO' ? <Clock className="w-4 h-4" /> : r.trangThai === 'DUYET' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-medium">{thu(r.ngay)}, {ddmm(r.ngay)} · <span className="num">{dinhDangSoGio(r.soGio)} giờ</span></div>
                        <div className={cn('text-[13px]', r.trangThai === 'TU_CHOI' ? 'text-danger' : 'text-muted')}>
                          {r.trangThai === 'CHO' ? 'Chờ tổ trưởng duyệt'
                            : r.trangThai === 'DUYET' ? `${r.nguoiXuLy ?? 'Tổ trưởng'} duyệt · ${r.xuLyLuc ? luc(r.xuLyLuc) : ''}`
                              : `Từ chối — ${r.lyDoTuChoi ?? ''}`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="rounded-card border border-line bg-surface px-4 py-6 text-center text-[14px] text-muted">Chưa gửi yêu cầu nào.</p>}
              <p className="text-[13px] text-muted mt-2">Chưa duyệt hoặc bị từ chối → báo cáo dùng giờ mặc định.</p>
            </section>
          </>
        )}
      </main>
      <BottomNav />

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `Sửa giờ làm ${thu(open.ngay)}, ${ddmm(open.ngay)}` : ''}
        footer={<><BigButton variant="secondary" className="flex-1" onClick={() => setOpen(null)}>Hủy</BigButton>
          <BigButton className="flex-1" disabled={bad || gui.isPending} onClick={() => open && gui.mutate({ ngay: open.ngay, soGio: val })}>
            {gui.isPending ? <span className="spin w-5 h-5 rounded-full border-2 border-current border-t-transparent" /> : <Send className="w-5 h-5" />}Gửi duyệt
          </BigButton></>}>
        <p className="text-[14px] text-muted">Nhập tổng số giờ đã làm trong ngày (gồm tăng ca). Yêu cầu mới thay thế yêu cầu cũ đang chờ.</p>
        <div className="mt-4 flex items-stretch gap-2">
          <button type="button" onClick={() => buoc(-0.5)} className="w-[56px] h-[60px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover" aria-label="Bớt 0,5 giờ"><Minus className="w-6 h-6" /></button>
          <input value={val} onChange={(e) => { setVal(e.target.value); setLoi(''); }} inputMode="decimal" aria-label="Số giờ" aria-invalid={bad}
            className={cn('num flex-1 min-w-0 h-[60px] rounded-ctl border-2 text-center text-[30px] font-semibold outline-none bg-surface', bad ? 'border-danger' : 'border-line-strong focus:border-brand-ink')} />
          <button type="button" onClick={() => buoc(0.5)} className="w-[56px] h-[60px] rounded-ctl border border-line-strong grid place-items-center hover:bg-hover" aria-label="Thêm 0,5 giờ"><Plus className="w-6 h-6" /></button>
        </div>
        {bad ? <p className="text-[14px] text-danger mt-2 flex items-center gap-1.5" role="alert"><CircleAlert className="w-4 h-4" />{LOI_SO_GIO}</p>
          : loi ? <p className="text-[14px] text-danger mt-2 flex items-center gap-1.5" role="alert"><CircleAlert className="w-4 h-4" />{loi}</p>
            : open?.gioMacDinh != null
              ? <p className="text-[14px] text-muted mt-2 text-center">Giờ mặc định {dinhDangSoGio(open.gioMacDinh)} · chênh <b className="text-ink num">{num! - open.gioMacDinh >= 0 ? '+' : '−'}{dinhDangSoGio(Math.abs(num! - open.gioMacDinh))} giờ</b></p>
              : <p className="text-[14px] text-muted mt-2 text-center">Ngày này không có giờ mặc định</p>}
        <div className="mt-3 flex gap-2 justify-center">
          {[8, 9, 10, 10.5, 11].map((h) => <button key={h} type="button" onClick={() => setVal(dinhDangSoGio(h))} className="h-10 px-3.5 rounded-pill border border-line-strong text-[14px] font-medium hover:bg-hover num">{dinhDangSoGio(h)}</button>)}
        </div>
      </Sheet>
    </>
  );
}
