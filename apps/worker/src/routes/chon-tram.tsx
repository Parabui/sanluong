/** Chọn trạm (danh sách / quét QR) · F1, F12 — giao diện ui-demo/app/chon-tram */
import { useQuery } from '@tanstack/react-query';
import { zCayTram } from '@vsn/shared';
import { cn } from '@vsn/ui';
import { ChevronRight, ExternalLink, QrCode, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api, KHOA_KHOI_DONG, layKhoiDong } from '../lib/api';
import { laWebview } from '../lib/hooks';
import { BottomNav, TopBar } from '../ui/mobile';
import { QuetQr } from '../ui/quet-qr';

export function ChonTramPage() {
  const navigate = useNavigate();
  const [scan, setScan] = useState(false);
  const cayQ = useQuery({ queryKey: ['cn', 'cay-tram'], queryFn: ({ signal }) => api.goi('/cn/cay-tram', { schema: zCayTram, signal }) });
  const kdQ = useQuery({ queryKey: KHOA_KHOI_DONG, queryFn: layKhoiDong });
  const chuyenDs = cayQ.data?.flatMap((x) => x.chuyen.map((c) => ({ ...c, xuong: x.ten }))) ?? [];
  const [chon, setChon] = useState<string | null>(null);
  const cuaToi = new Set((kdQ.data?.phien ?? []).filter((p) => p.ngayLamViec === kdQ.data?.homNay).map((p) => p.tramId));
  const macDinh = chuyenDs.find((c) => c.tram.some((t) => cuaToi.has(t.id)))?.id ?? chuyenDs.find((c) => c.ma === kdQ.data?.nhanVien?.maChuyen)?.id;
  const line = chuyenDs.find((c) => c.id === (chon ?? macDinh)) ?? chuyenDs[0];
  const wv = laWebview();

  return (
    <>
      <TopBar title="Chọn trạm" back={cuaToi.size ? '/nhap' : undefined} />
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {wv.la && (
          <div className="mx-4 mt-4 rounded-card bg-open-bg text-open-ink p-3 text-[14px] leading-snug flex gap-3">
            <ExternalLink className="w-5 h-5 mt-0.5 shrink-0" />
            <div>Đang mở trong Zalo/Facebook. Nên mở bằng {wv.android ? 'Chrome' : 'Safari'} để giữ đăng nhập ổn định.
              {wv.android && <a className="block font-semibold underline mt-1" href={`intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`}>Mở bằng Chrome</a>}
            </div>
          </div>
        )}
        <div className="p-4">
          <button type="button" onClick={() => setScan(true)} className="w-full rounded-card bg-ink text-ondark p-5 flex items-center gap-4 text-left hover:brightness-110 transition duration-fast">
            <span className="w-14 h-14 rounded-ctl bg-brand text-ink grid place-items-center shrink-0"><QrCode className="w-8 h-8" /></span>
            <span><span className="block text-[18px] font-semibold">Quét QR tại trạm</span><span className="block text-[14px] opacity-80">Nhanh nhất · không chọn nhầm trạm</span></span>
            <ChevronRight className="w-6 h-6 ml-auto opacity-70" />
          </button>
        </div>

        <div className="px-4 flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />hoặc chọn trong danh sách<span className="h-px flex-1 bg-line" /></div>

        {cayQ.isPending ? (
          <div className="py-12 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>
        ) : cayQ.isError ? (
          <p className="p-4 text-[15px] text-danger" role="alert">{cayQ.error.message}</p>
        ) : (
          <>
            <div className="px-4 pt-4">
              <div className="text-[13px] text-muted mb-2">{line?.xuong ?? ''} · Chuyền</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {chuyenDs.map((l) => (
                  <button key={l.id} type="button" onClick={() => setChon(l.id)} aria-pressed={line?.id === l.id}
                    className={cn('h-11 px-4 rounded-pill border text-[15px] shrink-0 transition-colors duration-fast', line?.id === l.id ? 'bg-ink text-surface border-ink font-semibold' : 'bg-surface border-line-strong hover:bg-hover')}>{l.ma}</button>
                ))}
              </div>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              {line?.tram.map((t) => {
                const mine = cuaToi.has(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => void navigate(mine ? `/nhap?tram=${t.id}` : `/dang-nhap/${t.id}`)}
                    className={cn('h-[76px] rounded-card border p-2.5 text-left flex flex-col transition-colors duration-fast', mine ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand active:bg-brand-soft')}>
                    <span className="text-[16px] font-semibold num">Trạm {t.soTram}</span>
                    <span className={cn('mt-auto text-[12px] leading-tight flex items-center gap-1 truncate', mine ? 'text-brand-ink font-semibold' : t.dangCoNguoi ? 'text-muted' : 'text-closed-ink font-medium')}>
                      {mine ? 'Của bạn' : t.dangCoNguoi ? <><UserRound className="w-3.5 h-3.5 shrink-0" />Đang có người</> : 'Trống'}
                    </span>
                  </button>
                );
              })}
              {!chuyenDs.length && <p className="col-span-3 text-[15px] text-muted text-center py-8">Chưa có trạm nào nhập qua app.</p>}
            </div>
          </>
        )}
      </div>
      {kdQ.data?.nhanVien && <BottomNav />}
      <QuetQr open={scan} onClose={() => setScan(false)} onTramId={(id) => { setScan(false); void navigate(`/dang-nhap/${id}`); }} />
    </>
  );
}
