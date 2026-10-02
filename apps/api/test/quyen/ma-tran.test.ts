/**
 * Kiểm chứng phân quyền [D8] [TDD 10.3]: mọi route × 8 vai trò so với ma trận PRD F8,
 * truy cập ngoài phạm vi bị 403 + audit.
 */
import { HEADER_CLIENT, QUYEN_MAC_DINH, VAI_TRO, type ChucNang, type VaiTro } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KiemTraRouteService } from '../../src/core/quyen/kiem-tra-route.service.js';
import { type AppTest, taoAppTest, taoChuyenNhanh, taoTaiKhoan, taoVaDangNhap } from '../ho-tro/app.js';
import { MA_TRAN_PRD, ROUTE } from './ma-tran.data.js';

const IP_NHA_MAY = '203.0.113.5';
let t: AppTest;
const cookie = {} as Record<VaiTro, string>;
const UUID_GIA = '018f0000-0000-7000-8000-000000000000';

beforeAll(async () => {
  t = await taoAppTest();
  await t.prisma.cauHinh.update({ where: { khoa: 'ipNhaMay' }, data: { giaTri: [IP_NHA_MAY] } });
  const { chuyen, xuongId } = await taoChuyenNhanh(t);
  for (const vaiTro of VAI_TRO) {
    const tc = vaiTro === 'TO_TRUONG' ? { chuyenIds: [chuyen.id] } : vaiTro === 'QUAN_LY_XUONG' ? { xuongIds: [xuongId] } : {};
    const tk = await taoTaiKhoan(t, { vaiTro, ...tc });
    const res = await t.http().post('/api/auth/dang-nhap').set(HEADER_CLIENT, 'web').set('X-Forwarded-For', IP_NHA_MAY)
      .send({ tenDangNhap: tk.tenDangNhap, matKhau: 'MatKhau123' }).expect(200);
    cookie[vaiTro] = String(res.headers['set-cookie']).split(';')[0]!;
  }
});
afterAll(async () => {
  await t.dong();
});

