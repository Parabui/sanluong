/** Xác thực Web/TV — phiên lưu ở server [D6] [D24] [TDD 9.2] · PRD F8 */
import { COOKIE_PHIEN, HEADER_CLIENT, HEADER_POLLING } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/clock/clock.service.js';
import { bamToken } from '../../src/core/phien/phien-web.service.js';
import {
  type AppTest,
  dangNhap,
  layCookie,
  MAT_KHAU_TEST,
  taoAppTest,
  taoTaiKhoan,
  taoVaDangNhap,
} from '../ho-tro/app.js';

const GIO = 3_600_000;
const clock = new FakeClock(new Date('2026-10-05T08:00:00+07:00'));
let t: AppTest;

beforeAll(async () => {
  t = await taoAppTest({ clock });
});
afterAll(async () => {
  await t.dong();
});

const ghi = () => t.http().post('/api/auth/dang-nhap').set(HEADER_CLIENT, 'web');
/** Route cần quyền DANH_MUC_XUONG_CHUYEN (chỉ Superadmin) */
const routeQuyen = (cookie: string) => t.http().get('/api/xuong').set('Cookie', cookie);

describe('Đăng nhập', () => {
  it('[F8] đúng mật khẩu → cookie vsn_sid HttpOnly; Secure; SameSite=Strict; Path=/api + thông tin tài khoản', async () => {
    const tk = await taoTaiKhoan(t, { vaiTro: 'SUPERADMIN' });
    const res = await ghi().send({ tenDangNhap: `  ${tk.tenDangNhap.toUpperCase()} `, matKhau: MAT_KHAU_TEST }).expect(200);

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${COOKIE_PHIEN}=`))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api/);
    expect(res.body).toMatchObject({ id: tk.id, vaiTro: 'SUPERADMIN', tenPhamVi: 'Toàn nhà máy', phaiDoiMatKhau: false });
    expect(res.body.chucNang).toContain('TAI_KHOAN_QUAN_LY');

    // DB chỉ giữ hash của token, không giữ token gốc [D6]
    const token = layCookie(res.headers['set-cookie']).split('=')[1]!;
    expect(await t.prisma.phienDangNhap.count({ where: { tokenHash: bamToken(token) } })).toBe(1);
    expect(await t.prisma.phienDangNhap.count({ where: { tokenHash: token } })).toBe(0);
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'DANG_NHAP_WEB', doiTuongId: tk.id } })).toBe(1);
  });

  it('[F8] sai mật khẩu hoặc tên không tồn tại → cùng một lỗi SAI_DANG_NHAP (không lộ tài khoản có tồn tại)', async () => {
    const tk = await taoTaiKhoan(t, { vaiTro: 'IE' });
    const a = await ghi().send({ tenDangNhap: tk.tenDangNhap, matKhau: 'sai-mat-khau' }).expect(401);
    const b = await ghi().send({ tenDangNhap: 'khong-ton-tai', matKhau: 'sai-mat-khau' }).expect(401);
    expect(a.body.code).toBe('SAI_DANG_NHAP');
    expect(b.body.message).toBe(a.body.message);
    expect(a.headers['set-cookie']).toBeUndefined();
  });

  it('[F8] sai mật khẩu 5 lần → khóa 15 phút; hết 15 phút đăng nhập lại được', async () => {
    const tk = await taoTaiKhoan(t, { vaiTro: 'IE' });
    for (let i = 1; i <= 4; i++) await ghi().send({ tenDangNhap: tk.tenDangNhap, matKhau: 'sai' }).expect(401);
    const lan5 = await ghi().send({ tenDangNhap: tk.tenDangNhap, matKhau: 'sai' }).expect(429);
    expect(lan5.body.code).toBe('QUA_SO_LAN_SAI');
    expect(lan5.body.message).toMatch(/khóa đến 08:15/);

    // Đang khóa thì mật khẩu đúng cũng bị từ chối
    await ghi().send({ tenDangNhap: tk.tenDangNhap, matKhau: MAT_KHAU_TEST }).expect(429);
    clock.tien(15 * 60_000 + 1);
    await ghi().send({ tenDangNhap: tk.tenDangNhap, matKhau: MAT_KHAU_TEST }).expect(200);
    expect(await t.prisma.taiKhoan.findUnique({ where: { id: tk.id }, select: { soLanSai: true, khoaDen: true } }))
      .toEqual({ soLanSai: 0, khoaDen: null });
  });

  it('[F8] tài khoản vô hiệu hóa không đăng nhập được; đang đăng nhập thì bị đăng xuất ở lần thao tác kế tiếp', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    await routeQuyen(tk.cookie).expect(200);
    await t.prisma.taiKhoan.update({ where: { id: tk.id }, data: { trangThai: 'NGUNG' } });

    const res = await routeQuyen(tk.cookie).expect(401);
    expect(res.body.code).toBe('PHIEN_HET_HAN');
    const lai = await ghi().send({ tenDangNhap: tk.tenDangNhap, matKhau: MAT_KHAU_TEST }).expect(403);
    expect(lai.body.code).toBe('TAI_KHOAN_VO_HIEU');
  });

  it('[D6] không cookie → 401 CHUA_DANG_NHAP; cookie giả → 401 PHIEN_HET_HAN', async () => {
    expect((await t.http().get('/api/xuong').expect(401)).body.code).toBe('CHUA_DANG_NHAP');
    expect((await routeQuyen(`${COOKIE_PHIEN}=gia-mao`).expect(401)).body.code).toBe('PHIEN_HET_HAN');
  });
});

describe('Hết hạn phiên', () => {
  it('[F8] phiên Web hết hạn sau 8 giờ không thao tác', async () => {
    const conHan = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    const hetHan = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    clock.tien(4 * GIO);
    await routeQuyen(conHan.cookie).expect(200); // thao tác → tính lại 8 giờ từ đây
    clock.tien(4 * GIO + 60_000);
    await routeQuyen(conHan.cookie).expect(200);
    expect((await routeQuyen(hetHan.cookie).expect(401)).body.code).toBe('PHIEN_HET_HAN');
    expect(await t.prisma.phienDangNhap.count({ where: { taiKhoanId: hetHan.id } })).toBe(0); // phiên hết hạn bị xóa
  });

  it('[D24] phiên Web tối đa 12 giờ kể từ đăng nhập, kể cả khi vẫn thao tác', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    for (let i = 0; i < 5; i++) {
      clock.tien(2 * GIO);
      await routeQuyen(tk.cookie).expect(200);
    }
    clock.tien(2 * GIO + 60_000);
    await routeQuyen(tk.cookie).expect(401);
  });

  it('[D24] request polling (X-VSN-Polling: 1) không gia hạn phiên', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    for (let i = 0; i < 3; i++) {
      clock.tien(2 * GIO + 60_000);
      await routeQuyen(tk.cookie).set(HEADER_POLLING, '1').expect(200);
    }
    clock.tien(2 * GIO);
    // 8 giờ 3 phút kể từ thao tác thật cuối cùng (lúc đăng nhập) — polling suốt thời gian đó không tính
    await routeQuyen(tk.cookie).set(HEADER_POLLING, '1').expect(401);
  });
});

describe('Tài khoản TV', () => {
  it('[D24] chỉ đăng nhập / dùng được từ IP nhà máy; phiên không hết hạn', async () => {
    await t.prisma.cauHinh.update({ where: { khoa: 'ipNhaMay' }, data: { giaTri: ['203.0.113.5'] } });
    const tk = await taoTaiKhoan(t, { vaiTro: 'TV' });
    const dn = (ip: string) => ghi().set('X-Forwarded-For', ip).send({ tenDangNhap: tk.tenDangNhap, matKhau: MAT_KHAU_TEST });

    expect((await dn('198.51.100.7').expect(403)).body.message).toMatch(/mạng nhà máy/);
    const res = await dn('203.0.113.5').expect(200);
    const cookie = layCookie(res.headers['set-cookie']);
    const toi = (ip: string) => t.http().get('/api/auth/toi').set('X-Forwarded-For', ip).set('Cookie', cookie);

    clock.tien(30 * 24 * GIO);
    expect((await toi('203.0.113.5').expect(200)).body.chucNang).toEqual(['DASHBOARD_XEM']);
    await toi('198.51.100.7').expect(401);
    await toi('203.0.113.5').expect(200); // mang TV về lại xưởng vẫn dùng tiếp
  });

  it('[R 5.12] thu hồi phiên TV = xóa dòng PhienDangNhap → bắt buộc đăng nhập lại', async () => {
    const tk = await taoTaiKhoan(t, { vaiTro: 'TV' });
    const res = await ghi().set('X-Forwarded-For', '203.0.113.5').send({ tenDangNhap: tk.tenDangNhap, matKhau: MAT_KHAU_TEST }).expect(200);
    const cookie = layCookie(res.headers['set-cookie']);
    await t.prisma.phienDangNhap.deleteMany({ where: { taiKhoanId: tk.id } });
    await t.http().get('/api/auth/toi').set('X-Forwarded-For', '203.0.113.5').set('Cookie', cookie).expect(401);
  });
});

describe('Đổi mật khẩu & đăng xuất', () => {
  it('[F8] lần đầu đăng nhập bắt buộc đổi mật khẩu: chỉ /auth/* dùng được cho đến khi đổi', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN', phaiDoiMatKhau: true });
    expect((await routeQuyen(tk.cookie).expect(403)).body.code).toBe('PHAI_DOI_MAT_KHAU');
    expect((await t.http().get('/api/auth/toi').set('Cookie', tk.cookie).expect(200)).body.phaiDoiMatKhau).toBe(true);

    const doi = (body: object) => t.http().post('/api/auth/doi-mat-khau').set(HEADER_CLIENT, 'web').set('Cookie', tk.cookie).send(body);
    expect((await doi({ matKhauHienTai: 'sai', matKhauMoi: 'MoiMoi123' }).expect(422)).body.field).toBe('matKhauHienTai');
    expect((await doi({ matKhauHienTai: MAT_KHAU_TEST, matKhauMoi: 'ngan1' }).expect(400)).body.field).toBe('matKhauMoi');
    await doi({ matKhauHienTai: MAT_KHAU_TEST, matKhauMoi: 'chiconchu' }).expect(400);
    await doi({ matKhauHienTai: MAT_KHAU_TEST, matKhauMoi: MAT_KHAU_TEST }).expect(400);

    const ok = await doi({ matKhauHienTai: MAT_KHAU_TEST, matKhauMoi: 'MoiMoi123' }).expect(200);
    expect(ok.body.phaiDoiMatKhau).toBe(false);
    await routeQuyen(tk.cookie).expect(200);
    await dangNhap(t, tk.tenDangNhap, 'MoiMoi123');
    // Audit không chứa mật khẩu
    const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { hanhDong: 'DOI_MAT_KHAU', doiTuongId: tk.id } });
    expect(JSON.stringify(audit)).not.toMatch(/MoiMoi123|\$2[aby]\$/);
  });

  it('[TDD 9.2] đổi mật khẩu → các phiên KHÁC của tài khoản bị thu hồi, phiên hiện tại giữ nguyên', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    const khac = await dangNhap(t, tk.tenDangNhap);
    await t.http().post('/api/auth/doi-mat-khau').set(HEADER_CLIENT, 'web').set('Cookie', tk.cookie)
      .send({ matKhauHienTai: MAT_KHAU_TEST, matKhauMoi: 'MoiMoi456' }).expect(200);
    await routeQuyen(tk.cookie).expect(200);
    await routeQuyen(khac).expect(401);
  });

  it('[F8] đăng xuất → xóa phiên ở server và cookie', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    const res = await t.http().post('/api/auth/dang-xuat').set(HEADER_CLIENT, 'web').set('Cookie', tk.cookie).expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(new RegExp(`${COOKIE_PHIEN}=;`));
    await routeQuyen(tk.cookie).expect(401);
  });

  it('[D6] đăng xuất thiếu header X-VSN-Client → 403 (chống CSRF)', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    await t.http().post('/api/auth/dang-xuat').set('Cookie', tk.cookie).expect(403);
    await routeQuyen(tk.cookie).expect(200);
  });
});
