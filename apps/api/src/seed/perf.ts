/**
 * `pnpm seed:perf` — sinh dữ liệu đo hiệu năng [TDD 13.3]: 12 tháng × 15 chuyền × 35 trạm app × 525 NV, phân bố thực tế:
 * hỗ trợ chuyền (~3% NV × ngày), ô tổ trưởng điều chỉnh (~1%), đổi SMV giữa tháng, giờ làm đã duyệt, các tháng cũ đã chốt + khóa.
 * Hôm nay: 525 phiên trạm sẵn với token thiết bị cố định `perf-tb-<i>` (k6 "tan ca" dùng) và 1 phiên Web Superadmin `perf-sid-sa`.
 *
 * ⚠ Ghi thẳng bằng SQL (không qua GhiSanLuongService) — đây là công cụ sinh dữ liệu đo, KHÔNG phải luồng nghiệp vụ;
 *   trigger DB vẫn chạy (snapshot chuyền, khóa tháng, chốt ngày). Chỉ chạy trên DB THỬ: từ chối nếu DB đã có dữ liệu khác.
 * Kết nối: PERF_MIGRATE_URL (tài khoản vsn_migrate — cần quyền ghi lịch sử chuyền gốc lùi ngày).
 */
import { homNay } from '@vsn/shared';
import pg from 'pg';

const url = process.env['PERF_MIGRATE_URL'] ?? 'postgresql://vsn_migrate:thu-migrate@127.0.0.1:5434/vsn_sanluong';
const thamSo = {
  homNay: process.env['PERF_HOM_NAY'] ?? homNay(new Date()),
  soChuyen: Number(process.env['PERF_SO_CHUYEN'] ?? 15),
  tram: Number(process.env['PERF_TRAM_MOI_CHUYEN'] ?? 35),
  soThang: Number(process.env['PERF_SO_THANG'] ?? 12),
  soMaHang: 20,
};

