/**
 * Báo cáo sản lượng (F5) + "Của tôi" (F11) · TDD 13.2, 16 (Báo cáo [D10] [D15] [D18] [D20]).
 * Kiểm chứng tuần 10: Tổng màn hình = Excel; F5 = F11.
 */
import { randomUUID } from 'node:crypto';
import { congNgay, COOKIE_THIET_BI, HEADER_CLIENT, homNay, thuIso } from '@vsn/shared';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/clock/clock.service.js';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { type AppTest, dangNhap, ngauNhien, taoAppTest, taoTaiKhoan, type TaiKhoanTest } from '../ho-tro/app.js';

let T2 = congNgay(homNay(new Date()), 2);
while (thuIso(T2) !== 1) T2 = congNgay(T2, 1);
const T3 = congNgay(T2, 1);
const CN = congNgay(T2, -1);
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
 * Xưởng (9 / 8 / trống) · chuyền A: trạm 1 (MH1: CD-1 hoàn thành 30s, CD-2 60s), trạm 2 (MH2: CD-1 hoàn thành 36s)
 * · chuyền B: trạm 1 (MH1: CD-1) · NV1, NV2 chuyền A, NVB chuyền B.
 */
async function dung() {
  const x = await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: 'X' } });
  await t.prisma.gioMacDinh.createMany({
    data: [
      { xuongId: x.id, loaiNgay: 'T2_T6', soGio: 9, apDungTuNgay: ngayDb('2025-01-01') },
      { xuongId: x.id, loaiNgay: 'T7', soGio: 8, apDungTuNgay: ngayDb('2025-01-01') },
      { xuongId: x.id, loaiNgay: 'CN', soGio: null, apDungTuNgay: ngayDb('2025-01-01') },
    ],
  });
  const mk = (ma: string, so: number) =>
    t.prisma.chuyen.create({
      data: { ma: ngauNhien(ma), ten: ma, loai: 'CHUYEN_MAY', xuongId: x.id, tram: { create: Array.from({ length: so }, (_, i) => ({ soTram: i + 1, nhapQuaApp: true })) } },
      include: { tram: { orderBy: { soTram: 'asc' } } },
    });
  const A = await mk('A', 2);
  const B = await mk('B', 1);
  const ie = await taoTaiKhoan(t, { vaiTro: 'IE' });
  const taoMh = async (smv: number[], soLuongDonHang = 1000) => {
    const mh = await t.prisma.maHang.create({ data: { ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang } });
    const cd = [];
    for (const [i, s] of smv.entries()) {
      const c = await t.prisma.congDoan.create({ data: { maHangId: mh.id, ma: `CD-${i + 1}`, ten: `Công đoạn ${i + 1}`, laCongDoanHoanThanh: i === 0 } });
      await t.prisma.smvLichSu.create({ data: { congDoanId: c.id, smv: s, apDungTuNgay: ngayDb('2000-01-01'), nguoiTaoId: ie.id } });
      cd.push(c);
    }
    return { mh, cd };
  };
  const m1 = await taoMh([30, 60]);
  const m2 = await taoMh([36]);
  const tu = luc('2025-01-01', '00:00');
  for (const [c, mh] of [[A, m1.mh], [A, m2.mh], [B, m1.mh]] as const) await t.prisma.chuyenMaHang.create({ data: { chuyenId: c.id, maHangId: mh.id, batDau: tu } });
  const gan = [[A.tram[0]!, m1.cd[0]!], [A.tram[0]!, m1.cd[1]!], [A.tram[1]!, m2.cd[0]!], [B.tram[0]!, m1.cd[0]!]] as const;
  for (const [tr, c] of gan) await t.prisma.ganCongDoan.create({ data: { tramId: tr.id, congDoanId: c.id, hieuLucTu: tu } });
  const nv = (hoTen: string, chuyenId: string) => t.prisma.nhanVien.create({ data: { maNV: ngauNhien('NV'), hoTen, chuyenId } });
  const nv1 = await nv('Nguyễn Thị Lan', A.id);
  const nv2 = await nv('Trần Văn Hùng', A.id);
  const nvB = await nv('Lê Thị Hoa', B.id);
  const sa = await taoTaiKhoan(t, { vaiTro: 'SUPERADMIN' });
  return { x, A, B, m1, m2, nv1, nv2, nvB, sa, ie };
}

