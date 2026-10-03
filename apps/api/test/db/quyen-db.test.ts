/**
 * Quyền tài khoản DB [D9] [TDD 6.4]: chạy bằng ĐÚNG tài khoản API dùng lúc chạy (vsn_app)
 * — quyền mặc định từ infra/postgres/init/01-tai-khoan.sh + REVOKE trong migration.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dungDb, ketNoi, kyVongLoi, mot, SQLSTATE, type Db } from '../ho-tro/db.js';
import { taoChuyen, taoKhung, taoMaHang, taoNhanVien, taoSanLuong } from '../ho-tro/factory.js';

const T2 = '2026-09-07';

describe('vsn_app', () => {
  const ctx = dungDb('vsn_app');

  it('[D9] chỉ INSERT/SELECT trên bảng chỉ-thêm, không UPDATE/DELETE/TRUNCATE', async () => {
    await ctx.db.query(
      `INSERT INTO audit_log (loai_nguoi_thuc_hien, hanh_dong, doi_tuong) VALUES ('HE_THONG', 'THU', 'thu')`,
    );
    for (const bang of ['audit_log', 'san_luong_lich_su', 'lich_su_xuat_luong']) {
      await kyVongLoi(ctx.db, `UPDATE ${bang} SET id = id`, [], SQLSTATE.KHONG_CO_QUYEN);
      await kyVongLoi(ctx.db, `DELETE FROM ${bang}`, [], SQLSTATE.KHONG_CO_QUYEN);
      await kyVongLoi(ctx.db, `TRUNCATE ${bang}`, [], SQLSTATE.KHONG_CO_QUYEN);
    }
  });

  it('[D9] không có quyền DDL', async () => {
    await kyVongLoi(ctx.db, `CREATE TABLE thu_ddl (id int)`, [], SQLSTATE.KHONG_CO_QUYEN);
    await kyVongLoi(ctx.db, `ALTER TABLE san_luong DROP CONSTRAINT ck_so_luong`, [], SQLSTATE.KHONG_CO_QUYEN);
    await kyVongLoi(ctx.db, `DROP TRIGGER tg_san_luong_bao_ve ON san_luong`, [], SQLSTATE.KHONG_CO_QUYEN);
  });

  it('[D18] không ghi thẳng lịch sử chuyền gốc, nhưng thêm/đổi chuyền NV thì trigger vẫn ghi được', async () => {
    const a = await taoChuyen(ctx.db);
    const b = await taoChuyen(ctx.db);
    const nv = await taoNhanVien(ctx.db, a);
    await ctx.db.query(`UPDATE nhan_vien SET chuyen_id = $2 WHERE id = $1`, [nv, b]);
    expect(await mot(ctx.db, `SELECT chuyen_id FROM nhan_vien_chuyen_goc WHERE nhan_vien_id = $1`, [nv])).toBe(b);

    await kyVongLoi(
      ctx.db,
      `INSERT INTO nhan_vien_chuyen_goc (nhan_vien_id, tu_ngay, chuyen_id) VALUES ($1, '2026-01-01', $2)`,
      [nv, a],
      SQLSTATE.KHONG_CO_QUYEN,
    );
    await kyVongLoi(ctx.db, `UPDATE nhan_vien_chuyen_goc SET chuyen_id = $1`, [a], SQLSTATE.KHONG_CO_QUYEN);
  });

  it('[R 5.6] xóa hẳn NV chưa có sản lượng được (kéo theo lịch sử chuyền gốc); NV đã có sản lượng thì DB chặn', async () => {
    const k = await taoKhung(ctx.db);
    const nvMoi = await taoNhanVien(ctx.db, k.chuyenId);
    await ctx.db.query(`DELETE FROM nhan_vien WHERE id = $1`, [nvMoi]);

    await taoSanLuong(ctx.db, { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 1 });
    await kyVongLoi(ctx.db, `DELETE FROM nhan_vien WHERE id = $1`, [k.nhanVienId], '23503');
  });

  it('[D9] view chỉ đọc', async () => {
    for (const view of ['v_san_luong_chi_tiet', 'v_nv_ngay', 'v_nv_chuyen_ngay']) {
      const { rows } = await ctx.db.query(
        `SELECT has_table_privilege($1, 'SELECT') AS doc,
                has_table_privilege($1, 'INSERT') OR has_table_privilege($1, 'UPDATE')
                  OR has_table_privilege($1, 'DELETE') AS ghi`,
        [view],
      );
      expect(rows[0], view).toEqual({ doc: true, ghi: false });
    }
  });

  it('[D9] lưới an toàn hoạt động với quyền của vsn_app (ghi audit DB_TRUC_TIEP)', async () => {
    const k = await taoKhung(ctx.db);
    await ctx.db.query(`SELECT set_config('vsn.nguoi_thuc_hien', '', true)`);
    const id = await taoSanLuong(ctx.db, {
      ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 1,
    });
    expect(await mot(ctx.db, `SELECT db_user FROM audit_log WHERE doi_tuong_id = $1`, [id])).toBe('vsn_app');
  });

  it('[F4] trigger tối đa 2 mã hàng chạy được với quyền của vsn_app', async () => {
    const chuyenId = await taoChuyen(ctx.db);
    const sql = `INSERT INTO chuyen_ma_hang (chuyen_id, ma_hang_id, bat_dau) VALUES ($1, $2, now())`;
    await ctx.db.query(sql, [chuyenId, await taoMaHang(ctx.db)]);
    await ctx.db.query(sql, [chuyenId, await taoMaHang(ctx.db)]);
    await kyVongLoi(ctx.db, sql, [chuyenId, await taoMaHang(ctx.db)], 'QUA_2_MA_HANG');
  });
});

describe('vsn_backup', () => {
  let db: Db;
  beforeAll(async () => {
    db = await ketNoi('vsn_backup');
  });
  afterAll(async () => {
    await db.end();
  });

  it('[D9] chỉ đọc', async () => {
    await db.query(`SELECT count(*) FROM san_luong`);
    await db.query(`SELECT count(*) FROM audit_log`);
    await expect(db.query(`INSERT INTO xuong (ma, ten) VALUES ('BK', 'x')`)).rejects.toMatchObject({
      code: SQLSTATE.KHONG_CO_QUYEN,
    });
  });
});
