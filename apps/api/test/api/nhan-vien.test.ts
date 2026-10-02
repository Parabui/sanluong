/** Nhân viên + import Excel · PRD F2 · TDD 19 (giới hạn file) */
import { HEADER_CLIENT, homNay } from '@vsn/shared';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock } from '../../src/core/clock/clock.service.js';
import { ngayDb } from '../../src/core/prisma/ngay-db.js';
import { type AppTest, ngauNhien, taoAppTest, taoChuyenNhanh, taoVaDangNhap } from '../ho-tro/app.js';
import { type GiaTriO, taoXlsx, taoZipGia, TIEU_DE_NV } from '../ho-tro/xlsx.js';

const clock = new FakeClock(new Date());
let t: AppTest;
let sa: { cookie: string; id: string };
let hr: { cookie: string; id: string };
let c1: { id: string; ma: string };
let c2: { id: string; ma: string };

beforeAll(async () => {
  t = await taoAppTest({ clock });
  sa = await taoVaDangNhap(t, { vaiTro: 'SUPERADMIN' });
  hr = await taoVaDangNhap(t, { vaiTro: 'IT_HR' });
  const a = await taoChuyenNhanh(t);
  const b = await taoChuyenNhanh(t, { xuongId: a.xuongId });
  c1 = a.chuyen;
  c2 = b.chuyen;
});
afterAll(async () => {
  await t.dong();
});

const ghi = (method: 'post' | 'patch' | 'delete', url: string, cookie = hr.cookie) =>
  t.http()[method](url).set('Cookie', cookie).set(HEADER_CLIENT, 'web');
const xemTruoc = (buf: Buffer, ten = 'DanhSachNV.xlsx', cookie = hr.cookie) =>
  ghi('post', '/api/import/nhan-vien/xem-truoc', cookie).attach('file', buf, ten);
const xacNhan = (importId: string, body: object = {}, cookie = hr.cookie) =>
  ghi('post', `/api/import/${importId}/xac-nhan`, cookie).send(body);
const ma = () => ngauNhien('NV');

