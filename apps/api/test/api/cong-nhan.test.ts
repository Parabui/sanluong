/**
 * App công nhân: phiên trạm + ghi sản lượng · PRD F1 · TDD 8.1, 8.2, 8.9, 16.3 (bộ test bắt buộc trước pilot).
 * Ngày test tính TƯƠNG ĐỐI theo hôm nay thật (Thứ Hai kế tiếp) — trigger lịch sử chuyền gốc dùng now() của DB.
 */
import { randomUUID } from 'node:crypto';
import { congNgay, COOKIE_THIET_BI, HEADER_CLIENT, homNay, thuIso } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../src/core/clock/clock.service.js';
import { khoaChuyenNgay } from '../../src/core/prisma/khoa.js';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { TurnstileService } from '../../src/modules/cong-nhan/turnstile.service.js';
import { type AppTest, ngauNhien, taoAppTest, taoTaiKhoan } from '../ho-tro/app.js';

// Thứ Hai kế tiếp (≥ 2 ngày sau hôm nay thật) và Thứ Bảy liền trước nó
let T2 = congNgay(homNay(new Date()), 2);
while (thuIso(T2) !== 1) T2 = congNgay(T2, 1);
const T7 = congNgay(T2, -2);
const T6 = congNgay(T2, -3);
const T3 = congNgay(T2, 1);
const luc = (ngay: string, gio = '10:00') => new Date(`${ngay}T${gio}:00+07:00`);

const clock = new FakeClock(luc(T2));
let t: AppTest;

beforeAll(async () => {
  t = await taoAppTest({ clock });
});
afterAll(async () => {
  await t.dong();
});

/** Chuyền + N trạm app + mã hàng 2 công đoạn (gán sẵn vào trạm đầu) + giờ mặc định + NV */
async function dung(soTram = 2, soNv = 3) {
  const x = await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: 'X' } });
  await t.prisma.gioMacDinh.createMany({
    data: [
      { xuongId: x.id, loaiNgay: 'T2_T6', soGio: 9, apDungTuNgay: ngayDb('2026-01-01') },
      { xuongId: x.id, loaiNgay: 'T7', soGio: 8, apDungTuNgay: ngayDb('2026-01-01') },
    ],
  });
  const chuyen = await t.prisma.chuyen.create({
    data: { ma: ngauNhien('C'), ten: 'C', loai: 'CHUYEN_MAY', xuongId: x.id, tram: { create: Array.from({ length: soTram }, (_, i) => ({ soTram: 26 + i, nhapQuaApp: true })) } },
    include: { tram: { orderBy: { soTram: 'asc' } } },
  });
  const tk = await taoTaiKhoan(t, { vaiTro: 'IE' });
  const mh = await t.prisma.maHang.create({ data: { ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang: 1000 } });
  const cd = [];
  for (const [i, smv] of [30, 60].entries()) {
    const c = await t.prisma.congDoan.create({ data: { maHangId: mh.id, ma: `CD-${i + 1}`, ten: `Công đoạn ${i + 1}`, laCongDoanHoanThanh: i === 0 } });
    await t.prisma.smvLichSu.create({ data: { congDoanId: c.id, smv, apDungTuNgay: ngayDb('2000-01-01'), nguoiTaoId: tk.id } });
    cd.push(c);
  }
  await t.prisma.chuyenMaHang.create({ data: { chuyenId: chuyen.id, maHangId: mh.id, batDau: luc('2026-01-01') } });
  for (const tr of chuyen.tram) {
    for (const c of cd) await t.prisma.ganCongDoan.create({ data: { tramId: tr.id, congDoanId: c.id, hieuLucTu: luc('2026-01-01') } });
  }
  const ten = ['Nguyễn Thị Lan', 'Trần Văn Hùng', 'Lê Thị Hoa'];
  const nv = [];
  for (let i = 0; i < soNv; i++) nv.push(await t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen: ten[i % 3]!, chuyenId: chuyen.id } }));
  return { xuong: x, chuyen, tram: chuyen.tram, mh, cd, nv, tk };
}

