/**
 * View công thức — nguồn duy nhất cho F5, F7, F11, F15 [D4] [D10] [TDD 6.6].
 * Chạy bằng chủ schema để dựng được lịch sử chuyền gốc lùi ngày.
 */
import { congNgay, loaiNgay } from '@vsn/shared';
import { describe, expect, it } from 'vitest';
import { dungDb, mot, type Db } from '../ho-tro/db.js';
import {
  datChuyenGoc,
  khoaThang,
  taoChuyen,
  taoCongDoan,
  taoKhung,
  taoMaHang,
  taoSanLuong,
  taoTaiKhoan,
  taoTram,
  taoGioMacDinh,
} from '../ho-tro/factory.js';

const CN = '2026-09-06';
const T2 = '2026-09-07';
const T7 = '2026-09-12';

const ctx = dungDb('vsn_migrate');

/** Khung chuyền + giờ mặc định của xưởng (T2–T6: 9, T7: 8, CN: trống) + chuyền gốc từ đầu năm */
async function khungCoGio(db: Db) {
  const k = await taoKhung(db);
  await taoGioMacDinh(db, k.xuongId, { loaiNgay: 'T2_T6', soGio: 9 });
  await taoGioMacDinh(db, k.xuongId, { loaiNgay: 'T7', soGio: 8 });
  await taoGioMacDinh(db, k.xuongId, { loaiNgay: 'CN', soGio: null });
  await datChuyenGoc(db, k.nhanVienId, '2026-01-01', k.chuyenId);
  return k;
}

async function nvNgay(db: Db, nhanVienId: string, ngay: string) {
  const { rows } = await db.query(`SELECT * FROM v_nv_ngay WHERE nhan_vien_id = $1 AND ngay_lam_viec = $2`, [
    nhanVienId,
    ngay,
  ]);
  return rows[0] as Record<string, string | boolean | null>;
}

describe('loai_ngay()', () => {
  it('[D5] khớp loaiNgay() của @vsn/shared', async () => {
    for (let i = 0; i < 14; i++) {
      const d = congNgay(CN, i);
      expect(await mot(ctx.db, `SELECT loai_ngay($1::date)::text`, [d]), d).toBe(loaiNgay(d));
    }
  });
});

describe('v_san_luong_chi_tiet', () => {
  it('[F5] phút SMV từng dòng = sản lượng × SMV snapshot ÷ 60, kèm mã hàng', async () => {
    const k = await khungCoGio(ctx.db);
    const id = await taoSanLuong(ctx.db, {
      ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 120, smv: 25.5,
    });
    const { rows } = await ctx.db.query(`SELECT phut_smv, ma_hang_id FROM v_san_luong_chi_tiet WHERE id = $1`, [id]);
    expect(Number(rows[0].phut_smv)).toBeCloseTo(51);
    expect(rows[0].ma_hang_id).toBe(k.maHangId);
  });
});

