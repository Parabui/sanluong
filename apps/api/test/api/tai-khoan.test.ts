/** Tài khoản & phân quyền Web · PRD F8 */
import { CHUC_NANG, HEADER_CLIENT, VAI_TRO } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppTest, dangNhap, MAT_KHAU_TEST, ngauNhien, taoAppTest, taoChuyenNhanh, taoTaiKhoan, taoVaDangNhap } from '../ho-tro/app.js';

let t: AppTest;
let sa: { cookie: string; id: string };
let c1: string;
let c2: string;
let x1: string;

beforeAll(async () => {
  t = await taoAppTest();
  sa = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
  const a = await taoChuyenNhanh(t);
  const b = await taoChuyenNhanh(t, { xuongId: a.xuongId });
  c1 = a.chuyen.id;
  c2 = b.chuyen.id;
  x1 = a.xuongId;
});
afterAll(async () => {
  await t.dong();
});

const req = (method: 'get' | 'post' | 'patch' | 'put', url: string, cookie = sa.cookie) =>
  t.http()[method](url).set('Cookie', cookie).set(HEADER_CLIENT, 'web');
const taoApi = (body: object) => req('post', '/api/tai-khoan').send({ hoTen: 'Người mới', matKhauTam: 'TamThoi123', ...body });
const ten = () => ngauNhien('tk.').toLowerCase();

describe('Tạo tài khoản', () => {
  it('[R 1.5] Tổ trưởng phải gắn ≥ 1 chuyền, Quản lý xưởng ≥ 1 xưởng; vai trò khác không gắn phạm vi', async () => {
    expect((await taoApi({ tenDangNhap: ten(), vaiTro: 'TO_TRUONG' }).expect(400)).body.field).toBe('chuyenIds');
    expect((await taoApi({ tenDangNhap: ten(), vaiTro: 'QUAN_LY_XUONG' }).expect(400)).body.field).toBe('xuongIds');
    const tt = (await taoApi({ tenDangNhap: ten(), vaiTro: 'TO_TRUONG', chuyenIds: [c1, c2] }).expect(201)).body;
    expect(tt).toMatchObject({ vaiTro: 'TO_TRUONG', chuyenIds: expect.arrayContaining([c1, c2]), phaiDoiMatKhau: true });
    const ie = (await taoApi({ tenDangNhap: ten(), vaiTro: 'IE', chuyenIds: [c1] }).expect(201)).body;
    expect(ie).toMatchObject({ chuyenIds: [], xuongIds: [], tenPhamVi: 'Toàn nhà máy' });
  });

  it('[F8] tên đăng nhập trùng → báo trùng; lần đầu đăng nhập bắt buộc đổi mật khẩu', async () => {
    const tdn = ten();
    await taoApi({ tenDangNhap: tdn, vaiTro: 'IE' }).expect(201);
    expect((await taoApi({ tenDangNhap: tdn.toUpperCase(), vaiTro: 'IE' }).expect(409)).body).toMatchObject({ code: 'TRUNG_MA', field: 'tenDangNhap' });
    const cookie = await dangNhap(t, tdn, 'TamThoi123');
    expect((await t.http().get('/api/nhan-vien').set('Cookie', cookie).expect(403)).body.code).toBe('PHAI_DOI_MAT_KHAU');
  });

  it('[F8] chuyền không tồn tại / đã ngưng → không gắn được', async () => {
    const { chuyen } = await taoChuyenNhanh(t);
    await t.prisma.chuyen.update({ where: { id: chuyen.id }, data: { trangThai: 'NGUNG' } });
    expect((await taoApi({ tenDangNhap: ten(), vaiTro: 'TO_TRUONG', chuyenIds: [chuyen.id] }).expect(400)).body.field).toBe('chuyenIds');
  });
});

