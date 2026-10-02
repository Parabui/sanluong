-- ════════════════════════════════════════════════════════════════
-- Giờ làm hiệu lực của NV × ngày thành HÀM dùng chung (N1 — một nguồn sự thật):
--   form công nhân (trần lý thuyết R 3.3) cần giờ làm cả khi NV CHƯA có sản lượng ngày đó,
--   còn view v_nv_ngay chỉ có dòng khi đã có sản lượng → view gọi lại đúng các hàm này.
-- View đổi kiểu cột → DROP + CREATE trong cùng migration [TDD 17.3]; định nghĩa giữ nguyên ngoài phần giờ làm.
-- ════════════════════════════════════════════════════════════════

-- Giờ mặc định theo xưởng của chuyền gốc NV TẠI NGÀY ĐÓ, theo thứ trong tuần, hiệu lực theo ngày [F6] [D18]
CREATE FUNCTION gio_mac_dinh_ngay(nv uuid, d date) RETURNS numeric STABLE LANGUAGE sql AS $$
  SELECT gm.so_gio FROM gio_mac_dinh gm
  JOIN chuyen c ON c.xuong_id = gm.xuong_id AND c.id = chuyen_goc_ngay(nv, d)
  WHERE gm.loai_ngay = loai_ngay(d) AND gm.ap_dung_tu_ngay <= d
  ORDER BY gm.ap_dung_tu_ngay DESC LIMIT 1 $$;

-- Giờ đã duyệt / tổ trưởng sửa nếu có, ngược lại giờ mặc định; NULL = chưa có giờ (CN, lễ, thiếu chuyền gốc)
CREATE FUNCTION gio_lam_hieu_luc(nv uuid, d date) RETURNS numeric STABLE LANGUAGE sql AS $$
  SELECT COALESCE((SELECT so_gio FROM gio_lam WHERE nhan_vien_id = nv AND ngay_lam_viec = d),
                  gio_mac_dinh_ngay(nv, d)) $$;

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
       gio_lam_hieu_luc(sl.nhan_vien_id, sl.ngay_lam_viec) AS gio_lam,
       gl.nguon                                           AS nguon_gio,        -- NULL = giờ mặc định
       EXISTS (SELECT 1 FROM yeu_cau_gio y WHERE y.nhan_vien_id = sl.nhan_vien_id
               AND y.ngay_lam_viec = sl.ngay_lam_viec AND y.trang_thai = 'CHO') AS gio_cho_duyet,
       CASE WHEN gio_lam_hieu_luc(sl.nhan_vien_id, sl.ngay_lam_viec) > 0
            THEN sl.phut_smv / (gio_lam_hieu_luc(sl.nhan_vien_id, sl.ngay_lam_viec) * 60) * 100 END AS hieu_suat
FROM sl
LEFT JOIN LATERAL (SELECT chuyen_goc_ngay(sl.nhan_vien_id, sl.ngay_lam_viec) AS chuyen_goc_id) g ON TRUE
LEFT JOIN chuyen c ON c.id = g.chuyen_goc_id
LEFT JOIN gio_lam gl ON gl.nhan_vien_id = sl.nhan_vien_id AND gl.ngay_lam_viec = sl.ngay_lam_viec;

-- Không đổi so với migration khởi tạo (tạo lại vì phụ thuộc v_nv_ngay) [D15]
CREATE VIEW v_nv_chuyen_ngay AS
WITH c AS (
  SELECT nhan_vien_id, ngay_lam_viec, chuyen_tram_snapshot AS chuyen_id,
         SUM(so_luong) AS san_luong_chuyen,
         SUM(so_luong * smv_snapshot) / 60.0 AS phut_smv_chuyen
  FROM san_luong GROUP BY 1, 2, 3)
SELECT c.*, n.gio_lam,
       n.gio_lam * 60 * CASE
         WHEN n.phut_smv > 0 AND NOT n.thieu_smv THEN c.phut_smv_chuyen / n.phut_smv
         ELSE c.san_luong_chuyen::numeric / NULLIF(n.tong_san_luong, 0)
       END AS phut_lam_phan_bo,
       n.thieu_smv
FROM c JOIN v_nv_ngay n USING (nhan_vien_id, ngay_lam_viec);

-- View chỉ đọc cho vsn_app [D9] (quyền mặc định do init script cấp lại khi tạo view mới)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON v_nv_ngay, v_nv_chuyen_ngay FROM vsn_app;
