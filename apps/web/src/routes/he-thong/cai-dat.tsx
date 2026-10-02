/**
 * Cài đặt · F6 — giao diện chép từ ui-demo/(web)/he-thong/cai-dat. Hiện làm thẻ "Giờ làm mặc định" (theo xưởng, theo thứ):
 * Quản lý xưởng chỉ sửa xưởng được gắn; đổi giờ chỉ áp dụng từ hôm nay trở đi. Các thẻ Chốt ngày / Dashboard / Phiên TV
 * (chỉ Superadmin) làm cùng F10, F7.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dinhDangNgay, dinhDangSoGio, docSoGio, GIO_MAC_DINH_DE_XUAT, type GioMacDinhXuong, LOAI_NGAY, type LoaiNgay, LOI_SO_GIO, zGioMacDinhXuong,
} from '@vsn/shared';
import { Button, Card, CardHeader, cn, EmptyState, Input, Page, Pill, Select, StatusBar, Toolbar, useToast } from '@vsn/ui';
import { Clock, Save } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { api, thongBaoLoi } from '../../lib/api';
import { useToi } from '../../lib/xac-thuc';

const NHAN: Record<LoaiNgay, string> = { T2_T6: 'Thứ 2 – Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật' };
type BanNhap = Record<LoaiNgay, string>;
const sangChuoi = (g: Record<LoaiNgay, number | null>): BanNhap => ({
  T2_T6: g.T2_T6 == null ? '' : dinhDangSoGio(g.T2_T6), T7: g.T7 == null ? '' : dinhDangSoGio(g.T7), CN: g.CN == null ? '' : dinhDangSoGio(g.CN),
});
const sai = (v: string) => v.trim() !== '' && !((docSoGio(v) ?? 0) > 0 && (docSoGio(v) ?? 0) <= 16);

/** "9 / 8 / trống — từ 01/07/2026" cho từng mốc hiệu lực */
function lichSuGon(x: GioMacDinhXuong): string[] {
  const moc = [...new Set(x.lichSu.map((l) => l.apDungTuNgay))].sort().reverse();
  return moc.slice(0, 3).map((m) => {
    const gio = LOAI_NGAY.map((l) => {
      const d = x.lichSu.filter((h) => h.loaiNgay === l && h.apDungTuNgay <= m).sort((a, b) => b.apDungTuNgay.localeCompare(a.apDungTuNgay))[0];
      return d?.soGio == null ? 'trống' : dinhDangSoGio(d.soGio);
    });
    return `${gio.join(' / ')} — từ ${dinhDangNgay(m)}`;
  });
}

export function CaiDatPage() {
  const toi = useToi();
  const ds = useQuery({ queryKey: ['gio-mac-dinh'], queryFn: ({ signal }) => api.goi('/gio-mac-dinh', { schema: z.array(zGioMacDinhXuong), signal }) });
  const [xuongId, setXuongId] = useState<string | null>(null);
  const x = ds.data?.find((d) => d.xuongId === xuongId) ?? ds.data?.[0];

  return (
    <>
      {!ds.data ? (
        <Page><Toolbar title="Cài đặt" /><div className="flex-1 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div></Page>
      ) : !x ? (
        <Page><Toolbar title="Cài đặt" /><section className="flex-1 bg-surface border border-line rounded-card grid place-items-center"><EmptyState icon={Clock} title="Chưa có xưởng trong phạm vi của bạn" /></section></Page>
      ) : (
        // key: đổi xưởng / dữ liệu mới → khởi tạo lại bản nháp
        <FormGio key={`${x.xuongId}|${x.lichSu.length}|${JSON.stringify(x.hienTai)}`} x={x} ds={ds.data} onChonXuong={setXuongId} laSuperadmin={toi.vaiTro === 'SUPERADMIN'} />
      )}
      <StatusBar right={<span>Mọi thay đổi ghi vào Audit log</span>} />
    </>
  );
}

