/** Danh mục Xưởng – Chuyền/Nhóm – Trạm · PRD F9 */
import { HEADER_CLIENT, homNay, TRAM_NHAP_QUA_APP_MVP } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { maLoiTuTrigger } from '../../src/core/loi/loi-db.js';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { type AppTest, ngauNhien, taoAppTest, taoChuyenNhanh, taoTaiKhoan, taoVaDangNhap } from '../ho-tro/app.js';

let t: AppTest;
let sa: { cookie: string; hoTen: string; id: string };

beforeAll(async () => {
  t = await taoAppTest();
  sa = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
});
afterAll(async () => {
  await t.dong();
});

const get = (url: string) => t.http().get(url).set('Cookie', sa.cookie);
const post = (url: string, body: object) => t.http().post(url).set('Cookie', sa.cookie).set(HEADER_CLIENT, 'web').send(body);
const patch = (url: string, body: object) => t.http().patch(url).set('Cookie', sa.cookie).set(HEADER_CLIENT, 'web').send(body);

async function taoXuongApi() {
  const res = await post('/api/xuong', { ma: ngauNhien('X'), ten: 'Xưởng May' }).expect(201);
  return res.body as { id: string; ma: string; version: number };
}
async function taoChuyenApi(xuongId: string, soTram = 41, loai = 'CHUYEN_MAY') {
  const res = await post('/api/chuyen', { ma: ngauNhien('C'), ten: 'Chuyền thử', loai, xuongId, soTram }).expect(201);
  return res.body as { id: string; ma: string; version: number; soTram: number; soTramApp: number };
}
const dsTram = async (chuyenId: string) =>
  (await get(`/api/chuyen/${chuyenId}/tram`).expect(200)).body as { id: string; soTram: number; nhapQuaApp: boolean; version: number; trangThai: string }[];

describe('Xưởng', () => {
  it('[F9] mã xưởng duy nhất (đã chuẩn hóa trim + viết hoa)', async () => {
    const ma = ngauNhien('x');
    const res = await post('/api/xuong', { ma: `  ${ma.toLowerCase()} `, ten: 'Xưởng May 1' }).expect(201);
    expect(res.body).toMatchObject({ ma: ma.toUpperCase(), trangThai: 'HOAT_DONG', soChuyen: 0 });
    const trung = await post('/api/xuong', { ma, ten: 'Khác' }).expect(409);
    expect(trung.body).toMatchObject({ code: 'TRUNG_MA', field: 'ma' });
  });

  it('[F9] ngưng xưởng còn chuyền hoạt động → chặn', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 1);
    const res = await patch(`/api/xuong/${x.id}`, { trangThai: 'NGUNG', version: x.version }).expect(422);
    expect(res.body).toMatchObject({ code: 'CON_CHUYEN_HOAT_DONG', chiTiet: { danhSach: [c.ma] } });
  });

  it('[R 5.10] ngưng xưởng còn quản lý xưởng: cảnh báo → xác nhận thì gỡ; quản lý chỉ có xưởng này → chặn', async () => {
    const x = await taoXuongApi();
    const xKhac = await taoXuongApi();
    const ql = await taoTaiKhoan(t, { vaiTro: 'QUAN_LY_XUONG', xuongIds: [x.id, xKhac.id] });

    const canhBao = await patch(`/api/xuong/${x.id}`, { trangThai: 'NGUNG', version: x.version }).expect(409);
    expect(canhBao.body).toMatchObject({ code: 'CAN_XAC_NHAN', chiTiet: { danhSach: [ql.hoTen] } });
    const ok = await patch(`/api/xuong/${x.id}`, { trangThai: 'NGUNG', version: x.version, xacNhan: true }).expect(200);
    expect(ok.body.trangThai).toBe('NGUNG');
    expect(await t.prisma.taiKhoanXuong.findMany({ where: { taiKhoanId: ql.id }, select: { xuongId: true } })).toEqual([{ xuongId: xKhac.id }]);

    await taoTaiKhoan(t, { vaiTro: 'QUAN_LY_XUONG', xuongIds: [xKhac.id] });
    const xk = (await get('/api/xuong').expect(200)).body.find((v: { id: string }) => v.id === xKhac.id);
    const chan = await patch(`/api/xuong/${xKhac.id}`, { trangThai: 'NGUNG', version: xk.version, xacNhan: true }).expect(422);
    expect(chan.body.code).toBe('PHAI_GAN_PHAM_VI');
  });

  it('[PRD ⑦] sửa bằng version cũ → 409 "Dữ liệu đã bị [tên] thay đổi lúc hh:mm"', async () => {
    const x = await taoXuongApi();
    await patch(`/api/xuong/${x.id}`, { ten: 'Tên mới', version: x.version }).expect(200);
    const res = await patch(`/api/xuong/${x.id}`, { ten: 'Tên khác', version: x.version }).expect(409);
    expect(res.body.code).toBe('DU_LIEU_DA_THAY_DOI');
    expect(res.body.message).toContain(sa.hoTen);
    expect(res.body.message).toMatch(/lúc \d{2}:\d{2}/);
  });
});