describe('Sửa tài khoản', () => {
  it('[F8] gỡ hết chuyền của tổ trưởng / hết xưởng của quản lý → chặn "Phải gắn ít nhất 1"', async () => {
    const tt = (await taoApi({ tenDangNhap: ten(), vaiTro: 'TO_TRUONG', chuyenIds: [c1] }).expect(201)).body;
    expect((await req('patch', `/api/tai-khoan/${tt.id}`).send({ chuyenIds: [], version: tt.version }).expect(422)).body.code).toBe('PHAI_GAN_PHAM_VI');
    const ql = (await taoApi({ tenDangNhap: ten(), vaiTro: 'QUAN_LY_XUONG', xuongIds: [x1] }).expect(201)).body;
    expect((await req('patch', `/api/tai-khoan/${ql.id}`).send({ xuongIds: [], version: ql.version }).expect(422)).body.code).toBe('PHAI_GAN_PHAM_VI');
  });

  it('[F8] đổi phạm vi có hiệu lực ngay + ghi lịch sử; đổi vai trò khỏi Tổ trưởng → bỏ phạm vi chuyền', async () => {
    const tt = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [c1] });
    const truoc = (await req('get', '/api/tai-khoan').expect(200)).body.find((x: { id: string }) => x.id === tt.id);
    const sau = (await req('patch', `/api/tai-khoan/${tt.id}`).send({ chuyenIds: [c2], version: truoc.version }).expect(200)).body;
    expect(sau.chuyenIds).toEqual([c2]);
    expect((await t.http().get('/api/auth/toi').set('Cookie', tt.cookie).expect(200)).body.phamVi).toEqual({ loai: 'CHUYEN', chuyenIds: [c2] });
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'DOI_PHAM_VI', doiTuongId: tt.id } })).toBe(1);

    const ie = (await req('patch', `/api/tai-khoan/${tt.id}`).send({ vaiTro: 'IE', version: sau.version }).expect(200)).body;
    expect(ie).toMatchObject({ vaiTro: 'IE', chuyenIds: [], tenPhamVi: 'Toàn nhà máy' });
    expect((await t.http().get('/api/auth/toi').set('Cookie', tt.cookie).expect(200)).body.vaiTro).toBe('IE');
  });

  it('[F8] vô hiệu hóa → đăng xuất ở lần thao tác kế tiếp; lịch sử giữ nguyên', async () => {
    const hr = await taoVaDangNhap(t, { vaiTro: 'IT_HR' });
    await t.http().get('/api/nhan-vien').set('Cookie', hr.cookie).expect(200);
    const tk = (await req('get', '/api/tai-khoan').expect(200)).body.find((x: { id: string }) => x.id === hr.id);
    expect(tk.lanDangNhapCuoi).not.toBeNull();
    await req('patch', `/api/tai-khoan/${hr.id}`).send({ trangThai: 'NGUNG', version: tk.version }).expect(200);
    await t.http().get('/api/nhan-vien').set('Cookie', hr.cookie).expect(401);
    expect(await t.prisma.auditLog.count({ where: { doiTuongId: hr.id } })).toBeGreaterThan(1);
  });

  it('[F8] Superadmin cuối cùng không tự vô hiệu hóa / hạ vai trò được', async () => {
    const khac = await t.prisma.taiKhoan.findMany({ where: { vaiTro: 'SUPERADMIN', trangThai: 'HOAT_DONG', id: { not: sa.id } }, select: { id: true } });
    await t.prisma.taiKhoan.updateMany({ where: { id: { in: khac.map((k) => k.id) } }, data: { trangThai: 'NGUNG' } });
    try {
      const toi = (await req('get', '/api/tai-khoan').expect(200)).body.find((x: { id: string }) => x.id === sa.id);
      expect((await req('patch', `/api/tai-khoan/${sa.id}`).send({ trangThai: 'NGUNG', version: toi.version }).expect(422)).body.code).toBe('SUPERADMIN_CUOI_CUNG');
      expect((await req('patch', `/api/tai-khoan/${sa.id}`).send({ vaiTro: 'IE', version: toi.version }).expect(422)).body.code).toBe('SUPERADMIN_CUOI_CUNG');
      // Còn Superadmin khác thì được
      const sa2 = await taoTaiKhoan(t, { vaiTro: 'SUPERADMIN' });
      const tk2 = (await req('get', '/api/tai-khoan').expect(200)).body.find((x: { id: string }) => x.id === sa2.id);
      await req('patch', `/api/tai-khoan/${sa2.id}`).send({ trangThai: 'NGUNG', version: tk2.version }).expect(200);
    } finally {
      await t.prisma.taiKhoan.updateMany({ where: { id: { in: khac.map((k) => k.id) } }, data: { trangThai: 'HOAT_DONG' } });
    }
  });

  it('[F8] Superadmin đặt lại mật khẩu → phải đổi ở lần đăng nhập sau, thu hồi phiên, mở khóa sai mật khẩu', async () => {
    const ie = await taoVaDangNhap(t, { vaiTro: 'IE' });
    await t.prisma.taiKhoan.update({ where: { id: ie.id }, data: { khoaDen: new Date(Date.now() + 3_600_000), soLanSai: 3 } });
    const res = (await req('post', `/api/tai-khoan/${ie.id}/dat-lai-mat-khau`).send({ matKhauTam: 'DatLai123' }).expect(200)).body;
    expect(res).toMatchObject({ phaiDoiMatKhau: true, khoaDen: null });
    await t.http().get('/api/auth/toi').set('Cookie', ie.cookie).expect(401);
    await dangNhap(t, ie.tenDangNhap, MAT_KHAU_TEST).catch(() => 'sai');
    const moi = await dangNhap(t, ie.tenDangNhap, 'DatLai123');
    expect((await t.http().get('/api/auth/toi').set('Cookie', moi).expect(200)).body.phaiDoiMatKhau).toBe(true);
    expect((await req('post', `/api/tai-khoan/${ie.id}/dat-lai-mat-khau`).send({ matKhauTam: 'yeu' }).expect(400)).body.field).toBe('matKhauTam');
  });

  it('[R 5.12] thu hồi phiên TV', async () => {
    const tv = await taoTaiKhoan(t, { vaiTro: 'TV' });
    await t.prisma.phienDangNhap.create({ data: { tokenHash: ngauNhien('h'), taiKhoanId: tv.id, loai: 'TV' } });
    expect((await req('post', `/api/tai-khoan/${tv.id}/thu-hoi-phien`).expect(200)).body).toEqual({ soPhien: 1 });
    expect(await t.prisma.phienDangNhap.count({ where: { taiKhoanId: tv.id } })).toBe(0);
  });
});

