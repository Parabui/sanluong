/** Sơ đồ chuyền — gán công đoạn vào trạm · PRD F4 · TDD 8.7 */
import { congNgay, HEADER_CLIENT, homNay } from '@vsn/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SoDoService } from '../../src/modules/so-do/so-do.service.js';
import { type AppTest, ngauNhien, taoAppTest, taoVaDangNhap } from '../ho-tro/app.js';

let t: AppTest;
let ie: { cookie: string };
let sa: { cookie: string };

beforeAll(async () => {
  t = await taoAppTest();
  ie = await taoVaDangNhap(t, { vaiTro: 'IE' });
  sa = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
});
afterAll(async () => {
  await t.dong();
});

const req = (method: 'get' | 'post' | 'put', url: string, cookie = ie.cookie) => t.http()[method](url).set('Cookie', cookie).set(HEADER_CLIENT, 'web');

/** Chuyền 41 trạm (qua API F9 → 18 trạm nhập qua app) */
async function taoChuyen41() {
  const x = (await req('post', '/api/xuong', sa.cookie).send({ ma: ngauNhien('X'), ten: 'X' }).expect(201)).body;
  return (await req('post', '/api/chuyen', sa.cookie).send({ ma: ngauNhien('C'), ten: 'C', loai: 'CHUYEN_MAY', xuongId: x.id, soTram: 41 }).expect(201)).body as { id: string; ma: string };
}
async function taoMaHang(soCd = 3) {
  const mh = (await req('post', '/api/ma-hang').send({ ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang: 100 }).expect(201)).body;
  const cd: { id: string; version: number }[] = [];
  for (let i = 0; i < soCd; i++) cd.push((await req('post', `/api/ma-hang/${mh.id}/cong-doan`).send({ ma: `CD-${i + 1}`, ten: `CĐ ${i + 1}`, smv: 30 + i, laCongDoanHoanThanh: i === 0 }).expect(201)).body);
  return { id: mh.id as string, ma: mh.ma as string, cd };
}
const xem = async (chuyenId: string, ngay?: string) =>
  (await req('get', `/api/so-do?chuyenId=${chuyenId}${ngay ? `&ngay=${ngay}` : ''}`).expect(200)).body as {
    versionSoDo: number; hienHanh: boolean; tram: { id: string; soTram: number; congDoan: { congDoanId: string }[] }[];
    chuaGan: { congDoanId: string }[]; maHangDangChay: { id: string }[]; phienBan: { nguoi: string } | null;
  };
const luu = (chuyenId: string, versionSoDo: number, gan: { tramId: string; congDoanIds: string[] }[], cookie = ie.cookie) =>
  req('put', '/api/so-do', cookie).send({ chuyenId, versionSoDo, gan });

