/**
 * Ràng buộc & trigger viết tay trong migration [TDD 6.3] — DB là hàng rào cuối (N2).
 * Chạy bằng tài khoản chủ schema (vsn_migrate): trigger/ràng buộc áp dụng cho MỌI tài khoản.
 * Phần quyền của vsn_app / vsn_backup kiểm ở quyen-db.test.ts.
 */
import { homNay } from '@vsn/shared';
import { describe, expect, it } from 'vitest';
import { dungDb, kyVongLoi, mot, SQLSTATE } from '../ho-tro/db.js';
import {
  chotNgay,
  khoaThang,
  taoChuyen,
  taoCongDoan,
  taoKhung,
  taoMaHang,
  taoNhanVien,
  taoPhienTram,
  taoSanLuong,
  taoTaiKhoan,
  taoThietBi,
  taoTram,
} from '../ho-tro/factory.js';

const T2 = '2026-09-07'; // Thứ Hai
const T3 = '2026-09-08';

const ctx = dungDb('vsn_migrate');

describe('uuid_v7()', () => {
  it('sinh UUID phiên bản 7, biến thể RFC, 48 bit đầu là mốc thời gian hiện tại', async () => {
    const { rows } = await ctx.db.query<{ u: string; ms: string }>(
      `SELECT uuid_v7()::text AS u, (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text AS ms`,
    );
    const { u, ms } = rows[0]!;
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const msTrongUuid = parseInt(u.replace(/-/g, '').slice(0, 12), 16);
    expect(Math.abs(msTrongUuid - Number(ms))).toBeLessThan(1000);
  });

  it('khóa chính mặc định của bảng là uuid v7 tăng dần theo thời gian', async () => {
    const a = await mot<string>(ctx.db, `INSERT INTO xuong (ma, ten) VALUES ('UA', 'a') RETURNING id::text`);
    await ctx.db.query('SELECT pg_sleep(0.002)');
    const b = await mot<string>(ctx.db, `INSERT INTO xuong (ma, ten) VALUES ('UB', 'b') RETURNING id::text`);
    expect(a < b).toBe(true);
  });
});

