/**
 * Bảng sản lượng ngày, sửa ô, nhập hộ, chốt ngày, khóa tháng, sơ đồ trạm + đăng xuất hộ · PRD F10, F17, F19 · TDD 8.3–8.5, 8.8.
 * Ngày "hôm nay" tính TƯƠNG ĐỐI theo hôm nay thật (Thứ Hai kế tiếp) — trigger lịch sử chuyền gốc dùng now() của DB.
 * Khóa tháng dùng tháng 03–04/2025 (nhập hộ không giới hạn cửa sổ nhập) để không đụng dữ liệu file test khác.
 */
import { randomUUID } from 'node:crypto';
import { congNgay, COOKIE_THIET_BI, HEADER_CLIENT, homNay, LY_DO_XAC_NHAN, thuIso } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/clock/clock.service.js';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { type AppTest, dangNhap, ngauNhien, taoAppTest, taoTaiKhoan, type TaiKhoanTest } from '../ho-tro/app.js';

let T2 = congNgay(homNay(new Date()), 2);
while (thuIso(T2) !== 1) T2 = congNgay(T2, 1);
const T3 = congNgay(T2, 1);
const T7 = congNgay(T2, -2);
const luc = (ngay: string, gio = '10:00') => new Date(`${ngay}T${gio}:00+07:00`);

const clock = new FakeClock(luc(T2));
let t: AppTest;

beforeAll(async () => {
  t = await taoAppTest({ clock });
});
afterAll(async () => {
  await t.dong();
});

/**
 * Chuyền A (trạm 1: CD-1 + CD-2, trạm 2: CD-3) + chuyền B (trạm 1: CD-1), sơ đồ hiệu lực từ 01/01/2025;
 * NV1, NV2 chuyền A, NVB chuyền B; tổ trưởng A, B; IT/HR.
 */
async function dung() {
  const x = await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: 'X' } });
  await t.prisma.gioMacDinh.createMany({
    data: [{ xuongId: x.id, loaiNgay: 'T2_T6', soGio: 9, apDungTuNgay: ngayDb('2025-01-01') }, { xuongId: x.id, loaiNgay: 'T7', soGio: 8, apDungTuNgay: ngayDb('2025-01-01') }],
  });
  const mk = (ma: string, so: number) =>
    t.prisma.chuyen.create({
      data: { ma: ngauNhien(ma), ten: ma, loai: 'CHUYEN_MAY', xuongId: x.id, tram: { create: Array.from({ length: so }, (_, i) => ({ soTram: i + 1, nhapQuaApp: true })) } },
      include: { tram: { orderBy: { soTram: 'asc' } } },
    });
  const A = await mk('A', 2);
  const B = await mk('B', 1);
  const ie = await taoTaiKhoan(t, { vaiTro: 'IE' });
  const mh = await t.prisma.maHang.create({ data: { ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang: 1000 } });
  const cd = [];
  for (const [i, smv] of [30, 60, 45].entries()) {
    const c = await t.prisma.congDoan.create({ data: { maHangId: mh.id, ma: `CD-${i + 1}`, ten: `Công đoạn ${i + 1}`, laCongDoanHoanThanh: i === 0 } });
    await t.prisma.smvLichSu.create({ data: { congDoanId: c.id, smv, apDungTuNgay: ngayDb('2000-01-01'), nguoiTaoId: ie.id } });
    cd.push(c);
  }
  const tu = luc('2025-01-01', '00:00');
  for (const c of [A, B]) await t.prisma.chuyenMaHang.create({ data: { chuyenId: c.id, maHangId: mh.id, batDau: tu } });
  const gan = [[A.tram[0]!, cd[0]!], [A.tram[0]!, cd[1]!], [A.tram[1]!, cd[2]!], [B.tram[0]!, cd[0]!]] as const;
  for (const [tr, c] of gan) await t.prisma.ganCongDoan.create({ data: { tramId: tr.id, congDoanId: c.id, hieuLucTu: tu } });
  const nv = async (hoTen: string, chuyenId: string) => t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen, chuyenId } });
  const nv1 = await nv('Nguyễn Thị Lan', A.id);
  const nv2 = await nv('Trần Văn Hùng', A.id);
  const nvB = await nv('Lê Thị Hoa', B.id);
  const ttA = await taoTaiKhoan(t, { vaiTro: 'TO_TRUONG', chuyenIds: [A.id] });
  const ttB = await taoTaiKhoan(t, { vaiTro: 'TO_TRUONG', chuyenIds: [B.id] });
  const hr = await taoTaiKhoan(t, { vaiTro: 'IT_HR' });
  return { x, A, B, mh, cd, nv1, nv2, nvB, ttA, ttB, hr, ie };
}