describe('view = hàm gốc (giờ làm hiệu lực, chuyền gốc)', () => {
  it('[D18] giờ làm / chuyền gốc trong v_nv_ngay và v_nv_chuyen_ngay khớp từng dòng với gio_lam_hieu_luc() / chuyen_goc_ngay()', async () => {
    // View tính bằng LATERAL (nhanh, đẩy điều kiện ngày xuống) — phải cho đúng kết quả như hàm dùng ở form / giờ làm
    const k = await khungCoGio(ctx.db);
    const k2 = await khungCoGio(ctx.db);
    await datChuyenGoc(ctx.db, k.nhanVienId, '2026-09-09', k2.chuyenId); // đổi chuyền gốc giữa tuần → đổi xưởng → đổi giờ mặc định
    await taoGioMacDinh(ctx.db, k2.xuongId, { loaiNgay: 'T2_T6', soGio: 7.5, tuNgay: '2026-09-10' });
    const tk = await taoTaiKhoan(ctx.db);
    await ctx.db.query(
      `INSERT INTO gio_lam (nhan_vien_id, ngay_lam_viec, so_gio, nguon, nguoi_thuc_hien_id) VALUES ($1, '2026-09-11', 10.5, 'YEU_CAU_DUYET', $2)`,
      [k.nhanVienId, tk],
    );
    for (let i = 0; i < 8; i++) {
      const ngay = congNgay(CN, i);
      await taoSanLuong(ctx.db, { ngay, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 100 + i });
      await taoSanLuong(ctx.db, { ngay, tramId: k2.tramId, congDoanId: k2.congDoanId, nhanVienId: k.nhanVienId, soLuong: 50 });
    }
    const lech = await ctx.db.query(
      `SELECT 'nv_ngay' AS v, ngay_lam_viec::text FROM v_nv_ngay WHERE nhan_vien_id = $1
         AND (gio_lam IS DISTINCT FROM gio_lam_hieu_luc(nhan_vien_id, ngay_lam_viec) OR chuyen_goc_id IS DISTINCT FROM chuyen_goc_ngay(nhan_vien_id, ngay_lam_viec))
       UNION ALL
       SELECT 'nv_chuyen_ngay', ngay_lam_viec::text FROM v_nv_chuyen_ngay WHERE nhan_vien_id = $1
         AND gio_lam IS DISTINCT FROM gio_lam_hieu_luc(nhan_vien_id, ngay_lam_viec)`,
      [k.nhanVienId],
    );
    expect(lech.rows).toEqual([]);
    const gio = await ctx.db.query(`SELECT ngay_lam_viec::text AS d, gio_lam FROM v_nv_ngay WHERE nhan_vien_id = $1 ORDER BY 1`, [k.nhanVienId]);
    expect(gio.rows.map((r) => [r.d, r.gio_lam == null ? null : Number(r.gio_lam)])).toEqual([
      ['2026-09-06', null], ['2026-09-07', 9], ['2026-09-08', 9], ['2026-09-09', 9], ['2026-09-10', 7.5], ['2026-09-11', 10.5], ['2026-09-12', 8], ['2026-09-13', null],
    ]);
  });
});

