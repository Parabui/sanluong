/**
 * Hệ thống · tuần 11: audit log, cài đặt hệ thống, health chi tiết (Uptime Kuma), việc định kỳ [TDD 12, 15.2, 18, 19].
 */
import { randomUUID } from 'node:crypto';
import { congNgay, HEADER_CLIENT, homNay, thuIso } from '@vsn/shared';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/clock/clock.service.js';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { BaoTriService } from '../../src/modules/he-thong/bao-tri.service.js';
import { type AppTest, dangNhap, ngauNhien, taoAppTest, taoTaiKhoan, type TaiKhoanTest } from '../ho-tro/app.js';
import { type Db, ketNoi } from '../ho-tro/db.js';

let T2 = congNgay(homNay(new Date()), 2);
while (thuIso(T2) !== 1) T2 = congNgay(T2, 1);
const T3 = congNgay(T2, 1);
const luc = (ngay: string, gio = '10:00') => new Date(`${ngay}T${gio}:00+07:00`);

const clock = new FakeClock(luc(T2));
let t: AppTest;
let chu: Db;
beforeAll(async () => {
  t = await taoAppTest({ clock });
  chu = await ketNoi('vsn_migrate');
});
afterAll(async () => {
  delete process.env['UPTIME_TOKEN'];
  await chu.end();
  await t.dong();
});

async function web(tk: TaiKhoanTest) {
  const cookie = await dangNhap(t, tk.tenDangNhap);
  const dat = <R extends { set: (k: string, v: string) => R }>(r: R) => r.set(HEADER_CLIENT, 'web').set('Cookie', cookie);
  return {
    cookie,
    get: (url: string) => dat(t.http().get(url)),
    put: (url: string, body: object) => dat(t.http().put(url)).send(body),
    post: (url: string, body: object = {}) => dat(t.http().post(url)).send(body),
    excel: async (url: string) => {
      const r = await dat(t.http().get(url)).buffer(true).parse((res, cb) => {
        const parts: Buffer[] = [];
        res.on('data', (c: Buffer) => parts.push(c));
        res.on('end', () => cb(null, Buffer.concat(parts)));
      });
      if (r.status !== 200) return { status: r.status, wb: null };
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(r.body as unknown as ArrayBuffer);
      return { status: r.status, wb };
    },
  };
}

describe('Audit log [F8] [TDD 12]', () => {
  it('Superadmin xem theo khoảng ngày, lọc hành động / người, phân trang; xuất Excel cùng dữ liệu', async () => {
    clock.dat(luc(T2));
    const sa = await taoTaiKhoan(t, { vaiTro: 'SUPERADMIN' });
    const w = await web(sa);
    const x = await w.post('/api/xuong', { ma: ngauNhien('X'), ten: 'Xưởng audit' });
    expect(x.status, JSON.stringify(x.body)).toBe(201);

    const ds = (await w.get(`/api/audit-log?tu=${T2}&den=${T2}&q=${sa.tenDangNhap}`).expect(200)).body;
    expect(ds.dsHanhDong).toEqual(expect.arrayContaining(['DANG_NHAP_WEB', 'TAO_XUONG']));
    expect(ds.dong.map((d: { hanhDong: string }) => d.hanhDong)).toEqual(['TAO_XUONG', 'DANG_NHAP_WEB']);
    expect(ds.dong[0]).toMatchObject({ loaiNguoiThucHien: 'TAI_KHOAN', nguoi: sa.tenDangNhap, hoTen: sa.hoTen, doiTuong: 'xuong', doiTuongId: x.body.id });
    expect(ds.dong[0].duLieuMoi).toMatchObject({ ten: 'Xưởng audit' });

    const loc = (await w.get(`/api/audit-log?tu=${T2}&den=${T2}&q=${sa.tenDangNhap}&hanhDong=TAO_XUONG`).expect(200)).body;
    expect(loc.tongDong).toBe(1);
    const p = (await w.get(`/api/audit-log?tu=${T2}&den=${T2}&q=${sa.tenDangNhap}&kichThuoc=1&trang=2`).expect(200)).body;
    expect(p).toMatchObject({ tongDong: 2, trang: 2 });
    expect(p.dong.map((d: { hanhDong: string }) => d.hanhDong)).toEqual(['DANG_NHAP_WEB']);

    const xl = await w.excel(`/api/audit-log/xuat?tu=${T2}&den=${T2}&q=${sa.tenDangNhap}`);
    expect(xl.status).toBe(200);
    expect(xl.wb!.worksheets[0]!.rowCount).toBe(3);
    expect((await w.get(`/api/audit-log?tu=2026-01-01&den=2026-05-01`)).body.message).toBe('Chọn tối đa 3 tháng.');
    // Chỉ Superadmin [TDD 10.1]
    expect((await (await web(await taoTaiKhoan(t, { vaiTro: 'IT_HR' }))).get('/api/audit-log')).status).toBe(403);
  });
});

