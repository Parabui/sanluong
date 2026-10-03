/**
 * Phân quyền lớp 1 — Chức năng [D8] [TDD 10.1], ánh xạ 1-1 với ma trận F8 (PRD).
 */
export const CHUC_NANG = [
  'TAI_KHOAN_QUAN_LY',
  'DANH_MUC_XUONG_CHUYEN',
  'NHAN_VIEN_QUAN_LY',
  'MA_HANG_QUAN_LY',
  'SO_DO_GAN',
  'GIO_MAC_DINH_CAI',
  'GIO_LAM_DUYET',
  'SAN_LUONG_SUA',
  'CHOT_NGAY',
  'KHOA_THANG',
  'BAO_CAO_XEM',
  'DASHBOARD_XEM',
  'KE_HOACH_QUAN_LY',
  'XUAT_LUONG',
  'CAU_HINH',
  'AUDIT_XEM',
  'SO_DO_TRAM_XEM',
] as const;
export type ChucNang = (typeof CHUC_NANG)[number];

export const VAI_TRO = [
  'SUPERADMIN',
  'QUAN_LY_XUONG',
  'TO_TRUONG',
  'IE',
  'IT_HR',
  'KE_HOACH',
  'BAN_GIAM_DOC',
  'TV',
] as const;
export type VaiTro = (typeof VAI_TRO)[number];

export const TEN_VAI_TRO: Record<VaiTro, string> = {
  SUPERADMIN: 'Superadmin',
  QUAN_LY_XUONG: 'Quản lý xưởng',
  TO_TRUONG: 'Tổ trưởng',
  IE: 'Kỹ thuật / IE',
  IT_HR: 'IT / HR',
  KE_HOACH: 'Kế hoạch',
  BAN_GIAM_DOC: 'Ban Giám đốc',
  TV: 'Tài khoản TV',
};

/**
 * Ma trận quyền MẶC ĐỊNH (PRD F8 + TDD 10.1). Dùng cho seed `QuyenVaiTro` và test ma trận.
 * Superadmin bật/tắt được từng ô, trừ `TAI_KHOAN_QUAN_LY` của Superadmin.
 */
export const QUYEN_MAC_DINH: Record<ChucNang, readonly VaiTro[]> = {
  TAI_KHOAN_QUAN_LY: ['SUPERADMIN'],
  DANH_MUC_XUONG_CHUYEN: ['SUPERADMIN'],
  NHAN_VIEN_QUAN_LY: ['SUPERADMIN', 'IT_HR'],
  MA_HANG_QUAN_LY: ['SUPERADMIN', 'IE'],
  SO_DO_GAN: ['SUPERADMIN', 'TO_TRUONG', 'IE'],
  GIO_MAC_DINH_CAI: ['SUPERADMIN', 'QUAN_LY_XUONG'],
  GIO_LAM_DUYET: ['SUPERADMIN', 'TO_TRUONG'],
  SAN_LUONG_SUA: ['SUPERADMIN', 'TO_TRUONG'],
  CHOT_NGAY: ['SUPERADMIN', 'TO_TRUONG'],
  KHOA_THANG: ['SUPERADMIN', 'IT_HR'],
  BAO_CAO_XEM: ['SUPERADMIN', 'QUAN_LY_XUONG', 'TO_TRUONG', 'IE', 'IT_HR'],
  DASHBOARD_XEM: ['SUPERADMIN', 'QUAN_LY_XUONG', 'TO_TRUONG', 'BAN_GIAM_DOC', 'TV'],
  KE_HOACH_QUAN_LY: ['SUPERADMIN', 'KE_HOACH'],
  XUAT_LUONG: ['SUPERADMIN', 'IT_HR'],
  CAU_HINH: ['SUPERADMIN'],
  AUDIT_XEM: ['SUPERADMIN'],
  SO_DO_TRAM_XEM: ['SUPERADMIN', 'TO_TRUONG'],
};

/** Ô không được tắt */
export function laQuyenKhongTatDuoc(vaiTro: VaiTro, chucNang: ChucNang): boolean {
  return vaiTro === 'SUPERADMIN' && chucNang === 'TAI_KHOAN_QUAN_LY';
}

/**
 * Ô ma trận Superadmin KHÔNG được sửa → lý do; sửa được → null.
 *  - Quản lý tài khoản của Superadmin luôn bật (PRD F8)
 *  - Tài khoản TV chỉ có DASHBOARD_XEM [D24] — phiên TV không hết hạn nên không được mở thêm chức năng
 */
export function lyDoKhoaQuyen(vaiTro: VaiTro, chucNang: ChucNang): string | null {
  if (laQuyenKhongTatDuoc(vaiTro, chucNang)) return 'Quyền quản lý tài khoản của Superadmin không tắt được';
  if (vaiTro === 'TV' && chucNang !== 'DASHBOARD_XEM') return 'Tài khoản TV chỉ xem dashboard';
  return null;
}

/** Tên hiển thị của chức năng (màn Phân quyền theo vai trò) — theo các hàng của ma trận PRD F8 */
export const TEN_CHUC_NANG: Record<ChucNang, string> = {
  TAI_KHOAN_QUAN_LY: 'Tài khoản & phân quyền (F8)',
  DANH_MUC_XUONG_CHUYEN: 'Xưởng / chuyền / trạm (F9)',
  NHAN_VIEN_QUAN_LY: 'Nhân viên (F2)',
  MA_HANG_QUAN_LY: 'Mã hàng / công đoạn (F3)',
  SO_DO_GAN: 'Gán công đoạn (F4)',
  GIO_MAC_DINH_CAI: 'Giờ mặc định (F6)',
  GIO_LAM_DUYET: 'Duyệt / sửa giờ (F6)',
  SAN_LUONG_SUA: 'Bảng sản lượng ngày: sửa, nhập hộ',
  CHOT_NGAY: 'Chốt ngày (F10)',
  KHOA_THANG: 'Khóa / mở khóa (F10)',
  BAO_CAO_XEM: 'Báo cáo (F5)',
  DASHBOARD_XEM: 'Dashboard (F7)',
  KE_HOACH_QUAN_LY: 'Kế hoạch (F16)',
  XUAT_LUONG: 'Xuất dữ liệu lương (F15)',
  CAU_HINH: 'Cài đặt hệ thống',
  AUDIT_XEM: 'Audit log',
  SO_DO_TRAM_XEM: 'Sơ đồ trạm trực tiếp, đăng xuất hộ (F17)',
};

/** Vai trò có phạm vi gắn theo tài khoản (PRD F8 R 1.5); vai trò khác → toàn nhà máy */
export const PHAM_VI_CUA_VAI_TRO: Partial<Record<VaiTro, 'CHUYEN' | 'XUONG'>> = {
  TO_TRUONG: 'CHUYEN',
  QUAN_LY_XUONG: 'XUONG',
};