const cookieTb = (setCookie: unknown) => {
  const ds = (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []) as string[];
  return ds.find((c) => c.startsWith(`${COOKIE_THIET_BI}=`))?.split(';')[0];
};
async function dangNhap(tramId: string, maNV: string, cookie?: string) {
  let r = t.http().post('/api/cn/phien-tram').set(HEADER_CLIENT, 'worker');
  if (cookie) r = r.set('Cookie', cookie);
  const res = await r.send({ tramId, maNV, turnstileToken: 'x' });
  return { res, cookie: cookieTb(res.headers['set-cookie']) ?? cookie };
}
async function mayMoi(tramId: string, maNV: string) {
  const { res, cookie } = await dangNhap(tramId, maNV);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return cookie!;
}
const ghi = (cookie: string, body: { tramId: string; ngay: string; dong: { congDoanId: string; soLuong: number; thuTuThietBi?: number }[]; requestId?: string }) =>
  t.http().put('/api/cn/san-luong').set(HEADER_CLIENT, 'worker').set('Cookie', cookie).send({
    requestId: body.requestId ?? randomUUID(), tramId: body.tramId, ngay: body.ngay,
    dong: body.dong.map((d, i) => ({ thuTuThietBi: Date.now() + i, ...d })),
  });
const soLichSu = (cdId: string, nvId: string) => t.prisma.sanLuongLichSu.count({ where: { sanLuong: { congDoanId: cdId, nhanVienId: nvId } } });

