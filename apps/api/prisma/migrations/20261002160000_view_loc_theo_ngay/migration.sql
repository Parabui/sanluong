-- ════════════════════════════════════════════════════════════════
-- Hiệu năng báo cáo (đo bằng seed:perf + k6, tuần 12) [TDD 13.1]: báo cáo 1 tháng × 15 chuyền > 60 s.
-- Nguyên nhân:
--   ① v_nv_chuyen_ngay JOIN v_nv_ngay → điều kiện KHOẢNG ngày của truy vấn ngoài chỉ đẩy được vào một vế,
--     vế v_nv_ngay phải tính lại TOÀN BỘ 12 tháng.
--   ② Mỗi dòng gọi lồng 3 hàm SQL vô hướng (gio_lam_hieu_luc → gio_mac_dinh_ngay → chuyen_goc_ngay) — PostgreSQL không
--     inline được hàm có FROM/ORDER BY/LIMIT → ~0,6 ms / dòng (1 tháng 13k dòng ≈ 8 s).
-- Sửa (giữ nguyên tên + ý nghĩa cột, công thức không đổi [CLAUDE.md #5]):
--   · Giờ làm hiệu lực / chuyền gốc tính trong view bằng LATERAL (cùng logic với gio_lam_hieu_luc / chuyen_goc_ngay, được
--     lập kế hoạch cùng truy vấn, dùng index UNIQUE). Test DB `[D18] view = hàm` đối chiếu từng dòng với hàm gốc.
--   · v_nv_chuyen_ngay: tổng NV × ngày lấy bằng window PARTITION BY (nhan_vien_id, ngay_lam_viec) thay cho JOIN v_nv_ngay
--     → điều kiện theo ngày / NV (khóa phân hoạch) được đẩy xuống tận bảng san_luong; điều kiện theo chuyền vẫn áp SAU
--     window nên tổng cả ngày của NV làm nhiều chuyền vẫn đúng [D15].
-- Hàm gio_lam_hieu_luc / chuyen_goc_ngay GIỮ NGUYÊN — dùng cho tra cứu 1 NV × 1 ngày (form công nhân, giờ làm).
-- View đổi định nghĩa → DROP + CREATE trong cùng migration [TDD 17.3].
-- ════════════════════════════════════════════════════════════════

DROP VIEW v_nv_chuyen_ngay;
DROP VIEW v_nv_ngay;

CREATE VIEW v_nv_ngay AS
WITH sl AS (
  SELECT s.nhan_vien_id, s.ngay_lam_viec,
         SUM(s.so_luong)                                 AS tong_san_luong,
         SUM(s.so_luong * s.smv_snapshot) / 60.0         AS phut_smv,
         BOOL_OR(s.smv_snapshot IS NULL)                 AS thieu_smv,
         BOOL_OR(k.ma_hang_id IS NULL)                   AS hieu_suat_tam_tinh   -- [D20] còn mã hàng chưa khóa
  FROM san_luong s
  JOIN cong_doan cd ON cd.id = s.cong_doan_id
  LEFT JOIN khoa_thang k ON k.ma_hang_id = cd.ma_hang_id
       AND k.thang = to_char(s.ngay_lam_viec, 'YYYY-MM') AND k.trang_thai = 'KHOA'
  GROUP BY s.nhan_vien_id, s.ngay_lam_viec)
SELECT sl.*,
       g.chuyen_goc_id,
       (c.id IS NULL)                                     AS thieu_chuyen_goc, -- [D18] KHÔNG làm mất dòng
       COALESCE(gl.so_gio, md.so_gio)                     AS gio_lam,          -- = gio_lam_hieu_luc(nv, d)
       gl.nguon                                           AS nguon_gio,        -- NULL = giờ mặc định
       EXISTS (SELECT 1 FROM yeu_cau_gio y WHERE y.nhan_vien_id = sl.nhan_vien_id
               AND y.ngay_lam_viec = sl.ngay_lam_viec AND y.trang_thai = 'CHO') AS gio_cho_duyet,
       CASE WHEN COALESCE(gl.so_gio, md.so_gio) > 0
            THEN sl.phut_smv / (COALESCE(gl.so_gio, md.so_gio) * 60) * 100 END AS hieu_suat
FROM sl
-- = chuyen_goc_ngay(nv, d) [D18]
LEFT JOIN LATERAL (SELECT g0.chuyen_id AS chuyen_goc_id FROM nhan_vien_chuyen_goc g0
                   WHERE g0.nhan_vien_id = sl.nhan_vien_id AND g0.tu_ngay <= sl.ngay_lam_viec
                   ORDER BY g0.tu_ngay DESC LIMIT 1) g ON TRUE
LEFT JOIN chuyen c ON c.id = g.chuyen_goc_id
LEFT JOIN gio_lam gl ON gl.nhan_vien_id = sl.nhan_vien_id AND gl.ngay_lam_viec = sl.ngay_lam_viec
-- = gio_mac_dinh_ngay(nv, d): xưởng của chuyền gốc ngày đó × thứ trong tuần, hiệu lực theo ngày [F6]
LEFT JOIN LATERAL (SELECT gm.so_gio FROM gio_mac_dinh gm
                   WHERE gm.xuong_id = c.xuong_id AND gm.loai_ngay = loai_ngay(sl.ngay_lam_viec)
                     AND gm.ap_dung_tu_ngay <= sl.ngay_lam_viec
                   ORDER BY gm.ap_dung_tu_ngay DESC LIMIT 1) md ON TRUE;

-- Mức NV × chuyền × ngày: chia giờ làm cho từng chuyền theo tỷ lệ phút SMV (thiếu SMV → theo số sản phẩm) [D15]
CREATE VIEW v_nv_chuyen_ngay AS
WITH c AS (
  SELECT nhan_vien_id, ngay_lam_viec, chuyen_tram_snapshot AS chuyen_id,
         SUM(so_luong) AS san_luong_chuyen,
         SUM(so_luong * smv_snapshot) / 60.0 AS phut_smv_chuyen,
         BOOL_OR(smv_snapshot IS NULL) AS thieu_smv_chuyen
  FROM san_luong GROUP BY 1, 2, 3),
w AS (
  SELECT c.*,
         SUM(c.phut_smv_chuyen) OVER ngay_nv      AS phut_smv_ngay,   -- = v_nv_ngay.phut_smv
         SUM(c.san_luong_chuyen) OVER ngay_nv     AS san_luong_ngay,  -- = v_nv_ngay.tong_san_luong
         BOOL_OR(c.thieu_smv_chuyen) OVER ngay_nv AS thieu_smv        -- = v_nv_ngay.thieu_smv
  FROM c WINDOW ngay_nv AS (PARTITION BY c.nhan_vien_id, c.ngay_lam_viec))
SELECT w.nhan_vien_id, w.ngay_lam_viec, w.chuyen_id, w.san_luong_chuyen, w.phut_smv_chuyen,
       h.gio_lam,
       h.gio_lam * 60 * CASE
         WHEN w.phut_smv_ngay > 0 AND NOT w.thieu_smv THEN w.phut_smv_chuyen / w.phut_smv_ngay
         ELSE w.san_luong_chuyen::numeric / NULLIF(w.san_luong_ngay, 0)
       END AS phut_lam_phan_bo,
       w.thieu_smv
FROM w
-- Giờ làm hiệu lực (= gio_lam_hieu_luc(nv, d)) — cùng logic như v_nv_ngay
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (SELECT gl.so_gio FROM gio_lam gl WHERE gl.nhan_vien_id = w.nhan_vien_id AND gl.ngay_lam_viec = w.ngay_lam_viec),
    (SELECT gm.so_gio FROM gio_mac_dinh gm
       JOIN chuyen cg ON cg.xuong_id = gm.xuong_id
      WHERE cg.id = (SELECT g0.chuyen_id FROM nhan_vien_chuyen_goc g0
                      WHERE g0.nhan_vien_id = w.nhan_vien_id AND g0.tu_ngay <= w.ngay_lam_viec
                      ORDER BY g0.tu_ngay DESC LIMIT 1)
        AND gm.loai_ngay = loai_ngay(w.ngay_lam_viec) AND gm.ap_dung_tu_ngay <= w.ngay_lam_viec
      ORDER BY gm.ap_dung_tu_ngay DESC LIMIT 1)) AS gio_lam) h;

-- View chỉ đọc cho vsn_app [D9] (quyền mặc định do init script cấp lại khi tạo view mới)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON v_nv_ngay, v_nv_chuyen_ngay FROM vsn_app;