describe('v_nv_ngay', () => {
  it('[F5] phút SMV cộng mọi công đoạn; % hiệu suất theo giờ mặc định, giờ đã duyệt thay thế giờ mặc định', async () => {
    const k = await khungCoGio(ctx.db);
    const cd2 = await taoCongDoan(ctx.db, k.maHangId);
    const s = { ngay: T2, tramId: k.tramId, nhanVienId: k.nhanVienId };
    await taoSanLuong(ctx.db, { ...s, congDoanId: k.congDoanId, soLuong: 600, smv: 30 });
    await taoSanLuong(ctx.db, { ...s, congDoanId: cd2, soLuong: 300, smv: 60 });

    let r = await nvNgay(ctx.db, k.nhanVienId, T2);
    expect(Number(r.tong_san_luong)).toBe(900);
    expect(Number(r.phut_smv)).toBeCloseTo(600); // (600×30 + 300×60) / 60
    expect(Number(r.gio_lam)).toBe(9);
    expect(r.nguon_gio).toBeNull();
    expect(Number(r.hieu_suat)).toBeCloseTo(111.11, 2); // 600 / (9 × 60) × 100
    expect(r).toMatchObject({ thieu_smv: false, thieu_chuyen_goc: false, gio_cho_duyet: false, chuyen_goc_id: k.chuyenId });

    await ctx.db.query(
      `INSERT INTO gio_lam (nhan_vien_id, ngay_lam_viec, so_gio, nguon, nguoi_thuc_hien_id) VALUES ($1, $2, 10, 'YEU_CAU_DUYET', $3)`,
      [k.nhanVienId, T2, await taoTaiKhoan(ctx.db)],
    );
    r = await nvNgay(ctx.db, k.nhanVienId, T2);
    expect(Number(r.gio_lam)).toBe(10);
    expect(r.nguon_gio).toBe('YEU_CAU_DUYET');
    expect(Number(r.hieu_suat)).toBeCloseTo(100);
  });

  it('[F5] giờ mặc định theo thứ: T7 = 8 giờ; Chủ nhật không có giờ → % hiệu suất NULL', async () => {
    const k = await khungCoGio(ctx.db);
    const s = { tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 100 };
    await taoSanLuong(ctx.db, { ...s, ngay: T7 });
    await taoSanLuong(ctx.db, { ...s, ngay: CN });
    expect(Number((await nvNgay(ctx.db, k.nhanVienId, T7)).gio_lam)).toBe(8);
    const cn = await nvNgay(ctx.db, k.nhanVienId, CN);
    expect(cn.gio_lam).toBeNull();
    expect(cn.hieu_suat).toBeNull();
  });

  it('[F6] đổi giờ mặc định chỉ áp dụng từ ngày thay đổi trở đi', async () => {
    const k = await khungCoGio(ctx.db);
    await taoGioMacDinh(ctx.db, k.xuongId, { loaiNgay: 'T2_T6', soGio: 8.5, tuNgay: '2026-09-08' });
    const s = { tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 100 };
    await taoSanLuong(ctx.db, { ...s, ngay: T2 });
    await taoSanLuong(ctx.db, { ...s, ngay: '2026-09-08' });
    expect(Number((await nvNgay(ctx.db, k.nhanVienId, T2)).gio_lam)).toBe(9);
    expect(Number((await nvNgay(ctx.db, k.nhanVienId, '2026-09-08')).gio_lam)).toBe(8.5);
  });

  it('[F5] công đoạn chưa có SMV → cờ thieu_smv, phút SMV chỉ cộng phần có SMV', async () => {
    const k = await khungCoGio(ctx.db);
    const cd2 = await taoCongDoan(ctx.db, k.maHangId);
    const s = { ngay: T2, tramId: k.tramId, nhanVienId: k.nhanVienId };
    await taoSanLuong(ctx.db, { ...s, congDoanId: k.congDoanId, soLuong: 120, smv: 30 });
    await taoSanLuong(ctx.db, { ...s, congDoanId: cd2, soLuong: 50, smv: null });
    const r = await nvNgay(ctx.db, k.nhanVienId, T2);
    expect(r.thieu_smv).toBe(true);
    expect(Number(r.phut_smv)).toBeCloseTo(60);
  });

  it('[D20] % hiệu suất "tạm tính" khi ngày còn mã hàng chưa khóa', async () => {
    const k = await khungCoGio(ctx.db);
    const mh2 = await taoMaHang(ctx.db);
    const cdMh2 = await taoCongDoan(ctx.db, mh2);
    const s = { ngay: T2, tramId: k.tramId, nhanVienId: k.nhanVienId, soLuong: 10 };
    await taoSanLuong(ctx.db, { ...s, congDoanId: k.congDoanId });
    await taoSanLuong(ctx.db, { ...s, congDoanId: cdMh2 });

    await khoaThang(ctx.db, k.maHangId, '2026-09');
    expect((await nvNgay(ctx.db, k.nhanVienId, T2)).hieu_suat_tam_tinh).toBe(true);
    await khoaThang(ctx.db, mh2, '2026-09');
    expect((await nvNgay(ctx.db, k.nhanVienId, T2)).hieu_suat_tam_tinh).toBe(false);
  });

  it('[F11] giờ làm chờ duyệt → cờ gio_cho_duyet', async () => {
    const k = await khungCoGio(ctx.db);
    await taoSanLuong(ctx.db, { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10 });
    await ctx.db.query(`INSERT INTO yeu_cau_gio (nhan_vien_id, ngay_lam_viec, so_gio) VALUES ($1, $2, 10)`, [k.nhanVienId, T2]);
    const r = await nvNgay(ctx.db, k.nhanVienId, T2);
    expect(r.gio_cho_duyet).toBe(true);
    expect(Number(r.gio_lam)).toBe(9); // chưa duyệt → vẫn dùng giờ mặc định
  });

  it('[D18] NV không có chuyền gốc tại ngày đó vẫn có trong view (thieu_chuyen_goc), không mất dòng', async () => {
    const k = await khungCoGio(ctx.db);
    await ctx.db.query(`DELETE FROM nhan_vien_chuyen_goc WHERE nhan_vien_id = $1`, [k.nhanVienId]);
    await taoSanLuong(ctx.db, { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10 });
    const r = await nvNgay(ctx.db, k.nhanVienId, T2);
    expect(r).toMatchObject({ thieu_chuyen_goc: true, chuyen_goc_id: null, gio_lam: null, hieu_suat: null });
    expect(Number(r.tong_san_luong)).toBe(10);
  });

  it('[D18] giờ mặc định lấy theo xưởng của chuyền gốc TẠI NGÀY ĐÓ, không theo chuyền hiện tại', async () => {
    const k = await khungCoGio(ctx.db);
    const xuong2 = (await ctx.db.query<{ id: string }>(`INSERT INTO xuong (ma, ten) VALUES ('X2-GIO', 'X2') RETURNING id`)).rows[0]!.id;
    const chuyenX2 = await taoChuyen(ctx.db, { xuongId: xuong2 });
    await taoGioMacDinh(ctx.db, xuong2, { loaiNgay: 'T2_T6', soGio: 7 });
    await ctx.db.query(`UPDATE nhan_vien SET chuyen_id = $2 WHERE id = $1`, [k.nhanVienId, chuyenX2]); // đổi hôm nay

    await taoSanLuong(ctx.db, { ngay: T2, tramId: k.tramId, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, soLuong: 10 });
    const r = await nvNgay(ctx.db, k.nhanVienId, T2); // T2 trước ngày đổi → vẫn chuyền gốc cũ
    expect(r.chuyen_goc_id).toBe(k.chuyenId);
    expect(Number(r.gio_lam)).toBe(9);
  });
});