describe('Nhân viên', () => {
  it('[R 3.4] mã NV trim + viết hoa, giữ số 0 đầu; trùng mã → 409', async () => {
    const m = ma();
    const res = await ghi('post', '/api/nhan-vien').send({ maNV: `  ${m.toLowerCase()} `, hoTen: 'Nguyễn Thị Lan', chuyenId: c1.id }).expect(201);
    expect(res.body).toMatchObject({ maNV: m, maChuyen: c1.ma, trangThai: 'HOAT_DONG', coSanLuong: false, bacTayNghe: null });
    const so = `00${Date.now() % 100000}`;
    expect((await ghi('post', '/api/nhan-vien').send({ maNV: so, hoTen: 'A', chuyenId: c1.id }).expect(201)).body.maNV).toBe(so);
    const trung = await ghi('post', '/api/nhan-vien').send({ maNV: m, hoTen: 'B', chuyenId: c1.id }).expect(409);
    expect(trung.body).toMatchObject({ code: 'TRUNG_MA', field: 'maNV' });
  });

  it('[F2] danh sách lọc theo chuyền, trạng thái, tìm mã/họ tên, phân trang', async () => {
    const { chuyen } = await taoChuyenNhanh(t);
    for (let i = 0; i < 3; i++) await ghi('post', '/api/nhan-vien').send({ maNV: ma(), hoTen: `Trần Văn Hùng ${i}`, chuyenId: chuyen.id }).expect(201);
    const ds = (await t.http().get(`/api/nhan-vien?chuyenId=${chuyen.id}&kichThuoc=2&trang=1`).set('Cookie', hr.cookie).expect(200)).body;
    expect(ds).toMatchObject({ tong: 3, trang: 1, kichThuoc: 2 });
    expect(ds.duLieu).toHaveLength(2);
    const tim = (await t.http().get(`/api/nhan-vien?chuyenId=${chuyen.id}&q=hùng 2`).set('Cookie', hr.cookie).expect(200)).body;
    expect(tim.tong).toBe(1);
  });

  it('[D18] đổi chuyền → lịch sử chuyền gốc có hiệu lực từ hôm nay; version cũ → 409', async () => {
    const nv = (await ghi('post', '/api/nhan-vien').send({ maNV: ma(), hoTen: 'A', chuyenId: c1.id }).expect(201)).body;
    const sua = (await ghi('patch', `/api/nhan-vien/${nv.id}`).send({ chuyenId: c2.id, version: nv.version }).expect(200)).body;
    expect(sua.chuyenId).toBe(c2.id);
    const ls = await t.prisma.nhanVienChuyenGoc.findMany({ where: { nhanVienId: nv.id } });
    expect(ls).toHaveLength(1); // cùng ngày → lần cuối thắng
    expect(ls[0]!.chuyenId).toBe(c2.id);
    await ghi('patch', `/api/nhan-vien/${nv.id}`).send({ hoTen: 'B', version: nv.version }).expect(409);
  });

  it('[F2] ngưng NV đang đăng nhập trạm → tự đăng xuất khỏi mọi trạm; NV ngưng không chuyển sang chuyền ngưng được', async () => {
    const nv = (await ghi('post', '/api/nhan-vien').send({ maNV: ma(), hoTen: 'A', chuyenId: c1.id }).expect(201)).body;
    const tb = await t.prisma.thietBi.create({ data: { tokenHash: ngauNhien('h') } });
    const tram = await t.prisma.tram.findFirstOrThrow({ where: { chuyenId: c1.id }, orderBy: { soTram: 'desc' } });
    const p = await t.prisma.phienTram.create({ data: { tramId: tram.id, nhanVienId: nv.id, thietBiId: tb.id, ngayLamViec: ngayDb(homNay(clock.now())) } });
    await ghi('patch', `/api/nhan-vien/${nv.id}`).send({ trangThai: 'NGUNG', version: nv.version }).expect(200);
    expect(await t.prisma.phienTram.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ lyDoDong: 'DANG_XUAT_HO', lyDo: 'Ngưng nhân viên' });
  });

  it('[R 5.6] xóa hẳn: chỉ Superadmin, chỉ NV chưa có sản lượng', async () => {
    const tao = async () => (await ghi('post', '/api/nhan-vien').send({ maNV: ma(), hoTen: 'Nhầm', chuyenId: c1.id }).expect(201)).body;
    const nv = await tao();
    expect((await ghi('delete', `/api/nhan-vien/${nv.id}`).expect(403)).body.code).toBe('CHI_SUPERADMIN');
    await ghi('delete', `/api/nhan-vien/${nv.id}`, sa.cookie).expect(204);
    expect(await t.prisma.nhanVien.count({ where: { id: nv.id } })).toBe(0);
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'XOA_NHAN_VIEN', doiTuongId: nv.id } })).toBe(1);

    const coSL = await tao();
    const tram = await t.prisma.tram.findFirstOrThrow({ where: { chuyenId: c1.id } });
    const mh = await t.prisma.maHang.create({ data: { ma: ngauNhien('MH'), ten: 'Áo', soLuongDonHang: 1 } });
    const cd = await t.prisma.congDoan.create({ data: { maHangId: mh.id, ma: 'CD1', ten: 'May' } });
    await t.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('vsn.nguoi_thuc_hien', 'test', true)`;
      await tx.sanLuong.create({ data: { ngayLamViec: ngayDb('2026-09-07'), tramId: tram.id, congDoanId: cd.id, nhanVienId: coSL.id, soLuong: 1, chuyenTramSnapshot: c1.id, nguon: 'APP' } });
    });
    const ds = (await t.http().get(`/api/nhan-vien?q=${coSL.maNV}`).set('Cookie', sa.cookie).expect(200)).body;
    expect(ds.duLieu[0].coSanLuong).toBe(true);
    expect((await ghi('delete', `/api/nhan-vien/${coSL.id}`, sa.cookie).expect(422)).body.code).toBe('NV_DA_CO_SAN_LUONG');
  });
});

describe('Import Excel nhân viên', () => {
  it('[F2] import 600 dòng < 10 giây; mã NV đã có → cập nhật, không tạo trùng', async () => {
    const dong: GiaTriO[][] = Array.from({ length: 600 }, (_, i) => [ma(), `Công nhân ${i}`, i % 2 ? c1.ma : c2.ma, `${(i % 7) + 1}/7`]);
    const batDau = performance.now();
    const xt = (await xemTruoc(await taoXlsx(TIEU_DE_NV, dong)).expect(200)).body;
    expect(xt).toMatchObject({ tongDong: 600, them: 600, capNhat: 0, loi: 0, canhBao: 0 });
    expect((await xacNhan(xt.importId).expect(200)).body).toEqual({ them: 600, capNhat: 0, boQua: 0 });
    expect(performance.now() - batDau).toBeLessThan(10_000);

    // Import lại: 5 dòng đổi họ tên, còn lại không đổi
    const lai = dong.map((d, i): GiaTriO[] => (i < 5 ? [d[0] ?? null, `Tên mới ${i}`, d[2] ?? null, d[3] ?? null] : d));
    const xt2 = (await xemTruoc(await taoXlsx(TIEU_DE_NV, lai)).expect(200)).body;
    expect(xt2).toMatchObject({ them: 0, capNhat: 5, khongDoi: 595 });
    expect((await xacNhan(xt2.importId).expect(200)).body).toEqual({ them: 0, capNhat: 5, boQua: 595 });
    expect(await t.prisma.nhanVien.count({ where: { maNV: { in: dong.map((d) => d[0] as string) } } })).toBe(600);
    expect(await t.prisma.auditLog.count({ where: { hanhDong: 'IMPORT_NHAN_VIEN', doiTuongId: xt.importId } })).toBe(1);
  });

  it('[F2] dòng lỗi không ghi, dòng hợp lệ vẫn ghi; trùng mã trong file (sau chuẩn hóa) → cả hai dòng lỗi', async () => {
    const tot = ma();
    const trung = ma();
    const xt = (await xemTruoc(await taoXlsx(TIEU_DE_NV, [
      [tot, 'Hợp lệ', c1.ma, null],              // dòng 2
      [null, 'Thiếu mã', c1.ma, null],            // dòng 3
      [ma(), null, c1.ma, null],                  // dòng 4
      [ma(), 'Chuyền lạ', 'KHONG-CO', null],      // dòng 5
      [` ${trung.toLowerCase()}`, 'Trùng 1', c1.ma, null], // dòng 6
      [trung, 'Trùng 2', c2.ma, null],            // dòng 7
      [ma(), 'Chuyền chữ thường', c2.ma.toLowerCase(), null], // dòng 8 — mã chuyền cũng chuẩn hóa
    ])).expect(200)).body;
    expect(xt).toMatchObject({ tongDong: 7, them: 2, loi: 5 });
    expect(xt.dsLoi).toEqual([
      { dong: [3], lyDo: 'Thiếu Mã NV' },
      { dong: [4], lyDo: 'Thiếu Họ tên' },
      { dong: [5], lyDo: 'Chuyền/Nhóm KHONG-CO không tồn tại' },
      { dong: [6, 7], lyDo: `Trùng mã ${trung} trong file (sau chuẩn hóa)` },
    ]);
    expect((await xacNhan(xt.importId).expect(200)).body.them).toBe(2);
    expect(await t.prisma.nhanVien.count({ where: { maNV: trung } })).toBe(0);
  });

  it('[F2] ô Mã NV kiểu số → cảnh báo; phải xác nhận mới ghi', async () => {
    const so = 900000 + Math.floor(Math.random() * 99999);
    const xt = (await xemTruoc(await taoXlsx(TIEU_DE_NV, [[so, 'Kiểu số', c1.ma, null]])).expect(200)).body;
    expect(xt).toMatchObject({ them: 1, canhBao: 1, dsCanhBao: [{ dong: [2], lyDo: 'Mã NV đang ở dạng số — kiểm tra số 0 đầu' }] });
    expect((await xacNhan(xt.importId).expect(409)).body.code).toBe('CAN_XAC_NHAN');
    await xacNhan(xt.importId, { xacNhanCanhBao: true }).expect(200);
    expect(await t.prisma.nhanVien.count({ where: { maNV: String(so) } })).toBe(1);
  });

  it('[F2] file sai mẫu / thiếu cột → từ chối cả file; tiêu đề không dấu vẫn nhận', async () => {
    const res = await xemTruoc(await taoXlsx(['Mã NV', 'Tên'], [[ma(), 'A']])).expect(422);
    expect(res.body).toMatchObject({ code: 'FILE_SAI_MAU', chiTiet: { thieu: ['Họ tên', 'Chuyền/Nhóm'] } });
    await xemTruoc(await taoXlsx(['ma nv', 'HO TEN', 'chuyen / nhom'], [[ma(), 'A', c1.ma]])).expect(200);
  });

  it('[TDD 19] chỉ nhận .xlsx thật; chặn zip bomb (> 50 MB giải nén) trước khi parse; > 10 MB → 413; > 5.000 dòng → từ chối', async () => {
    const xlsx = await taoXlsx(TIEU_DE_NV, [[ma(), 'A', c1.ma, null]]);
    expect((await xemTruoc(xlsx, 'ds.csv').expect(422)).body.code).toBe('FILE_KHONG_HOP_LE');
    expect((await xemTruoc(Buffer.from('Mã NV,Họ tên\nNV1,A'), 'gia.xlsx').expect(422)).body.code).toBe('FILE_KHONG_HOP_LE');
    expect((await xemTruoc(taoZipGia(60 * 1024 * 1024), 'bom.xlsx').expect(422)).body.chiTiet).toEqual({ lyDo: 'ZIP_BOMB' });
    expect((await xemTruoc(Buffer.alloc(10 * 1024 * 1024 + 1), 'to.xlsx').expect(413)).body.code).toBe('FILE_QUA_LON');
    const nhieu = await taoXlsx(TIEU_DE_NV, Array.from({ length: 5001 }, (_, i) => [`X${i}`, 'A', c1.ma, null]));
    expect((await xemTruoc(nhieu).expect(422)).body.code).toBe('FILE_QUA_NHIEU_DONG');
    expect((await ghi('post', '/api/import/nhan-vien/xem-truoc').expect(400)).body.field).toBe('file');
  });

  it('[TDD 6.1] bản xem trước hết hạn sau 30 phút; chỉ người tạo xác nhận được; xác nhận 2 lần chỉ ghi 1 lần', async () => {
    const buf = () => taoXlsx(TIEU_DE_NV, [[ma(), 'A', c1.ma, null]]);
    const xt = (await xemTruoc(await buf()).expect(200)).body;
    await xacNhan(xt.importId, {}, sa.cookie).expect(404); // người khác
    await xacNhan(xt.importId).expect(200);
    await xacNhan(xt.importId).expect(404);

    const cu = (await xemTruoc(await buf()).expect(200)).body;
    clock.tien(30 * 60_000 + 1);
    expect((await xacNhan(cu.importId).expect(410)).body.code).toBe('IMPORT_HET_HAN');
  });

  it('[F2] chuyền bị ngưng giữa lúc xem trước và xác nhận → dòng đó bỏ qua', async () => {
    const { chuyen } = await taoChuyenNhanh(t);
    const xt = (await xemTruoc(await taoXlsx(TIEU_DE_NV, [[ma(), 'A', chuyen.ma, null], [ma(), 'B', c1.ma, null]])).expect(200)).body;
    await t.prisma.chuyen.update({ where: { id: chuyen.id }, data: { trangThai: 'NGUNG' } });
    expect((await xacNhan(xt.importId).expect(200)).body).toEqual({ them: 1, capNhat: 0, boQua: 1 });
  });

  it('[F2] file mẫu: đúng cột, cột Mã NV định dạng Text', async () => {
    const res = await t.http().get('/api/import/nhan-vien/mau').set('Cookie', hr.cookie).buffer(true)
      .parse((r, cb) => { const ds: Buffer[] = []; r.on('data', (c: Buffer) => ds.push(c)); r.on('end', () => cb(null, Buffer.concat(ds))); })
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(/mau-import-nhan-vien\.xlsx/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    expect((ws.getRow(1).values as string[]).slice(1)).toEqual(TIEU_DE_NV);
    expect(ws.getColumn(1).numFmt).toBe('@');
  });

  it('[F8] tổ trưởng không import được (không có chức năng Nhân viên)', async () => {
    const tt = await taoVaDangNhap(t, { vaiTro: 'TO_TRUONG', chuyenIds: [c1.id] });
    await xemTruoc(await taoXlsx(TIEU_DE_NV, [[ma(), 'A', c1.ma, null]]), 'a.xlsx', tt.cookie).expect(403);
  });
});
