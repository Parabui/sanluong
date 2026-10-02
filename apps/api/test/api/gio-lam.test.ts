/**
 * Giờ làm · PRD F6 — giờ mặc định theo xưởng × thứ, yêu cầu của công nhân, duyệt / từ chối, sửa trực tiếp, khóa [R 5.7].
 * Ngày test tính TƯƠNG ĐỐI theo hôm nay thật (Thứ Hai kế tiếp) — trigger lịch sử chuyền gốc dùng now() của DB.
 */
import { randomUUID } from 'node:crypto';
import { congNgay, COOKIE_THIET_BI, HEADER_CLIENT, homNay, thuIso } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/clock/clock.service.js';
import { khoaMaHangThang } from '../../src/core/prisma/khoa.js';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { type AppTest, dangNhap, ngauNhien, taoAppTest, taoVaDangNhap } from '../ho-tro/app.js';
import { type Db, ketNoi } from '../ho-tro/db.js';
import { datChuyenGoc } from '../ho-tro/factory.js';

let T2 = congNgay(homNay(new Date()), 2);
while (thuIso(T2) !== 1) T2 = congNgay(T2, 1);
const T3 = congNgay(T2, 1);
const T4 = congNgay(T2, 2);
const T7 = congNgay(T2, -2);
const luc = (ngay: string, gio = '10:00') => new Date(`${ngay}T${gio}:00+07:00`);

const clock = new FakeClock(luc(T2));
let t: AppTest;
let chu: Db; // tài khoản chủ schema — ghi lịch sử chuyền gốc lùi ngày

beforeAll(async () => {
  t = await taoAppTest({ clock });
  chu = await ketNoi('vsn_migrate');
});
afterAll(async () => {
  await chu.end();
  await t.dong();
});

/** Xưởng (giờ mặc định 9 / 8 / trống) + 2 chuyền (A, B) mỗi chuyền 1 trạm app + mã hàng 1 công đoạn gán ở cả 2 trạm + NV chuyền A */
async function dung(tc: { macDinh?: boolean } = {}) {
  const x = await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: `Xưởng ${ngauNhien()}` } });
  if (tc.macDinh !== false) {
    await t.prisma.gioMacDinh.createMany({
      data: [
        { xuongId: x.id, loaiNgay: 'T2_T6', soGio: 9, apDungTuNgay: ngayDb('2026-01-01') },
        { xuongId: x.id, loaiNgay: 'T7', soGio: 8, apDungTuNgay: ngayDb('2026-01-01') },
        { xuongId: x.id, loaiNgay: 'CN', soGio: null, apDungTuNgay: ngayDb('2026-01-01') },
      ],
    });
  }
  const mk = (ma: string) =>
    t.prisma.chuyen.create({
      data: { ma: ngauNhien(ma), ten: ma, loai: 'CHUYEN_MAY', xuongId: x.id, tram: { create: [{ soTram: 1, nhapQuaApp: true }] } },
      include: { tram: true },
    });
  const A = await mk('A');
  const B = await mk('B');
  const ie = await taoVaDangNhap(t, { vaiTro: 'IE' });
  const mh = await t.prisma.maHang.create({ data: { ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang: 1000 } });
  const cd = await t.prisma.congDoan.create({ data: { maHangId: mh.id, ma: 'CD-1', ten: 'May cổ', laCongDoanHoanThanh: true } });
  await t.prisma.smvLichSu.create({ data: { congDoanId: cd.id, smv: 60, apDungTuNgay: ngayDb('2000-01-01'), nguoiTaoId: ie.id } });
  for (const c of [A, B]) {
    await t.prisma.chuyenMaHang.create({ data: { chuyenId: c.id, maHangId: mh.id, batDau: luc('2026-01-01') } });
    await t.prisma.ganCongDoan.create({ data: { tramId: c.tram[0]!.id, congDoanId: cd.id, hieuLucTu: luc('2026-01-01') } });
  }
  const nv = await t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen: 'Nguyễn Thị Lan', chuyenId: A.id } });
  const ttA = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [A.id] });
  const ttB = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [B.id] });
  return { x, A, B, mh, cd, nv, ie, ttA, ttB };
}