describe('v_nv_chuyen_ngay', () => {
  async function haiChuyen(db: Db) {
    const k = await khungCoGio(db);
    const chuyenB = await taoChuyen(db, { xuongId: k.xuongId });
    const tramB = await taoTram(db, chuyenB, 30);
    return { ...k, chuyenB, tramB };
  }

  async function phanBo(db: Db, nhanVienId: string) {
    const { rows } = await db.query<{ chuyen_id: string; phut_lam_phan_bo: string; phut_smv_chuyen: string | null }>(
      `SELECT chuyen_id, phut_lam_phan_bo, phut_smv_chuyen FROM v_nv_chuyen_ngay
       WHERE nhan_vien_id = $1 AND ngay_lam_viec = $2`,
      [nhanVienId, T2],
    );
    return Object.fromEntries(rows.map((r) => [r.chuyen_id, Number(r.phut_lam_phan_bo)]));
  }

  it('[D15] NV làm 2 chuyền: giờ làm chia theo tỷ lệ phút SMV; tổng các chuyền = giờ làm thật', async () => {
    const k = await haiChuyen(ctx.db);
    const s = { ngay: T2, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId, smv: 30 };
    await taoSanLuong(ctx.db, { ...s, tramId: k.tramId, soLuong: 800 }); // 400 phút SMV
    await taoSanLuong(ctx.db, { ...s, tramId: k.tramB, soLuong: 400 }); // 200 phút SMV

    const pb = await phanBo(ctx.db, k.nhanVienId);
    expect(pb[k.chuyenId]).toBeCloseTo(360); // 540 × 400/600
    expect(pb[k.chuyenB]).toBeCloseTo(180);
    expect(pb[k.chuyenId]! + pb[k.chuyenB]!).toBeCloseTo(9 * 60);
  });

  it('[D15] thiếu SMV → chia giờ làm theo tỷ lệ số sản phẩm', async () => {
    const k = await haiChuyen(ctx.db);
    const s = { ngay: T2, congDoanId: k.congDoanId, nhanVienId: k.nhanVienId };
    await taoSanLuong(ctx.db, { ...s, tramId: k.tramId, soLuong: 100, smv: null });
    await taoSanLuong(ctx.db, { ...s, tramId: k.tramB, soLuong: 300, smv: 30 });

    const pb = await phanBo(ctx.db, k.nhanVienId);
    expect(pb[k.chuyenId]).toBeCloseTo(135); // 540 × 100/400
    expect(pb[k.chuyenB]).toBeCloseTo(405);
  });
});