describe('Phiên trạm', () => {
  it('[R 1] mỗi trạm × ngày chỉ 1 phiên đang hoạt động; đóng phiên cũ thì người khác vào được', async () => {
    const k = await taoKhung(ctx.db);
    const nv2 = await taoNhanVien(ctx.db, k.chuyenId);
    const [tb1, tb2] = [await taoThietBi(ctx.db), await taoThietBi(ctx.db)];
    const p1 = await taoPhienTram(ctx.db, { tramId: k.tramId, nhanVienId: k.nhanVienId, thietBiId: tb1, ngay: T2 });

    await kyVongLoi(
      ctx.db,
      `INSERT INTO phien_tram (tram_id, nhan_vien_id, ngay_lam_viec, thiet_bi_id) VALUES ($1, $2, $3, $4)`,
      [k.tramId, nv2, T2, tb2],
      SQLSTATE.TRUNG_UNIQUE,
    );

    const tt = await taoTaiKhoan(ctx.db);
    await ctx.db.query(
      `UPDATE phien_tram SET dang_xuat_luc = now(), ly_do_dong = 'DANG_XUAT_HO', dang_xuat_boi_id = $2, ly_do = 'Nhầm trạm'
       WHERE id = $1`,
      [p1, tt],
    );
    await taoPhienTram(ctx.db, { tramId: k.tramId, nhanVienId: nv2, thietBiId: tb2, ngay: T2 });
  });

  it('[R 1.3] một thiết bị chỉ một mã NV trong một ngày, nhưng được nhiều trạm', async () => {
    const k = await taoKhung(ctx.db);
    const tram2 = await taoTram(ctx.db, k.chuyenId, 27);
    const tram3 = await taoTram(ctx.db, k.chuyenId, 28);
    const nv2 = await taoNhanVien(ctx.db, k.chuyenId);
    const tb = await taoThietBi(ctx.db);

    await taoPhienTram(ctx.db, { tramId: k.tramId, nhanVienId: k.nhanVienId, thietBiId: tb, ngay: T2 });
    await taoPhienTram(ctx.db, { tramId: tram2, nhanVienId: k.nhanVienId, thietBiId: tb, ngay: T2 });
    await kyVongLoi(
      ctx.db,
      `INSERT INTO phien_tram (tram_id, nhan_vien_id, ngay_lam_viec, thiet_bi_id) VALUES ($1, $2, $3, $4)`,
      [tram3, nv2, T2, tb],
      SQLSTATE.VI_PHAM_EXCLUDE,
    );
    // Ngày khác thì được
    await taoPhienTram(ctx.db, { tramId: tram3, nhanVienId: nv2, thietBiId: tb, ngay: T3 });
  });

  it('[D26] đăng xuất hộ bắt buộc có người thực hiện và lý do; đã đóng phải có lý do đóng', async () => {
    const k = await taoKhung(ctx.db);
    const p = await taoPhienTram(ctx.db, {
      tramId: k.tramId,
      nhanVienId: k.nhanVienId,
      thietBiId: await taoThietBi(ctx.db),
      ngay: T2,
    });
    await kyVongLoi(ctx.db, `UPDATE phien_tram SET dang_xuat_luc = now() WHERE id = $1`, [p], SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(
      ctx.db,
      `UPDATE phien_tram SET dang_xuat_luc = now(), ly_do_dong = 'DANG_XUAT_HO' WHERE id = $1`,
      [p],
      SQLSTATE.VI_PHAM_CHECK,
    );
    await ctx.db.query(`UPDATE phien_tram SET dang_xuat_luc = now(), ly_do_dong = 'TU_DANG_XUAT' WHERE id = $1`, [p]);
  });
});

describe('Bản ghi sản lượng', () => {
  it('[R 1.1] duy nhất theo Ngày + Trạm + Công đoạn + Mã NV', async () => {
    const k = await taoKhung(ctx.db);
    const s = { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10 };
    await taoSanLuong(ctx.db, s);
    await kyVongLoi(
      ctx.db,
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, chuyen_tram_snapshot, nguon)
       VALUES ($1, $2, $3, $4, 5, $5, 'APP')`,
      [T2, k.tramId, k.congDoanId, k.nhanVienId, k.chuyenId],
      SQLSTATE.TRUNG_UNIQUE,
    );
    // Cùng key nhưng NV khác → bản ghi riêng
    await taoSanLuong(ctx.db, { ...s, nhanVienId: await taoNhanVien(ctx.db, k.chuyenId) });
  });

  it('[R 1.1] số lượng là số nguyên 0 – 99.999', async () => {
    const k = await taoKhung(ctx.db);
    const sql = `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, chuyen_tram_snapshot, nguon)
                 VALUES ($1, $2, $3, $4, $5, $6, 'APP')`;
    const ts = (n: number) => [T2, k.tramId, k.congDoanId, k.nhanVienId, n, k.chuyenId];
    await kyVongLoi(ctx.db, sql, ts(-1), SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ts(100_000), SQLSTATE.VI_PHAM_CHECK);
    await ctx.db.query(sql, ts(99_999));
  });

  it('[R 5.4] nguồn Web ⇔ Ô đã điều chỉnh ⇔ có tài khoản cập nhật', async () => {
    const k = await taoKhung(ctx.db);
    const tt = await taoTaiKhoan(ctx.db);
    const sql = `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, chuyen_tram_snapshot,
                                        nguon, da_dieu_chinh, cap_nhat_boi_tai_khoan_id)
                 VALUES ($1, $2, $3, $4, 10, $5, $6, $7, $8)`;
    const ts = (nguon: string, dieuChinh: boolean, tk: string | null) => [
      T2, k.tramId, k.congDoanId, k.nhanVienId, k.chuyenId, nguon, dieuChinh, tk,
    ];
    await kyVongLoi(ctx.db, sql, ts('APP', false, tt), SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ts('NHAP_HO', false, tt), SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ts('NHAP_HO', true, null), SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ts('APP', true, null), SQLSTATE.VI_PHAM_CHECK);
    await ctx.db.query(sql, ts('NHAP_HO', true, tt));
  });

  it('[D17] chuyen_tram_snapshot phải đúng chuyền của trạm và không đổi được', async () => {
    const k = await taoKhung(ctx.db);
    const chuyenKhac = await taoChuyen(ctx.db, { xuongId: k.xuongId });
    const s = { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10 };
    await kyVongLoi(
      ctx.db,
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, chuyen_tram_snapshot, nguon)
       VALUES ($1, $2, $3, $4, 10, $5, 'APP')`,
      [T2, k.tramId, k.congDoanId, k.nhanVienId, chuyenKhac],
      'SNAPSHOT_CHUYEN_SAI',
    );
    const id = await taoSanLuong(ctx.db, s);
    await kyVongLoi(ctx.db, `UPDATE san_luong SET chuyen_tram_snapshot = $2 WHERE id = $1`, [id, chuyenKhac], 'KHOA_SAN_LUONG_BAT_BIEN');
    await kyVongLoi(ctx.db, `UPDATE san_luong SET ngay_lam_viec = $2 WHERE id = $1`, [id, T3], 'KHOA_SAN_LUONG_BAT_BIEN');
  });

  it('[D17] trạm không đổi chuyền', async () => {
    const k = await taoKhung(ctx.db);
    const chuyenKhac = await taoChuyen(ctx.db, { xuongId: k.xuongId });
    await kyVongLoi(ctx.db, `UPDATE tram SET chuyen_id = $2 WHERE id = $1`, [k.tramId, chuyenKhac], 'TRAM_KHONG_DOI_CHUYEN');
    // Sửa trường khác vẫn được
    await ctx.db.query(`UPDATE tram SET nhap_qua_app = false WHERE id = $1`, [k.tramId]);
  });

  it('[R 5.4] upsert của app (TDD 8.2) bỏ qua Ô đã điều chỉnh; trigger chặn nếu code ghi đè', async () => {
    const k = await taoKhung(ctx.db);
    const tt = await taoTaiKhoan(ctx.db);
    const id = await taoSanLuong(ctx.db, {
      ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 50,
      nguon: 'SUA_WEB', taiKhoanId: tt,
    });

    const { rowCount } = await ctx.db.query(
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, chuyen_tram_snapshot, nguon)
       VALUES ($1, $2, $3, $4, 99, $5, 'APP')
       ON CONFLICT (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id) DO UPDATE
         SET so_luong = EXCLUDED.so_luong, nguon = EXCLUDED.nguon
         WHERE san_luong.da_dieu_chinh = false`,
      [T2, k.tramId, k.congDoanId, k.nhanVienId, k.chuyenId],
    );
    expect(rowCount).toBe(0);
    expect(await mot(ctx.db, `SELECT so_luong FROM san_luong WHERE id = $1`, [id])).toBe(50);

    await kyVongLoi(
      ctx.db,
      `UPDATE san_luong SET so_luong = 99, nguon = 'APP', da_dieu_chinh = false, cap_nhat_boi_tai_khoan_id = NULL WHERE id = $1`,
      [id],
      'O_DA_DIEU_CHINH',
    );
  });
});

describe('Chốt ngày & khóa tháng', () => {
  it('[F10] app không ghi được ngày đã chốt; tổ trưởng vẫn nhập hộ được', async () => {
    const k = await taoKhung(ctx.db);
    const tt = await taoTaiKhoan(ctx.db);
    await chotNgay(ctx.db, k.chuyenId, T2);
    await kyVongLoi(
      ctx.db,
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, chuyen_tram_snapshot, nguon)
       VALUES ($1, $2, $3, $4, 10, $5, 'APP')`,
      [T2, k.tramId, k.congDoanId, k.nhanVienId, k.chuyenId],
      'NGAY_DA_CHOT',
    );
    await taoSanLuong(ctx.db, {
      ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10,
      nguon: 'NHAP_HO', taiKhoanId: tt,
    });
  });

  it('[F10] chốt ngày rồi thì app không sửa số, nhưng tính lại SMV (chưa khóa) vẫn chạy', async () => {
    const k = await taoKhung(ctx.db);
    const id = await taoSanLuong(ctx.db, {
      ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10,
    });
    await chotNgay(ctx.db, k.chuyenId, T2);
    await kyVongLoi(ctx.db, `UPDATE san_luong SET so_luong = 20 WHERE id = $1`, [id], 'NGAY_DA_CHOT');
    await ctx.db.query(`UPDATE san_luong SET smv_snapshot = 45 WHERE id = $1`, [id]);
  });

  it('[R 5.5] tháng đã khóa: không sửa số, không tính lại SMV; mở khóa thì sửa được', async () => {
    const k = await taoKhung(ctx.db);
    const id = await taoSanLuong(ctx.db, {
      ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10,
    });
    await khoaThang(ctx.db, k.maHangId, '2026-09');

    await kyVongLoi(ctx.db, `UPDATE san_luong SET smv_snapshot = 99 WHERE id = $1`, [id], 'THANG_DA_KHOA');
    await kyVongLoi(ctx.db, `DELETE FROM san_luong WHERE id = $1`, [id], 'THANG_DA_KHOA');
    await kyVongLoi(
      ctx.db,
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, chuyen_tram_snapshot, nguon)
       VALUES ($1, $2, $3, $4, 1, $5, 'APP')`,
      [T3, k.tramId, k.congDoanId, await taoNhanVien(ctx.db, k.chuyenId), k.chuyenId],
      'THANG_DA_KHOA',
    );
    expect(await mot(ctx.db, `SELECT smv_snapshot::text FROM san_luong WHERE id = $1`, [id])).toBe('30.000');

    await khoaThang(ctx.db, k.maHangId, '2026-09', 'MO');
    await ctx.db.query(`UPDATE san_luong SET smv_snapshot = 99 WHERE id = $1`, [id]);
  });

  it('[F10] mã hàng vắt 2 tháng khóa riêng từng tháng', async () => {
    const k = await taoKhung(ctx.db);
    const s = { tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10 };
    const thang9 = await taoSanLuong(ctx.db, { ...s, ngay: '2026-09-30' });
    const thang10 = await taoSanLuong(ctx.db, { ...s, ngay: '2026-10-01' });
    await khoaThang(ctx.db, k.maHangId, '2026-09');
    await kyVongLoi(ctx.db, `UPDATE san_luong SET so_luong = 11 WHERE id = $1`, [thang9], 'THANG_DA_KHOA');
    await ctx.db.query(`UPDATE san_luong SET so_luong = 11 WHERE id = $1`, [thang10]);
  });

  it('[R 5.7] giờ làm của NV × ngày có sản lượng thuộc mã hàng × tháng đã khóa thì không sửa được', async () => {
    const k = await taoKhung(ctx.db);
    const tt = await taoTaiKhoan(ctx.db);
    await taoSanLuong(ctx.db, { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10 });
    const sql = `INSERT INTO gio_lam (nhan_vien_id, ngay_lam_viec, so_gio, nguon, ly_do, nguoi_thuc_hien_id)
                 VALUES ($1, $2, 10, 'TO_TRUONG_SUA', 'Tăng ca', $3)`;
    await ctx.db.query(sql, [k.nhanVienId, T3, tt]); // ngày không có sản lượng bị khóa
    await khoaThang(ctx.db, k.maHangId, '2026-09');
    await kyVongLoi(ctx.db, sql, [k.nhanVienId, T2, tt], 'THANG_DA_KHOA');
    expect(await mot(ctx.db, `SELECT gio_lam_bi_khoa($1, $2)`, [k.nhanVienId, T2])).toBe(true);
    expect(await mot(ctx.db, `SELECT gio_lam_bi_khoa($1, $2)`, [k.nhanVienId, T3])).toBe(false);
  });

  it('trang_thai_ngay(): CHUA_CHOT → DA_CHOT → DA_KHOA', async () => {
    const k = await taoKhung(ctx.db);
    const tt = () => mot<string>(ctx.db, `SELECT trang_thai_ngay($1, $2, $3)`, [k.chuyenId, T2, k.maHangId]);
    expect(await tt()).toBe('CHUA_CHOT');
    await chotNgay(ctx.db, k.chuyenId, T2);
    expect(await tt()).toBe('DA_CHOT');
    await khoaThang(ctx.db, k.maHangId, '2026-09');
    expect(await tt()).toBe('DA_KHOA');
  });

  it('[F10] chốt ngày duy nhất theo chuyền × ngày', async () => {
    const k = await taoKhung(ctx.db);
    await chotNgay(ctx.db, k.chuyenId, T2);
    await kyVongLoi(
      ctx.db,
      `INSERT INTO chot_ngay (chuyen_id, ngay_lam_viec, chot_boi_id) VALUES ($1, $2, $3)`,
      [k.chuyenId, T2, await taoTaiKhoan(ctx.db)],
      SQLSTATE.TRUNG_UNIQUE,
    );
  });
});

describe('Mã hàng, sơ đồ gán', () => {
  it('[F3] mỗi mã hàng tối đa 1 công đoạn hoàn thành', async () => {
    const mh = await taoMaHang(ctx.db);
    await taoCongDoan(ctx.db, mh, { hoanThanh: true });
    await kyVongLoi(
      ctx.db,
      `INSERT INTO cong_doan (ma_hang_id, ma, ten, la_cong_doan_hoan_thanh) VALUES ($1, 'QC2', 'QC', true)`,
      [mh],
      SQLSTATE.TRUNG_UNIQUE,
    );
    await taoCongDoan(ctx.db, await taoMaHang(ctx.db), { hoanThanh: true });
  });

  it('[R 5.5] SMV > 0', async () => {
    const k = await taoKhung(ctx.db);
    const tk = await taoTaiKhoan(ctx.db, 'IE');
    await kyVongLoi(
      ctx.db,
      `INSERT INTO smv_lich_su (cong_doan_id, smv, ap_dung_tu_ngay, nguoi_tao_id) VALUES ($1, 0, $2, $3)`,
      [k.congDoanId, T2, tk],
      SQLSTATE.VI_PHAM_CHECK,
    );
  });

  it('[R 3.6] khoảng hiệu lực gán của cùng (trạm, công đoạn) không chồng nhau; nối tiếp thì được', async () => {
    const k = await taoKhung(ctx.db);
    const sql = `INSERT INTO gan_cong_doan (tram_id, cong_doan_id, hieu_luc_tu, hieu_luc_den) VALUES ($1, $2, $3, $4)`;
    await ctx.db.query(sql, [k.tramId, k.congDoanId, '2026-09-07 07:00+07', '2026-09-07 15:00+07']);
    await kyVongLoi(ctx.db, sql, [k.tramId, k.congDoanId, '2026-09-07 14:00+07', null], SQLSTATE.VI_PHAM_EXCLUDE);
    await ctx.db.query(sql, [k.tramId, k.congDoanId, '2026-09-07 15:00+07', null]);
    // Công đoạn khác cùng trạm, cùng lúc → được
    await ctx.db.query(sql, [k.tramId, await taoCongDoan(ctx.db, k.maHangId), '2026-09-07 07:00+07', null]);
  });

  it('[F4] một chuyền chạy tối đa 2 mã hàng cùng lúc', async () => {
    const chuyenId = await taoChuyen(ctx.db);
    const sql = `INSERT INTO chuyen_ma_hang (chuyen_id, ma_hang_id, bat_dau) VALUES ($1, $2, now()) RETURNING id`;
    const { rows } = await ctx.db.query<{ id: string }>(sql, [chuyenId, await taoMaHang(ctx.db)]);
    await ctx.db.query(sql, [chuyenId, await taoMaHang(ctx.db)]);
    await kyVongLoi(ctx.db, sql, [chuyenId, await taoMaHang(ctx.db)], 'QUA_2_MA_HANG');

    // Kết thúc mã cũ → thêm được mã mới
    await ctx.db.query(`UPDATE chuyen_ma_hang SET ket_thuc = now() WHERE id = $1`, [rows[0]!.id]);
    await ctx.db.query(sql, [chuyenId, await taoMaHang(ctx.db)]);
  });
});

describe('Nhân viên & chuyền gốc', () => {
  it('[R 3.4] mã NV phải được chuẩn hóa (trim + viết hoa) trước khi lưu; giữ số 0 đầu', async () => {
    const c = await taoChuyen(ctx.db);
    const sql = `INSERT INTO nhan_vien (ma_nv, ho_ten, chuyen_id) VALUES ($1, 'A', $2)`;
    await kyVongLoi(ctx.db, sql, [' NV00123', c], SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ['nv00123', c], SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ['', c], SQLSTATE.VI_PHAM_CHECK);
    await ctx.db.query(sql, ['00123', c]);
    expect(await mot(ctx.db, `SELECT ma_nv FROM nhan_vien WHERE ma_nv = '00123'`)).toBe('00123');
  });

  it('[D18] thêm NV / đổi chuyền tự ghi lịch sử chuyền gốc từ ngày làm việc hiện tại; đổi trong ngày → lần cuối thắng', async () => {
    const a = await taoChuyen(ctx.db);
    const b = await taoChuyen(ctx.db);
    const c = await taoChuyen(ctx.db);
    const nv = await taoNhanVien(ctx.db, a);
    const homNayVn = homNay(new Date());

    const lichSu = () =>
      ctx.db
        .query<{ tu_ngay: string; chuyen_id: string }>(
          `SELECT tu_ngay, chuyen_id FROM nhan_vien_chuyen_goc WHERE nhan_vien_id = $1 ORDER BY tu_ngay`,
          [nv],
        )
        .then((r) => r.rows);

    expect(await lichSu()).toEqual([{ tu_ngay: homNayVn, chuyen_id: a }]);
    await ctx.db.query(`UPDATE nhan_vien SET chuyen_id = $2 WHERE id = $1`, [nv, b]);
    await ctx.db.query(`UPDATE nhan_vien SET chuyen_id = $2 WHERE id = $1`, [nv, c]);
    expect(await lichSu()).toEqual([{ tu_ngay: homNayVn, chuyen_id: c }]);

    // Sửa trường khác không đụng lịch sử
    await ctx.db.query(`UPDATE nhan_vien SET ho_ten = 'Tên mới' WHERE id = $1`, [nv]);
    expect(await lichSu()).toHaveLength(1);
  });

  it('[D18] chuyen_goc_ngay() lấy chuyền gốc có hiệu lực tại ngày D, không phải chuyền hiện tại', async () => {
    const a = await taoChuyen(ctx.db);
    const b = await taoChuyen(ctx.db);
    const nv = await taoNhanVien(ctx.db, b);
    await ctx.db.query(`DELETE FROM nhan_vien_chuyen_goc WHERE nhan_vien_id = $1`, [nv]);
    await ctx.db.query(
      `INSERT INTO nhan_vien_chuyen_goc (nhan_vien_id, tu_ngay, chuyen_id) VALUES ($1, '2026-09-01', $2), ($1, '2026-09-15', $3)`,
      [nv, a, b],
    );
    const goc = (d: string) => mot<string | null>(ctx.db, `SELECT chuyen_goc_ngay($1, $2)`, [nv, d]);
    expect(await goc('2026-08-31')).toBeNull();
    expect(await goc('2026-09-01')).toBe(a);
    expect(await goc('2026-09-14')).toBe(a);
    expect(await goc('2026-09-15')).toBe(b);
  });
});

describe('Giờ làm', () => {
  it('[F6] số giờ trong (0, 16], nhận thập phân; tổ trưởng sửa bắt buộc lý do', async () => {
    const k = await taoKhung(ctx.db);
    const tt = await taoTaiKhoan(ctx.db);
    const sql = `INSERT INTO gio_lam (nhan_vien_id, ngay_lam_viec, so_gio, nguon, ly_do, nguoi_thuc_hien_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`;
    const ts = (gio: number, ngay = T2, nguon = 'YEU_CAU_DUYET', lyDo: string | null = null) => [
      k.nhanVienId, ngay, gio, nguon, lyDo, tt,
    ];
    await kyVongLoi(ctx.db, sql, ts(0), SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ts(16.01), SQLSTATE.VI_PHAM_CHECK);
    await kyVongLoi(ctx.db, sql, ts(9, T2, 'TO_TRUONG_SUA', '  '), SQLSTATE.VI_PHAM_CHECK);
    await ctx.db.query(sql, ts(9.5));
    await ctx.db.query(sql, ts(16, T3, 'TO_TRUONG_SUA', 'Tăng ca'));
  });

  it('[F6] tối đa 1 yêu cầu sửa giờ đang chờ / NV × ngày; từ chối bắt buộc lý do', async () => {
    const k = await taoKhung(ctx.db);
    const sql = `INSERT INTO yeu_cau_gio (nhan_vien_id, ngay_lam_viec, so_gio) VALUES ($1, $2, 10) RETURNING id`;
    const { rows } = await ctx.db.query<{ id: string }>(sql, [k.nhanVienId, T2]);
    await kyVongLoi(ctx.db, sql, [k.nhanVienId, T2], SQLSTATE.TRUNG_UNIQUE);
    await kyVongLoi(ctx.db, `UPDATE yeu_cau_gio SET trang_thai = 'TU_CHOI' WHERE id = $1`, [rows[0]!.id], SQLSTATE.VI_PHAM_CHECK);
    await ctx.db.query(`UPDATE yeu_cau_gio SET trang_thai = 'TU_CHOI', ly_do_tu_choi = 'Sai giờ' WHERE id = $1`, [rows[0]!.id]);
    await ctx.db.query(sql, [k.nhanVienId, T2]); // yêu cầu cũ đã xử lý → gửi yêu cầu mới được
  });
});

describe('Audit & hệ thống', () => {
  it('[D9] audit_log, san_luong_lich_su, lich_su_xuat_luong chỉ thêm — chặn cả chủ bảng', async () => {
    await ctx.db.query(
      `INSERT INTO audit_log (loai_nguoi_thuc_hien, hanh_dong, doi_tuong) VALUES ('HE_THONG', 'THU', 'thu')`,
    );
    await kyVongLoi(ctx.db, `UPDATE audit_log SET hanh_dong = 'SUA'`, [], /chỉ được thêm/);
    await kyVongLoi(ctx.db, `DELETE FROM audit_log`, [], /chỉ được thêm/);
    for (const bang of ['audit_log', 'san_luong_lich_su', 'lich_su_xuat_luong']) {
      await kyVongLoi(ctx.db, `TRUNCATE ${bang} CASCADE`, [], /chỉ được thêm/);
    }
  });

  it('[D9] lưới an toàn: ghi san_luong không qua ứng dụng → audit DB_TRUC_TIEP; qua ứng dụng thì không', async () => {
    const k = await taoKhung(ctx.db);
    const s = { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, soLuong: 10 };
    const dem = () => mot<string>(ctx.db, `SELECT count(*)::text FROM audit_log WHERE loai_nguoi_thuc_hien = 'DB_TRUC_TIEP'`);

    const truoc = await dem();
    await taoSanLuong(ctx.db, { ...s, nhanVienId: k.nhanVienId }); // vsn.nguoi_thuc_hien = 'test'
    expect(await dem()).toBe(truoc);

    await ctx.db.query(`SELECT set_config('vsn.nguoi_thuc_hien', '', true)`);
    const id = await taoSanLuong(ctx.db, { ...s, nhanVienId: await taoNhanVien(ctx.db, k.chuyenId) });
    await ctx.db.query(`UPDATE san_luong SET so_luong = 11 WHERE id = $1`, [id]);
    const { rows } = await ctx.db.query(
      `SELECT db_user, doi_tuong, doi_tuong_id, du_lieu_cu IS NULL AS khong_cu
       FROM audit_log WHERE loai_nguoi_thuc_hien = 'DB_TRUC_TIEP' AND doi_tuong_id = $1 ORDER BY id`,
      [id],
    );
    expect(rows).toEqual([
      { db_user: 'vsn_migrate', doi_tuong: 'san_luong', doi_tuong_id: id, khong_cu: true },
      { db_user: 'vsn_migrate', doi_tuong: 'san_luong', doi_tuong_id: id, khong_cu: false },
    ]);
  });

  it('[F8] quyền Quản lý tài khoản của Superadmin không tắt được', async () => {
    // Upsert: bảng có thể đã được seed bởi test API chạy trước trong cùng container
    const sql = `INSERT INTO quyen_vai_tro (vai_tro, chuc_nang, bat_tat) VALUES ($1, $2, $3)
                 ON CONFLICT (vai_tro, chuc_nang) DO UPDATE SET bat_tat = EXCLUDED.bat_tat`;
    await kyVongLoi(ctx.db, sql, ['SUPERADMIN', 'TAI_KHOAN_QUAN_LY', false], SQLSTATE.VI_PHAM_CHECK);
    await ctx.db.query(sql, ['SUPERADMIN', 'TAI_KHOAN_QUAN_LY', true]);
    await ctx.db.query(sql, ['SUPERADMIN', 'BAO_CAO_XEM', false]);
  });

  it('updated_at do DB đặt khi UPDATE, kể cả khi câu lệnh cố gán giá trị khác', async () => {
    const id = await mot<string>(ctx.db, `INSERT INTO xuong (ma, ten) VALUES ('UPD', 'a') RETURNING id`);
    await ctx.db.query(`UPDATE xuong SET ten = 'b', updated_at = '2000-01-01' WHERE id = $1`, [id]);
    // Cột lưu tới mili-giây → so gần đúng với now() của transaction
    expect(await mot(ctx.db, `SELECT abs(extract(epoch FROM updated_at - now())) < 0.01 FROM xuong WHERE id = $1`, [id])).toBe(true);
  });

  it('khóa tháng đúng định dạng YYYY-MM', async () => {
    const mh = await taoMaHang(ctx.db);
    await kyVongLoi(
      ctx.db,
      `INSERT INTO khoa_thang (ma_hang_id, thang, trang_thai, nguoi_thuc_hien_id) VALUES ($1, '2026-13', 'KHOA', $2)`,
      [mh, await taoTaiKhoan(ctx.db, 'IT_HR')],
      SQLSTATE.VI_PHAM_CHECK,
    );
  });
});
