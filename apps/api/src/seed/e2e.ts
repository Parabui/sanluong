/**
 * `node tools/thu/chay.mjs e2e` — dữ liệu cho Playwright E2E [TDD 16.1, 16.3] trên DB THỬ (5435, tmpfs).
 * 4 bộ dữ liệu độc lập (k = 1..4) — mỗi project Playwright (iPhone/WebKit, Android/Chromium, Web Chromium, Web WebKit) dùng 1 bộ
 * để chạy song song không giẫm nhau. Mỗi bộ:
 *   chuyền EC<k> (3 trạm app: CD-1 / CD-2 / CD-3 của mã hàng EMH<k>) · NV EN<k>01..03 · tổ trưởng e2e.tt<k> · IT/HR e2e.hr<k>
 *   · hôm qua (ngày làm việc liền trước): EN<k>02 có 120 sp ở trạm 2, trạm 1 + trạm 3 chưa có số (để nhập hộ) — chưa chốt
 *   · hôm nay: EN<k>03 đang đăng nhập trạm 3 (thiết bị e2e-tb-<k>), chưa có số → tổ trưởng đăng xuất hộ
 *   · mã hàng EMH<k>B: sản lượng tháng 06/2025 đã chốt → IT/HR khóa sổ được
 * Mật khẩu tài khoản thử: E2E_MAT_KHAU (mặc định "E2eThu12345") — CHỈ dùng cho DB thử trên máy.
 * Ghi thẳng SQL (công cụ dựng dữ liệu, không phải luồng nghiệp vụ); trigger DB vẫn kiểm.
 */
import { hash } from 'bcryptjs';
import { ngayLamViecLienTruoc, homNay } from '@vsn/shared';
import pg from 'pg';

export const E2E_MAT_KHAU = process.env['E2E_MAT_KHAU'] ?? 'E2eThu12345';
const url = process.env['E2E_MIGRATE_URL'] ?? 'postgresql://vsn_migrate:thu-migrate@127.0.0.1:5435/vsn_sanluong';

const hn = homNay(new Date());
const homQua = ngayLamViecLienTruoc(hn);
const tu = '2025-01-01';

const client = new pg.Client({ connectionString: url });
await client.connect();
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await client.query(sql, p)).rows as T[];
const id = async (sql: string, p: unknown[] = []) => (await q<{ id: string }>(`${sql} RETURNING id`, p))[0]!.id;