describe('Phiên trạm [TDD 8.1]', () => {
  it('[D21] khởi động không tạo cookie; đăng nhập thành công mới cấp cookie vsn_tb (HttpOnly; Secure; SameSite=Strict; Path=/api)', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const kd = await t.http().get('/api/cn/khoi-dong').expect(200);
    expect(kd.body).toMatchObject({ homNay: T2, nhanVien: null, phien: [] });
    expect(kd.headers['set-cookie']).toBeUndefined();

    const truoc = await t.prisma.thietBi.count();
    const sai = await dangNhap(k.tram[0]!.id, 'KHONG-CO');
    expect(sai.res.status).toBe(422);
    expect(sai.res.body).toMatchObject({ code: 'MA_NV_KHONG_HOP_LE', message: 'Mã NV không hợp lệ.' });
    expect(await t.prisma.thietBi.count()).toBe(truoc); // đăng nhập lỗi không tạo thiết bị

    const ok = await dangNhap(k.tram[0]!.id, ` ${k.nv[0]!.maNV.toLowerCase()} `);
    expect(ok.res.status).toBe(200);
    const raw = (ok.res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(COOKIE_THIET_BI))!;
    expect(raw).toMatch(/HttpOnly/);
    expect(raw).toMatch(/Secure/);
    expect(raw).toMatch(/SameSite=Strict/);
    expect(raw).toMatch(/Path=\/api/);
    expect(ok.res.body).toMatchObject({ nhanVien: { maNV: k.nv[0]!.maNV }, phien: [{ tramId: k.tram[0]!.id, ngayLamViec: T2 }] });
  });

  it('[R 1] trạm đang có người khác → "Trạm đang có [tên viết tắt] – báo tổ trưởng"; công nhân không đăng xuất được người khác', async () => {
    const k = await dung();
    await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV); // Nguyễn Thị Lan
    const { res } = await dangNhap(k.tram[0]!.id, k.nv[1]!.maNV);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'TRAM_DA_CO_NGUOI', message: 'Trạm đang có Ng. T. Lan – báo tổ trưởng.' });
  });

  it('[R 1.3] một điện thoại một mã NV / ngày, nhưng được nhiều trạm', async () => {
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    expect((await dangNhap(k.tram[1]!.id, k.nv[0]!.maNV, c)).res.status).toBe(200);
    const khac = await dangNhap(k.tram[1]!.id, k.nv[1]!.maNV, c);
    expect(khac.res.status).toBe(409);
    expect(khac.res.body.code).toBe('THIET_BI_DA_CO_NV_KHAC');
  });

  it('[D21] cùng mã NV đăng nhập ở thiết bị B → mọi phiên còn hiệu lực (kể cả hôm qua chưa chốt) chuyển sang B; A bị từ chối', async () => {
    const k = await dung();
    clock.dat(luc(T7, '16:00'));
    const a = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV); // phiên Thứ 7
    clock.dat(luc(T2, '07:30'));
    expect((await dangNhap(k.tram[1]!.id, k.nv[0]!.maNV, a)).res.status).toBe(200); // phiên Thứ 2
    expect((await t.http().get('/api/cn/khoi-dong').set('Cookie', a).expect(200)).body.phien).toHaveLength(2);

    clock.dat(luc(T2, '08:15'));
    const b = await mayMoi(k.tram[1]!.id, k.nv[0]!.maNV);
    const kdB = (await t.http().get('/api/cn/khoi-dong').set('Cookie', b).expect(200)).body;
    expect(kdB.phien.map((p: { ngayLamViec: string }) => p.ngayLamViec).sort()).toEqual([T7, T2].sort());

    const kdA = (await t.http().get('/api/cn/khoi-dong').set('Cookie', a).expect(200)).body;
    expect(kdA.phien).toEqual([]);
    expect(kdA.thongBao[0]).toMatchObject({ loai: 'CHUYEN_THIET_BI' });
    const res = await ghi(a, { tramId: k.tram[1]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 10 }] }).expect(409);
    expect(res.body).toMatchObject({ code: 'PHIEN_KHONG_CON', message: 'Phiên đã chuyển sang thiết bị khác lúc 08:15.' });
    await ghi(b, { tramId: k.tram[0]!.id, ngay: T7, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 10 }] }).expect(200);
  });

  it('[D23] tối đa 3 lần chuyển thiết bị / ngày — lần thứ 4 → 429, báo tổ trưởng', async () => {
    clock.dat(luc(T2, '09:00'));
    const k = await dung();
    for (let i = 0; i < 4; i++) await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV); // lần 1 là đăng nhập, 3 lần sau là chuyển
    const { res } = await dangNhap(k.tram[0]!.id, k.nv[0]!.maNV);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('QUA_SO_LAN_CHUYEN_THIET_BI');
  });

  it('[R 3.5] sai mã NV 10 lần / 10 phút / thiết bị → khóa 15 phút; NV ngưng không đăng nhập được', async () => {
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    for (let i = 0; i < 10; i++) expect((await dangNhap(k.tram[1]!.id, 'SAI', c)).res.status).toBe(422);
    const khoa = await dangNhap(k.tram[1]!.id, k.nv[0]!.maNV, c);
    expect(khoa.res.status).toBe(429);
    clock.tien(15 * 60_000 + 1);
    expect((await dangNhap(k.tram[1]!.id, k.nv[0]!.maNV, c)).res.status).toBe(200);

    await t.prisma.nhanVien.update({ where: { id: k.nv[2]!.id }, data: { trangThai: 'NGUNG' } });
    expect((await dangNhap(k.tram[1]!.id, k.nv[2]!.maNV)).res.body.code).toBe('MA_NV_KHONG_HOP_LE');
  });

  it('[R 3.9] 2 người đăng nhập cùng trạm gần như cùng lúc → 1 người vào, người còn lại nhận 409', async () => {
    const k = await dung();
    const [a, b] = await Promise.all([dangNhap(k.tram[0]!.id, k.nv[0]!.maNV), dangNhap(k.tram[0]!.id, k.nv[1]!.maNV)]);
    expect([a.res.status, b.res.status].sort()).toEqual([200, 409]);
    expect(await t.prisma.phienTram.count({ where: { tramId: k.tram[0]!.id, dangXuatLuc: null } })).toBe(1);
  });

  it('[D23] Turnstile không hợp lệ → 403', async () => {
    const k = await dung();
    const spy = vi.spyOn(t.app.get(TurnstileService), 'hopLe').mockResolvedValueOnce(false);
    expect((await dangNhap(k.tram[0]!.id, k.nv[0]!.maNV)).res.body.code).toBe('TURNSTILE_SAI');
    spy.mockRestore();
  });

  it('[F1] tự đăng xuất một trạm; thiết bị khác không đăng xuất được phiên này', async () => {
    const k = await dung();
    const a = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    const b = await mayMoi(k.tram[1]!.id, k.nv[1]!.maNV);
    const phien = (await t.http().get('/api/cn/khoi-dong').set('Cookie', a)).body.phien[0].id;
    await t.http().delete(`/api/cn/phien-tram/${phien}`).set(HEADER_CLIENT, 'worker').set('Cookie', b).expect(404);
    await t.http().delete(`/api/cn/phien-tram/${phien}`).set(HEADER_CLIENT, 'worker').set('Cookie', a).expect(204);
    expect((await t.prisma.phienTram.findUniqueOrThrow({ where: { id: phien } })).lyDoDong).toBe('TU_DANG_XUAT');
    await t.http().get('/api/cn/form').query({ tramId: k.tram[0]!.id, ngay: T2 }).expect(401); // không cookie
  });

  it('[F12] tra trạm theo QR: hợp lệ → thông tin trạm + công đoạn hôm nay; mã lạ → 404; trạm ngưng → 422', async () => {
    const k = await dung();
    expect((await t.http().get(`/api/cn/tram/${k.tram[0]!.id}`).expect(200)).body).toMatchObject({ soTram: 26, maChuyen: k.chuyen.ma, congDoan: [{ ma: 'CD-1' }, { ma: 'CD-2' }] });
    expect((await t.http().get('/api/cn/tram/khong-phai-uuid').expect(404)).body.code).toBe('QR_KHONG_HOP_LE');
    await t.prisma.tram.update({ where: { id: k.tram[1]!.id }, data: { trangThai: 'NGUNG' } });
    expect((await t.http().get(`/api/cn/tram/${k.tram[1]!.id}`).expect(422)).body.message).toBe('Trạm không còn hoạt động.');
  });
});