const web = (cookie: string) => ({
  get: (url: string) => t.http().get(url).set(HEADER_CLIENT, 'web').set('Cookie', cookie),
  post: (url: string, body: object = {}) => t.http().post(url).set(HEADER_CLIENT, 'web').set('Cookie', cookie).send(body),
  put: (url: string, body: object) => t.http().put(url).set(HEADER_CLIENT, 'web').set('Cookie', cookie).send(body),
});
const cn = (cookie?: string) => {
  const dat = <R extends { set: (k: string, v: string) => R }>(r: R) => (cookie ? r.set(HEADER_CLIENT, 'worker').set('Cookie', cookie) : r.set(HEADER_CLIENT, 'worker'));
  return {
    get: (url: string) => dat(t.http().get(url)),
    post: (url: string, body: object) => dat(t.http().post(url)).send(body),
    put: (url: string, body: object) => dat(t.http().put(url)).send(body),
  };
};
/** Đăng nhập trạm (hôm nay theo clock) → cookie thiết bị */
async function dangNhapTram(tramId: string, maNV: string, cookie?: string): Promise<string> {
  const res = await cn(cookie).post('/api/cn/phien-tram', { tramId, maNV, turnstileToken: 'x' });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const ds = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return ds.find((c) => c.startsWith(`${COOKIE_THIET_BI}=`))?.split(';')[0] ?? cookie!;
}
const luuSanLuong = (cookie: string, tramId: string, ngay: string, congDoanId: string, soLuong: number) =>
  cn(cookie).put('/api/cn/san-luong', { requestId: randomUUID(), tramId, ngay, dong: [{ congDoanId, soLuong, thuTuThietBi: Date.now() }] });
const gioHieuLuc = async (nvId: string, ngay: string) =>
  Number((await chu.query(`SELECT gio_lam_hieu_luc($1, $2) AS g`, [nvId, ngay])).rows[0].g ?? Number.NaN);

describe('Giờ mặc định theo xưởng × thứ [F6 bước 1] [R 4.3]', () => {
  it('chỉ QL xưởng của xưởng được gắn cài được; xưởng khác → 403; Superadmin cài mọi xưởng', async () => {
    clock.dat(luc(T2));
    const k = await dung({ macDinh: false });
    const k2 = await dung();
    const ql = await taoVaDangNhap(t, { vaiTro: 'QUAN_LY_XUONG', xuongIds: [k.x.id] });

    const ds = (await web(ql.cookie).get('/api/gio-mac-dinh').expect(200)).body;
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ xuongId: k.x.id, chuaCai: true, hienTai: { T2_T6: null, T7: null, CN: null }, lichSu: [] });

    const ok = await web(ql.cookie).put('/api/gio-mac-dinh', { xuongId: k.x.id, T2_T6: '9', T7: '8', CN: null }).expect(200);
    expect(ok.body).toMatchObject({ chuaCai: false, hienTai: { T2_T6: 9, T7: 8, CN: null } });
    expect(ok.body.lichSu).toHaveLength(3);

    const khac = await web(ql.cookie).put('/api/gio-mac-dinh', { xuongId: k2.x.id, T2_T6: 9, T7: 8, CN: null });
    expect(khac.status).toBe(403);
    expect(khac.body.code).toBe('KHONG_CO_QUYEN');

    const sa = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    await web(sa.cookie).put('/api/gio-mac-dinh', { xuongId: k2.x.id, T2_T6: 9.5, T7: 8, CN: null }).expect(200);
    // Tổ trưởng không có chức năng này [F8]
    expect((await web(k.ttA.cookie).get('/api/gio-mac-dinh')).status).toBe(403);
  });

  it('đổi giờ mặc định chỉ áp dụng từ ngày thay đổi trở đi (lịch sử theo ngày hiệu lực); sửa lại trong ngày ghi đè dòng hôm nay', async () => {
    clock.dat(luc(T3));
    const k = await dung();
    const sa = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    await web(sa.cookie).put('/api/gio-mac-dinh', { xuongId: k.x.id, T2_T6: '10', T7: 8, CN: null }).expect(200);
    await web(sa.cookie).put('/api/gio-mac-dinh', { xuongId: k.x.id, T2_T6: '10,5', T7: 8, CN: null }).expect(200);
    expect(await gioHieuLuc(k.nv.id, T2)).toBe(9); // ngày trước giữ nguyên
    expect(await gioHieuLuc(k.nv.id, T3)).toBe(10.5);
    expect(await gioHieuLuc(k.nv.id, T4)).toBe(10.5);
    const dong = await t.prisma.gioMacDinh.findMany({ where: { xuongId: k.x.id, loaiNgay: 'T2_T6' } });
    expect(dong).toHaveLength(2); // 01/01 + hôm nay (lần sửa thứ 2 ghi đè dòng hôm nay)
    // T7 / CN không đổi → không ghi thêm dòng
    expect(await t.prisma.gioMacDinh.count({ where: { xuongId: k.x.id, loaiNgay: { in: ['T7', 'CN'] } } })).toBe(2);
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'CAI_GIO_MAC_DINH', doiTuongId: k.x.id } })).toBe(2);
  });

  it('giờ nhận dấu phẩy hoặc chấm, trong khoảng > 0 và ≤ 16; sai → 400 tiếng Việt', async () => {
    const k = await dung();
    const sa = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
    for (const v of ['0', '16,5', 'abc', -1]) {
      const r = await web(sa.cookie).put('/api/gio-mac-dinh', { xuongId: k.x.id, T2_T6: v, T7: 8, CN: null });
      expect(r.status, String(v)).toBe(400);
      expect(r.body.message).toBe('Số giờ phải lớn hơn 0 và không quá 16.');
    }
  });
});

