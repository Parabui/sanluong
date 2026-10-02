/**
 * Sơ đồ trạm trực tiếp · F17 [D26] — giao diện chép từ ui-demo/(web)/san-xuat/so-do-tram
 * (lưới trạm: NV đang đăng nhập, đã nhập / chưa nhập hôm nay, trống · drawer trạm + Đăng xuất hộ có lý do).
 * Cập nhật mỗi 5 giây (useDuLieuTrucTiep) [R 5.11]. NV chưa có số → server cảnh báo, tổ trưởng xác nhận lần nữa mới đăng xuất.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dinhDangGio, LoiApi, LY_DO_DANG_XUAT_HO, type TramTrucTiep, zChuyen, zSoDoTram } from '@vsn/shared';
import { Button, cn, Drawer, EmptyState, Page, Pill, ReasonChips, Select, StatusBar, Toolbar, useToast } from '@vsn/ui';
import { CircleCheck, CircleDashed, LogOut, Radio, Smartphone, TriangleAlert, UserRound, UserX } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { api, thongBaoLoi } from '../../lib/api';
import { useDuLieuTrucTiep } from '../../lib/truc-tiep';
import { useShell } from '../../shell/shell-context';

const zKhongNoiDung = z.undefined();

export function SoDoTramPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { q } = useShell();
  const chuyenQ = useQuery({ queryKey: ['chuyen', 'tat-ca'], queryFn: ({ signal }) => api.goi('/chuyen', { schema: z.array(zChuyen), signal }) });
  const lines = (chuyenQ.data ?? []).filter((c) => c.loai === 'CHUYEN_MAY' && c.trangThai === 'HOAT_DONG');
  const [chon, setChon] = useState<string | null>(null);
  const line = lines.find((l) => l.id === chon) ?? lines[0];
  const sdQ = useDuLieuTrucTiep(['so-do-tram', line?.id], `/so-do-tram?chuyenId=${line?.id}`, zSoDoTram, { chuKyGiay: 5, enabled: !!line });
  const tram = sdQ.data?.tram ?? [];

  const [selId, setSelId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [canhBao, setCanhBao] = useState<string | null>(null);
  const sel = tram.find((t) => t.id === selId);
  const o = sel?.phien ?? null;

  const moTram = (t: TramTrucTiep) => { setSelId(t.id); setReason(''); setNote(''); setErr(''); setCanhBao(null); };
  const dangXuat = useMutation({
    mutationFn: (xacNhan: boolean) => api.goi('/so-do-tram/dang-xuat-ho', {
      method: 'POST', body: { phienId: o!.id, lyDo: reason === 'Khác' ? note.trim() : reason, xacNhan }, schema: zKhongNoiDung,
    }),
    onSuccess: () => {
      toast(`Đã đăng xuất ${o!.nhanVien.hoTen} khỏi Trạm ${sel!.soTram}`);
      setSelId(null);
      void queryClient.invalidateQueries({ queryKey: ['so-do-tram'] });
    },
    onError: (e) => {
      if (e instanceof LoiApi && e.code === 'CAN_XAC_NHAN') return setCanhBao(e.message);
      setErr(thongBaoLoi(e));
      void queryClient.invalidateQueries({ queryKey: ['so-do-tram'] });
    },
  });
  const bamDangXuat = () => {
    if (!reason) return setErr('Vui lòng chọn lý do đăng xuất hộ.');
    if (reason === 'Khác' && !note.trim()) return setErr('Vui lòng nhập ghi chú khi chọn “Khác”.');
    dangXuat.mutate(!!canhBao);
  };

  const inCount = tram.filter((t) => t.phien).length;
  const entered = tram.filter((t) => t.phien?.daNhap.length).length;
  const s = q.trim().toLowerCase();

  if (chuyenQ.isSuccess && !lines.length) {
    return <Page><Toolbar title="Sơ đồ trạm trực tiếp" /><section className="flex-1 bg-surface border border-line rounded-card grid place-items-center"><EmptyState icon={Radio} title="Chưa có chuyền may trong phạm vi của bạn" /></section></Page>;
  }

  return (
    <>
      <Page>
        <Toolbar title="Sơ đồ trạm trực tiếp" right={<span className="flex items-center gap-1.5 text-chip text-muted"><span className={cn('w-2 h-2 rounded-full', sdQ.isError ? 'bg-danger' : 'live-dot bg-success')} />{sdQ.isError ? 'Mất kết nối — đang thử lại' : 'Trực tiếp · cập nhật ≤ 10 giây'}</span>}>
          <Select label="Chuyền" value={line?.id ?? ''} onChange={(e) => setChon(e.target.value)} className="w-40">
            {lines.map((l) => <option key={l.id} value={l.id}>{l.ma} · {l.ten}</option>)}
          </Select>
          {sdQ.data && (
            <div className="flex items-center gap-2 ml-2">
              <Pill tone="closed" icon={UserRound}>{inCount} đang đăng nhập</Pill>
              <Pill tone="neutral">{tram.length - inCount} trống</Pill>
              <Pill tone="empty" icon={CircleDashed}>{inCount - entered} chưa nhập hôm nay</Pill>
            </div>
          )}
        </Toolbar>

        {!sdQ.data ? (
          <div className="flex-1 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div>
        ) : !tram.length ? (
          <section className="flex-1 bg-surface border border-line rounded-card grid place-items-center"><EmptyState icon={UserX} title="Chuyền chưa có trạm nhập qua app" /></section>
        ) : (
          <section className="flex-1 min-h-0 grid grid-cols-6 auto-rows-fr gap-3 overflow-auto">
            {tram.map((t) => {
              const x = t.phien;
              const daNhap = !!x?.daNhap.length;
              const hit = !s || `trạm ${t.soTram} ${x?.nhanVien.maNV ?? ''} ${x?.nhanVien.hoTen ?? ''}`.toLowerCase().includes(s);
              return (
                <button key={t.id} type="button" onClick={() => moTram(t)}
                  className={cn('text-left bg-surface border rounded-card p-3 flex flex-col gap-2 min-h-[120px] hover:shadow-pop hover:border-line-strong transition duration-fast',
                    x ? (daNhap ? 'border-line' : 'border-empty-bar/50') : 'border-dashed border-line-strong bg-thead', !hit && 'opacity-30')}>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-h font-semibold num">Trạm {t.soTram}</span>
                    {x && <span className={cn('ml-auto w-2 h-2 rounded-full', daNhap ? 'bg-success' : 'bg-empty-bar')} aria-hidden="true" />}
                  </div>
                  {x ? (
                    <>
                      <div className="min-w-0">
                        <div className="text-body font-medium truncate">{x.nhanVien.hoTen}</div>
                        <div className="text-sub text-muted"><span className="font-mono">{x.nhanVien.maNV}</span> · từ {dinhDangGio(x.dangNhapLuc)}</div>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        {daNhap ? <Pill size="sm" tone="closed" icon={CircleCheck}>Đã nhập</Pill> : <Pill size="sm" tone="empty">Chưa nhập</Pill>}
                        <span className="text-tag text-muted truncate">{t.congDoan.map((c) => c.ma).join(', ')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted text-chip gap-1"><UserX className="w-5 h-5" />Trống</div>
                  )}
                </button>
              );
            })}
          </section>
        )}
      </Page>
      <StatusBar right={<span>Tự cập nhật mỗi 5 giây{sdQ.dataUpdatedAt ? ` · ${dinhDangGio(new Date(sdQ.dataUpdatedAt))}` : ''}</span>}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" />Đã nhập hôm nay</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-empty-bar" />Đăng nhập nhưng chưa nhập</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-line-strong" />Trống</span>
      </StatusBar>

      <Drawer open={!!sel} onClose={() => setSelId(null)} title={`Trạm ${sel?.soTram ?? ''} · ${line?.ma ?? ''}`}
        footer={o ? <><Button onClick={() => setSelId(null)}>Đóng</Button><Button variant="danger" icon={LogOut} disabled={dangXuat.isPending} onClick={bamDangXuat}>{canhBao ? 'Vẫn đăng xuất hộ' : 'Đăng xuất hộ'}</Button></> : undefined}>
        {sel && o ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-card border border-line bg-thead p-3 flex gap-3">
              <span className="w-10 h-10 rounded-full bg-brand-soft text-brand-ink grid place-items-center font-semibold">{o.nhanVien.hoTen.split(' ').slice(-1)[0]?.[0]}</span>
              <div className="text-chip leading-relaxed">
                <div className="text-body font-semibold">{o.nhanVien.hoTen}</div>
                <div className="text-muted"><span className="font-mono">{o.nhanVien.maNV}</span> · đăng nhập {dinhDangGio(o.dangNhapLuc)}</div>
                {o.thietBi && <div className="text-muted flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" />{o.thietBi}</div>}
              </div>
            </div>
            <div>
              <h3 className="text-chip font-semibold mb-2">Công đoạn tại trạm hôm nay</h3>
              <ul className="flex flex-col gap-1.5">{sel.congDoan.map((op) => (
                <li key={op.id} className="flex items-center gap-2 text-chip"><span className="font-mono text-tag">{op.ma}</span>{op.ten}
                  <span className="ml-auto">{o.daNhap.includes(op.id) ? <Pill size="sm" tone="closed">Đã nhập</Pill> : <Pill size="sm" tone="empty">Chưa nhập</Pill>}</span></li>))}</ul>
            </div>
            <div className="h-px bg-line" />
            <div>
              <ReasonChips name="lo-reason" reasons={LY_DO_DANG_XUAT_HO} value={reason} onChange={(v) => { setReason(v); setErr(''); }} />
              {reason === 'Khác' && <textarea rows={2} value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} placeholder="Mô tả ngắn lý do…" aria-label="Ghi chú lý do"
                className="mt-2 w-full px-3 py-2 rounded-ctl border border-line-strong bg-surface text-body resize-none outline-none focus:border-brand-ink" />}
              {err && <p className="text-sub text-danger mt-1.5" role="alert">{err}</p>}
              {canhBao && (
                <div className="mt-3 px-3 py-2 rounded-ctl bg-warn-bg text-warn-ink text-chip flex gap-2" role="alert">
                  <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /><span>{canhBao} Bấm <b>Vẫn đăng xuất hộ</b> để tiếp tục — sau đó nhập hộ ở Bảng sản lượng ngày.</span>
                </div>
              )}
              <p className="text-sub text-muted mt-3">Công nhân thấy thông báo ở lần mở app kế tiếp, hoặc ngay khi bấm Lưu. Bản ghi offline (nếu có) vẫn được tính cho người đã nhập.</p>
            </div>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center gap-2 text-muted text-chip"><UserX className="w-8 h-8" />Trạm đang trống. Công nhân quét QR tại trạm để đăng nhập.</div>
        )}
      </Drawer>
    </>
  );
}