async function web(tk: TaiKhoanTest) {
  const cookie = await dangNhap(t, tk.tenDangNhap);
  const dat = <R extends { set: (k: string, v: string) => R }>(r: R) => r.set(HEADER_CLIENT, 'web').set('Cookie', cookie);
  return {
    get: (url: string) => dat(t.http().get(url)),
    post: (url: string, body: object = {}) => dat(t.http().post(url)).send(body),
    /** Tải file .xlsx → workbook */
    excel: async (url: string) => {
      const r = await dat(t.http().get(url)).buffer(true).parse((res, cb) => {
        const parts: Buffer[] = [];
        res.on('data', (c: Buffer) => parts.push(c));
        res.on('end', () => cb(null, Buffer.concat(parts)));
      });
      if (r.status !== 200) return { status: r.status, body: JSON.parse((r.body as Buffer).toString()), wb: null, headers: r.headers };
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(r.body as unknown as ArrayBuffer);
      return { status: r.status, body: null, wb, headers: r.headers };
    },
  };
}
type Web = Awaited<ReturnType<typeof web>>;
const nhapHo = (w: Web, tramId: string, congDoanId: string, ngay: string, nhanVienId: string, soLuong: number) =>
  w.post('/api/bang-san-luong/nhap-ho', { tramId, congDoanId, ngay, nhanVienId, soLuong, lyDo: 'Không có phiên trạm' }).expect(200);

/** NV1: chuyền A trạm 1 CD-1 300 sp (150 phút) + hỗ trợ chuyền B trạm 1 CD-1 100 sp (50 phút) ngày T2; NV2: A trạm 1 CD-2 90 sp (90 phút) */
async function duLieuT2(k: Awaited<ReturnType<typeof dung>>, w: Web) {
  await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[0]!.id, T2, k.nv1.id, 300);
  await nhapHo(w, k.B.tram[0]!.id, k.m1.cd[0]!.id, T2, k.nv1.id, 100);
  await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[1]!.id, T2, k.nv2.id, 90);
}
const q = (k: { A: { id: string } }, extra = '') => `tu=${T2}&den=${T2}${extra}`;