/** Client Web đăng nhập mới (phiên Web hết hạn sau 8 giờ không thao tác — clock của test nhảy ngày) */
async function web(tk: TaiKhoanTest) {
  const cookie = await dangNhap(t, tk.tenDangNhap);
  const dat = <R extends { set: (k: string, v: string) => R }>(r: R) => r.set(HEADER_CLIENT, 'web').set('Cookie', cookie);
  return {
    get: (url: string) => dat(t.http().get(url)),
    post: (url: string, body: object = {}) => dat(t.http().post(url)).send(body),
    put: (url: string, body: object) => dat(t.http().put(url)).send(body),
  };
}
const cn = (cookie?: string) => {
  const dat = <R extends { set: (k: string, v: string) => R }>(r: R) => (cookie ? r.set(HEADER_CLIENT, 'worker').set('Cookie', cookie) : r.set(HEADER_CLIENT, 'worker'));
  return {
    get: (url: string) => dat(t.http().get(url)),
    post: (url: string, body: object) => dat(t.http().post(url)).send(body),
    put: (url: string, body: object) => dat(t.http().put(url)).send(body),
  };
};
async function dangNhapTram(tramId: string, maNV: string, cookie?: string): Promise<string> {
  const res = await cn(cookie).post('/api/cn/phien-tram', { tramId, maNV, turnstileToken: 'x' });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const ds = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return ds.find((c) => c.startsWith(`${COOKIE_THIET_BI}=`))?.split(';')[0] ?? cookie!;
}
const luu = (cookie: string, tramId: string, ngay: string, congDoanId: string, soLuong: number) =>
  cn(cookie).put('/api/cn/san-luong', { requestId: randomUUID(), tramId, ngay, dong: [{ congDoanId, soLuong, thuTuThietBi: Date.now() }] });