describe('Yêu cầu sửa giờ từ app [F6 bước 2–3]', () => {
  it('công nhân thấy giờ mặc định của Ngày mở nhập; gửi yêu cầu → Chờ duyệt; yêu cầu mới thay thế yêu cầu cũ đang chờ', async () => {
    const k = await dung();
    clock.dat(luc(T7, '16:00'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    clock.dat(luc(T2, '07:30'));
    await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV, may);

    const xem = (await cn(may).get('/api/cn/gio-lam').expect(200)).body;
    expect(xem.ngayMo.map((d: { ngay: string }) => d.ngay)).toEqual([T2, T7]);
    expect(xem.ngayMo[0]).toMatchObject({ ngay: T2, gioMacDinh: 9, gioHieuLuc: 9, nguon: 'MAC_DINH', yeuCauCho: null, biKhoa: false });
    expect(xem.ngayMo[1]).toMatchObject({ ngay: T7, gioMacDinh: 8 });

    clock.dat(luc(T2, '18:05'));
    const gui = (await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: '10,5' }).expect(200)).body;
    expect(gui.ngayMo[0].yeuCauCho).toMatchObject({ soGio: 10.5 });
    expect(gui.ngayMo[0].gioHieuLuc).toBe(9); // chưa duyệt → vẫn giờ mặc định

    clock.dat(luc(T2, '19:00'));
    const lai = (await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 11 }).expect(200)).body;
    expect(lai.ngayMo[0].yeuCauCho).toMatchObject({ soGio: 11, guiLuc: luc(T2, '19:00').toISOString() });
    expect(await t.prisma.yeuCauGio.count({ where: { nhanVienId: k.nv.id } })).toBe(1);
    expect(lai.yeuCau).toEqual([expect.objectContaining({ ngay: T2, soGio: 11, trangThai: 'CHO' })]);
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'GUI_YEU_CAU_GIO', duLieuMoi: { path: ['nhanVienId'], equals: k.nv.id } } })).toBe(2);
  });

  it('ngày không mở nhập (không có phiên trạm còn hiệu lực) → NGAY_KHONG_MO_NHAP; giờ sai → 400', async () => {
    const k = await dung();
    clock.dat(luc(T2));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    const r = await cn(may).post('/api/cn/gio-lam', { ngay: T7, soGio: 9 });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('NGAY_KHONG_MO_NHAP');
    for (const v of [0, 17, 'chín']) {
      const sai = await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: v });
      expect(sai.status).toBe(400);
      expect(sai.body.message).toBe('Số giờ phải lớn hơn 0 và không quá 16.');
    }
    // Không có cookie thiết bị → chưa đăng nhập trạm
    expect((await cn().get('/api/cn/gio-lam')).body.code).toBe('CHUA_DANG_NHAP_TRAM');
  });
});