describe('Sơ đồ chuyền', () => {
  it('[F4] hiện đủ 18 trạm nhập liệu; một trạm nhiều công đoạn, một công đoạn nhiều trạm; danh sách công đoạn chưa gán', async () => {
    const c = await taoChuyen41();
    const mh = await taoMaHang(3);
    let sd = await xem(c.id);
    expect(sd.tram.map((x) => x.soTram)).toEqual([12, 25, ...Array.from({ length: 16 }, (_, i) => 26 + i)]);
    expect(sd.chuaGan).toEqual([]); // mã hàng chưa chạy trên chuyền

    const [t26, t27] = [sd.tram[2]!, sd.tram[3]!];
    const res = await luu(c.id, sd.versionSoDo, [
      { tramId: t26.id, congDoanIds: [mh.cd[1]!.id, mh.cd[2]!.id] },
      { tramId: t27.id, congDoanIds: [mh.cd[1]!.id] },
    ]).expect(200);
    expect(res.body).toMatchObject({ them: 3, go: 0 });

    sd = await xem(c.id);
    expect(sd.maHangDangChay.map((m) => m.id)).toEqual([mh.id]); // gán công đoạn → mã hàng bắt đầu chạy
    expect(sd.tram.find((x) => x.soTram === 26)!.congDoan.map((x) => x.congDoanId).sort()).toEqual([mh.cd[1]!.id, mh.cd[2]!.id].sort());
    expect(sd.chuaGan.map((x) => x.congDoanId)).toEqual([mh.cd[0]!.id]);
    expect(sd.phienBan?.nguoi).toBeTruthy();
  });

  it('[F4] tối đa 2 mã hàng cùng lúc; kết thúc mã hàng → gỡ công đoạn của mã đó, gán mã mới được', async () => {
    const c = await taoChuyen41();
    const [a, b, c3] = [await taoMaHang(1), await taoMaHang(1), await taoMaHang(1)];
    let sd = await xem(c.id);
    const tram = sd.tram.map((x) => x.id);
    await luu(c.id, sd.versionSoDo, [{ tramId: tram[2]!, congDoanIds: [a.cd[0]!.id] }, { tramId: tram[3]!, congDoanIds: [b.cd[0]!.id] }]).expect(200);
    sd = await xem(c.id);
    const qua = await luu(c.id, sd.versionSoDo, [{ tramId: tram[4]!, congDoanIds: [c3.cd[0]!.id] }]).expect(422);
    expect(qua.body.code).toBe('QUA_2_MA_HANG');

    const kt = await req('post', '/api/so-do/ket-thuc-ma-hang').send({ chuyenId: c.id, maHangId: a.id, versionSoDo: sd.versionSoDo }).expect(200);
    expect(kt.body.go).toBe(1);
    sd = await xem(c.id);
    expect(sd.maHangDangChay.map((m) => m.id)).toEqual([b.id]);
    expect(sd.tram[2]!.congDoan).toEqual([]);
    await luu(c.id, sd.versionSoDo, [{ tramId: tram[4]!, congDoanIds: [c3.cd[0]!.id] }]).expect(200);
  });

  it('[R 3.6] gỡ công đoạn không xóa dòng: sơ đồ HÔM NAY vẫn còn công đoạn đã gỡ, ngày mai thì không', async () => {
    const c = await taoChuyen41();
    const mh = await taoMaHang(1);
    let sd = await xem(c.id);
    const tram = sd.tram[5]!;
    await luu(c.id, sd.versionSoDo, [{ tramId: tram.id, congDoanIds: [mh.cd[0]!.id] }]).expect(200);
    sd = await xem(c.id);
    expect((await luu(c.id, sd.versionSoDo, [{ tramId: tram.id, congDoanIds: [] }]).expect(200)).body.go).toBe(1);

    const soDo = t.app.get(SoDoService);
    const homNayVn = homNay(new Date());
    expect((await soDo.soDoNgay(t.prisma, [tram.id], homNayVn)).get(tram.id)).toEqual([mh.cd[0]!.id]);
    expect((await soDo.soDoNgay(t.prisma, [tram.id], congNgay(homNayVn, 1))).get(tram.id)).toBeUndefined();
    expect(await t.prisma.ganCongDoan.count({ where: { tramId: tram.id } })).toBe(1); // vẫn còn dòng, chỉ đã đóng
    // Xem sơ đồ ngày đã qua: chỉ đọc
    expect((await xem(c.id, congNgay(homNayVn, -1))).hienHanh).toBe(false);
  });

  it('[F4] tổ trưởng và IE cùng sửa → người lưu sau nhận cảnh báo, phải tải lại', async () => {
    const c = await taoChuyen41();
    const mh = await taoMaHang(2);
    const sd = await xem(c.id);
    await luu(c.id, sd.versionSoDo, [{ tramId: sd.tram[2]!.id, congDoanIds: [mh.cd[0]!.id] }]).expect(200);
    const res = await luu(c.id, sd.versionSoDo, [{ tramId: sd.tram[3]!.id, congDoanIds: [mh.cd[1]!.id] }]).expect(409);
    expect(res.body.code).toBe('DU_LIEU_DA_THAY_DOI');
    expect(res.body.message).toMatch(/^Sơ đồ đã bị .+ thay đổi lúc \d{2}:\d{2}/);
  });

  it('[F4] công đoạn đã ngưng không gán được; trạm không thuộc chuyền / không nhập qua app → chặn', async () => {
    const c = await taoChuyen41();
    const khac = await taoChuyen41();
    const mh = await taoMaHang(2);
    const sd = await xem(c.id);
    await t.prisma.congDoan.update({ where: { id: mh.cd[1]!.id }, data: { trangThai: 'NGUNG' } });
    expect((await luu(c.id, sd.versionSoDo, [{ tramId: sd.tram[2]!.id, congDoanIds: [mh.cd[1]!.id] }]).expect(422)).body.code).toBe('CONG_DOAN_KHONG_HOP_LE');
    const tramKhac = (await xem(khac.id)).tram[0]!.id;
    expect((await luu(c.id, sd.versionSoDo, [{ tramId: tramKhac, congDoanIds: [mh.cd[0]!.id] }]).expect(422)).body.code).toBe('TRAM_KHONG_HOP_LE');
    const tram1 = await t.prisma.tram.findFirstOrThrow({ where: { chuyenId: c.id, soTram: 1 } }); // JACK
    expect((await luu(c.id, sd.versionSoDo, [{ tramId: tram1.id, congDoanIds: [mh.cd[0]!.id] }]).expect(422)).body.code).toBe('TRAM_KHONG_HOP_LE');
  });

  it('[F4] sao chép cùng mã hàng: giữ bố cục + công đoạn theo số trạm, bỏ qua công đoạn đã ngưng và báo số lượng', async () => {
    const nguon = await taoChuyen41();
    const dich = await taoChuyen41();
    const mh = await taoMaHang(3);
    const sd = await xem(nguon.id);
    const so = (n: number) => sd.tram.find((x) => x.soTram === n)!.id;
    await luu(nguon.id, sd.versionSoDo, [
      { tramId: so(26), congDoanIds: [mh.cd[1]!.id] },
      { tramId: so(27), congDoanIds: [mh.cd[2]!.id] },
      { tramId: so(12), congDoanIds: [mh.cd[0]!.id] },
    ]).expect(200);
    await t.prisma.congDoan.update({ where: { id: mh.cd[2]!.id }, data: { trangThai: 'NGUNG' } }); // giả lập dữ liệu cũ
    const dx = (await req('post', '/api/so-do/sao-chep').send({ chuyenDichId: dich.id, chuyenNguonId: nguon.id, maHangId: mh.id }).expect(200)).body;
    expect(dx.boQuaNgung).toBe(1);
    expect(dx.gan.map((g: { soTram: number; congDoan: { congDoanId: string }[] }) => [g.soTram, g.congDoan.map((x) => x.congDoanId)])).toEqual([
      [12, [mh.cd[0]!.id]],
      [26, [mh.cd[1]!.id]],
    ]);
    expect((await xem(dich.id)).tram.every((x) => x.congDoan.length === 0)).toBe(true); // chỉ đề xuất, chưa lưu
  });

  it('[F4] tổ trưởng chỉ sửa chuyền được gắn; IE sửa mọi chuyền', async () => {
    const a = await taoChuyen41();
    const b = await taoChuyen41();
    const mh = await taoMaHang(1);
    const tt = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [a.id] });
    const sdA = (await req('get', `/api/so-do?chuyenId=${a.id}`, tt.cookie).expect(200)).body;
    await luu(a.id, sdA.versionSoDo, [{ tramId: sdA.tram[2].id, congDoanIds: [mh.cd[0]!.id] }], tt.cookie).expect(200);
    await req('get', `/api/so-do?chuyenId=${b.id}`, tt.cookie).expect(403);
    const sdB = await xem(b.id);
    await luu(b.id, sdB.versionSoDo, [{ tramId: sdB.tram[2]!.id, congDoanIds: [mh.cd[0]!.id] }], tt.cookie).expect(403);
    await luu(b.id, sdB.versionSoDo, [{ tramId: sdB.tram[2]!.id, congDoanIds: [mh.cd[0]!.id] }]).expect(200);
  });
});
