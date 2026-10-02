/**
 * Dữ liệu kỳ vọng cho test ma trận quyền [TDD 10.3] — CHÉP TAY từ bảng "Ma trận phân quyền mặc định" PRD F8
 * (+ 2 chức năng TDD 10.1 bổ sung: AUDIT_XEM, SO_DO_TRAM_XEM). Cố ý KHÔNG import QUYEN_MAC_DINH:
 * đây là nguồn độc lập để bắt lỗi khi ai đó sửa ma trận trong code mà PRD không đổi.
 */
import type { ChucNang, VaiTro } from '@vsn/shared';

const SA: VaiTro = 'SUPERADMIN';
const QLX: VaiTro = 'QUAN_LY_XUONG';
const TT: VaiTro = 'TO_TRUONG';
const IE: VaiTro = 'IE';
const HR: VaiTro = 'IT_HR';
const KH: VaiTro = 'KE_HOACH';
const BGD: VaiTro = 'BAN_GIAM_DOC';
const TV: VaiTro = 'TV';

export const MA_TRAN_PRD: Record<ChucNang, VaiTro[]> = {
  TAI_KHOAN_QUAN_LY: [SA], //            Tài khoản & phân quyền (F8)
  DANH_MUC_XUONG_CHUYEN: [SA], //        Xưởng / chuyền / trạm (F9)
  NHAN_VIEN_QUAN_LY: [SA, HR], //        Nhân viên (F2)
  MA_HANG_QUAN_LY: [SA, IE], //          Mã hàng / công đoạn (F3)
  SO_DO_GAN: [SA, TT, IE], //            Gán công đoạn (F4)
  GIO_MAC_DINH_CAI: [SA, QLX], //        Giờ mặc định (F6)
  GIO_LAM_DUYET: [SA, TT], //            Duyệt / sửa giờ (F6)
  SAN_LUONG_SUA: [SA, TT], //            Bảng sản lượng ngày: sửa, nhập hộ (F10, F19)
  CHOT_NGAY: [SA, TT], //                Chốt ngày (F10)
  KHOA_THANG: [SA, HR], //               Khóa / mở khóa (F10)
  BAO_CAO_XEM: [SA, QLX, TT, IE, HR], // Báo cáo (F5)
  DASHBOARD_XEM: [SA, QLX, TT, BGD, TV], // Dashboard (F7)
  KE_HOACH_QUAN_LY: [SA, KH], //         Kế hoạch (F16)
  XUAT_LUONG: [SA, HR], //               Xuất dữ liệu lương (F15)
  CAU_HINH: [SA], //                     Cài đặt hệ thống
  AUDIT_XEM: [SA], //                    TDD 10.1
  SO_DO_TRAM_XEM: [SA, TT], //           TDD 10.1 — F17 [D26]
};

export type KhaiBaoRoute = 'CONG_KHAI' | 'DA_DANG_NHAP' | ChucNang[];

/**
 * MỌI route của API và quyền khai báo trên nó. Thêm route mới mà không thêm vào đây → test đỏ
 * (buộc người viết route xem lại quyền có khớp PRD F8 không).
 */
export const ROUTE: Record<string, KhaiBaoRoute> = {
  'GET /api/health': 'CONG_KHAI',
  'POST /api/auth/dang-nhap': 'CONG_KHAI',
  'POST /api/auth/dang-xuat': 'DA_DANG_NHAP',
  'POST /api/auth/doi-mat-khau': 'DA_DANG_NHAP',
  'GET /api/auth/toi': 'DA_DANG_NHAP',
  'GET /api/xuong': ['DANH_MUC_XUONG_CHUYEN', 'NHAN_VIEN_QUAN_LY', 'TAI_KHOAN_QUAN_LY'],
  'POST /api/xuong': ['DANH_MUC_XUONG_CHUYEN'],
  'PATCH /api/xuong/:id': ['DANH_MUC_XUONG_CHUYEN'],
  'GET /api/chuyen': ['DANH_MUC_XUONG_CHUYEN', 'NHAN_VIEN_QUAN_LY', 'TAI_KHOAN_QUAN_LY'],
  'POST /api/chuyen': ['DANH_MUC_XUONG_CHUYEN'],
  'PATCH /api/chuyen/:id': ['DANH_MUC_XUONG_CHUYEN'],
  'GET /api/chuyen/:id/tram': ['DANH_MUC_XUONG_CHUYEN'],
  'PATCH /api/tram/:id': ['DANH_MUC_XUONG_CHUYEN'],
  'GET /api/nhan-vien': ['NHAN_VIEN_QUAN_LY'],
  'POST /api/nhan-vien': ['NHAN_VIEN_QUAN_LY'],
  'PATCH /api/nhan-vien/:id': ['NHAN_VIEN_QUAN_LY'],
  'DELETE /api/nhan-vien/:id': ['NHAN_VIEN_QUAN_LY'], // + chỉ Superadmin (kiểm ở service)
  'POST /api/import/:loai/xem-truoc': ['NHAN_VIEN_QUAN_LY'],
  'POST /api/import/:importId/xac-nhan': ['NHAN_VIEN_QUAN_LY'],
  'GET /api/import/:loai/mau': ['NHAN_VIEN_QUAN_LY'],
  'GET /api/tai-khoan': ['TAI_KHOAN_QUAN_LY'],
  'POST /api/tai-khoan': ['TAI_KHOAN_QUAN_LY'],
  'PATCH /api/tai-khoan/:id': ['TAI_KHOAN_QUAN_LY'],
  'POST /api/tai-khoan/:id/dat-lai-mat-khau': ['TAI_KHOAN_QUAN_LY'],
  'POST /api/tai-khoan/:id/thu-hoi-phien': ['TAI_KHOAN_QUAN_LY'],
  'GET /api/quyen-vai-tro': ['TAI_KHOAN_QUAN_LY'],
  'PUT /api/quyen-vai-tro': ['TAI_KHOAN_QUAN_LY'],
};