describe('Duyệt / từ chối / sửa trực tiếp [F6 bước 4–6] [R 5.8] [D18]', () => {
  it('[R 5.8] tổ trưởng chuyền gốc duyệt; NV hỗ trợ chuyền khác: màn duyệt hiện sản lượng ở mọi chuyền, tổ trưởng chuyền hỗ trợ không duyệt được', async () => {
    const k = await dung();
    clock.dat(luc(T2, '07:30'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    await dangNhapTram(k.B.tram[0]!.id, k.nv.maNV, may); // hỗ trợ chuyền B
    expect((await luuSanLuong(may, k.A.tram[0]!.id, T2, k.cd.id, 300)).status).toBe(200);
    expect((await luuSanLuong(may, k.B.tram[0]!.id, T2, k.cd.id, 120)).status).toBe(200);
    clock.dat(luc(T2, '18:00'));
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 10.5 }).expect(200);

    const dsA = (await web(k.ttA.cookie).get(`/api/gio-lam/cho-duyet?chuyenId=${k.A.id}`).expect(200)).body;
    expect(dsA.dem).toEqual({ CHO: 1, DUYET: 0, TU_CHOI: 0 });
    expect(dsA.macDinh).toMatchObject({ gio: { T2_T6: 9, T7: 8, CN: null } });
    const y = dsA.ds[0];
    expect(y).toMatchObject({ ngay: T2, soGio: 10.5, gioMacDinh: 9, chuyenGoc: { id: k.A.id }, biKhoa: false });
    expect(y.sanLuong).toEqual([
      { maChuyen: k.A.ma, soLuong: 300, hoTro: false },
      { maChuyen: k.B.ma, soLuong: 120, hoTro: true },
    ].sort((a, b) => a.maChuyen.localeCompare(b.maChuyen)));

    // Tổ trưởng chuyền B: không thấy, không duyệt được, gọi chuyenId = A → 403
    expect((await web(k.ttB.cookie).get('/api/gio-lam/cho-duyet').expect(200)).body.ds).toEqual([]);
    expect((await web(k.ttB.cookie).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version })).status).toBe(403);
    expect((await web(k.ttB.cookie).get(`/api/gio-lam/cho-duyet?chuyenId=${k.A.id}`)).status).toBe(403);

    const kq = await web(k.ttA.cookie).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version }).expect(200);
    expect(kq.body).toMatchObject({ soGio: 10.5, nguon: 'YEU_CAU_DUYET' });
    expect(await gioHieuLuc(k.nv.id, T2)).toBe(10.5);
    // Nhiều trạm, nhiều chuyền → vẫn 1 giờ làm; view dùng giờ mới
    const v = (await chu.query(`SELECT gio_lam, nguon_gio, gio_cho_duyet FROM v_nv_ngay WHERE nhan_vien_id = $1 AND ngay_lam_viec = $2`, [k.nv.id, T2])).rows;
    expect(v).toEqual([{ gio_lam: '10.50', nguon_gio: 'YEU_CAU_DUYET', gio_cho_duyet: false }]);
    const phan = (await chu.query(`SELECT sum(phut_lam_phan_bo)::numeric(6,2) AS p FROM v_nv_chuyen_ngay WHERE nhan_vien_id = $1 AND ngay_lam_viec = $2`, [k.nv.id, T2])).rows[0].p;
    expect(Number(phan)).toBe(630);

    const cuaToi = (await cn(may).get('/api/cn/gio-lam').expect(200)).body;
    expect(cuaToi.ngayMo[0]).toMatchObject({ gioHieuLuc: 10.5, nguon: 'YEU_CAU_DUYET', yeuCauCho: null });
    expect(cuaToi.yeuCau[0]).toMatchObject({ trangThai: 'DUYET', nguoiXuLy: expect.stringContaining('Người thử') });

    // Duyệt lại → đã xử lý
    expect((await web(k.ttA.cookie).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version + 1 })).body.code).toBe('DU_LIEU_DA_THAY_DOI');
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'DUYET_GIO', doiTuongId: y.id } })).toBe(1);
  });

  it('[D18] phạm vi theo chuyền gốc TẠI NGÀY của yêu cầu, không theo chuyền hiện tại', async () => {
    const k = await dung();
    clock.dat(luc(T2, '07:30'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 10 }).expect(200);
    // HR chuyển NV sang chuyền B từ T3
    await datChuyenGoc(chu, k.nv.id, T3, k.B.id);
    clock.dat(luc(T3)); // phiên Web cũ hết hạn sau 24 giờ → đăng nhập lại
    const ttA = await dangNhap(t, k.ttA.tenDangNhap);
    const ttB = await dangNhap(t, k.ttB.tenDangNhap);
    const y = await t.prisma.yeuCauGio.findFirstOrThrow({ where: { nhanVienId: k.nv.id } });
    expect((await web(ttB).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version })).status).toBe(403);
    await web(ttA).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version }).expect(200);
  });

  it('từ chối bắt buộc lý do; bị từ chối → dùng giờ mặc định; công nhân thấy lý do', async () => {
    const k = await dung();
    clock.dat(luc(T2, '07:30'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 12 }).expect(200);
    const y = (await web(k.ttA.cookie).get('/api/gio-lam/cho-duyet').expect(200)).body.ds[0];
    expect((await web(k.ttA.cookie).post(`/api/gio-lam/${y.id}/tu-choi`, { version: y.version, lyDo: '  ' })).status).toBe(400);
    await web(k.ttA.cookie).post(`/api/gio-lam/${y.id}/tu-choi`, { version: y.version, lyDo: 'Không có lệnh tăng ca' }).expect(204);
    expect(await gioHieuLuc(k.nv.id, T2)).toBe(9);
    const yc = (await cn(may).get('/api/cn/gio-lam').expect(200)).body.yeuCau[0];
    expect(yc).toMatchObject({ trangThai: 'TU_CHOI', lyDoTuChoi: 'Không có lệnh tăng ca' });
    const tab = (await web(k.ttA.cookie).get('/api/gio-lam/cho-duyet?trangThai=TU_CHOI').expect(200)).body;
    expect(tab.ds[0]).toMatchObject({ id: y.id, lyDoTuChoi: 'Không có lệnh tăng ca', xuLy: { boi: k.ttA.hoTen } });
  });

  it('tổ trưởng đang xem yêu cầu cũ mà công nhân gửi lại số mới → duyệt bị từ chối (không duyệt nhầm số cũ)', async () => {
    const k = await dung();
    clock.dat(luc(T2, '07:30'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 10 }).expect(200);
    const cu = (await web(k.ttA.cookie).get('/api/gio-lam/cho-duyet').expect(200)).body.ds[0];
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 12 }).expect(200);
    const r = await web(k.ttA.cookie).post(`/api/gio-lam/${cu.id}/duyet`, { version: cu.version });
    expect(r.status).toBe(404);
    expect(await gioHieuLuc(k.nv.id, T2)).toBe(9);
  });

  it('sửa giờ trực tiếp: bắt buộc lý do, chỉ NV chuyền gốc của mình, không cho ngày chưa tới; yêu cầu đang chờ được đóng kèm lý do', async () => {
    const k = await dung();
    clock.dat(luc(T2, '07:30'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 11 }).expect(200);

    const dsNv = (await web(k.ttA.cookie).get(`/api/gio-lam/nhan-vien?chuyenId=${k.A.id}&ngay=${T2}`).expect(200)).body;
    expect(dsNv).toEqual([expect.objectContaining({ id: k.nv.id, gioMacDinh: 9, gioHieuLuc: 9, nguon: 'MAC_DINH' })]);
    expect((await web(k.ttB.cookie).get(`/api/gio-lam/nhan-vien?chuyenId=${k.A.id}&ngay=${T2}`)).status).toBe(403);

    const body = { nhanVienId: k.nv.id, ngay: T2, soGio: '9,5', lyDo: 'Làm lẫn trạm JACK buổi chiều' };
    expect((await web(k.ttA.cookie).put('/api/gio-lam/truc-tiep', { ...body, lyDo: '' })).status).toBe(400);
    expect((await web(k.ttA.cookie).put('/api/gio-lam/truc-tiep', { ...body, ngay: T3 })).body.message).toBe('Không sửa giờ cho ngày chưa tới.');
    expect((await web(k.ttB.cookie).put('/api/gio-lam/truc-tiep', body)).status).toBe(403);

    const kq = await web(k.ttA.cookie).put('/api/gio-lam/truc-tiep', body).expect(200);
    expect(kq.body).toMatchObject({ soGio: 9.5, nguon: 'TO_TRUONG_SUA' });
    expect(await gioHieuLuc(k.nv.id, T2)).toBe(9.5);
    const gl = await t.prisma.gioLam.findFirstOrThrow({ where: { nhanVienId: k.nv.id } });
    expect(gl).toMatchObject({ nguon: 'TO_TRUONG_SUA', lyDo: body.lyDo, nguoiThucHienId: k.ttA.id });
    const yc = (await cn(may).get('/api/cn/gio-lam').expect(200)).body.yeuCau[0];
    expect(yc).toMatchObject({ trangThai: 'TU_CHOI', lyDoTuChoi: 'Tổ trưởng đã sửa giờ trực tiếp: 9,5 giờ — Làm lẫn trạm JACK buổi chiều' });
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'SUA_GIO_TRUC_TIEP', doiTuongId: `${k.nv.id}|${T2}` } })).toBe(1);
  });

  it('ngày không có giờ mặc định (Chủ nhật): không tự gán giờ; tổ trưởng sửa → có giờ', async () => {
    const k = await dung();
    const CN = congNgay(T2, -1);
    clock.dat(luc(T2));
    expect((await chu.query(`SELECT gio_lam_hieu_luc($1, $2) AS g`, [k.nv.id, CN])).rows[0].g).toBeNull();
    await web(k.ttA.cookie).put('/api/gio-lam/truc-tiep', { nhanVienId: k.nv.id, ngay: CN, soGio: 6, lyDo: 'Tăng ca Chủ nhật' }).expect(200);
    expect(await gioHieuLuc(k.nv.id, CN)).toBe(6);
  });
});