function goi(route: string, c?: string) {
  const [method, duongDan] = route.split(' ') as [string, string];
  const url = duongDan.replace(/:[a-zA-Z]+/g, UUID_GIA);
  let req = t.http()[method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete'](url)
    .set(HEADER_CLIENT, 'web')
    .set('X-Forwarded-For', IP_NHA_MAY);
  if (c) req = req.set('Cookie', c);
  return method === 'GET' ? req : req.send({}); // body rỗng → nếu qua được guard thì dừng ở 400 validation, không ghi gì
}

/** Bật/tắt một ô ma trận rồi chạy fn — luôn khôi phục */
async function voiQuyen(vaiTro: VaiTro, chucNang: ChucNang, batTat: boolean, fn: () => Promise<void>) {
  const cu = await t.prisma.quyenVaiTro.findUniqueOrThrow({ where: { vaiTro_chucNang: { vaiTro, chucNang } } });
  await t.prisma.quyenVaiTro.update({ where: { vaiTro_chucNang: { vaiTro, chucNang } }, data: { batTat } });
  t.quyen.xoaCache();
  try {
    await fn();
  } finally {
    await t.prisma.quyenVaiTro.update({ where: { vaiTro_chucNang: { vaiTro, chucNang } }, data: { batTat: cu.batTat } });
    t.quyen.xoaCache();
  }
}

describe('Ma trận', () => {
  it('[F8] QUYEN_MAC_DINH trong code khớp ma trận PRD F8', () => {
    for (const cn of Object.keys(MA_TRAN_PRD) as ChucNang[]) {
      expect([...QUYEN_MAC_DINH[cn]].sort(), cn).toEqual([...MA_TRAN_PRD[cn]].sort());
    }
    expect(Object.keys(QUYEN_MAC_DINH).sort()).toEqual(Object.keys(MA_TRAN_PRD).sort());
  });

  it('[D8] mọi route của API đều có trong ma-tran.data.ts với đúng quyền khai báo', () => {
    const thucTe = Object.fromEntries(t.app.get(KiemTraRouteService).danhSach().map((r) => [r.route, r.quyen]));
    expect(thucTe).toEqual(ROUTE);
  });

  const routeQuyen = Object.entries(ROUTE).filter((e): e is [string, ChucNang[]] => Array.isArray(e[1]));
  for (const [route, chucNang] of routeQuyen) {
    it(`[F8] ${route} × 8 vai trò`, async () => {
      for (const vaiTro of VAI_TRO) {
        const duocPhep = chucNang.some((cn) => MA_TRAN_PRD[cn].includes(vaiTro));
        const res = await goi(route, cookie[vaiTro]);
        // Qua guard: không 401 và không 403 KHONG_CO_QUYEN (403 khác — vd. CHI_SUPERADMIN — là quy tắc riêng của route)
        if (duocPhep) expect(res.status === 401 || res.body.code === 'KHONG_CO_QUYEN', `${vaiTro} phải được qua guard (nhận ${res.status} ${res.body.code})`).toBe(false);
        else expect({ vaiTro, status: res.status, code: res.body.code }).toEqual({ vaiTro, status: 403, code: 'KHONG_CO_QUYEN' });
      }
      expect((await goi(route)).status, 'không có phiên').toBe(401);
    });
  }

  it('[D8] route công khai không cần phiên; route chỉ cần đăng nhập thì mọi vai trò đều dùng được', async () => {
    await goi('GET /api/health').expect(200);
    expect((await goi('POST /api/auth/dang-nhap')).status).toBe(400);
    for (const vaiTro of VAI_TRO) await goi('GET /api/auth/toi', cookie[vaiTro]).expect(200);
    await goi('GET /api/auth/toi').expect(401);
  });

  it('[F8] Superadmin tắt một chức năng của vai trò → có hiệu lực ngay ở request kế tiếp', async () => {
    await goi('POST /api/xuong', cookie.IE).expect(403);
    await voiQuyen('IE', 'DANH_MUC_XUONG_CHUYEN', true, async () => {
      await goi('POST /api/xuong', cookie.IE).expect(400); // qua guard, dừng ở validation
    });
    await voiQuyen('SUPERADMIN', 'DANH_MUC_XUONG_CHUYEN', false, async () => {
      await goi('POST /api/xuong', cookie.SUPERADMIN).expect(403);
    });
    await goi('POST /api/xuong', cookie.SUPERADMIN).expect(400); // qua guard, dừng ở validation
  });

  it('[F8] truy cập ngoài quyền → audit TU_CHOI_TRUY_CAP, gộp theo (người, route, phút)', async () => {
    const tk = await taoVaDangNhap(t, { vaiTro: 'KE_HOACH' });
    await goi('GET /api/xuong', tk.cookie).expect(403);
    await goi('GET /api/xuong', tk.cookie).expect(403);
    const audit = await t.prisma.auditLog.findMany({ where: { hanhDong: 'TU_CHOI_TRUY_CAP', nguoiThucHienId: tk.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ doiTuongId: 'GET /api/xuong', lyDo: 'CHUC_NANG' });
  });
});

describe('Phạm vi', () => {
  it('[R 5.8] tổ trưởng chỉ thấy chuyền được gắn; gọi chuyenId ngoài phạm vi → 403 + audit, không trả rỗng', async () => {
    const a = await taoChuyenNhanh(t);
    const b = await taoChuyenNhanh(t, { xuongId: a.xuongId });
    const tt = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [a.chuyen.id] });
    await voiQuyen('TO_TRUONG', 'DANH_MUC_XUONG_CHUYEN', true, async () => {
      const ds = (await goi('GET /api/chuyen', tt.cookie).expect(200)).body as { id: string }[];
      expect(ds.map((c) => c.id)).toEqual([a.chuyen.id]);
      await t.http().get(`/api/chuyen/${a.chuyen.id}/tram`).set('Cookie', tt.cookie).expect(200);

      const res = await t.http().get(`/api/chuyen/${b.chuyen.id}/tram`).set('Cookie', tt.cookie).expect(403);
      expect(res.body.code).toBe('KHONG_CO_QUYEN');
      expect(await t.prisma.auditLog.count({ where: { hanhDong: 'TU_CHOI_TRUY_CAP', nguoiThucHienId: tt.id, lyDo: 'PHAM_VI' } })).toBe(1);
    });
  });

  it('[F8] gỡ chuyền khỏi tổ trưởng → có hiệu lực ngay ở lần thao tác kế tiếp', async () => {
    const a = await taoChuyenNhanh(t);
    const b = await taoChuyenNhanh(t, { xuongId: a.xuongId });
    const tt = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [a.chuyen.id, b.chuyen.id] });
    await voiQuyen('TO_TRUONG', 'DANH_MUC_XUONG_CHUYEN', true, async () => {
      await t.http().get(`/api/chuyen/${b.chuyen.id}/tram`).set('Cookie', tt.cookie).expect(200);
      await t.prisma.taiKhoanChuyen.delete({ where: { taiKhoanId_chuyenId: { taiKhoanId: tt.id, chuyenId: b.chuyen.id } } });
      await t.http().get(`/api/chuyen/${b.chuyen.id}/tram`).set('Cookie', tt.cookie).expect(403);
    });
  });

  it('[F8] quản lý xưởng chỉ lọc được xưởng được gắn', async () => {
    const a = await taoChuyenNhanh(t);
    const b = await taoChuyenNhanh(t);
    const ql = await taoVaDangNhap(t, { vaiTro: 'QUAN_LY_XUONG', xuongIds: [a.xuongId] });
    await voiQuyen('QUAN_LY_XUONG', 'DANH_MUC_XUONG_CHUYEN', true, async () => {
      const ds = (await t.http().get('/api/chuyen').set('Cookie', ql.cookie).expect(200)).body as { xuongId: string }[];
      expect(new Set(ds.map((c) => c.xuongId))).toEqual(new Set([a.xuongId]));
      await t.http().get(`/api/chuyen?xuongId=${b.xuongId}`).set('Cookie', ql.cookie).expect(403);
      await t.http().get(`/api/chuyen/${b.chuyen.id}/tram`).set('Cookie', ql.cookie).expect(403);
      await t.http().get(`/api/chuyen/${a.chuyen.id}/tram`).set('Cookie', ql.cookie).expect(200);
    });
  });

  it('[F8] tên phạm vi hiển thị theo mã chuyền / tên xưởng', async () => {
    const a = await taoChuyenNhanh(t);
    const tt = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [a.chuyen.id] });
    expect((await goi('GET /api/auth/toi', tt.cookie).expect(200)).body).toMatchObject({
      phamVi: { loai: 'CHUYEN', chuyenIds: [a.chuyen.id] },
      tenPhamVi: a.chuyen.ma,
    });
  });
});