describe('Cài đặt hệ thống [F8] [R 5.9]', () => {
  it('Superadmin đổi Giờ mở chốt ngày → chốt ngày dùng giờ mới; dữ liệu sai bị chặn; mọi thay đổi ghi audit', async () => {
    clock.dat(luc(T2));
    const sa = await taoTaiKhoan(t, { vaiTro: 'SUPERADMIN' });
    let w = await web(sa);
    const tv = await taoTaiKhoan(t, { vaiTro: 'TV' });
    const truoc = (await w.get('/api/cau-hinh').expect(200)).body;
    expect(truoc.phienTv).toContainEqual(expect.objectContaining({ taiKhoanId: tv.id, soPhien: 0, lanCuoi: null }));

    for (const sai of [{ gioMoChotNgay: '25:00' }, { chuKyLamMoiDashboard: 0 }, { ipNhaMay: ['1.2.3'] }]) {
      expect((await w.put('/api/cau-hinh', { ...truoc.cauHinh, ...sai })).status).toBe(400);
    }
    const kq = await w.put('/api/cau-hinh', { gioMoChotNgay: '06:00', chuKyLamMoiDashboard: 10, ipNhaMay: ['203.0.113.7'] }).expect(200);
    expect(kq.body.cauHinh).toMatchObject({ gioMoChotNgay: '06:00', chuKyLamMoiDashboard: 10, ipNhaMay: ['203.0.113.7'], soNgayNhapLui: truoc.cauHinh.soNgayNhapLui });
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'SUA_CAU_HINH', nguoiThucHienId: sa.id } })).toBe(1);

    // Chốt ngày T2 được từ 06:00 ngày T3
    const x = await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: 'X' } });
    const c = await t.prisma.chuyen.create({ data: { ma: ngauNhien('C'), ten: 'C', loai: 'CHUYEN_MAY', xuongId: x.id } });
    clock.dat(luc(T3, '06:30'));
    w = await web(sa);
    await w.post('/api/chot-ngay', { chuyenId: c.id, ngay: T2, xacNhan: true }).expect(200);
    // trả lại mặc định cho các file test khác
    await w.put('/api/cau-hinh', { ...truoc.cauHinh }).expect(200);
    expect((await (await web(await taoTaiKhoan(t, { vaiTro: 'QUAN_LY_XUONG', xuongIds: [x.id] }))).get('/api/cau-hinh')).status).toBe(403);
  });
});