describe('Form & ghi sản lượng [TDD 8.2]', () => {
  it('[R 3.6] form hiện đúng công đoạn của sơ đồ NGÀY ĐANG CHỌN, kể cả công đoạn đã gỡ trong ngày; có giờ làm để tính trần', async () => {
    clock.dat(luc(T2, '15:30'));
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    await t.prisma.ganCongDoan.updateMany({ where: { tramId: k.tram[0]!.id, congDoanId: k.cd[1]!.id }, data: { hieuLucDen: luc(T2, '15:00') } });
    const f = (await t.http().get('/api/cn/form').query({ tramId: k.tram[0]!.id, ngay: T2 }).set('Cookie', c).expect(200)).body;
    expect(f).toMatchObject({ soTram: 26, laHomNay: true, gioLam: 9 });
    expect(f.congDoan.map((x: { ma: string; daGo: boolean; smv: number }) => [x.ma, x.daGo, x.smv])).toEqual([['CD-1', false, 30], ['CD-2', true, 60]]);

    // công đoạn đã gỡ vẫn nhập được đến hết ngày, gắn cờ ⚠ [R 3.10]
    await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[1]!.id, soLuong: 40 }] }).expect(200);
    expect((await t.prisma.sanLuong.findFirstOrThrow({ where: { congDoanId: k.cd[1]!.id, nhanVienId: k.nv[0]!.id } })).canhBao).toBe(true);
    // công đoạn không thuộc sơ đồ của trạm → từ chối
    const cdLa = await t.prisma.congDoan.create({ data: { maHangId: k.mh.id, ma: 'CD-9', ten: 'Lạ' } });
    expect((await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: cdLa.id, soLuong: 1 }] }).expect(422)).body.code).toBe('CONG_DOAN_KHONG_THUOC_SO_DO');
  });

  it('[R 1.1] số nhập là tổng trong ngày: lần sau ghi đè; lịch sử (số cũ, số mới, giờ server, giờ thiết bị); số không đổi không sinh lịch sử', async () => {
    clock.dat(luc(T2, '11:00'));
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    const g1 = (await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 60 }, { congDoanId: k.cd[1]!.id, soLuong: 20 }] }).expect(200)).body;
    expect(g1.dong.map((d: { ketQua: string }) => d.ketQua)).toEqual(['DA_LUU', 'DA_LUU']);
    const g2 = (await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 100 }, { congDoanId: k.cd[1]!.id, soLuong: 20 }] }).expect(200)).body;
    expect(g2.dong.map((d: { ketQua: string }) => d.ketQua)).toEqual(['DA_LUU', 'KHONG_DOI']);

    const sl = await t.prisma.sanLuong.findFirstOrThrow({ where: { congDoanId: k.cd[0]!.id, nhanVienId: k.nv[0]!.id }, include: { lichSu: { orderBy: { lucServer: 'asc' } } } });
    expect(sl).toMatchObject({ soLuong: 100, nguon: 'APP', chuyenTramSnapshot: k.chuyen.id });
    expect(Number(sl.smvSnapshot)).toBe(30); // snapshot SMV tại ngày [R 5]
    expect(sl.lichSu.map((l) => [l.soCu, l.soMoi])).toEqual([[null, 60], [60, 100]]);
    expect(await soLichSu(k.cd[1]!.id, k.nv[0]!.id)).toBe(1);
  });

  it('[D19] Thử lại cùng requestId sau khi mất phản hồi → nhận lại đúng DA_LUU, không thêm lịch sử; 2 request cùng requestId đồng thời → không lỗi 500', async () => {
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    const requestId = randomUUID();
    const body = { requestId, tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 50, thuTuThietBi: 1000 }] };
    const r1 = (await ghi(c, body).expect(200)).body;
    const r2 = (await ghi(c, body).expect(200)).body;
    expect(r2).toEqual(r1);
    expect(await soLichSu(k.cd[0]!.id, k.nv[0]!.id)).toBe(1);

    const dongThoi = { ...body, requestId: randomUUID(), dong: [{ congDoanId: k.cd[0]!.id, soLuong: 70, thuTuThietBi: 2000 }] };
    const [a, b] = await Promise.all([ghi(c, dongThoi), ghi(c, dongThoi)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body).toEqual(b.body);
    expect(await soLichSu(k.cd[0]!.id, k.nv[0]!.id)).toBe(2);
  });

  it('[D16] gói cũ đến sau gói mới (cùng thiết bị) → GOI_CU_BO_QUA kèm số hiện tại; NV đổi thiết bị giữa ngày → số mới được ghi', async () => {
    const k = await dung();
    const a = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    await ghi(a, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 80, thuTuThietBi: 5000 }] }).expect(200);
    const cu = (await ghi(a, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 60, thuTuThietBi: 4000 }] }).expect(200)).body;
    expect(cu.dong[0]).toEqual({ congDoanId: k.cd[0]!.id, ketQua: 'GOI_CU_BO_QUA', soHienTai: 80 });

    const b = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV); // chuyển thiết bị; bộ đếm máy mới nhỏ hơn
    const moi = (await ghi(b, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 90, thuTuThietBi: 1 }] }).expect(200)).body;
    expect(moi.dong[0].ketQua).toBe('DA_LUU');
  });

  it('[R 5.4] app không ghi đè Ô đã điều chỉnh — form hiện chỉ đọc kèm số cũ, lý do, người', async () => {
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 101 }] }).expect(200);
    const sl = await t.prisma.sanLuong.findFirstOrThrow({ where: { congDoanId: k.cd[0]!.id, nhanVienId: k.nv[0]!.id } });
    await t.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('vsn.nguoi_thuc_hien', 'test', true)`;
      await tx.sanLuong.update({ where: { id: sl.id }, data: { soLuong: 110, nguon: 'SUA_WEB', daDieuChinh: true, capNhatBoiTaiKhoanId: k.tk.id } });
      await tx.sanLuongLichSu.create({ data: { sanLuongId: sl.id, soCu: 101, soMoi: 110, nguon: 'SUA_WEB', lyDo: 'Công nhân báo lại', loaiNguoiThucHien: 'TAI_KHOAN', nguoiThucHienId: k.tk.id } });
    });
    const res = (await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 120 }] }).expect(200)).body;
    expect(res.dong[0]).toEqual({ congDoanId: k.cd[0]!.id, ketQua: 'O_DA_DIEU_CHINH', soHienTai: 110 });
    const f = (await t.http().get('/api/cn/form').query({ tramId: k.tram[0]!.id, ngay: T2 }).set('Cookie', c)).body;
    expect(f.congDoan[0]).toMatchObject({ soLuong: 110, trangThai: 'DA_DIEU_CHINH', dieuChinh: { soCu: 101, lyDo: 'Công nhân báo lại' } });
  });

  it('[R 3.8] đang nhập thì bị tổ trưởng đăng xuất hộ → Lưu bị từ chối "Bạn đã bị đăng xuất khỏi trạm X lúc hh:mm bởi [tên]"', async () => {
    clock.dat(luc(T2, '14:00'));
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    const tt = await taoTaiKhoan(t, { vaiTro: 'TO_TRUONG', chuyenIds: [k.chuyen.id] });
    await t.prisma.phienTram.updateMany({ where: { tramId: k.tram[0]!.id, dangXuatLuc: null }, data: { dangXuatLuc: luc(T2, '14:05'), lyDoDong: 'DANG_XUAT_HO', dangXuatBoiId: tt.id, lyDo: 'Đổi trạm' } });
    const res = await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 10 }] }).expect(409);
    expect(res.body.message).toBe(`Bạn đã bị đăng xuất khỏi trạm 26 lúc 14:05 bởi ${tt.hoTen} — nhờ tổ trưởng nhập hộ.`);
    const kd = (await t.http().get('/api/cn/khoi-dong').set('Cookie', c)).body;
    expect(kd.thongBao[0]).toMatchObject({ loai: 'DANG_XUAT_HO', soTram: 26, boi: tt.hoTen, lyDo: 'Đổi trạm' });
  });

  it('[D22] Thứ Hai 07:30 vẫn nhập được Thứ 7 chưa chốt; Lưu 00:01 cho hôm qua chưa chốt → nhận; ngày trước nữa → NGAY_KHONG_MO_NHAP; đã chốt → NGAY_DA_CHOT', async () => {
    const k = await dung();
    clock.dat(luc(T7, '17:00'));
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    clock.dat(luc(T2, '07:30'));
    await ghi(c, { tramId: k.tram[0]!.id, ngay: T7, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 10 }] }).expect(200);
    expect((await ghi(c, { tramId: k.tram[0]!.id, ngay: T6, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 10 }] }).expect(422)).body.code).toBe('NGAY_KHONG_MO_NHAP');
    expect((await ghi(c, { tramId: k.tram[0]!.id, ngay: T3, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 10 }] }).expect(422)).body.code).toBe('NGAY_KHONG_MO_NHAP');

    // Thứ 2 làm, 00:01 Thứ 3 lưu cho Thứ 2
    clock.dat(luc(T2, '16:00'));
    await dangNhap(k.tram[0]!.id, k.nv[0]!.maNV, c);
    clock.dat(luc(T3, '00:01'));
    await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 99 }] }).expect(200);

    await t.prisma.chotNgay.create({ data: { chuyenId: k.chuyen.id, ngayLamViec: ngayDb(T2), chotBoiId: k.tk.id } });
    const chot = await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 100 }] }).expect(409);
    expect(chot.body).toMatchObject({ code: 'NGAY_DA_CHOT', message: 'Ngày đã chốt, liên hệ tổ trưởng.' });
    expect((await t.http().get('/api/cn/khoi-dong').set('Cookie', c)).body.phien).toEqual([]); // phiên ngày đã chốt tự hết
  });

  it('[F10] mã hàng × tháng đã khóa → app không lưu được', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    await t.prisma.khoaThang.create({ data: { maHangId: k.mh.id, thang: T2.slice(0, 7), trangThai: 'KHOA', nguoiThucHienId: k.tk.id } });
    expect((await ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 1 }] }).expect(409)).body.code).toBe('THANG_DA_KHOA');
  });
});

describe('Đồng thời [D25] [TDD 8.9]', () => {
  it('[D25] Lưu và Chốt đồng thời: Chốt giữ khóa ĐỘC QUYỀN → Lưu chờ, rồi bị từ chối NGAY_DA_CHOT (không lỗi 500)', async () => {
    clock.dat(luc(T2, '10:00'));
    const k = await dung();
    const c = await mayMoi(k.tram[0]!.id, k.nv[0]!.maNV);
    let luuXong = 0;
    const chot = t.prisma.$transaction(async (tx) => {
      await khoaChuyenNgay(tx, k.chuyen.id, T2, 'DOC_QUYEN');
      await tx.chotNgay.create({ data: { chuyenId: k.chuyen.id, ngayLamViec: ngayDb(T2), chotBoiId: k.tk.id } });
      await new Promise((r) => setTimeout(r, 400));
      expect(luuXong).toBe(0); // Lưu đang chờ khóa
    });
    await new Promise((r) => setTimeout(r, 100));
    const luu = ghi(c, { tramId: k.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 5 }] }).then((r) => { luuXong = Date.now(); return r; });
    const [, res] = await Promise.all([chot, luu]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NGAY_DA_CHOT');
  });

  it('[D25] 35 lần Lưu cùng chuyền đồng thời không xếp hàng, không lỗi', async () => {
    clock.dat(luc(T2, '17:00'));
    const k = await dung(35, 35);
    const cookie: string[] = [];
    for (let i = 0; i < 35; i++) cookie.push(await mayMoi(k.tram[i]!.id, k.nv[i]!.maNV));
    const batDau = performance.now();
    const res = await Promise.all(cookie.map((c, i) =>
      ghi(c, { tramId: k.tram[i]!.id, ngay: T2, dong: [{ congDoanId: k.cd[0]!.id, soLuong: 100 + i }, { congDoanId: k.cd[1]!.id, soLuong: 50 + i }] })));
    const ms = performance.now() - batDau;
    expect(res.map((r) => r.status)).toEqual(Array(35).fill(200));
    expect(await t.prisma.sanLuong.count({ where: { chuyenTramSnapshot: k.chuyen.id, ngayLamViec: ngayDb(T2) } })).toBe(70);
    expect(ms).toBeLessThan(10_000);
  });
});
