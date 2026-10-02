/**
 * Phân quyền lớp 2 — Phạm vi dữ liệu [D8] [TDD 10.2].
 * Mọi hàm repository / báo cáo nhận PhamVi làm tham số BẮT BUỘC (không có giá trị mặc định).
 */
export type PhamVi =
  | { loai: 'TOAN_NHA_MAY' }
  | { loai: 'CHUYEN'; chuyenIds: string[] } // Tổ trưởng: TaiKhoanChuyen
  | { loai: 'XUONG'; xuongIds: string[] }; // QL xưởng: TaiKhoanXuong → quy ra chuyenIds khi truy vấn