function FormGio({ x, ds, onChonXuong, laSuperadmin }: { x: GioMacDinhXuong; ds: GioMacDinhXuong[]; onChonXuong: (id: string) => void; laSuperadmin: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  // Xưởng chưa cài → điền giá trị đề xuất 9 / 8 / trống [R 4.3], bấm Lưu để áp dụng
  const [gio, setGio] = useState<BanNhap>(() => sangChuoi(x.chuaCai ? GIO_MAC_DINH_DE_XUAT : x.hienTai));
  const goc = sangChuoi(x.hienTai);
  const dirty = x.chuaCai || LOAI_NGAY.some((l) => docSoGio(gio[l]) !== docSoGio(goc[l]) || (gio[l].trim() === '') !== (goc[l] === ''));
  const coLoi = LOAI_NGAY.some((l) => sai(gio[l]));

  const luu = useMutation({
    mutationFn: () => api.goi('/gio-mac-dinh', {
      method: 'PUT',
      body: { xuongId: x.xuongId, T2_T6: gio.T2_T6.trim() || null, T7: gio.T7.trim() || null, CN: gio.CN.trim() || null },
      schema: zGioMacDinhXuong,
    }),
    onSuccess: () => { toast('Đã lưu cài đặt · áp dụng từ hôm nay'); void queryClient.invalidateQueries({ queryKey: ['gio-mac-dinh'] }); },
    onError: (e) => toast(thongBaoLoi(e), 'warn'),
  });

  return (
    <Page scroll>
      <Toolbar title="Cài đặt" right={<Button variant="primary" icon={Save} disabled={!dirty || coLoi || luu.isPending} onClick={() => luu.mutate()}>Lưu</Button>}>
        {!laSuperadmin && <Pill tone="neutral">Quản lý xưởng — chỉ sửa giờ mặc định của xưởng được gắn</Pill>}
      </Toolbar>

      <div className="grid grid-cols-2 gap-4 items-start">
        <Card>
          <CardHeader icon={Clock} title="Giờ làm mặc định" sub="theo xưởng, theo thứ trong tuần" right={
            <Select label="Xưởng" className="w-36" value={x.xuongId} onChange={(e) => onChonXuong(e.target.value)}>
              {ds.map((d) => <option key={d.xuongId} value={d.xuongId}>{d.tenXuong}</option>)}
            </Select>} />
          <div className="p-4 flex flex-col gap-3">
            {LOAI_NGAY.map((k) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-body font-medium">{NHAN[k]}</span>
                <Input value={gio[k]} onChange={(e) => setGio({ ...gio, [k]: e.target.value })} inputMode="decimal" placeholder="Trống" aria-label={`Giờ mặc định ${NHAN[k]}`}
                  aria-invalid={sai(gio[k])} className={cn('w-28 text-right num', sai(gio[k]) && 'border-danger')} />
                <span className="text-chip text-muted">giờ</span>
                {sai(gio[k]) && <span className="text-sub text-danger">{LOI_SO_GIO.replace('Số giờ phải ', 'Trong khoảng ').replace('lớn hơn 0 và không quá 16.', '> 0 và ≤ 16')}</span>}
                {k === 'CN' && !gio.CN.trim() && <span className="text-sub text-muted">Có sản lượng mà không có giờ → % hiệu suất “—”</span>}
              </div>
            ))}
            {x.chuaCai ? (
              <div className="rounded-ctl bg-warn-bg text-warn-ink px-3 py-2 text-sub">Xưởng chưa cài giờ mặc định — đang điền giá trị đề xuất. Bấm <b>Lưu</b> để áp dụng từ hôm nay.</div>
            ) : (
              <div className="rounded-ctl bg-thead border border-line px-3 py-2 text-sub text-muted">
                Đổi giờ mặc định chỉ áp dụng từ ngày thay đổi trở đi. Lịch sử: {lichSuGon(x).join(' · ')}.
              </div>
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}