try {
  if ((await q<{ n: number }>(`SELECT count(*)::int AS n FROM chuyen`))[0]!.n > 0) {
    console.error('DB E2E đã có dữ liệu — tạo lại container: docker compose -f infra/compose.thu.yml rm -sf postgres-e2e');
    process.exit(1);
  }
  await q('BEGIN');
  await q(`SELECT set_config('vsn.nguoi_thuc_hien', 'seed-e2e', true)`);
  const mk = await hash(E2E_MAT_KHAU, 10);
  // Chốt được ngay ngày hôm qua dù chạy E2E lúc nào [R 5.9]
  await q(`INSERT INTO cau_hinh (khoa, gia_tri) VALUES ('gioMoChotNgay', '"00:00"') ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`);
  const ie = await id(`INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, mat_khau_hash, vai_tro, phai_doi_mat_khau) VALUES ('e2e.ie', 'IE E2E', $1, 'IE', false)`, [mk]);

  for (let k = 1; k <= 4; k++) {
    const x = await id(`INSERT INTO xuong (ma, ten) VALUES ($1, $2)`, [`EX${k}`, `Xưởng E2E ${k}`]);
    for (const [l, g] of [['T2_T6', 9], ['T7', 8], ['CN', null]] as const) {
      await q(`INSERT INTO gio_mac_dinh (xuong_id, loai_ngay, so_gio, ap_dung_tu_ngay) VALUES ($1, $2, $3, $4)`, [x, l, g, tu]);
    }
    const c = await id(`INSERT INTO chuyen (ma, ten, loai, xuong_id) VALUES ($1, $2, 'CHUYEN_MAY', $3)`, [`EC${k}`, `Chuyền E2E ${k}`, x]);
    const tram: string[] = [];
    for (let t = 1; t <= 3; t++) tram.push(await id(`INSERT INTO tram (chuyen_id, so_tram, nhap_qua_app) VALUES ($1, $2, true)`, [c, t]));

    const taoMh = async (ma: string) => {
      const mh = await id(`INSERT INTO ma_hang (ma, ten, so_luong_don_hang) VALUES ($1, $2, 5000)`, [ma, `Áo E2E ${ma}`]);
      const cd: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const cdi = await id(`INSERT INTO cong_doan (ma_hang_id, ma, ten, la_cong_doan_hoan_thanh) VALUES ($1, $2, $3, $4)`, [mh, `CD-${i}`, ['May cổ', 'Tra tay', 'Kiểm thành phẩm'][i - 1], i === 3]);
        await q(`INSERT INTO smv_lich_su (cong_doan_id, smv, ap_dung_tu_ngay, nguoi_tao_id) VALUES ($1, $2, '2000-01-01', $3)`, [cdi, 30 + i * 10, ie]);
        cd.push(cdi);
      }
      return { mh, cd };
    };
    const a = await taoMh(`EMH${k}`);
    const b = await taoMh(`EMH${k}B`);
    await q(`INSERT INTO chuyen_ma_hang (chuyen_id, ma_hang_id, bat_dau) VALUES ($1, $2, $3::date)`, [c, a.mh, tu]);
    for (let t = 0; t < 3; t++) {
      await q(`INSERT INTO gan_cong_doan (tram_id, cong_doan_id, hieu_luc_tu) VALUES ($1, $2, ($3::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`, [tram[t], a.cd[t], tu]);
    }

    const nv: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const n = await id(`INSERT INTO nhan_vien (ma_nv, ho_ten, chuyen_id) VALUES ($1, $2, $3)`, [`EN${k}0${i}`, ['Nguyễn Thị Lan', 'Trần Văn Hùng', 'Lê Thị Hoa'][i - 1], c]);
      await q(`INSERT INTO nhan_vien_chuyen_goc (nhan_vien_id, tu_ngay, chuyen_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [n, tu, c]);
      nv.push(n);
    }
    const tt = await id(
      `INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, mat_khau_hash, vai_tro, phai_doi_mat_khau) VALUES ($1, $2, $3, 'TO_TRUONG', false)`,
      [`e2e.tt${k}`, `Tổ trưởng E2E ${k}`, mk],
    );
    await q(`INSERT INTO tai_khoan_chuyen (tai_khoan_id, chuyen_id) VALUES ($1, $2)`, [tt, c]);
    await q(`INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, mat_khau_hash, vai_tro, phai_doi_mat_khau) VALUES ($1, $2, $3, 'IT_HR', false)`, [`e2e.hr${k}`, `IT/HR E2E ${k}`, mk]);

    // Hôm qua: EN<k>02 có 120 sp ở trạm 2 (App) — trạm 1, 3 chưa có số
    const sl = await id(
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, smv_snapshot, chuyen_tram_snapshot, nguon)
       VALUES ($1, $2, $3, $4, 120, 50, $5, 'APP')`,
      [homQua, tram[1], a.cd[1], nv[1], c],
    );
    await q(`INSERT INTO san_luong_lich_su (san_luong_id, so_moi, nguon, loai_nguoi_thuc_hien, nguoi_thuc_hien_id) VALUES ($1, 120, 'APP', 'NHAN_VIEN', $2)`, [sl, nv[1]]);

    // Hôm nay: EN<k>03 đang giữ trạm 3, chưa nhập số
    const tb = await id(`INSERT INTO thiet_bi (token_hash, user_agent) VALUES (encode(sha256(convert_to($1, 'UTF8')), 'hex'), 'e2e')`, [`e2e-tb-${k}`]);
    await q(`INSERT INTO phien_tram (tram_id, nhan_vien_id, ngay_lam_viec, thiet_bi_id) VALUES ($1, $2, $3, $4)`, [tram[2], nv[2], hn, tb]);

    // Mã hàng B: tháng 06/2025 có sản lượng, đã chốt → khóa được
    const slb = await id(
      `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, smv_snapshot, chuyen_tram_snapshot, nguon)
       VALUES ('2025-06-10', $1, $2, $3, 300, 60, $4, 'APP')`,
      [tram[2], b.cd[2], nv[0], c],
    );
    await q(`INSERT INTO san_luong_lich_su (san_luong_id, so_moi, nguon, loai_nguoi_thuc_hien, nguoi_thuc_hien_id) VALUES ($1, 300, 'APP', 'NHAN_VIEN', $2)`, [slb, nv[0]]);
    await q(`INSERT INTO chot_ngay (chuyen_id, ngay_lam_viec, chot_boi_id) VALUES ($1, '2025-06-10', $2)`, [c, tt]);
  }
  await q('COMMIT');
  console.log(`seed E2E xong: hôm nay ${hn}, hôm qua ${homQua}, 4 bộ dữ liệu.`);
} catch (e) {
  await q('ROLLBACK').catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
