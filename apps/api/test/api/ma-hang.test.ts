/** Mã hàng, công đoạn, lịch sử SMV · PRD F3 · TDD 8.6 */
import { HEADER_CLIENT } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { type AppTest, ngauNhien, taoAppTest, taoChuyenNhanh, taoTaiKhoan, taoVaDangNhap } from '../ho-tro/app.js';

let t: AppTest;
let ie: { cookie: string; id: string };

beforeAll(async () => {
  t = await taoAppTest();
  ie = await taoVaDangNhap(t, { vaiTro: 'IE' });
});
afterAll(async () => {
  await t.dong();
});

const req = (method: 'get' | 'post' | 'patch', url: string, cookie = ie.cookie) => t.http()[method](url).set('Cookie', cookie).set(HEADER_CLIENT, 'web');
const taoMh = async () => (await req('post', '/api/ma-hang').send({ ma: ngauNhien('MH'), ten: 'Áo polo nam', khachHang: 'Khách A', soLuongDonHang: 12000 }).expect(201)).body;
const taoCd = async (mhId: string, body: object = {}) =>
  (await req('post', `/api/ma-hang/${mhId}/cong-doan`).send({ ma: ngauNhien('CD'), ten: 'May cổ', smv: 30, ...body }).expect(201)).body;
const dsCd = async (mhId: string) => (await req('get', `/api/ma-hang/${mhId}/cong-doan`).expect(200)).body as { id: string; laCongDoanHoanThanh: boolean; version: number; smv: number | null; smvSapApDung: unknown; dangGan: unknown[] }[];

