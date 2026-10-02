/**
 * Đăng nhập mã NV vào trạm · F1 — giao diện ui-demo/app/dang-nhap.
 * Khác demo theo [D26]: KHÔNG có nút "Đăng xuất người này" — trạm có người khác thì báo tổ trưởng (F17).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chuanHoaMaNV, LoiApi, zKhoiDong, zTramQr } from '@vsn/shared';
import { cn } from '@vsn/ui';
import { CircleAlert, LogIn, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, KHOA_KHOI_DONG, layKhoiDong } from '../lib/api';
import { layTokenTurnstile } from '../lib/turnstile';
import { BigButton, TopBar, useToast } from '../ui/mobile';

export function DangNhapPage() {
  const { tramId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [nv, setNv] = useState('');
  const [err, setErr] = useState('');

  const tramQ = useQuery({ queryKey: ['cn', 'tram', tramId], queryFn: ({ signal }) => api.goi(`/cn/tram/${tramId}`, { schema: zTramQr, signal }) });
  const kdQ = useQuery({ queryKey: KHOA_KHOI_DONG, queryFn: layKhoiDong });
  const daCo = kdQ.data?.phien.some((p) => p.tramId === tramId && p.ngayLamViec === kdQ.data?.homNay);
  const nvMay = kdQ.data?.nhanVien;

  const dangNhap = useMutation({
    mutationFn: async (maNV: string) =>
      api.goi('/cn/phien-tram', { method: 'POST', body: { tramId, maNV, turnstileToken: await layTokenTurnstile() }, schema: zKhoiDong }),
    onSuccess: (kd) => {
      queryClient.setQueryData(KHOA_KHOI_DONG, kd);
      toast(`Đã đăng nhập Trạm ${tramQ.data?.soTram ?? ''}`);
      void navigate(`/nhap?tram=${tramId}`, { replace: true });
    },
    onError: (e) => setErr(e instanceof LoiApi ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = chuanHoaMaNV(nv);
    if (!code) return setErr('Nhập mã nhân viên của bạn.');
    setErr('');
    dangNhap.mutate(code);
  };

  if (tramQ.isError) {
    return (
      <>
        <TopBar title="Đăng nhập trạm" back="/chon-tram" />
        <div className="flex-1 p-4"><p className="rounded-card bg-danger-bg text-danger p-4 text-[15px] flex gap-2" role="alert"><CircleAlert className="w-5 h-5 shrink-0" />{tramQ.error.message}</p></div>
      </>
    );
  }
  const t = tramQ.data;
  const ops = t?.congDoan ?? [];

  return (
    <>
      <TopBar title={t ? `Trạm ${t.soTram} · ${t.maChuyen}` : 'Đăng nhập trạm'} back="/chon-tram" />
      <form onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4" noValidate>
        <section className="rounded-card border border-line bg-surface p-4">
          <div className="text-[13px] text-muted">Công đoạn tại trạm hôm nay</div>
          {tramQ.isPending ? <span className="spin mt-2 block w-5 h-5 rounded-full border-2 border-muted border-t-transparent" /> : ops.length ? (
            <ul className="mt-2 flex flex-col gap-1.5">{ops.map((o) => (
              <li key={o.ma} className="flex items-center gap-2 text-[15px]"><span className="h-6 px-2 rounded-pill bg-group text-[12px] font-semibold inline-flex items-center">{o.maMaHang}</span><span className="font-medium">{o.ten}</span><span className="ml-auto font-mono text-[12px] text-muted">{o.ma}</span></li>))}</ul>
          ) : <p className="mt-1 text-[15px] text-empty-ink">Trạm chưa có công đoạn, liên hệ tổ trưởng.</p>}
        </section>

        {daCo && (
          <section className="rounded-card border border-brand bg-brand-soft p-4 text-brand-ink text-[15px] flex gap-3">
            <UserRound className="w-5 h-5 mt-0.5 shrink-0" />
            <div>Bạn đã đăng nhập trạm này hôm nay. <button type="button" className="font-semibold underline" onClick={() => void navigate(`/nhap?tram=${tramId}`)}>Vào nhập số</button></div>
          </section>
        )}

        <div>
          <label htmlFor="nv" className="block text-[15px] font-medium mb-1.5">Mã nhân viên</label>
          <input id="nv" value={nv} onChange={(e) => { setNv(e.target.value.toUpperCase()); setErr(''); }} autoComplete="off" autoCapitalize="characters" enterKeyHint="go"
            placeholder="VD: NV00127" aria-invalid={!!err} aria-describedby={err ? 'nv-err' : 'nv-hint'}
            className={cn('w-full h-14 px-4 rounded-ctl border-2 bg-surface font-mono text-[22px] font-semibold tracking-wider outline-none placeholder:font-sans placeholder:text-[16px] placeholder:font-normal placeholder:tracking-normal transition-colors duration-fast',
              err ? 'border-danger' : 'border-line-strong focus:border-brand-ink')} />
          {err ? <p id="nv-err" className="text-[14px] text-danger mt-1.5 flex items-center gap-1.5" role="alert"><CircleAlert className="w-4 h-4 shrink-0" />{err}</p>
            : <p id="nv-hint" className="text-[13px] text-muted mt-1.5">{nvMay ? <>Điện thoại này đang dùng mã <b className="font-mono text-ink">{nvMay.maNV}</b> hôm nay.</> : 'Mã NV in trên thẻ nhân viên.'}</p>}
        </div>

        <BigButton type="submit" disabled={dangNhap.isPending || !t} className="w-full mt-auto">
          {dangNhap.isPending ? <span className="spin w-5 h-5 rounded-full border-2 border-current border-t-transparent" /> : <LogIn className="w-5 h-5" />}
          {dangNhap.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </BigButton>
        <p className="text-[13px] text-muted text-center -mt-1">Phiên đăng nhập có hiệu lực cho <b className="text-ink">hôm nay</b>. Một điện thoại = một mã NV / ngày.</p>
      </form>
    </>
  );
}