const SQL = /* sql */ `
DO $$
DECLARE
  hn  date := current_setting('perf.hom_nay')::date;
  bd  date := (current_setting('perf.hom_nay')::date - make_interval(months => current_setting('perf.so_thang')::int))::date;
  sc  int  := current_setting('perf.so_chuyen')::int;
  st  int  := current_setting('perf.tram')::int;
  smh int  := current_setting('perf.so_ma_hang')::int;
  sa  uuid;
  thang_dau date;
BEGIN
  thang_dau := date_trunc('month', bd)::date;

  INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, mat_khau_hash, vai_tro, phai_doi_mat_khau)
  VALUES ('perf.sa', 'Superadmin perf', '!khong-dang-nhap-bang-mat-khau', 'SUPERADMIN', false) RETURNING id INTO sa;

  -- 3 xưởng × 5 chuyền; giờ mặc định 9 / 8 / trống
  INSERT INTO xuong (ma, ten) SELECT 'PX' || x, 'Xưởng perf ' || x FROM generate_series(1, (sc + 4) / 5) x;
  INSERT INTO gio_mac_dinh (xuong_id, loai_ngay, so_gio, ap_dung_tu_ngay)
  SELECT x.id, l::loai_ngay, CASE l WHEN 'T2_T6' THEN 9 WHEN 'T7' THEN 8 END, DATE '2000-01-01'
  FROM xuong x CROSS JOIN unnest(ARRAY['T2_T6', 'T7', 'CN']) l WHERE x.ma LIKE 'PX%';
  INSERT INTO chuyen (ma, ten, loai, xuong_id)
  SELECT 'PC' || lpad(c::text, 2, '0'), 'Chuyền perf ' || c, 'CHUYEN_MAY', (SELECT id FROM xuong WHERE ma = 'PX' || ((c - 1) / 5 + 1))
  FROM generate_series(1, sc) c;
  INSERT INTO tram (chuyen_id, so_tram, nhap_qua_app)
  SELECT ch.id, t, true FROM chuyen ch CROSS JOIN generate_series(1, st) t WHERE ch.ma LIKE 'PC%';

  -- Mã hàng: mỗi mã st công đoạn (CD-01 = công đoạn hoàn thành), SMV 20–60 giây
  INSERT INTO ma_hang (ma, ten, so_luong_don_hang)
  SELECT 'PMH' || lpad(m::text, 2, '0'), 'Mã hàng perf ' || m, 400000 FROM generate_series(1, smh) m;
  INSERT INTO cong_doan (ma_hang_id, ma, ten, la_cong_doan_hoan_thanh)
  SELECT mh.id, 'CD-' || lpad(k::text, 2, '0'), 'Công đoạn ' || k, k = 1 FROM ma_hang mh CROSS JOIN generate_series(1, st) k WHERE mh.ma LIKE 'PMH%';
  INSERT INTO smv_lich_su (cong_doan_id, smv, ap_dung_tu_ngay, nguoi_tao_id)
  SELECT cd.id, 20 + abs(hashtext(cd.id::text)) % 41, DATE '2000-01-01', sa
  FROM cong_doan cd JOIN ma_hang mh ON mh.id = cd.ma_hang_id WHERE mh.ma LIKE 'PMH%';
  -- Đổi SMV giữa tháng (CD-05 của mọi mã hàng, từ ngày 15 của tháng cách đây 3 tháng)
  INSERT INTO smv_lich_su (cong_doan_id, smv, ap_dung_tu_ngay, nguoi_tao_id)
  SELECT cd.id, 25 + abs(hashtext(cd.id::text)) % 41, (date_trunc('month', hn - interval '3 months') + interval '14 days')::date, sa
  FROM cong_doan cd JOIN ma_hang mh ON mh.id = cd.ma_hang_id WHERE mh.ma LIKE 'PMH%' AND cd.ma = 'CD-05';

  -- Mỗi chuyền chạy 1 mã hàng / tháng, xoay vòng: tháng m → mã ((c + m) % smh) + 1
  CREATE TEMP TABLE p_thang ON COMMIT DROP AS
  SELECT m, (thang_dau + make_interval(months => m))::date AS tu, (thang_dau + make_interval(months => m + 1))::date AS den
  FROM generate_series(0, (EXTRACT(YEAR FROM age(date_trunc('month', hn), thang_dau)) * 12 + EXTRACT(MONTH FROM age(date_trunc('month', hn), thang_dau)))::int) m;
  CREATE TEMP TABLE p_chuyen_mh ON COMMIT DROP AS
  SELECT ch.id AS chuyen_id, substr(ch.ma, 3)::int AS c, t.m, t.tu, t.den,
         (SELECT id FROM ma_hang WHERE ma = 'PMH' || lpad(((substr(ch.ma, 3)::int + t.m) % smh + 1)::text, 2, '0')) AS ma_hang_id
  FROM chuyen ch CROSS JOIN p_thang t WHERE ch.ma LIKE 'PC%';
  INSERT INTO chuyen_ma_hang (chuyen_id, ma_hang_id, bat_dau, ket_thuc)
  SELECT chuyen_id, ma_hang_id, (tu::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
         CASE WHEN den > hn THEN NULL ELSE (den::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') END
  FROM p_chuyen_mh ORDER BY m;
  INSERT INTO gan_cong_doan (tram_id, cong_doan_id, hieu_luc_tu, hieu_luc_den)
  SELECT tr.id, cd.id, (p.tu::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
         CASE WHEN p.den > hn THEN NULL ELSE (p.den::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') END
  FROM p_chuyen_mh p JOIN tram tr ON tr.chuyen_id = p.chuyen_id
  JOIN cong_doan cd ON cd.ma_hang_id = p.ma_hang_id AND cd.ma = 'CD-' || lpad(tr.so_tram::text, 2, '0');

  -- NV: st người / chuyền; chuyền gốc từ ngày đầu kỳ (trigger đã thêm dòng "hôm nay", thêm dòng lùi ngày)
  INSERT INTO nhan_vien (ma_nv, ho_ten, chuyen_id)
  SELECT 'PNV' || lpad(i::text, 4, '0'), 'Công nhân perf ' || i, (SELECT id FROM chuyen WHERE ma = 'PC' || lpad(((i - 1) / st + 1)::text, 2, '0'))
  FROM generate_series(1, sc * st) i;
  INSERT INTO nhan_vien_chuyen_goc (nhan_vien_id, tu_ngay, chuyen_id)
  SELECT id, bd, chuyen_id FROM nhan_vien WHERE ma_nv LIKE 'PNV%' ON CONFLICT DO NOTHING;

  -- Sản lượng: mọi ngày Thứ 2–Thứ 7 từ đầu kỳ đến hôm qua; vắng ~4%, hỗ trợ chuyền kế bên ~3%, điều chỉnh ~1%
  CREATE TEMP TABLE p_nv ON COMMIT DROP AS
  SELECT nv.id, substr(nv.ma_nv, 4)::int AS i, ((substr(nv.ma_nv, 4)::int - 1) / st + 1) AS c, ((substr(nv.ma_nv, 4)::int - 1) % st + 1) AS k
  FROM nhan_vien nv WHERE nv.ma_nv LIKE 'PNV%';
  CREATE TEMP TABLE p_ngay ON COMMIT DROP AS
  SELECT d::date AS d FROM generate_series(bd, hn - 1, interval '1 day') d WHERE EXTRACT(ISODOW FROM d) < 7;
  CREATE TEMP TABLE p_sl ON COMMIT DROP AS
  SELECT nv.id AS nhan_vien_id, n.d, nv.i,
         CASE WHEN abs(hashtext(nv.i || '-h-' || n.d)) % 100 < 3 THEN nv.c % sc + 1 ELSE nv.c END AS c_lam, nv.k,
         abs(hashtext(nv.i || '-q-' || n.d)) % 100 AS r
  FROM p_nv nv CROSS JOIN p_ngay n
  WHERE abs(hashtext(nv.i || '-v-' || n.d)) % 100 >= 4;

  INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, smv_snapshot, chuyen_tram_snapshot,
                         nguon, da_dieu_chinh, cap_nhat_boi_tai_khoan_id, cap_nhat_luc_server, created_at, updated_at)
  SELECT s.d, tr.id, cd.id, s.nhan_vien_id,
         LEAST(99999, round((CASE WHEN EXTRACT(ISODOW FROM s.d) = 6 THEN 8 ELSE 9 END) * 3600.0 / smv.smv * (0.6 + s.r / 200.0)))::int,
         smv.smv, ch.id,
         CASE WHEN s.r = 99 THEN 'SUA_WEB'::nguon_san_luong ELSE 'APP'::nguon_san_luong END,
         s.r = 99, CASE WHEN s.r = 99 THEN sa END,
         (s.d + time '17:30') AT TIME ZONE 'Asia/Ho_Chi_Minh', (s.d + time '17:30') AT TIME ZONE 'Asia/Ho_Chi_Minh', (s.d + time '17:30') AT TIME ZONE 'Asia/Ho_Chi_Minh'
  FROM p_sl s
  JOIN chuyen ch ON ch.ma = 'PC' || lpad(s.c_lam::text, 2, '0')
  JOIN tram tr ON tr.chuyen_id = ch.id AND tr.so_tram = s.k
  JOIN p_chuyen_mh p ON p.chuyen_id = ch.id AND s.d >= p.tu AND s.d < p.den
  JOIN cong_doan cd ON cd.ma_hang_id = p.ma_hang_id AND cd.ma = 'CD-' || lpad(s.k::text, 2, '0')
  CROSS JOIN LATERAL (SELECT h.smv FROM smv_lich_su h WHERE h.cong_doan_id = cd.id AND h.ap_dung_tu_ngay <= s.d ORDER BY h.ap_dung_tu_ngay DESC LIMIT 1) smv;

  -- Lịch sử: 1 dòng nhập từ app; ô điều chỉnh có thêm dòng Sửa Web (số app + 10 → số đúng)
  INSERT INTO san_luong_lich_su (san_luong_id, so_cu, so_moi, nguon, loai_nguoi_thuc_hien, nguoi_thuc_hien_id, luc_server)
  SELECT s.id, NULL, CASE WHEN s.da_dieu_chinh THEN LEAST(99999, s.so_luong + 10) ELSE s.so_luong END, 'APP', 'NHAN_VIEN', s.nhan_vien_id, s.cap_nhat_luc_server
  FROM san_luong s JOIN chuyen ch ON ch.id = s.chuyen_tram_snapshot WHERE ch.ma LIKE 'PC%';
  INSERT INTO san_luong_lich_su (san_luong_id, so_cu, so_moi, nguon, loai_nguoi_thuc_hien, nguoi_thuc_hien_id, luc_server, ly_do)
  SELECT s.id, LEAST(99999, s.so_luong + 10), s.so_luong, 'SUA_WEB', 'TAI_KHOAN', sa, s.cap_nhat_luc_server + interval '15 hours', 'Đếm lại bó hàng'
  FROM san_luong s JOIN chuyen ch ON ch.id = s.chuyen_tram_snapshot WHERE ch.ma LIKE 'PC%' AND s.da_dieu_chinh;

  -- Giờ làm đã duyệt (~2% NV × ngày có sản lượng): tăng ca 10 giờ
  INSERT INTO gio_lam (nhan_vien_id, ngay_lam_viec, so_gio, nguon, nguoi_thuc_hien_id)
  SELECT DISTINCT s.nhan_vien_id, s.ngay_lam_viec, 10, 'YEU_CAU_DUYET'::nguon_gio, sa
  FROM san_luong s JOIN chuyen ch ON ch.id = s.chuyen_tram_snapshot
  WHERE ch.ma LIKE 'PC%' AND abs(hashtext(s.nhan_vien_id::text || s.ngay_lam_viec)) % 100 < 2;

  -- Chốt mọi ngày trước 3 ngày gần nhất; khóa mọi mã hàng × tháng của các tháng trước tháng trước nữa
  INSERT INTO chot_ngay (chuyen_id, ngay_lam_viec, chot_boi_id, chot_luc)
  SELECT ch.id, n.d, sa, (n.d + 1 + time '08:10') AT TIME ZONE 'Asia/Ho_Chi_Minh'
  FROM chuyen ch CROSS JOIN p_ngay n WHERE ch.ma LIKE 'PC%' AND n.d < hn - 3;
  INSERT INTO khoa_thang (ma_hang_id, thang, trang_thai, nguoi_thuc_hien_id)
  SELECT DISTINCT cd.ma_hang_id, to_char(s.ngay_lam_viec, 'YYYY-MM'), 'KHOA'::trang_thai_khoa, sa
  FROM san_luong s JOIN cong_doan cd ON cd.id = s.cong_doan_id JOIN chuyen ch ON ch.id = s.chuyen_tram_snapshot
  WHERE ch.ma LIKE 'PC%' AND s.ngay_lam_viec < date_trunc('month', hn - interval '1 month')::date;

  -- Hôm nay: thiết bị + phiên trạm của từng NV tại trạm của mình (k6 dùng cookie vsn_tb = perf-tb-<i>)
  INSERT INTO thiet_bi (token_hash, user_agent)
  SELECT encode(sha256(convert_to('perf-tb-' || i, 'UTF8')), 'hex'), 'k6 perf' FROM p_nv;
  INSERT INTO phien_tram (tram_id, nhan_vien_id, ngay_lam_viec, thiet_bi_id, dang_nhap_luc)
  SELECT tr.id, nv.id, hn, tb.id, (hn + time '06:55') AT TIME ZONE 'Asia/Ho_Chi_Minh'
  FROM p_nv nv
  JOIN chuyen ch ON ch.ma = 'PC' || lpad(nv.c::text, 2, '0')
  JOIN tram tr ON tr.chuyen_id = ch.id AND tr.so_tram = nv.k
  JOIN thiet_bi tb ON tb.token_hash = encode(sha256(convert_to('perf-tb-' || nv.i, 'UTF8')), 'hex');
  -- Một ít yêu cầu giờ đang chờ (hôm qua)
  INSERT INTO yeu_cau_gio (nhan_vien_id, ngay_lam_viec, so_gio)
  SELECT id, (SELECT max(d) FROM p_ngay), 10.5 FROM p_nv WHERE i % 50 = 0;

  -- Phiên Web Superadmin cho đo API báo cáo (cookie vsn_sid = perf-sid-sa)
  INSERT INTO phien_dang_nhap (token_hash, tai_khoan_id, loai)
  VALUES (encode(sha256(convert_to('perf-sid-sa', 'UTF8')), 'hex'), sa, 'WEB');
END $$;
`;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const [{ n }] = (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM chuyen`)).rows as [{ n: number }];
  if (n > 0) {
    console.error(`DB đã có ${n} chuyền — seed:perf chỉ chạy trên DB THỬ còn trống (pnpm thu:db:down && pnpm thu:db:up).`);
    process.exit(1);
  }
  console.log('seed:perf', thamSo);
  const batDau = performance.now();
  await client.query('BEGIN');
  // Lưới an toàn audit [D9]: đánh dấu là công cụ seed để không sinh 300k dòng DB_TRUC_TIEP
  await client.query(`SELECT set_config('vsn.nguoi_thuc_hien', 'seed-perf', true)`);
  for (const [k, v] of Object.entries({ hom_nay: thamSo.homNay, so_chuyen: thamSo.soChuyen, tram: thamSo.tram, so_thang: thamSo.soThang, so_ma_hang: thamSo.soMaHang })) {
    await client.query(`SELECT set_config($1, $2, true)`, [`perf.${k}`, String(v)]);
  }
  await client.query(SQL);
  await client.query('COMMIT');
  await client.query('ANALYZE');
  const dem = await client.query<{ bang: string; n: number }>(`
    SELECT 'san_luong' AS bang, count(*)::int AS n FROM san_luong UNION ALL SELECT 'san_luong_lich_su', count(*)::int FROM san_luong_lich_su
    UNION ALL SELECT 'nhan_vien', count(*)::int FROM nhan_vien UNION ALL SELECT 'tram', count(*)::int FROM tram
    UNION ALL SELECT 'chot_ngay', count(*)::int FROM chot_ngay UNION ALL SELECT 'khoa_thang', count(*)::int FROM khoa_thang
    UNION ALL SELECT 'phien_tram (hôm nay)', count(*)::int FROM phien_tram WHERE ngay_lam_viec = $1::date`, [thamSo.homNay]);
  console.table(dem.rows);
  console.log(`Xong trong ${((performance.now() - batDau) / 1000).toFixed(1)} giây.`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw e;
} finally {
  await client.end();
}