describe('Chuyền', () => {
  it('[F9] tạo chuyền 41 trạm bằng 1 thao tác; trạm MVP (12, 25, 26–41) mặc định nhập qua app', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 41);
    expect(c).toMatchObject({ soTram: 41, soTramApp: 18 });
    const tram = await dsTram(c.id);
    expect(tram.map((v) => v.soTram)).toEqual(Array.from({ length: 41 }, (_, i) => i + 1));
    expect(tram.filter((v) => v.nhapQuaApp).map((v) => v.soTram)).toEqual([...TRAM_NHAP_QUA_APP_MVP].sort((a, b) => a - b));
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'TAO_CHUYEN', doiTuongId: c.id } })).toBe(1);
  });

  it('[F9] mã chuyền duy nhất; chuyền may phải có ≥ 1 trạm; vòng ngoài không có trạm app', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 2);
    expect((await post('/api/chuyen', { ma: c.ma, ten: 'T', loai: 'CHUYEN_MAY', xuongId: x.id, soTram: 1 }).expect(409)).body.code).toBe('TRUNG_MA');
    expect((await post('/api/chuyen', { ma: ngauNhien('C'), ten: 'T', loai: 'CHUYEN_MAY', xuongId: x.id, soTram: 0 }).expect(400)).body.field).toBe('soTram');
    const vn = await taoChuyenApi(x.id, 3, 'VONG_NGOAI');
    expect(vn.soTramApp).toBe(0);
    const tram = await dsTram(vn.id);
    const res = await patch(`/api/tram/${tram[0]!.id}`, { nhapQuaApp: true, version: tram[0]!.version }).expect(422);
    expect(res.body.field).toBe('nhapQuaApp');
  });

  it('[F9] mã định danh trạm (UUID, dùng cho QR) không đổi khi sửa mã/tên chuyền', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 3);
    const truoc = (await dsTram(c.id)).map((v) => v.id);
    await patch(`/api/chuyen/${c.id}`, { ma: ngauNhien('C'), ten: 'Tên mới', version: c.version }).expect(200);
    expect((await dsTram(c.id)).map((v) => v.id)).toEqual(truoc);
  });

  it('[F9] ngưng chuyền còn nhân viên hoạt động → chặn', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 1);
    await t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen: 'A', chuyenId: c.id } });
    const res = await patch(`/api/chuyen/${c.id}`, { trangThai: 'NGUNG', version: c.version }).expect(422);
    expect(res.body.code).toBe('CON_NHAN_VIEN_HOAT_DONG');
  });

  it('[R 5.10] ngưng chuyền còn tổ trưởng: cảnh báo → xác nhận thì gỡ; chuyền duy nhất của tổ trưởng → chặn', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 1);
    const c2 = await taoChuyenApi(x.id, 1);
    const tt = await taoTaiKhoan(t, { vaiTro: 'TO_TRUONG', chuyenIds: [c.id, c2.id] });

    const canhBao = await patch(`/api/chuyen/${c.id}`, { trangThai: 'NGUNG', version: c.version }).expect(409);
    expect(canhBao.body).toMatchObject({ code: 'CAN_XAC_NHAN', chiTiet: { danhSach: [tt.hoTen] } });
    await patch(`/api/chuyen/${c.id}`, { trangThai: 'NGUNG', version: c.version, xacNhan: true }).expect(200);
    expect(await t.prisma.taiKhoanChuyen.count({ where: { taiKhoanId: tt.id } })).toBe(1);

    const chan = await patch(`/api/chuyen/${c2.id}`, { trangThai: 'NGUNG', version: c2.version, xacNhan: true }).expect(422);
    expect(chan.body).toMatchObject({ code: 'PHAI_GAN_PHAM_VI', chiTiet: { danhSach: [tt.hoTen] } });
  });

  it('[F9] ngưng chuyền → công nhân đang đăng nhập trạm của chuyền tự bị đăng xuất', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 2);
    const tram = await dsTram(c.id);
    const phienId = await taoPhien(tram[0]!.id, c.id);
    await patch(`/api/chuyen/${c.id}`, { trangThai: 'NGUNG', version: c.version }).expect(200);
    expect(await t.prisma.phienTram.findUnique({ where: { id: phienId }, select: { lyDoDong: true, lyDo: true, dangXuatBoiId: true } }))
      .toEqual({ lyDoDong: 'DANG_XUAT_HO', lyDo: 'Ngưng chuyền', dangXuatBoiId: sa.id });
  });
});