describe('Báo cáo theo công nhân / theo chuyền [F5] [D15]', () => {
  it('[D15] NV làm 2 chuyền: phút SMV cộng dồn, giờ làm chia theo tỷ lệ phút SMV → tổng phút làm các chuyền = giờ làm thật; % hiệu suất NV = phút SMV ÷ (giờ × 60)', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const w = await web(k.sa);
    await duLieuT2(k, w);

    const cn = (await w.get(`/api/bao-cao/cong-nhan?${q(k, `&xuongId=${k.x.id}`)}`).expect(200)).body;
    const cuaNv1 = cn.dong.filter((d: { nhanVienId: string }) => d.nhanVienId === k.nv1.id);
    expect(cuaNv1).toHaveLength(2);
    const [a, b] = [cuaNv1.find((d: { chuyenId: string }) => d.chuyenId === k.A.id), cuaNv1.find((d: { chuyenId: string }) => d.chuyenId === k.B.id)];
    expect(a).toMatchObject({ sanLuong: 300, phutSmv: 150, gioLam: 6.75, hoTroTu: null, tram: [1], congDoan: ['CD-1'], trangThai: 'CHUA_CHOT' });
    expect(b).toMatchObject({ sanLuong: 100, phutSmv: 50, gioLam: 2.25, hoTroTu: k.A.ma });
    expect(a.hieuSuat).toBeCloseTo((200 / 540) * 100, 6);
    expect(a.gioLam + b.gioLam).toBe(9);
    expect(cn.tongCong).toMatchObject({ sanLuong: 490, phutSmv: 290, phutLam: 1080 });

    const ch = (await w.get(`/api/bao-cao/chuyen?${q(k, `&xuongId=${k.x.id}`)}`).expect(200)).body;
    const cA = ch.dong.find((d: { chuyenId: string }) => d.chuyenId === k.A.id);
    expect(cA).toMatchObject({ hoanThanh: 300, sanLuong: 390, phutSmv: 240, phutLam: 945, soNv: 2 });
    expect(cA.hieuSuat).toBeCloseTo((240 / 945) * 100, 6);
    // Tổng các chuyền = toàn nhà máy (phút làm = Σ giờ làm thật × 60)
    expect(ch.tongCong.phutLam).toBe(1080);
    expect(ch.tongCong.hieuSuat).toBeCloseTo((290 / 1080) * 100, 6);
  });

  it('[R 5.8] phạm vi R3: tổ trưởng chuyền A thấy sản lượng tại A + NV chuyền A đi hỗ trợ B (chỉ xem), không thấy NV chuyền B; tham số ngoài phạm vi → 403', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    await duLieuT2(k, await web(k.sa));
    await nhapHo(await web(k.sa), k.B.tram[0]!.id, k.m1.cd[0]!.id, T2, k.nvB.id, 40);
    const ttA = await web(await taoTaiKhoan(t, { vaiTro: 'TO_TRUONG', chuyenIds: [k.A.id] }));

    const cn = (await ttA.get(`/api/bao-cao/cong-nhan?${q(k)}`).expect(200)).body;
    expect(cn.dong.map((d: { nhanVienId: string; chuyenId: string }) => [d.nhanVienId, d.chuyenId]).sort()).toEqual(
      [[k.nv1.id, k.A.id], [k.nv1.id, k.B.id], [k.nv2.id, k.A.id]].sort());
    const cd = (await ttA.get(`/api/bao-cao/cong-doan?${q(k)}`).expect(200)).body;
    expect(cd.dong.every((d: { chuyenId: string }) => d.chuyenId === k.A.id)).toBe(true);
    const ls = (await ttA.get(`/api/bao-cao/lich-su?${q(k)}`).expect(200)).body;
    expect(ls.dong.some((d: { maNV: string }) => d.maNV === k.nvB.maNV)).toBe(false);

    expect((await ttA.get(`/api/bao-cao/cong-nhan?${q(k, `&chuyenId=${k.B.id}`)}`)).status).toBe(403);
    expect((await ttA.get(`/api/bao-cao/chuyen?${q(k, `&xuongId=${k.x.id}`)}`)).status).toBe(403);
    expect((await ttA.excel(`/api/bao-cao/cong-nhan/xuat?${q(k, `&chuyenId=${k.B.id}`)}`)).status).toBe(403);
    const qlKhac = await web(await taoTaiKhoan(t, { vaiTro: 'QUAN_LY_XUONG', xuongIds: [(await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: 'Khác' } })).id] }));
    expect((await qlKhac.get(`/api/bao-cao/cong-nhan?${q(k, `&xuongId=${k.x.id}`)}`)).status).toBe(403);
    expect((await qlKhac.get(`/api/bao-cao/cong-nhan?${q(k)}`).expect(200)).body.dong.filter((d: { chuyenId: string }) => [k.A.id, k.B.id].includes(d.chuyenId))).toEqual([]);
    // Kế hoạch không có quyền báo cáo [F8]
    expect((await (await web(await taoTaiKhoan(t, { vaiTro: 'KE_HOACH' }))).get(`/api/bao-cao/cong-nhan?${q(k)}`)).status).toBe(403);
  });

  it('chưa có giờ làm (Chủ nhật) → % hiệu suất "—"; trạng thái Chưa chốt / Đã chốt / Đã khóa; ngày có cả mã hàng đã khóa và chưa khóa → "tạm tính" [D20]', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    let w = await web(k.sa);
    await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[0]!.id, CN, k.nv1.id, 60);
    await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[0]!.id, T2, k.nv1.id, 300);
    await nhapHo(w, k.A.tram[1]!.id, k.m2.cd[0]!.id, T2, k.nv1.id, 100);
    const cnCN = (await w.get(`/api/bao-cao/cong-nhan?tu=${CN}&den=${CN}&chuyenId=${k.A.id}`).expect(200)).body.dong[0];
    expect(cnCN).toMatchObject({ sanLuong: 60, phutSmv: 30, gioLam: null, hieuSuat: null });

    clock.dat(luc(T3, '09:00'));
    w = await web(k.sa);
    await w.post('/api/chot-ngay', { chuyenId: k.A.id, ngay: T2, xacNhan: true }).expect(200);
    expect((await w.get(`/api/bao-cao/cong-nhan?${q(k, `&chuyenId=${k.A.id}`)}`).expect(200)).body.dong[0]).toMatchObject({ trangThai: 'DA_CHOT', tamTinh: false });
    await t.prisma.khoaThang.create({ data: { maHangId: k.m1.mh.id, thang: T2.slice(0, 7), trangThai: 'KHOA', nguoiThucHienId: k.sa.id } });
    // MH1 đã khóa, MH2 chưa → Đã chốt (chưa khóa hết) + tạm tính
    expect((await w.get(`/api/bao-cao/cong-nhan?${q(k, `&chuyenId=${k.A.id}`)}`).expect(200)).body.dong[0]).toMatchObject({ trangThai: 'DA_CHOT', tamTinh: true });
    await t.prisma.khoaThang.create({ data: { maHangId: k.m2.mh.id, thang: T2.slice(0, 7), trangThai: 'KHOA', nguoiThucHienId: k.sa.id } });
    expect((await w.get(`/api/bao-cao/cong-nhan?${q(k, `&chuyenId=${k.A.id}`)}`).expect(200)).body.dong[0]).toMatchObject({ trangThai: 'DA_KHOA', tamTinh: false });
  });
});

