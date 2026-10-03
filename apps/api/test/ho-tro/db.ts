/**
 * Kết nối DB cho test tích hợp. Mỗi test chạy trong MỘT transaction và ROLLBACK ở cuối
 * → các test không ảnh hưởng nhau [TDD 16.2].
 */
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect, inject } from 'vitest';
import type { TaiKhoanDb } from './global-setup.js';

// Ngày (date) giữ nguyên chuỗi 'YYYY-MM-DD' — không để driver đổi sang Date theo múi giờ máy [D5]
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export type Db = pg.Client;

export async function ketNoi(tk: TaiKhoanDb): Promise<Db> {
  const c = new pg.Client({ connectionString: inject('urlDb')[tk] });
  await c.connect();
  return c;
}

/**
 * Mở kết nối cho cả file test; mỗi test bọc trong transaction + ROLLBACK.
 * `nguoiThucHien`: giả lập ứng dụng đặt `vsn.nguoi_thuc_hien` đầu transaction ghi [D9]
 * (null = giả lập ghi thẳng vào DB, không qua ứng dụng).
 */
export function dungDb(tk: TaiKhoanDb, tuyChon: { nguoiThucHien?: string | null } = {}): { db: Db } {
  const ketQua = {} as { db: Db };
  const nguoiThucHien = tuyChon.nguoiThucHien === undefined ? 'test' : tuyChon.nguoiThucHien;

  beforeAll(async () => {
    ketQua.db = await ketNoi(tk);
  });
  afterAll(async () => {
    await ketQua.db?.end();
  });
  beforeEach(async () => {
    await ketQua.db.query('BEGIN');
    if (nguoiThucHien) await ketQua.db.query(`SELECT set_config('vsn.nguoi_thuc_hien', $1, true)`, [nguoiThucHien]);
  });
  afterEach(async () => {
    await ketQua.db.query('ROLLBACK');
  });
  return ketQua;
}

let demSavepoint = 0;

/**
 * Chạy câu lệnh mong đợi bị DB từ chối. Bọc trong SAVEPOINT để transaction của test vẫn dùng tiếp được.
 * `kyVong`: SQLSTATE (vd. '23505') hoặc chuỗi/regex khớp message (vd. 'THANG_DA_KHOA').
 */
export async function kyVongLoi(db: Db, sql: string, thamSo: unknown[], kyVong: string | RegExp): Promise<void> {
  const sp = `sp_${++demSavepoint}`;
  await db.query(`SAVEPOINT ${sp}`);
  let loi: (Error & { code?: string }) | undefined;
  try {
    await db.query(sql, thamSo);
  } catch (e) {
    loi = e as Error & { code?: string };
  }
  await db.query(`ROLLBACK TO SAVEPOINT ${sp}`);
  expect(loi, `Mong đợi lỗi ${String(kyVong)} nhưng câu lệnh chạy thành công`).toBeDefined();
  if (typeof kyVong === 'string' && /^[0-9A-Z]{5}$/.test(kyVong)) {
    expect(loi!.code).toBe(kyVong);
  } else {
    expect(loi!.message).toMatch(kyVong);
  }
}

/** Lấy một giá trị đơn */
export async function mot<T = unknown>(db: Db, sql: string, thamSo: unknown[] = []): Promise<T> {
  const { rows } = await db.query(sql, thamSo);
  return Object.values(rows[0] ?? {})[0] as T;
}

/** Mã lỗi SQLSTATE hay gặp */
export const SQLSTATE = {
  TRUNG_UNIQUE: '23505',
  VI_PHAM_CHECK: '23514',
  VI_PHAM_EXCLUDE: '23P01',
  KHONG_CO_QUYEN: '42501',
} as const;
