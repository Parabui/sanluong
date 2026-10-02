/**
 * Của tôi · F11 — giao diện chép từ ui-demo/app/cua-toi và cua-toi/[ngay]:
 * 30 ngày gần nhất có sản lượng (tổng, % TB ngày đã chốt) → chi tiết ngày theo trạm, ô điều chỉnh kèm số cũ / lý do / người.
 * Số lấy từ cùng view với Báo cáo theo công nhân (F5) → khớp 100%.
 */
import { useQuery } from '@tanstack/react-query';
import { dinhDangGio, dinhDangNgay, dinhDangSo, dinhDangSoGio, homNay as ngayVN, type NgayCuaToi, thuIso, type TrangThaiSoLieu, zCuaToi, zCuaToiNgay } from '@vsn/shared';
import { cn } from '@vsn/ui';
import { CalendarX, Clock, Lock, Pencil, Plus, ScanLine } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, KHOA_KHOI_DONG, layKhoiDong } from '../lib/api';
import { BigButton, BottomNav, TopBar, WorkerBar } from '../ui/mobile';

const ST: Record<TrangThaiSoLieu, readonly [string, string]> = {
  CHUA_CHOT: ['Chưa chốt', 'bg-open-bg text-open-ink'],
  DA_CHOT: ['Đã chốt', 'bg-closed-bg text-closed-ink'],
  DA_KHOA: ['Đã khóa', 'bg-locked-bg text-locked-ink'],
};
const thu = (d: string) => { const t = thuIso(d); return t === 7 ? 'Chủ nhật' : `Thứ ${t + 1}`; };
const ddmm = (d: string) => dinhDangNgay(d).slice(0, 5);
const pct = (d: NgayCuaToi) => (d.hieuSuat == null ? '—' : `${dinhDangSo(d.hieuSuat)}%`);
const xoay = <span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" />;