describe('Tổng màn hình = tổng Excel [F5] [TDD 13.2]', () => {
  it('màn hình phân trang nhưng tongCong tính trên toàn bộ; Excel có đủ dòng + dòng Tổng giống hệt; số dòng = dữ liệu nhập', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const w = await web(k.sa);
    await duLieuT2(k, w);
    const loc = `tu=${T2}&den=${T2}&xuongId=${k.x.id}`;

    for (const [loai, cotSl, cotTong] of [['cong-nhan', 7, 'sanLuong'], ['cong-doan', 7, 'sanLuong'], ['chuyen', 4, 'sanLuong'], ['lich-su', 10, 'soLanGhi']] as const) {
      const p1 = (await w.get(`/api/bao-cao/${loai}?${loc}&kichThuoc=1`).expect(200)).body;
      const all = (await w.get(`/api/bao-cao/${loai}?${loc}`).expect(200)).body;
      expect(p1.dong).toHaveLength(1);
      expect(p1.tongCong).toEqual(all.tongCong);
      expect(p1.tongDong).toBe(all.dong.length);

      const x = await w.excel(`/api/bao-cao/${loai}/xuat?${loc}`);
      expect(x.status, loai).toBe(200);
      expect(x.headers['content-disposition']).toBe(`attachment; filename="bao-cao-${loai}-${T2}-${T2}.xlsx"`);
      const ws = x.wb!.worksheets[0]!;
      expect(ws.rowCount).toBe(all.tongDong + 2); // tiêu đề + dòng + Tổng
      const giaTri: number[] = [];
      for (let r = 2; r <= all.tongDong + 1; r++) giaTri.push(Number(ws.getRow(r).getCell(cotSl).value ?? 0));
      if (loai === 'lich-su') {
        expect(giaTri.reduce((a, b) => a + b, 0)).toBe(490); // số mới của 3 lần nhập
        expect(all.tongCong.soLanGhi).toBe(3);
      } else {
        expect(giaTri.reduce((a, b) => a + b, 0)).toBe(all.tongCong[cotTong]);
        expect(ws.getRow(all.tongDong + 2).getCell(cotSl).value).toBe(all.tongCong[cotTong]);
      }
    }
    // Đúng 3 bản ghi nhập → lệch 0 bản ghi
    expect((await w.get(`/api/bao-cao/cong-doan?${loc}`).expect(200)).body.tongCong.sanLuong)
      .toBe((await t.prisma.sanLuong.aggregate({ _sum: { soLuong: true }, where: { chuyen: { xuongId: k.x.id } } }))._sum.soLuong);
  });

  it('theo mã hàng: Đã làm = công đoạn hoàn thành; lũy kế, còn lại, % hoàn thành; Excel có sheet theo công đoạn', async () => {
    clock.dat(luc(T2));
    const k = await dung();
    const w = await web(k.sa);
    await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[0]!.id, congNgay(T2, -7), k.nv1.id, 200);
    await duLieuT2(k, w);
    const mh = (await w.get(`/api/bao-cao/ma-hang?${q(k, `&maHangId=${k.m1.mh.id}`)}`).expect(200)).body.dong;
    expect(mh).toEqual([expect.objectContaining({ maHangId: k.m1.mh.id, daLamKy: 400, daLamLuyKe: 600, soLuongDonHang: 1000, conLai: 400, phanTram: 60 })]);
    expect(mh[0].congDoan).toEqual([{ ma: 'CD-1', ten: 'Công đoạn 1', sanLuong: 400 }, { ma: 'CD-2', ten: 'Công đoạn 2', sanLuong: 90 }]);
    const x = await w.excel(`/api/bao-cao/ma-hang/xuat?${q(k, `&maHangId=${k.m1.mh.id}`)}`);
    expect(x.wb!.getWorksheet('Theo công đoạn')!.rowCount).toBe(3);
  });

  it('khoảng > 3 tháng → "Chọn tối đa 3 tháng."; không có dữ liệu → không xuất file rỗng', async () => {
    const k = await dung();
    const w = await web(k.sa);
    const r = await w.get('/api/bao-cao/cong-nhan?tu=2026-01-01&den=2026-04-01');
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Chọn tối đa 3 tháng.');
    const x = await w.excel(`/api/bao-cao/cong-nhan/xuat?tu=2025-02-01&den=2025-02-02&xuongId=${k.x.id}`);
    expect(x.status).toBe(422);
    expect(x.body).toMatchObject({ code: 'KHONG_CO_DU_LIEU' });
  });
});