/** Phiên trạm đang hoạt động hôm nay (dữ liệu nền) */
async function taoPhien(tramId: string, chuyenId: string): Promise<string> {
  const nv = await t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen: 'Ng Thi Lan', chuyenId } });
  await t.prisma.nhanVien.update({ where: { id: nv.id }, data: { trangThai: 'NGUNG' } }); // không chặn ngưng chuyền
  const tb = await t.prisma.thietBi.create({ data: { tokenHash: ngauNhien('h') } });
  const p = await t.prisma.phienTram.create({
    data: { tramId, nhanVienId: nv.id, ngayLamViec: ngayDb(homNay(new Date())), thietBiId: tb.id },
  });
  return p.id;
}

describe('Trạm', () => {
  it('[F9] đánh dấu / bỏ nhập qua app; trạm ngưng không còn tính vào số trạm app', async () => {
    const x = await taoXuongApi();
    const c = await taoChuyenApi(x.id, 30);
    const t26 = (await dsTram(c.id)).find((v) => v.soTram === 26)!;
    await patch(`/api/tram/${t26.id}`, { trangThai: 'NGUNG', version: t26.version }).expect(200);
    const chuyen = (await get(`/api/chuyen?xuongId=${x.id}`).expect(200)).body.find((v: { id: string }) => v.id === c.id);
    expect(chuyen.soTramApp).toBe(6); // 12, 25, 27, 28, 29, 30
  });

  it('[F9] ngưng trạm / bỏ nhập qua app khi còn công đoạn gán → chặn "Gỡ công đoạn khỏi trạm trước"', async () => {
    const { chuyen } = await taoChuyenNhanh(t);
    const tram = chuyen.tram[0]!;
    const mh = await t.prisma.maHang.create({ data: { ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang: 10 } });
    const cd = await t.prisma.congDoan.create({ data: { maHangId: mh.id, ma: 'CD1', ten: 'May cổ' } });
    await t.prisma.ganCongDoan.create({ data: { tramId: tram.id, congDoanId: cd.id, hieuLucTu: new Date() } });

    expect((await patch(`/api/tram/${tram.id}`, { trangThai: 'NGUNG', version: 0 }).expect(422)).body.code).toBe('CON_CONG_DOAN_GAN');
    expect((await patch(`/api/tram/${tram.id}`, { nhapQuaApp: false, version: 0 }).expect(422)).body.code).toBe('CON_CONG_DOAN_GAN');
  });

  it('[F9] ngưng trạm đang có công nhân đăng nhập → tự đăng xuất', async () => {
    const { chuyen } = await taoChuyenNhanh(t);
    const tram = chuyen.tram[0]!;
    const phienId = await taoPhien(tram.id, chuyen.id);
    expect((await dsTram(chuyen.id))[0]).toMatchObject({ maNVDangDangNhap: expect.any(String) });

    await patch(`/api/tram/${tram.id}`, { trangThai: 'NGUNG', version: 0 }).expect(200);
    const p = await t.prisma.phienTram.findUniqueOrThrow({ where: { id: phienId } });
    expect(p).toMatchObject({ lyDoDong: 'DANG_XUAT_HO', lyDo: 'Ngưng trạm', dangXuatBoiId: sa.id });
    expect((await dsTram(chuyen.id))[0]).toMatchObject({ trangThai: 'NGUNG', maNVDangDangNhap: null });
  });

  it('[F9] kích hoạt trạm khi chuyền đang ngưng → chặn', async () => {
    const { chuyen } = await taoChuyenNhanh(t);
    const tram = chuyen.tram[0]!;
    await patch(`/api/tram/${tram.id}`, { trangThai: 'NGUNG', version: 0 }).expect(200);
    await patch(`/api/chuyen/${chuyen.id}`, { trangThai: 'NGUNG', version: 0 }).expect(200);
    const res = await patch(`/api/tram/${tram.id}`, { trangThai: 'HOAT_DONG', version: 1 }).expect(422);
    expect(res.body.message).toMatch(/Chuyền đang ngưng/);
  });

  it('[D17] lỗi trigger của DB được chuyển thành mã lỗi nghiệp vụ', async () => {
    const a = await taoChuyenNhanh(t);
    const b = await taoChuyenNhanh(t, { xuongId: a.xuongId });
    const loi = await t.prisma.tram.update({ where: { id: a.chuyen.tram[0]!.id }, data: { chuyenId: b.chuyen.id } }).catch((e: unknown) => e);
    expect(maLoiTuTrigger(loi)).toBe('TRAM_KHONG_DOI_CHUYEN');
  });

  it('id không phải UUID → 400; không tồn tại → 404', async () => {
    await get('/api/chuyen/khong-phai-uuid/tram').expect(400);
    await get('/api/chuyen/018f0000-0000-7000-8000-000000000000/tram').expect(404);
  });
});