type Dong = { key: string; sanLuongId: string | null; version: number; soTram: number; maCongDoan: string; trangThai: string; nguon: string | null; soLuong: number | null; canhBao: string[]; hoTroTu: string | null; nhanVien: { id: string } | null; dangNhap: { id: string } | null; lichSu: { soCu: number | null; soMoi: number; nguon: string; boi: string; lyDo: string | null }[] };
async function bang(w: Awaited<ReturnType<typeof web>>, chuyenId: string, ngay: string) {
  const r = await w.get(`/api/bang-san-luong?chuyenId=${chuyenId}&ngay=${ngay}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as { dong: Dong[]; chot: { boi: string } | null; duocChot: boolean; daKhoa: boolean; gioChoDuyet: number; moChotTu: string };
}

describe('Bảng sản lượng ngày [F10]', () => {
  it('hiện đủ mọi trạm / công đoạn theo sơ đồ ngày đó; ô chưa có số kèm người đang đăng nhập trạm; ngoài phạm vi → 403', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv1.maNV);
    expect((await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 120)).status).toBe(200);

    const b = await bang(await web(k.ttA), k.A.id, T2);
    expect(b.dong.map((d) => [d.soTram, d.maCongDoan, d.trangThai])).toEqual([
      [1, 'CD-1', 'BINH_THUONG'], [1, 'CD-2', 'CHUA_CO_SO'], [2, 'CD-3', 'CHUA_CO_SO'],
    ]);
    expect(b.dong[0]).toMatchObject({ soLuong: 120, nguon: 'APP', nhanVien: { id: k.nv1.id }, lichSu: [{ soCu: null, soMoi: 120, nguon: 'APP', boi: 'Nguyễn Thị Lan' }] });
    expect(b.dong[1]!.dangNhap).toMatchObject({ id: k.nv1.id });
    expect(b.dong[2]!.dangNhap).toBeNull();
    expect(b).toMatchObject({ chot: null, duocChot: false, daKhoa: false, moChotTu: luc(T3, '08:00').toISOString() });

    expect((await (await web(k.ttB)).get(`/api/bang-san-luong?chuyenId=${k.A.id}&ngay=${T2}`)).status).toBe(403);
  });

  it('[R 5.4] sửa ô bắt buộc lý do → Ô đã điều chỉnh, app không ghi đè được; hai tổ trưởng cùng sửa → người sau nhận "Dữ liệu đã bị [tên] thay đổi lúc hh:mm"', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv1.maNV);
    await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 120);
    const w = await web(k.ttA);
    const o = (await bang(w, k.A.id, T2)).dong[0]!;

    expect((await w.put('/api/bang-san-luong/o', { sanLuongId: o.sanLuongId, soLuong: 110, lyDo: ' ', version: o.version })).status).toBe(400);
    clock.dat(luc(T2, '10:05'));
    await w.put('/api/bang-san-luong/o', { sanLuongId: o.sanLuongId, soLuong: 110, lyDo: 'Đếm lại bó hàng', version: o.version }).expect(200);
    const sau = (await bang(w, k.A.id, T2)).dong[0]!;
    expect(sau).toMatchObject({ soLuong: 110, nguon: 'SUA_WEB', trangThai: 'DA_DIEU_CHINH' });
    expect(sau.lichSu[0]).toMatchObject({ soCu: 120, soMoi: 110, nguon: 'SUA_WEB', boi: k.ttA.hoTen, lyDo: 'Đếm lại bó hàng' });

    // Tổ trưởng thứ hai còn giữ version cũ
    const tt2 = await taoTaiKhoan(t, { vaiTro: 'TO_TRUONG', chuyenIds: [k.A.id] });
    const r = await (await web(tt2)).put('/api/bang-san-luong/o', { sanLuongId: o.sanLuongId, soLuong: 130, lyDo: 'Công nhân báo lại', version: o.version });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'DU_LIEU_DA_THAY_DOI', message: `Dữ liệu đã bị ${k.ttA.hoTen} thay đổi lúc 10:05, vui lòng tải lại.` });

    const app = await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 200);
    expect(app.body.dong[0]).toMatchObject({ ketQua: 'O_DA_DIEU_CHINH', soHienTai: 110 });
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'SUA_SAN_LUONG', doiTuongId: o.sanLuongId! } })).toBe(1);
  });

  it('[D23] cờ ⚠ "nhiều thiết bị": mã NV dùng ≥ 2 thiết bị trong ngày, hoặc thiết bị từng đăng nhập ≥ 2 mã NV trong 7 ngày; xác nhận "số đúng" → Ô đã điều chỉnh, số giữ nguyên', async () => {
    const k = await dung();
    // Thiết bị X: NV2 đăng nhập Thứ 7, NV1 đăng nhập Thứ 2 (≥ 2 mã NV trong 7 ngày)
    clock.dat(luc(T7));
    const x = await dangNhapTram(k.A.tram[1]!.id, k.nv2.maNV);
    clock.dat(luc(T2, '07:00'));
    await dangNhapTram(k.A.tram[1]!.id, k.nv1.maNV, x);
    expect((await luu(x, k.A.tram[1]!.id, T2, k.cd[2]!.id, 50)).status).toBe(200);
    // NV2 Thứ 2: thiết bị Y rồi chuyển sang Z (≥ 2 thiết bị trong ngày)
    const y = await dangNhapTram(k.A.tram[0]!.id, k.nv2.maNV);
    await luu(y, k.A.tram[0]!.id, T2, k.cd[0]!.id, 80);
    clock.dat(luc(T2, '09:00'));
    await dangNhapTram(k.A.tram[0]!.id, k.nv2.maNV);

    const w = await web(k.ttA);
    const d = (await bang(w, k.A.id, T2)).dong;
    const cuaNv2 = d.find((r) => r.nhanVien?.id === k.nv2.id)!;
    const cuaNv1 = d.find((r) => r.nhanVien?.id === k.nv1.id)!;
    expect(cuaNv2).toMatchObject({ trangThai: 'CANH_BAO' });
    expect(cuaNv2.canhBao.join('|')).toContain('mã NV dùng 2 thiết bị trong ngày');
    expect(cuaNv1).toMatchObject({ trangThai: 'CANH_BAO', canhBao: ['Nhiều thiết bị: thiết bị từng đăng nhập 2 mã NV trong 7 ngày'] });

    await w.put('/api/bang-san-luong/o', { sanLuongId: cuaNv1.sanLuongId, soLuong: 50, lyDo: LY_DO_XAC_NHAN, version: cuaNv1.version }).expect(200);
    const sau = (await bang(w, k.A.id, T2)).dong.find((r) => r.nhanVien?.id === k.nv1.id)!;
    expect(sau).toMatchObject({ trangThai: 'DA_DIEU_CHINH', nguon: 'SUA_WEB', soLuong: 50, canhBao: [] });
    expect(sau.lichSu[0]).toMatchObject({ soCu: 50, soMoi: 50, lyDo: LY_DO_XAC_NHAN });
  });
});

describe('Nhập hộ [F19] [R 5.8]', () => {
  it('nhập hộ ở trạm chuyền mình cho NV bất kỳ đang hoạt động (kể cả hỗ trợ) → "Nhập hộ", Ô đã điều chỉnh; không có phiên → audit NV_KHONG_CO_PHIEN', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const w = await web(k.ttA);
    const body = { tramId: k.A.tram[1]!.id, congDoanId: k.cd[2]!.id, ngay: T2, nhanVienId: k.nvB.id, soLuong: 75, lyDo: 'Không mang điện thoại' };
    const kq = await w.post('/api/bang-san-luong/nhap-ho', body).expect(200);
    const o = (await bang(w, k.A.id, T2)).dong.find((d) => d.sanLuongId === kq.body.sanLuongId)!;
    expect(o).toMatchObject({ soLuong: 75, nguon: 'NHAP_HO', trangThai: 'DA_DIEU_CHINH', hoTroTu: k.B.ma, lichSu: [{ soCu: null, soMoi: 75, nguon: 'NHAP_HO', boi: k.ttA.hoTen, lyDo: 'Không mang điện thoại' }] });
    const a = await t.prisma.auditLog.findFirstOrThrow({ where: { hanhDong: 'NHAP_HO', doiTuongId: kq.body.sanLuongId } });
    expect(a.duLieuMoi).toMatchObject({ co: 'NV_KHONG_CO_PHIEN' });

    // Trạm chuyền khác → 403 · công đoạn không thuộc sơ đồ trạm → 422 · NV đã ngưng → 422 · thiếu lý do → 400
    expect((await w.post('/api/bang-san-luong/nhap-ho', { ...body, tramId: k.B.tram[0]!.id, congDoanId: k.cd[0]!.id })).status).toBe(403);
    expect((await w.post('/api/bang-san-luong/nhap-ho', { ...body, congDoanId: k.cd[0]!.id })).body.code).toBe('CONG_DOAN_KHONG_THUOC_SO_DO');
    await t.prisma.nhanVien.update({ where: { id: k.nv2.id }, data: { trangThai: 'NGUNG' } });
    expect((await w.post('/api/bang-san-luong/nhap-ho', { ...body, nhanVienId: k.nv2.id })).body.code).toBe('NV_KHONG_HOAT_DONG');
    expect((await w.post('/api/bang-san-luong/nhap-ho', { ...body, lyDo: '' })).status).toBe(400);
    // Tìm NV đang hoạt động ở mọi chuyền
    const tim = (await w.get(`/api/bang-san-luong/nhan-vien?q=${k.nvB.maNV.toLowerCase()}`).expect(200)).body as { id: string; maChuyen: string }[];
    expect(tim).toEqual([expect.objectContaining({ id: k.nvB.id, maChuyen: k.B.ma })]);
    expect((await w.get(`/api/bang-san-luong/nhan-vien?q=${k.nv2.maNV}`).expect(200)).body).toEqual([]); // đã ngưng
  });

  it('công nhân đã tự nhập → nhập hộ ghi đè, lịch sử số cũ – số mới; ngày đã chốt vẫn nhập hộ được', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv1.maNV);
    await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 100);
    clock.dat(luc(T3, '09:00'));
    const w = await web(k.ttA);
    await w.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2, xacNhan: true }).expect(200);
    await w.post('/api/bang-san-luong/nhap-ho', { tramId: k.A.tram[0]!.id, congDoanId: k.cd[0]!.id, ngay: T2, nhanVienId: k.nv1.id, soLuong: 140, lyDo: 'Hết pin' }).expect(200);
    const o = (await bang(w, k.A.id, T2)).dong[0]!;
    expect(o).toMatchObject({ soLuong: 140, nguon: 'NHAP_HO', trangThai: 'DA_DIEU_CHINH' });
    expect(o.lichSu.map((l) => [l.soCu, l.soMoi, l.nguon])).toEqual([[100, 140, 'NHAP_HO'], [null, 100, 'APP']]);
  });
});

describe('Chốt ngày [F10] [TDD 8.4]', () => {
  it('[R 5.9] chỉ chốt được từ Giờ mở chốt của ngày D+1; còn ô chưa có số → bắt buộc xác nhận; chốt lần hai → "đã được [tên] chốt"', async () => {
    clock.dat(luc(T2, '07:30'));
    const k = await dung();
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv1.maNV);
    await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 100);

    clock.dat(luc(T3, '07:59'));
    let w = await web(k.ttA);
    const som = await w.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2 });
    expect(som.status).toBe(422);
    expect(som.body).toMatchObject({ code: 'CHUA_TOI_GIO_MO_CHOT', message: `Chốt được từ 08:00 ngày ${T3.split('-').reverse().join('/')}.` });
    expect((await w.get('/api/chot-ngay/chua-chot').expect(200)).body).toEqual([]);

    clock.dat(luc(T3, '08:00'));
    w = await web(k.ttA);
    expect((await w.get('/api/chot-ngay/chua-chot').expect(200)).body).toEqual([{ chuyenId: k.A.id, maChuyen: k.A.ma, ngay: T2 }]);
    expect((await bang(w, k.A.id, T2)).duocChot).toBe(true);
    const canh = await w.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2 });
    expect(canh.status).toBe(409);
    expect(canh.body.code).toBe('CAN_XAC_NHAN');
    expect(canh.body.chiTiet).toMatchObject({ oChuaCoSo: [{ soTram: 1, maCongDoan: 'CD-2', nhanVien: `${k.nv1.maNV} Nguyễn Thị Lan` }, { soTram: 2, maCongDoan: 'CD-3', nhanVien: null }], oCanhBao: 0, yeuCauGioChoDuyet: 0 });
    expect(await t.prisma.chotNgay.count({ where: { chuyenId: k.A.id } })).toBe(0);

    const ok = await w.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2, xacNhan: true }).expect(200);
    expect(ok.body).toMatchObject({ boi: k.ttA.hoTen });
    const lai = await (await web(k.ttA)).post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2, xacNhan: true });
    expect(lai.status).toBe(409);
    expect(lai.body.code).toBe('DA_DUOC_CHOT');
    expect(lai.body.message).toContain(`Ngày đã được ${k.ttA.hoTen} chốt lúc 08:00`);
    expect((await w.get('/api/chot-ngay/chua-chot').expect(200)).body).toEqual([]);
    expect((await (await web(k.ttB)).post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2, xacNhan: true })).status).toBe(403);
  });

  it('sau khi chốt: app không lưu được số ngày đó và phiên trạm ngày đó tự hết; tổ trưởng vẫn sửa được (bắt buộc lý do)', async () => {
    clock.dat(luc(T2, '07:30'));
    const k = await dung();
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv1.maNV);
    await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 100);
    clock.dat(luc(T3, '08:30'));
    expect((await cn(may).get('/api/cn/khoi-dong').expect(200)).body.phien).toHaveLength(1);
    const w = await web(k.ttA);
    await w.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2, xacNhan: true }).expect(200);

    const r = await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 120);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'NGAY_DA_CHOT', message: 'Ngày đã chốt, liên hệ tổ trưởng.' });
    expect((await cn(may).get('/api/cn/khoi-dong').expect(200)).body.phien).toEqual([]);

    const o = (await bang(w, k.A.id, T2)).dong[0]!;
    await w.put('/api/bang-san-luong/o', { sanLuongId: o.sanLuongId, soLuong: 105, lyDo: 'Công nhân báo lại', version: o.version }).expect(200);
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'CHOT_NGAY', doiTuongId: k.A.id } })).toBe(1);
  });

  it('hai tổ trưởng cùng bấm Chốt ngày đồng thời → chỉ 1 bản ghi chốt, người kia nhận DA_DUOC_CHOT', async () => {
    clock.dat(luc(T3, '09:00'));
    const k = await dung();
    const tt2 = await taoTaiKhoan(t, { vaiTro: 'TO_TRUONG', chuyenIds: [k.A.id] });
    const [w1, w2] = [await web(k.ttA), await web(tt2)];
    const res = await Promise.all([w1, w2].map((w) => w.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2, xacNhan: true })));
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(res.find((r) => r.status === 409)!.body.code).toBe('DA_DUOC_CHOT');
    expect(await t.prisma.chotNgay.count({ where: { chuyenId: k.A.id, ngayLamViec: ngayDb(T2) } })).toBe(1);
  });
});

describe('Khóa / mở khóa Mã hàng × Tháng [F10] [TDD 8.5]', () => {
  it('chỉ khóa khi mọi ngày liên quan đã chốt; khóa chặn sửa / nhập hộ / giờ làm; mở khóa (lý do) → sửa được → khóa lại; mã hàng vắt 2 tháng khóa riêng', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const tt = await web(k.ttA);
    const nh = (ngay: string, soLuong: number) =>
      tt.post('/api/bang-san-luong/nhap-ho', { tramId: k.A.tram[0]!.id, congDoanId: k.cd[0]!.id, ngay, nhanVienId: k.nv1.id, soLuong, lyDo: 'Không có phiên trạm' });
    const s31 = (await nh('2025-03-31', 300).expect(200)).body.sanLuongId as string;
    await nh('2025-04-01', 500).expect(200);
    const hr = await web(k.hr);

    const chua = await hr.post('/api/khoa-thang/khoa', { maHangId: k.mh.id, thang: '2025-03' });
    expect(chua.status).toBe(422);
    expect(chua.body).toMatchObject({ code: 'CON_NGAY_CHUA_CHOT', chiTiet: [{ chuyenId: k.A.id, maChuyen: k.A.ma, ngay: '2025-03-31' }] });
    const xem = (await hr.get('/api/khoa-thang?thang=2025-03').expect(200)).body;
    expect(xem.dong.find((d: { maHangId: string }) => d.maHangId === k.mh.id)).toMatchObject({ sanLuong: 300, soNgay: 1, khoa: null });

    await tt.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: '2025-03-31', xacNhan: true }).expect(200);
    await hr.post('/api/khoa-thang/khoa', { maHangId: k.mh.id, thang: '2025-03' }).expect(204);
    // Tháng 04 vẫn mở (khóa riêng từng tháng)
    await nh('2025-04-01', 510).expect(200);
    const o = (await bang(tt, k.A.id, '2025-03-31')).dong[0]!;
    expect((await bang(tt, k.A.id, '2025-03-31')).daKhoa).toBe(true);
    expect((await tt.put('/api/bang-san-luong/o', { sanLuongId: s31, soLuong: 310, lyDo: 'Đếm lại bó hàng', version: o.version })).body.code).toBe('THANG_DA_KHOA');
    expect((await nh('2025-03-31', 320)).body.code).toBe('THANG_DA_KHOA');
    // [R 5.7] khóa cả giờ làm của NV × ngày có sản lượng thuộc mã hàng × tháng đó
    const sa = await web(await taoTaiKhoan(t, { vaiTro: 'SUPERADMIN' }));
    expect((await sa.put('/api/gio-lam/truc-tiep', { nhanVienId: k.nv1.id, ngay: '2025-03-31', soGio: 10, lyDo: 'x' })).body.code).toBe('GIO_LAM_DA_KHOA');

    expect((await hr.post('/api/khoa-thang/mo-khoa', { maHangId: k.mh.id, thang: '2025-03', lyDo: '' })).status).toBe(400);
    await hr.post('/api/khoa-thang/mo-khoa', { maHangId: k.mh.id, thang: '2025-03', lyDo: 'Tổ trưởng báo sai số' }).expect(204);
    await tt.put('/api/bang-san-luong/o', { sanLuongId: s31, soLuong: 310, lyDo: 'Đếm lại bó hàng', version: o.version }).expect(200);
    await hr.post('/api/khoa-thang/khoa', { maHangId: k.mh.id, thang: '2025-03' }).expect(204);
    const kt = (await hr.get('/api/khoa-thang?thang=2025-03').expect(200)).body.dong.find((d: { maHangId: string }) => d.maHangId === k.mh.id);
    expect(kt).toMatchObject({ sanLuong: 310, khoa: { trangThai: 'KHOA', boi: k.hr.hoTen } });
    expect((await t.prisma.auditLog.findMany({ where: { doiTuongId: k.mh.id }, orderBy: [{ luc: 'asc' }, { id: 'asc' }] })).map((a) => a.hanhDong))
      .toEqual(['KHOA_THANG', 'MO_KHOA_THANG', 'KHOA_LAI_THANG']);
    // Tổ trưởng không khóa được [F8]
    expect((await tt.post('/api/khoa-thang/khoa', { maHangId: k.mh.id, thang: '2025-04' })).status).toBe(403);
  });

  it('"Khóa tất cả mã hàng của tháng": khóa mã đã chốt đủ, bỏ qua mã còn ngày chưa chốt', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const k2 = await dung();
    const tt = await web(k.ttA);
    const tt2 = await web(k2.ttA);
    await tt.post('/api/bang-san-luong/nhap-ho', { tramId: k.A.tram[0]!.id, congDoanId: k.cd[0]!.id, ngay: '2025-03-10', nhanVienId: k.nv1.id, soLuong: 10, lyDo: 'x' }).expect(200);
    await tt2.post('/api/bang-san-luong/nhap-ho', { tramId: k2.A.tram[0]!.id, congDoanId: k2.cd[0]!.id, ngay: '2025-03-10', nhanVienId: k2.nv1.id, soLuong: 10, lyDo: 'x' }).expect(200);
    await tt.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: '2025-03-10', xacNhan: true }).expect(200);
    const kq = (await (await web(k.hr)).post('/api/khoa-thang/khoa-tat-ca', { thang: '2025-03' }).expect(200)).body;
    expect(kq.daKhoa).toContain(k.mh.ma);
    expect(kq.boQua).toContainEqual({ ma: k2.mh.ma, soNgayChuaChot: 1 });
  });
});

describe('Sơ đồ trạm trực tiếp + đăng xuất hộ [F17] [TDD 8.8] [D26]', () => {
  it('hiện ai đang ở trạm, đã nhập chưa; NV chưa có số → cảnh báo; đăng xuất hộ → công nhân Lưu bị từ chối và thấy thông báo', async () => {
    clock.dat(luc(T2, '07:30'));
    const k = await dung();
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv1.maNV);
    const w = await web(k.ttA);
    const sd = (await w.get(`/api/so-do-tram?chuyenId=${k.A.id}`).expect(200)).body;
    expect(sd.khongDoi).toBe(false);
    expect(sd.tram[0]).toMatchObject({ soTram: 1, congDoan: [{ ma: 'CD-1' }, { ma: 'CD-2' }], phien: { nhanVien: { maNV: k.nv1.maNV }, daNhap: [] } });
    expect(sd.tram[1].phien).toBeNull();
    // Không đổi → { khongDoi: true }
    expect((await w.get(`/api/so-do-tram?chuyenId=${k.A.id}&phienBan=${sd.phienBan}`).expect(200)).body).toEqual({ khongDoi: true });

    const phienId = sd.tram[0].phien.id as string;
    const canh = await w.post('/api/so-do-tram/dang-xuat-ho', { phienId, lyDo: 'Đăng nhập nhầm trạm' });
    expect(canh.status).toBe(409);
    expect(canh.body).toMatchObject({ code: 'CAN_XAC_NHAN', message: expect.stringContaining('Ng. T. Lan chưa nhập số tại trạm 1') });
    expect((await (await web(k.ttB)).post('/api/so-do-tram/dang-xuat-ho', { phienId, lyDo: 'x', xacNhan: true })).status).toBe(403);

    clock.dat(luc(T2, '09:10'));
    await w.post('/api/so-do-tram/dang-xuat-ho', { phienId, lyDo: 'Đăng nhập nhầm trạm', xacNhan: true }).expect(204);
    expect((await w.get(`/api/so-do-tram?chuyenId=${k.A.id}&phienBan=${sd.phienBan}`).expect(200)).body.tram[0].phien).toBeNull();
    expect((await w.post('/api/so-do-tram/dang-xuat-ho', { phienId, lyDo: 'x', xacNhan: true })).body.code).toBe('DU_LIEU_DA_THAY_DOI');

    const r = await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 10);
    expect(r.status).toBe(409);
    expect(r.body.message).toBe(`Bạn đã bị đăng xuất khỏi trạm 1 lúc 09:10 bởi ${k.ttA.hoTen} — nhờ tổ trưởng nhập hộ.`);
    const kd = (await cn(may).get('/api/cn/khoi-dong').expect(200)).body;
    expect(kd.thongBao).toEqual([expect.objectContaining({ loai: 'DANG_XUAT_HO', soTram: 1, boi: k.ttA.hoTen, lyDo: 'Đăng nhập nhầm trạm' })]);
    // Trạm trống → người khác đăng nhập được
    await dangNhapTram(k.A.tram[0]!.id, k.nv2.maNV);
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'DANG_XUAT_HO', doiTuongId: phienId } })).toBe(1);
  });

  it('NV đã có số hôm nay → đăng xuất hộ không cần xác nhận; đăng xuất trạm nào chỉ ảnh hưởng trạm đó', async () => {
    clock.dat(luc(T2, '07:30'));
    const k = await dung();
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv1.maNV);
    await dangNhapTram(k.A.tram[1]!.id, k.nv1.maNV, may);
    await luu(may, k.A.tram[0]!.id, T2, k.cd[0]!.id, 10);
    const w = await web(k.ttA);
    const sd = (await w.get(`/api/so-do-tram?chuyenId=${k.A.id}`).expect(200)).body;
    expect(sd.tram[0].phien.daNhap).toEqual([k.cd[0]!.id]);
    await w.post('/api/so-do-tram/dang-xuat-ho', { phienId: sd.tram[0].phien.id, lyDo: 'Đổi vị trí làm việc' }).expect(204);
    expect((await luu(may, k.A.tram[1]!.id, T2, k.cd[2]!.id, 5)).status).toBe(200);
  });
});