describe('"Của tôi" [F11] — F5 = F11', () => {
  it('30 ngày gần nhất có sản lượng của chính NV; số khớp 100% với báo cáo theo công nhân; chi tiết theo trạm, ô điều chỉnh kèm số cũ / lý do / người', async () => {
    clock.dat(luc(T2, '07:00'));
    const k = await dung();
    const res = await t.http().post('/api/cn/phien-tram').set(HEADER_CLIENT, 'worker').send({ tramId: k.A.tram[0]!.id, maNV: k.nv1.maNV, turnstileToken: 'x' });
    expect(res.status).toBe(200);
    const may = ((res.headers['set-cookie'] ?? []) as unknown as string[]).find((c) => c.startsWith(`${COOKIE_THIET_BI}=`))!.split(';')[0]!;
    const app = await t.http().put('/api/cn/san-luong').set(HEADER_CLIENT, 'worker').set('Cookie', may)
      .send({ requestId: randomUUID(), tramId: k.A.tram[0]!.id, ngay: T2, dong: [{ congDoanId: k.m1.cd[0]!.id, soLuong: 280, thuTuThietBi: 1 }] });
    expect(app.status).toBe(200);
    const w = await web(k.sa);
    await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[0]!.id, T2, k.nv1.id, 300); // tổ trưởng sửa 280 → 300
    await nhapHo(w, k.B.tram[0]!.id, k.m1.cd[0]!.id, T2, k.nv1.id, 100);
    await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[0]!.id, congNgay(T2, -3), k.nv1.id, 50);
    await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[0]!.id, congNgay(T2, -40), k.nv1.id, 70); // ngoài 30 ngày
    await nhapHo(w, k.A.tram[0]!.id, k.m1.cd[1]!.id, T2, k.nv2.id, 90); // NV khác

    const cuaToi = (await t.http().get('/api/cn/cua-toi').set(HEADER_CLIENT, 'worker').set('Cookie', may).expect(200)).body;
    expect(cuaToi.nhanVien).toEqual({ maNV: k.nv1.maNV, hoTen: 'Nguyễn Thị Lan' });
    expect(cuaToi.ngay.map((d: { ngay: string }) => d.ngay)).toEqual([T2, congNgay(T2, -3)]);
    const hn = cuaToi.ngay[0];
    expect(hn).toMatchObject({ sanLuong: 400, phutSmv: 200, gioLam: 9, coDieuChinh: true, trangThai: 'CHUA_CHOT' });

    // F5 = F11: cộng các dòng NV1 × T2 (mọi chuyền) của báo cáo theo công nhân
    const f5 = (await w.get(`/api/bao-cao/cong-nhan?tu=${T2}&den=${T2}&q=${k.nv1.maNV}`).expect(200)).body.dong;
    expect(f5.reduce((a: number, d: { sanLuong: number }) => a + d.sanLuong, 0)).toBe(hn.sanLuong);
    expect(f5.reduce((a: number, d: { phutSmv: number }) => a + d.phutSmv, 0)).toBe(hn.phutSmv);
    expect(f5.reduce((a: number, d: { gioLam: number }) => a + d.gioLam, 0)).toBe(hn.gioLam);
    for (const d of f5) expect(d.hieuSuat).toBe(hn.hieuSuat);

    const ct = (await t.http().get(`/api/cn/cua-toi/${T2}`).set(HEADER_CLIENT, 'worker').set('Cookie', may).expect(200)).body;
    expect(ct.tram.map((x: { soTram: number; maChuyen: string }) => [x.soTram, x.maChuyen])).toEqual([[1, k.A.ma], [1, k.B.ma]]);
    expect(ct.tram[0].dong[0]).toMatchObject({ ma: 'CD-1', soLuong: 300, dieuChinh: { soCu: 280, lyDo: 'Không có phiên trạm', boi: k.sa.hoTen } });
    expect((await t.http().get(`/api/cn/cua-toi/${congNgay(T2, -40)}`).set(HEADER_CLIENT, 'worker').set('Cookie', may)).status).toBe(404);
    expect((await t.http().get(`/api/cn/cua-toi/${congNgay(T2, -1)}`).set(HEADER_CLIENT, 'worker').set('Cookie', may)).status).toBe(404);
    // Không có cookie thiết bị → không xem được
    expect((await t.http().get('/api/cn/cua-toi').set(HEADER_CLIENT, 'worker')).status).toBe(401);
  });
});