describe('Health [D24] [TDD 18]', () => {
  it('/api/health công khai chỉ trả { ok }; /api/health/chi-tiet cần token Uptime Kuma hoặc Superadmin', async () => {
    expect((await t.http().get('/api/health').expect(200)).body).toEqual({ ok: true });
    expect((await t.http().get('/api/health/chi-tiet')).status).toBe(403);
    process.env['UPTIME_TOKEN'] = 'token-uptime-kuma-thu-0123456789';
    expect((await t.http().get('/api/health/chi-tiet').set('X-Uptime-Token', 'sai-token-uptime-kuma-012345678')).status).toBe(403);
    const ok = (await t.http().get('/api/health/chi-tiet').set('X-Uptime-Token', 'token-uptime-kuma-thu-0123456789').expect(200)).body;
    expect(ok).toMatchObject({ db: 'ok', migration: expect.stringMatching(/^\d{14}_/), gioServer: clock.now().toISOString() });
    delete process.env['UPTIME_TOKEN'];
    const w = await web(await taoTaiKhoan(t, { vaiTro: 'SUPERADMIN' }));
    expect((await w.get('/api/health/chi-tiet')).status).toBe(200);
    expect((await (await web(await taoTaiKhoan(t, { vaiTro: 'IT_HR' }))).get('/api/health/chi-tiet')).status).toBe(403);
  });
});

describe('Việc định kỳ [TDD 15.2]', () => {
  it('03:00 dọn RequestDaXuLy quá 7 ngày, ImportTam hết hạn, phiên Web quá hạn', async () => {
    clock.dat(luc(T2));
    const bt = t.app.get(BaoTriService);
    const tk = await taoTaiKhoan(t, { vaiTro: 'IE' });
    const cu = randomUUID(), moi = randomUUID();
    await t.prisma.requestDaXuLy.createMany({
      data: [
        { chuTheId: tk.id, requestId: cu, loaiChuThe: 'TAI_KHOAN', luc: new Date(luc(T2).getTime() - 8 * 86_400_000) },
        { chuTheId: tk.id, requestId: moi, loaiChuThe: 'TAI_KHOAN', luc: luc(T2) },
      ],
    });
    await t.prisma.phienDangNhap.create({ data: { tokenHash: randomUUID(), taiKhoanId: tk.id, loai: 'WEB', taoLuc: new Date(luc(T2).getTime() - 13 * 3_600_000) } });
    const kq = await bt.donDep();
    expect(kq.request).toBeGreaterThanOrEqual(1);
    expect(kq.phienWeb).toBeGreaterThanOrEqual(1);
    expect(await t.prisma.requestDaXuLy.count({ where: { requestId: { in: [cu, moi] } } })).toBe(1);
  });

  it('03:30 kiểm tra toàn vẹn: phát hiện bản ghi không có lịch sử, lệch số lịch sử, thiếu SMV snapshot', async () => {
    clock.dat(luc(T2));
    const bt = t.app.get(BaoTriService);
    const truoc = await bt.kiemTraToanVen();
    // Ghi thẳng DB (mô phỏng sửa ngoài ứng dụng) — chỉ trong test
    const x = await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: 'X' } });
    const c = await t.prisma.chuyen.create({ data: { ma: ngauNhien('C'), ten: 'C', loai: 'CHUYEN_MAY', xuongId: x.id, tram: { create: [{ soTram: 1, nhapQuaApp: true }] } }, include: { tram: true } });
    const ie = await taoTaiKhoan(t, { vaiTro: 'IE' });
    const mh = await t.prisma.maHang.create({ data: { ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang: 10 } });
    const cd = await t.prisma.congDoan.create({ data: { maHangId: mh.id, ma: 'CD-1', ten: 'CĐ', laCongDoanHoanThanh: true } });
    await t.prisma.smvLichSu.create({ data: { congDoanId: cd.id, smv: 30, apDungTuNgay: ngayDb('2000-01-01'), nguoiTaoId: ie.id } });
    const nv = await t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen: 'A', chuyenId: c.id } });
    await chu.query(`SELECT set_config('vsn.nguoi_thuc_hien', 'test', false)`);
    await chu.query(
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, smv_snapshot, chuyen_tram_snapshot, nguon)
       VALUES ($1, $2, $3, $4, 10, NULL, $5, 'APP')`,
      [T2, c.tram[0]!.id, cd.id, nv.id, c.id],
    );
    const sau = await bt.kiemTraToanVen();
    expect(sau.thieuSmv).toBe(truoc.thieuSmv + 1);
    expect(sau.khongLichSu).toBe(truoc.khongLichSu + 1);
  });
});