describe('Ma trận quyền', () => {
  const doc = async () => (await req('get', '/api/quyen-vai-tro').expect(200)).body as { vaiTro: string; chucNang: string; batTat: boolean; lyDoKhoa: string | null }[];

  it('[F8] đủ 8 vai trò × 17 chức năng; ô khóa: quản lý tài khoản của Superadmin, chức năng ngoài dashboard của TV', async () => {
    const mt = await doc();
    expect(mt).toHaveLength(VAI_TRO.length * CHUC_NANG.length);
    expect(mt.find((o) => o.vaiTro === 'SUPERADMIN' && o.chucNang === 'TAI_KHOAN_QUAN_LY')).toMatchObject({ batTat: true, lyDoKhoa: expect.any(String) });
    expect(mt.filter((o) => o.vaiTro === 'TV' && o.lyDoKhoa === null).map((o) => o.chucNang)).toEqual(['DASHBOARD_XEM']);
  });

  it('[F8] không tắt được quyền quản lý tài khoản của Superadmin; không mở thêm chức năng cho TV [D24]', async () => {
    await req('put', '/api/quyen-vai-tro').send({ thayDoi: [{ vaiTro: 'SUPERADMIN', chucNang: 'TAI_KHOAN_QUAN_LY', batTat: false }] }).expect(403);
    await req('put', '/api/quyen-vai-tro').send({ thayDoi: [{ vaiTro: 'TV', chucNang: 'BAO_CAO_XEM', batTat: true }] }).expect(403);
  });

  it('[F8] Superadmin bật/tắt chức năng theo vai trò → có hiệu lực ngay, ghi lịch sử', async () => {
    const ie = await taoVaDangNhap(t, { vaiTro: 'IE' });
    await t.http().get('/api/nhan-vien').set('Cookie', ie.cookie).expect(403);
    const o = { vaiTro: 'IE', chucNang: 'NHAN_VIEN_QUAN_LY' };
    try {
      const mt = (await req('put', '/api/quyen-vai-tro').send({ thayDoi: [{ ...o, batTat: true }] }).expect(200)).body;
      expect(mt.find((x: typeof o) => x.vaiTro === o.vaiTro && x.chucNang === o.chucNang).batTat).toBe(true);
      await t.http().get('/api/nhan-vien').set('Cookie', ie.cookie).expect(200);
      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { hanhDong: 'DOI_QUYEN_VAI_TRO' }, orderBy: { luc: 'desc' } });
      expect(audit.duLieuMoi).toEqual({ thayDoi: [{ ...o, batTat: true }] });
    } finally {
      await req('put', '/api/quyen-vai-tro').send({ thayDoi: [{ ...o, batTat: false }] }).expect(200);
    }
    await t.http().get('/api/nhan-vien').set('Cookie', ie.cookie).expect(403);
  });
});