describe('Khóa giờ làm [R 5.7]', () => {
  it('Mã hàng × Tháng chứa sản lượng của NV ngày đó bị khóa → không gửi / duyệt / sửa được (server từ chối)', async () => {
    const k = await dung();
    clock.dat(luc(T2, '07:30'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    expect((await luuSanLuong(may, k.A.tram[0]!.id, T2, k.cd.id, 100)).status).toBe(200);
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 10 }).expect(200);
    const y = (await web(k.ttA.cookie).get('/api/gio-lam/cho-duyet').expect(200)).body.ds[0];

    await t.prisma.khoaThang.create({ data: { maHangId: k.mh.id, thang: T2.slice(0, 7), trangThai: 'KHOA', nguoiThucHienId: k.ie.id } });

    const xem = (await cn(may).get('/api/cn/gio-lam').expect(200)).body;
    expect(xem.ngayMo[0]).toMatchObject({ ngay: T2, biKhoa: true });
    expect((await web(k.ttA.cookie).get('/api/gio-lam/cho-duyet').expect(200)).body.ds[0].biKhoa).toBe(true);

    for (const r of [
      await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 11 }),
      await web(k.ttA.cookie).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version }),
      await web(k.ttA.cookie).put('/api/gio-lam/truc-tiep', { nhanVienId: k.nv.id, ngay: T2, soGio: 8, lyDo: 'x' }),
    ]) {
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('GIO_LAM_DA_KHOA');
    }
    expect(await gioHieuLuc(k.nv.id, T2)).toBe(9);
    // Mở khóa → duyệt bù được
    await t.prisma.khoaThang.update({ where: { maHangId_thang: { maHangId: k.mh.id, thang: T2.slice(0, 7) } }, data: { trangThai: 'MO' } });
    await web(k.ttA.cookie).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version }).expect(200);
  });

  it('[TDD 8.9] Duyệt giờ và Khóa tháng đồng thời: Khóa tháng giữ khóa ĐỘC QUYỀN (MH) → Duyệt chờ, rồi bị từ chối GIO_LAM_DA_KHOA', async () => {
    const k = await dung();
    clock.dat(luc(T2, '07:30'));
    const may = await dangNhapTram(k.A.tram[0]!.id, k.nv.maNV);
    expect((await luuSanLuong(may, k.A.tram[0]!.id, T2, k.cd.id, 100)).status).toBe(200);
    await cn(may).post('/api/cn/gio-lam', { ngay: T2, soGio: 10 }).expect(200);
    const y = (await web(k.ttA.cookie).get('/api/gio-lam/cho-duyet').expect(200)).body.ds[0];
    let duyetXong = 0;
    const khoa = t.prisma.$transaction(async (tx) => {
      await khoaMaHangThang(tx, [{ maHangId: k.mh.id, thang: T2.slice(0, 7) }], 'DOC_QUYEN');
      await tx.khoaThang.create({ data: { maHangId: k.mh.id, thang: T2.slice(0, 7), trangThai: 'KHOA', nguoiThucHienId: k.ie.id } });
      await new Promise((r) => setTimeout(r, 400));
      expect(duyetXong).toBe(0); // Duyệt đang chờ khóa
    });
    await new Promise((r) => setTimeout(r, 100));
    const duyet = web(k.ttA.cookie).post(`/api/gio-lam/${y.id}/duyet`, { version: y.version }).then((r) => { duyetXong = Date.now(); return r; });
    const [, res] = await Promise.all([khoa, duyet]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('GIO_LAM_DA_KHOA');
    expect(await t.prisma.gioLam.count({ where: { nhanVienId: k.nv.id } })).toBe(0);
  });
});