export function CuaToiPage() {
  const navigate = useNavigate();
  const kdQ = useQuery({ queryKey: KHOA_KHOI_DONG, queryFn: layKhoiDong });
  const q = useQuery({ queryKey: ['cn', 'cua-toi'], queryFn: ({ signal }) => api.goi('/cn/cua-toi', { schema: zCuaToi, signal }) });
  const ds = q.data?.ngay ?? [];
  const daChot = ds.filter((d) => d.trangThai !== 'CHUA_CHOT' && d.hieuSuat != null);
  const tb = daChot.length ? daChot.reduce((a, d) => a + d.hieuSuat!, 0) / daChot.length : null;
  const tong = ds.reduce((a, d) => a + d.sanLuong, 0);
  const homNay = kdQ.data?.homNay;

  return (
    <>
      <WorkerBar nhanVien={kdQ.data?.nhanVien ?? null} />
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {q.isPending ? <div className="py-16 grid place-items-center text-muted" role="status">{xoay}</div>
          : q.isError ? <p className="m-4 rounded-card bg-danger-bg text-danger p-4 text-[15px]" role="alert">{q.error.message}</p>
            : !q.data.nhanVien ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <ScanLine className="w-12 h-12 text-muted" /><p className="text-[17px] font-semibold">Chưa đăng nhập trạm nào</p>
                <p className="text-[14px] text-muted max-w-[260px]">Đăng nhập trạm để xem sản lượng của bạn.</p>
                <BigButton onClick={() => void navigate('/chon-tram')}><Plus className="w-5 h-5" />Thêm trạm</BigButton>
              </div>
            ) : (
              <>
                <div className="p-4">
                  <section className="rounded-card bg-ink text-ondark p-4">
                    <div className="text-[13px] opacity-80">30 ngày gần nhất · {ds.length} ngày có sản lượng</div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div><div className="text-[13px] opacity-80">Tổng sản lượng</div><div className="text-[28px] leading-9 font-bold num">{dinhDangSo(tong)}</div></div>
                      <div><div className="text-[13px] opacity-80">% hiệu suất TB · ngày chốt</div><div className="text-[28px] leading-9 font-bold num">{tb == null ? '—' : `${dinhDangSo(tb)}%`}</div></div>
                    </div>
                  </section>
                  <p className="text-[13px] text-muted mt-3">Chỉ bạn xem được số của mình. Thấy sai? Báo tổ trưởng trước khi khóa sổ.</p>
                </div>
                {ds.length ? (
                  <ul className="px-4 pb-4 flex flex-col gap-2">
                    {ds.map((d) => {
                      const today = d.ngay === homNay;
                      return (
                        <li key={d.ngay}>
                          <Link to={`/cua-toi/${d.ngay}`} className="rounded-card border border-line bg-surface py-3 pl-2.5 pr-3 flex items-center gap-2.5 hover:border-line-strong active:bg-hover transition-colors duration-fast">
                            <span className="w-10 text-center leading-none shrink-0">
                              <span className="block text-[12px] text-muted font-semibold uppercase">{thu(d.ngay).replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</span>
                              <span className="block text-[20px] font-semibold num mt-1">{d.ngay.slice(8)}</span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5"><b className="text-[18px] num">{dinhDangSo(d.sanLuong)}</b><span className="text-[13px] text-muted">sp</span>
                                {d.coDieuChinh && <Pencil className="w-3.5 h-3.5 text-adjust-ink self-center" aria-label="Có ô tổ trưởng điều chỉnh" />}</div>
                              <div className="text-[13px] text-muted num whitespace-nowrap">{d.phutSmv == null ? '—' : dinhDangSo(d.phutSmv, 0)} phút SMV · {d.gioLam != null ? `${dinhDangSoGio(d.gioLam)}h` : '—'}</div>
                              {(d.gioChoDuyet || today || d.tamTinh || d.gioLam == null) && (
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {(today || d.tamTinh) && <span className="h-6 px-2 rounded-pill bg-group text-[12px] font-semibold inline-flex items-center whitespace-nowrap">Tạm tính</span>}
                                  {d.gioChoDuyet && <span className="h-6 px-2 rounded-pill bg-empty-bg text-empty-ink text-[12px] font-semibold inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Giờ chờ duyệt</span>}
                                  {d.gioLam == null && <span className="h-6 px-2 rounded-pill bg-empty-bg text-empty-ink text-[12px] font-semibold inline-flex items-center whitespace-nowrap">Chưa có giờ làm</span>}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[18px] font-semibold num">{pct(d)}</div>
                              <span className={cn('mt-1 h-6 px-2 rounded-pill text-[12px] font-semibold inline-flex items-center gap-1', ST[d.trangThai][1])}>{d.trangThai === 'DA_KHOA' && <Lock className="w-3 h-3" />}{ST[d.trangThai][0]}</span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="mx-4 rounded-card border border-line bg-surface px-4 py-8 text-center text-[15px] text-muted">Chưa có sản lượng trong 30 ngày gần nhất.</p>}
                <p className="text-[13px] text-muted text-center pb-4">Ngày không có sản lượng không hiển thị · {ddmm(q.data.tu)} – {ddmm(q.data.den)}</p>
              </>
            )}
      </main>
      <BottomNav />
    </>
  );
}

export function CuaToiNgayPage() {
  const { ngay = '' } = useParams();
  const q = useQuery({ queryKey: ['cn', 'cua-toi', ngay], queryFn: ({ signal }) => api.goi(`/cn/cua-toi/${ngay}`, { schema: zCuaToiNgay, signal }), retry: false });
  const d = q.data;
  const tieuDe = /^\d{4}-\d{2}-\d{2}$/.test(ngay) ? `${thu(ngay)}, ${dinhDangNgay(ngay)}` : 'Chi tiết ngày';

  if (q.isPending) return <><TopBar title={tieuDe} back="/cua-toi" /><div className="flex-1 grid place-items-center text-muted" role="status">{xoay}</div><BottomNav /></>;
  if (!d) return (
    <>
      <TopBar title={tieuDe} back="/cua-toi" />
      <div className="flex-1 grid place-items-center text-center px-8"><div><CalendarX className="w-12 h-12 text-muted mx-auto" /><p className="text-[17px] font-semibold mt-3">{q.error?.message ?? 'Không có sản lượng ngày này'}</p></div></div>
      <BottomNav />
    </>
  );

  return (
    <>
      <TopBar title={tieuDe} back="/cua-toi" />
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3">
        <section className="rounded-card border border-line bg-surface p-4 grid grid-cols-2 gap-y-3 gap-x-4">
          <div><div className="text-[13px] text-muted">Sản lượng</div><div className="text-[22px] font-bold num">{dinhDangSo(d.sanLuong)}</div></div>
          <div><div className="text-[13px] text-muted">% hiệu suất</div><div className="text-[22px] font-bold num">{pct(d)}</div></div>
          <div><div className="text-[13px] text-muted">Phút SMV</div><div className="text-[17px] font-semibold num">{d.phutSmv == null ? '—' : dinhDangSo(d.phutSmv, 0)}</div></div>
          <div><div className="text-[13px] text-muted">Giờ làm</div><div className="text-[17px] font-semibold num">{dinhDangSoGio(d.gioLam)}</div></div>
          <div className="col-span-2 flex flex-wrap gap-1.5">
            <span className={cn('h-7 px-2.5 rounded-pill text-[13px] font-semibold inline-flex items-center gap-1', ST[d.trangThai][1])}>
              {d.trangThai === 'DA_KHOA' && <Lock className="w-3.5 h-3.5" />}{ST[d.trangThai][0]}
            </span>
            {d.gioChoDuyet && <span className="h-7 px-2.5 rounded-pill bg-empty-bg text-empty-ink text-[13px] font-semibold inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Giờ làm chờ duyệt · % tạm tính</span>}
            {d.gioLam == null && <span className="h-7 px-2.5 rounded-pill bg-empty-bg text-empty-ink text-[13px] font-semibold inline-flex items-center">Chưa có giờ làm</span>}
          </div>
        </section>

        {d.tram.map((t) => (
          <section key={t.tramId} className="rounded-card border border-line bg-surface overflow-hidden">
            <div className="px-4 h-11 flex items-center bg-thead border-b border-line text-[14px] font-semibold">Trạm {t.soTram} · {t.maChuyen}</div>
            <ul>
              {t.dong.map((i, idx) => (
                <li key={i.congDoanId} className={cn('px-4 py-3', idx > 0 && 'border-t border-line')}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-muted">{i.ma}</span><span className="text-[16px] font-medium">{i.ten}</span>
                    <b className="ml-auto text-[18px] num flex items-center gap-1.5">{i.dieuChinh && <Pencil className="w-4 h-4 text-adjust-ink" />}{dinhDangSo(i.soLuong)}</b>
                  </div>
                  {i.dieuChinh && (
                    <div className="mt-2 rounded-ctl bg-adjust-bg text-adjust-ink px-3 py-2 text-[14px] leading-snug">
                      <div className="font-semibold">{i.dieuChinh.soCu == null ? `Tổ trưởng nhập hộ: ${dinhDangSo(i.soLuong)}` : `Tổ trưởng đã điều chỉnh: ${dinhDangSo(i.dieuChinh.soCu)} → ${dinhDangSo(i.soLuong)}`}</div>
                      <div>{i.dieuChinh.lyDo ?? '—'} · {i.dieuChinh.boi} · {dinhDangGio(i.dieuChinh.luc)} {ddmm(ngayVN(new Date(i.dieuChinh.luc)))}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-[13px] text-muted text-center">Số liệu khớp 100% với báo cáo của công ty · sai số → báo tổ trưởng</p>
      </main>
      <BottomNav />
    </>
  );
}