/** Bản ghi sản lượng nền (ghi thẳng DB, giả lập ứng dụng) */
async function taoSanLuong(cdId: string, ngay: string, smv: number) {
  const { chuyen } = await taoChuyenNhanh(t, { soTram: 1 });
  const nv = await t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen: 'A', chuyenId: chuyen.id } });
  return t.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('vsn.nguoi_thuc_hien', 'test', true)`;
    return tx.sanLuong.create({
      data: { ngayLamViec: ngayDb(ngay), tramId: chuyen.tram[0]!.id, congDoanId: cdId, nhanVienId: nv.id, soLuong: 100, smvSnapshot: smv, chuyenTramSnapshot: chuyen.id, nguon: 'APP' },
    });
  });
}
const smvCua = async (id: string) => Number((await t.prisma.sanLuong.findUniqueOrThrow({ where: { id } })).smvSnapshot);

describe('Mã hàng & công đoạn', () => {
  it('[F3] mã hàng duy nhất; số lượng đơn hàng > 0; mỗi mã hàng có danh sách công đoạn riêng', async () => {
    const mh = await taoMh();
    expect(mh).toMatchObject({ soCongDoan: 0, trangThai: 'SAP_CHAY', daLam: 0, thieuCongDoanHoanThanh: false });
    expect((await req('post', '/api/ma-hang').send({ ma: mh.ma, ten: 'X', soLuongDonHang: 1 }).expect(409)).body.code).toBe('TRUNG_MA');
    expect((await req('post', '/api/ma-hang').send({ ma: ngauNhien('MH'), ten: 'X', soLuongDonHang: 0 }).expect(400)).body.field).toBe('soLuongDonHang');

    const cd = await taoCd(mh.id, { ma: 'CD-05' });
    expect((await req('post', `/api/ma-hang/${mh.id}/cong-doan`).send({ ma: 'cd-05', ten: 'Trùng' }).expect(409)).body.code).toBe('TRUNG_MA');
    await taoCd((await taoMh()).id, { ma: 'CD-05' }); // mã công đoạn chỉ duy nhất trong cùng mã hàng
    expect(cd).toMatchObject({ ma: 'CD-05', smv: 30, laCongDoanHoanThanh: false, dangGan: [] });
  });

  it('[F3] đúng 1 công đoạn hoàn thành / mã hàng: đặt công đoạn khác thì công đoạn cũ tự bỏ; không ngưng được công đoạn hoàn thành', async () => {
    const mh = await taoMh();
    const a = await taoCd(mh.id);
    expect((await req('get', '/api/ma-hang').expect(200)).body.find((m: { id: string }) => m.id === mh.id).thieuCongDoanHoanThanh).toBe(true);
    const b = await taoCd(mh.id, { laCongDoanHoanThanh: true });
    await req('patch', `/api/cong-doan/${a.id}`).send({ laCongDoanHoanThanh: true, version: a.version }).expect(200);
    const ds = await dsCd(mh.id);
    expect(ds.filter((c) => c.laCongDoanHoanThanh).map((c) => c.id)).toEqual([a.id]);
    const aMoi = ds.find((c) => c.id === a.id)!;
    expect((await req('patch', `/api/cong-doan/${a.id}`).send({ trangThai: 'NGUNG', version: aMoi.version }).expect(422)).body.code).toBe('CONG_DOAN_HOAN_THANH');
    expect((await req('get', '/api/ma-hang').expect(200)).body.find((m: { id: string }) => m.id === mh.id).thieuCongDoanHoanThanh).toBe(false);
    void b;
  });

  it('[F3] không cho Ngưng công đoạn còn đang gán ở trạm; gỡ khỏi trạm rồi thì ngưng được', async () => {
    const mh = await taoMh();
    const cd = await taoCd(mh.id);
    const { chuyen } = await taoChuyenNhanh(t, { soTram: 2 });
    const g = await t.prisma.ganCongDoan.create({ data: { tramId: chuyen.tram[1]!.id, congDoanId: cd.id, hieuLucTu: new Date() } });
    const res = await req('patch', `/api/cong-doan/${cd.id}`).send({ trangThai: 'NGUNG', version: cd.version }).expect(422);
    expect(res.body.message).toBe(`Công đoạn đang gán tại ${chuyen.ma} trạm 2 — gỡ khỏi trạm trước khi ngưng.`);
    expect((await dsCd(mh.id))[0]!.dangGan).toEqual([{ maChuyen: chuyen.ma, soTram: [2] }]);
    await t.prisma.ganCongDoan.update({ where: { id: g.id }, data: { hieuLucDen: new Date() } });
    await req('patch', `/api/cong-doan/${cd.id}`).send({ trangThai: 'NGUNG', version: cd.version }).expect(200);
  });

  it('[F8] chỉ IE và Superadmin tạo/sửa; tổ trưởng chỉ đọc (để gán sơ đồ)', async () => {
    const tt = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [(await taoChuyenNhanh(t)).chuyen.id] });
    const mh = await taoMh();
    await req('get', `/api/ma-hang/${mh.id}/cong-doan`, tt.cookie).expect(200);
    await req('post', '/api/ma-hang', tt.cookie).send({ ma: ngauNhien('MH'), ten: 'X', soLuongDonHang: 1 }).expect(403);
    await req('post', `/api/ma-hang/${mh.id}/cong-doan`, tt.cookie).send({ ma: 'X', ten: 'X' }).expect(403);
  });
});

describe('Đổi SMV áp dụng lùi ngày [R 5.5]', () => {
  it('[R 5.5] đổi SMV không làm thay đổi phút SMV của ngày đã khóa; chọn ngày rơi vào tháng khóa → chặn, báo ngày sớm nhất', async () => {
    const mh = await taoMh();
    const cd = await taoCd(mh.id, { smv: 30 });
    const thang9 = await taoSanLuong(cd.id, '2026-09-20', 30);
    const thang10 = await taoSanLuong(cd.id, '2026-10-05', 30);
    const phutSmvThang9 = async () => Number((await t.prisma.$queryRaw<{ p: string }[]>`SELECT phut_smv::text AS p FROM v_san_luong_chi_tiet WHERE id = ${thang9.id}::uuid`)[0]!.p);
    expect(await phutSmvThang9()).toBe(50);

    const tk = await taoTaiKhoan(t, { vaiTro: 'IT_HR' });
    await t.prisma.khoaThang.create({ data: { maHangId: mh.id, thang: '2026-09', trangThai: 'KHOA', nguoiThucHienId: tk.id } });
    expect((await req('get', '/api/ma-hang').expect(200)).body.find((m: { id: string }) => m.id === mh.id).ngaySomNhatDoiSmv).toBe('2026-10-01');

    const chan = await req('post', `/api/cong-doan/${cd.id}/smv`).send({ smv: 36, apDungTuNgay: '2026-09-15' }).expect(422);
    expect(chan.body).toMatchObject({ code: 'NGAY_SMV_DA_KHOA', field: 'apDungTuNgay' });
    expect(chan.body.message).toMatch(/01\/10\/2026/);

    const ok = await req('post', `/api/cong-doan/${cd.id}/smv`).send({ smv: 36, apDungTuNgay: '2026-10-01' }).expect(200);
    expect(ok.body).toEqual({ soBanGhiTinhLai: 1 });
    expect(await smvCua(thang10.id)).toBe(36);
    expect(await smvCua(thang9.id)).toBe(30);
    expect(await phutSmvThang9()).toBe(50); // ngày đã khóa: phút SMV không đổi
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'TINH_LAI_SMV', doiTuongId: cd.id } })).toBe(1);
  });

  it('[R 5.5] chỉ tính lại từ ngày áp dụng đến mốc đổi SMV kế tiếp; SMV hiện hành / sắp áp dụng; lịch sử', async () => {
    const mh = await taoMh();
    const cd = await taoCd(mh.id, { smv: 30 });
    const truoc = await taoSanLuong(cd.id, '2026-08-01', 30);
    const giua = await taoSanLuong(cd.id, '2026-08-10', 30);
    const sau = await taoSanLuong(cd.id, '2026-08-25', 30);
    await req('post', `/api/cong-doan/${cd.id}/smv`).send({ smv: 40, apDungTuNgay: '2026-08-20' }).expect(200);
    expect((await req('post', `/api/cong-doan/${cd.id}/smv`).send({ smv: 35, apDungTuNgay: '2026-08-05' }).expect(200)).body.soBanGhiTinhLai).toBe(1);
    expect([await smvCua(truoc.id), await smvCua(giua.id), await smvCua(sau.id)]).toEqual([30, 35, 40]);

    await req('post', `/api/cong-doan/${cd.id}/smv`).send({ smv: 50, apDungTuNgay: '2099-01-01' }).expect(200);
    expect((await dsCd(mh.id))[0]).toMatchObject({ smv: 40, smvSapApDung: { smv: 50, tuNgay: '2099-01-01' } });

    const ls = (await req('get', `/api/ma-hang/${mh.id}/lich-su-smv`).expect(200)).body;
    expect(ls.map((l: { smvCu: number; smvMoi: number; apDungTuNgay: string }) => [l.smvCu, l.smvMoi, l.apDungTuNgay])).toEqual([
      [40, 50, '2099-01-01'],
      [30, 35, '2026-08-05'],
      [30, 40, '2026-08-20'],
    ]);
  });

  it('[R 5.5] SMV ban đầu áp dụng từ đầu — công đoạn chưa có SMV được đặt lần đầu thì bản ghi cũ (chưa khóa) có SMV', async () => {
    const mh = await taoMh();
    const cd = await taoCd(mh.id, { smv: null });
    expect(cd.smv).toBeNull();
    const sl = await t.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('vsn.nguoi_thuc_hien', 'test', true)`;
      const { chuyen } = await taoChuyenNhanh(t, { soTram: 1 });
      const nv = await tx.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen: 'A', chuyenId: chuyen.id } });
      return tx.sanLuong.create({ data: { ngayLamViec: ngayDb('2026-07-01'), tramId: chuyen.tram[0]!.id, congDoanId: cd.id, nhanVienId: nv.id, soLuong: 1, chuyenTramSnapshot: chuyen.id, nguon: 'APP' } });
    });
    await req('post', `/api/cong-doan/${cd.id}/smv`).send({ smv: 25.5, apDungTuNgay: '2026-07-01' }).expect(200);
    expect(await smvCua(sl.id)).toBe(25.5);
    expect((await req('post', `/api/cong-doan/${cd.id}/smv`).send({ smv: 0, apDungTuNgay: '2026-07-01' }).expect(400)).body.field).toBe('smv');
  });
});
