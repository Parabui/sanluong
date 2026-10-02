/**
 * Công thức dùng ở phía ứng dụng. Công thức báo cáo (phút SMV, giờ làm hiệu lực, % hiệu suất)
 * KHÔNG nằm ở đây — chỉ lấy từ view SQL v_san_luong_chi_tiet / v_nv_ngay / v_nv_chuyen_ngay [D4].
 */

/** Số lượng hợp lệ của một ô sản lượng (khớp CHECK ck_so_luong) */
export const SO_LUONG_TOI_DA = 99_999;

/** Hệ số trần lý thuyết [R 3.3] */
export const HE_SO_TRAN = 1.5;

/**
 * Trần lý thuyết cho một công đoạn: gioLam × 3600 ÷ SMV × 1,5 [R 3.3].
 * SMV tính bằng giây / sản phẩm. Thiếu SMV hoặc giờ làm → null (không cảnh báo).
 */
export function tranLyThuyet(gioLam: number | null, smvGiay: number | null): number | null {
  if (!gioLam || !smvGiay || gioLam <= 0 || smvGiay <= 0) return null;
  return Math.floor(((gioLam * 3600) / smvGiay) * HE_SO_TRAN);
}
