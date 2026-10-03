/**
 * Cài đặt · F6, F8 — giao diện chép từ ui-demo/(web)/he-thong/cai-dat:
 * - Giờ làm mặc định (theo xưởng × thứ) — Superadmin, Quản lý xưởng (xưởng được gắn); đổi giờ chỉ áp dụng từ hôm nay.
 * - Chốt ngày (giờ mở chốt) · Dashboard (chu kỳ làm mới) · Phiên TV (thu hồi, IP nhà máy [D24]) — chỉ Superadmin.
 * Một nút Lưu trên toolbar lưu mọi thẻ có thay đổi.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type CaiDatHeThong, dinhDangGio, dinhDangNgay, dinhDangSoGio, docSoGio, GIO_MAC_DINH_DE_XUAT, type GioMacDinhXuong, homNay as ngayVN,
  LOAI_NGAY, type LoaiNgay, LOI_SO_GIO, NGUONG_HIEU_SUAT_CAO, zCaiDatHeThong, zGioMacDinhXuong,
} from '@vsn/shared';
import { Button, Card, CardHeader, cn, EmptyState, Field, Input, Page, Pill, Select, StatusBar, Toolbar, useToast } from '@vsn/ui';
import { CalendarClock, Clock, LayoutDashboard, Save, Tv } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { api, thongBaoLoi } from '../../lib/api';
import { coChucNang, useToi } from '../../lib/xac-thuc';

const NHAN: Record<LoaiNgay, string> = { T2_T6: 'Thứ 2 – Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật' };
type BanGio = Record<LoaiNgay, string>;
const sangChuoi = (g: Record<LoaiNgay, number | null>): BanGio => ({
  T2_T6: g.T2_T6 == null ? '' : dinhDangSoGio(g.T2_T6), T7: g.T7 == null ? '' : dinhDangSoGio(g.T7), CN: g.CN == null ? '' : dinhDangSoGio(g.CN),
});
const saiGio = (v: string) => v.trim() !== '' && !((docSoGio(v) ?? 0) > 0 && (docSoGio(v) ?? 0) <= 16);
const khacGio = (a: BanGio, b: BanGio) => LOAI_NGAY.some((l) => docSoGio(a[l]) !== docSoGio(b[l]) || (a[l].trim() === '') !== (b[l].trim() === ''));
const IPV4 = /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$/;
const docIp = (s: string) => s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

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

type BanHeThong = { gioMoChotNgay: string; chuKy: string; ip: string };
const sangBanHeThong = (c: CaiDatHeThong['cauHinh']): BanHeThong => ({ gioMoChotNgay: c.gioMoChotNgay, chuKy: String(c.chuKyLamMoiDashboard), ip: c.ipNhaMay.join(', ') });

export function CaiDatPage() {
  const toi = useToi();
  const laSa = coChucNang(toi, 'CAU_HINH');
  const coGio = coChucNang(toi, 'GIO_MAC_DINH_CAI');
  const gioQ = useQuery({ queryKey: ['gio-mac-dinh'], queryFn: ({ signal }) => api.goi('/gio-mac-dinh', { schema: z.array(zGioMacDinhXuong), signal }), enabled: coGio });
  const htQ = useQuery({ queryKey: ['cau-hinh'], queryFn: ({ signal }) => api.goi('/cau-hinh', { schema: zCaiDatHeThong, signal }), enabled: laSa });
  const [xuongId, setXuongId] = useState<string | null>(null);
  const x = gioQ.data?.find((d) => d.xuongId === xuongId) ?? gioQ.data?.[0];

  if ((coGio && !gioQ.data) || (laSa && !htQ.data)) {
    return <><Page><Toolbar title="Cài đặt" /><div className="flex-1 grid place-items-center text-muted" role="status"><span className="spin w-6 h-6 rounded-full border-2 border-current border-t-transparent" /></div></Page><StatusBar /></>;
  }
  // key: đổi xưởng / dữ liệu mới → khởi tạo lại bản nháp
  return (
    <FormCaiDat key={`${x?.xuongId}|${x?.lichSu.length}|${JSON.stringify(x?.hienTai)}|${JSON.stringify(htQ.data?.cauHinh)}`}
      x={x} dsXuong={gioQ.data ?? []} onChonXuong={setXuongId} ht={htQ.data ?? null} laSa={laSa} coGio={coGio} />
  );
}

function FormCaiDat({ x, dsXuong, onChonXuong, ht, laSa, coGio }: {
  x: GioMacDinhXuong | undefined; dsXuong: GioMacDinhXuong[]; onChonXuong: (id: string) => void; ht: CaiDatHeThong | null; laSa: boolean; coGio: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  // Xưởng chưa cài → điền giá trị đề xuất 9 / 8 / trống [R 4.3], bấm Lưu để áp dụng
  const gocGio = x ? sangChuoi(x.hienTai) : null;
  const [gio, setGio] = useState<BanGio | null>(() => (x ? sangChuoi(x.chuaCai ? GIO_MAC_DINH_DE_XUAT : x.hienTai) : null));
  const gocHt = ht ? sangBanHeThong(ht.cauHinh) : null;
  const [bht, setBht] = useState<BanHeThong | null>(gocHt);

  const doiGio = !!x && !!gio && (x.chuaCai || khacGio(gio, gocGio!));
  const doiHt = !!bht && !!gocHt && JSON.stringify({ ...bht, ip: docIp(bht.ip) }) !== JSON.stringify({ ...gocHt, ip: docIp(gocHt.ip) });
  const loiChuKy = bht && !/^\d+$/.test(bht.chuKy.trim()) || (bht && (Number(bht.chuKy) < 1 || Number(bht.chuKy) > 60)) ? 'Từ 1 đến 60 phút.' : null;
  const loiIp = bht && docIp(bht.ip).some((i) => !IPV4.test(i)) ? 'Địa chỉ IP không hợp lệ (VD: 203.0.113.7).' : null;
  const coLoi = (!!gio && LOAI_NGAY.some((l) => saiGio(gio[l]))) || !!loiChuKy || !!loiIp || (!!bht && !bht.gioMoChotNgay);

  const luu = useMutation({
    mutationFn: async () => {
      if (doiGio) {
        await api.goi('/gio-mac-dinh', {
          method: 'PUT', body: { xuongId: x!.xuongId, T2_T6: gio!.T2_T6.trim() || null, T7: gio!.T7.trim() || null, CN: gio!.CN.trim() || null }, schema: zGioMacDinhXuong,
        });
      }
      if (doiHt) {
        await api.goi('/cau-hinh', {
          method: 'PUT', body: { gioMoChotNgay: bht!.gioMoChotNgay, chuKyLamMoiDashboard: Number(bht!.chuKy), ipNhaMay: docIp(bht!.ip) }, schema: zCaiDatHeThong,
        });
      }
    },
    onSuccess: () => {
      toast(doiGio ? 'Đã lưu cài đặt · giờ mặc định áp dụng từ hôm nay' : 'Đã lưu cài đặt');
      void queryClient.invalidateQueries({ queryKey: ['gio-mac-dinh'] });
      void queryClient.invalidateQueries({ queryKey: ['cau-hinh'] });
    },
    onError: (e) => toast(thongBaoLoi(e), 'warn'),
  });
  const thuHoi = useMutation({
    mutationFn: (taiKhoanId: string) => api.goi(`/tai-khoan/${taiKhoanId}/thu-hoi-phien`, { method: 'POST', schema: z.object({ soPhien: z.number() }) }),
    onSuccess: (kq) => { toast(`Đã thu hồi ${kq.soPhien} phiên TV · bắt buộc đăng nhập lại`); void queryClient.invalidateQueries({ queryKey: ['cau-hinh'] }); },
    onError: (e) => toast(thongBaoLoi(e), 'warn'),
  });

  return (
    <>
      <Page scroll>
        <Toolbar title="Cài đặt" right={<Button variant="primary" icon={Save} disabled={(!doiGio && !doiHt) || coLoi || luu.isPending} onClick={() => luu.mutate()}>Lưu</Button>}>
          {!laSa && <Pill tone="neutral">Quản lý xưởng — chỉ sửa giờ mặc định của xưởng được gắn</Pill>}
        </Toolbar>

        <div className="grid grid-cols-2 gap-4 items-start">
          {coGio && (x && gio ? (
            <Card>
              <CardHeader icon={Clock} title="Giờ làm mặc định" sub="theo xưởng, theo thứ trong tuần" right={
                <Select label="Xưởng" className="w-36" value={x.xuongId} onChange={(e) => onChonXuong(e.target.value)}>
                  {dsXuong.map((d) => <option key={d.xuongId} value={d.xuongId}>{d.tenXuong}</option>)}
                </Select>} />
              <div className="p-4 flex flex-col gap-3">
                {LOAI_NGAY.map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-body font-medium">{NHAN[k]}</span>
                    <Input value={gio[k]} onChange={(e) => setGio({ ...gio, [k]: e.target.value })} inputMode="decimal" placeholder="Trống" aria-label={`Giờ mặc định ${NHAN[k]}`}
                      aria-invalid={saiGio(gio[k])} className={cn('w-28 text-right num', saiGio(gio[k]) && 'border-danger')} />
                    <span className="text-chip text-muted">giờ</span>
                    {saiGio(gio[k]) && <span className="text-sub text-danger">{LOI_SO_GIO}</span>}
                    {k === 'CN' && !gio.CN.trim() && <span className="text-sub text-muted">Có sản lượng mà không có giờ → % hiệu suất “—”</span>}
                  </div>
                ))}
                {x.chuaCai ? (
                  <div className="rounded-ctl bg-warn-bg text-warn-ink px-3 py-2 text-sub">Xưởng chưa cài giờ mặc định — đang điền giá trị đề xuất. Bấm <b>Lưu</b> để áp dụng từ hôm nay.</div>
                ) : (
                  <div className="rounded-ctl bg-thead border border-line px-3 py-2 text-sub text-muted">Đổi giờ mặc định chỉ áp dụng từ ngày thay đổi trở đi. Lịch sử: {lichSuGon(x).join(' · ')}.</div>
                )}
              </div>
            </Card>
          ) : <Card><EmptyState icon={Clock} title="Chưa có xưởng trong phạm vi của bạn" /></Card>)}

          {laSa && bht && ht && (<>
            <Card>
              <CardHeader icon={CalendarClock} title="Chốt ngày" sub="dùng chung cho F10 và F13" />
              <div className="p-4 flex flex-col gap-4">
                <Field label="Giờ mở chốt ngày" hint="Từ mốc này tổ trưởng được chốt ngày hôm trước và trang chủ bắt đầu cảnh báo trạm chưa nhập">
                  <Input type="time" value={bht.gioMoChotNgay} onChange={(e) => setBht({ ...bht, gioMoChotNgay: e.target.value })} className="w-32 num" aria-label="Giờ mở chốt ngày" />
                </Field>
                <Field label="Số ngày mở nhập lùi" hint="Hôm nay + ngày làm việc liền trước chưa chốt">
                  <Input value={ht.cauHinh.soNgayNhapLui} disabled className="w-20 num text-right disabled:bg-disabled-bg" aria-label="Số ngày mở nhập lùi" />
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader icon={LayoutDashboard} title="Dashboard" />
              <div className="p-4 flex flex-col gap-4">
                <Field label="Chu kỳ tự làm mới" hint="1 – 60 phút" error={loiChuKy ?? undefined}>
                  <div className="flex items-center gap-2"><Input value={bht.chuKy} onChange={(e) => setBht({ ...bht, chuKy: e.target.value })} inputMode="numeric" className={cn('w-20 num text-right', loiChuKy && 'border-danger')} aria-label="Chu kỳ tự làm mới" /><span className="text-chip text-muted">phút</span></div>
                </Field>
                <Field label="Ngưỡng cảnh báo % hiệu suất" hint="Tô màu cảnh báo khi vượt">
                  <div className="flex items-center gap-2"><Input value={NGUONG_HIEU_SUAT_CAO} disabled className="w-20 num text-right disabled:bg-disabled-bg" aria-label="Ngưỡng cảnh báo" /><span className="text-chip text-muted">%</span></div>
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader icon={Tv} title="Phiên TV" sub="không hết hạn · thu hồi được" />
              {ht.phienTv.length ? (
                <ul className="p-2">
                  {ht.phienTv.map((p) => (
                    <li key={p.taiKhoanId} className="h-12 px-2 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-group grid place-items-center"><Tv className="w-4 h-4 text-muted" /></span>
                      <div className="min-w-0"><div className="text-body font-medium truncate">{p.hoTen}</div>
                        <div className="text-sub text-muted">{p.soPhien ? `${p.soPhien} phiên · hoạt động lúc ${dinhDangGio(p.lanCuoi!)} ${dinhDangNgay(ngayVN(new Date(p.lanCuoi!))).slice(0, 5)}` : 'Chưa đăng nhập'}</div></div>
                      <Button size="sm" className="ml-auto" disabled={!p.soPhien || thuHoi.isPending} onClick={() => thuHoi.mutate(p.taiKhoanId)}>Thu hồi</Button>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-4 py-3 text-sub text-muted">Chưa có tài khoản TV (tạo ở Tài khoản & phân quyền).</p>}
              <div className="px-4 pb-4">
                <Field label="IP nhà máy" hint="Phiên TV chỉ hợp lệ khi truy cập từ các IP này; cách nhau bằng dấu phẩy" error={loiIp ?? undefined}>
                  <Input value={bht.ip} onChange={(e) => setBht({ ...bht, ip: e.target.value })} placeholder="VD: 203.0.113.7" className={cn('w-full num', loiIp && 'border-danger')} aria-label="IP nhà máy" />
                </Field>
              </div>
            </Card>
          </>)}
        </div>
      </Page>
      <StatusBar right={<span>Mọi thay đổi ghi vào Audit log</span>} />
    </>
  );
}
