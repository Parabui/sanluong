/**
 * Danh sách màn hình Web (PRD ⑪) ↔ thư mục giao diện tương ứng trong ui-demo.
 * Mỗi màn hình hiện là trang tạm; khi implement User Story thì thay bằng giao diện chuyển từ `demo`.
 */
export interface ManHinh {
  duongDan: string;
  tieuDe: string;
  tinhNang: string;
  /** Đường dẫn giao diện gốc trong ui-demo */
  demo: string;
}

export const MAN_HINH_XAC_THUC: ManHinh[] = [
  { duongDan: 'dang-nhap', tieuDe: 'Đăng nhập', tinhNang: 'F8', demo: 'ui-demo/src/app/(auth)/dang-nhap' },
  { duongDan: 'doi-mat-khau', tieuDe: 'Đổi mật khẩu', tinhNang: 'F8', demo: 'ui-demo/src/app/(auth)/doi-mat-khau' },
];

export const MAN_HINH_WEB: ManHinh[] = [
  { duongDan: 'trang-chu', tieuDe: 'Trang chủ', tinhNang: 'F10, F13', demo: 'ui-demo/src/app/(web)/trang-chu' },
  { duongDan: 'san-xuat/bang-san-luong', tieuDe: 'Bảng sản lượng ngày', tinhNang: 'F10, F19', demo: 'ui-demo/src/app/(web)/san-xuat/bang-san-luong' },
  { duongDan: 'san-xuat/so-do-chuyen', tieuDe: 'Sơ đồ chuyền', tinhNang: 'F4', demo: 'ui-demo/src/app/(web)/san-xuat/so-do-chuyen' },
  { duongDan: 'san-xuat/so-do-tram', tieuDe: 'Sơ đồ trạm trực tiếp', tinhNang: 'F17', demo: 'ui-demo/src/app/(web)/san-xuat/so-do-tram' },
  { duongDan: 'san-xuat/duyet-gio', tieuDe: 'Duyệt giờ làm', tinhNang: 'F6', demo: 'ui-demo/src/app/(web)/san-xuat/duyet-gio' },
  { duongDan: 'bao-cao', tieuDe: 'Báo cáo', tinhNang: 'F5', demo: 'ui-demo/src/app/(web)/bao-cao' },
  { duongDan: 'bao-cao/dashboard', tieuDe: 'Dashboard', tinhNang: 'F7', demo: 'ui-demo/src/app/(web)/bao-cao/dashboard' },
  { duongDan: 'luong/khoa-so', tieuDe: 'Khóa sổ', tinhNang: 'F10', demo: 'ui-demo/src/app/(web)/luong/khoa-so' },
  { duongDan: 'luong/xuat-du-lieu', tieuDe: 'Xuất dữ liệu lương', tinhNang: 'F15', demo: 'ui-demo/src/app/(web)/luong/xuat-du-lieu' },
  { duongDan: 'ke-hoach', tieuDe: 'Kế hoạch sản lượng', tinhNang: 'F16', demo: 'ui-demo/src/app/(web)/ke-hoach' },
  { duongDan: 'danh-muc/nhan-vien', tieuDe: 'Nhân viên', tinhNang: 'F2', demo: 'ui-demo/src/app/(web)/danh-muc/nhan-vien' },
  { duongDan: 'danh-muc/ma-hang', tieuDe: 'Mã hàng & công đoạn', tinhNang: 'F3', demo: 'ui-demo/src/app/(web)/danh-muc/ma-hang' },
  { duongDan: 'danh-muc/chuyen-tram', tieuDe: 'Xưởng – Chuyền – Trạm', tinhNang: 'F9, F12', demo: 'ui-demo/src/app/(web)/danh-muc/chuyen-tram' },
  { duongDan: 'he-thong/tai-khoan', tieuDe: 'Tài khoản & phân quyền', tinhNang: 'F8', demo: 'ui-demo/src/app/(web)/he-thong/tai-khoan' },
  { duongDan: 'he-thong/cai-dat', tieuDe: 'Cài đặt', tinhNang: 'F6, F8', demo: 'ui-demo/src/app/(web)/he-thong/cai-dat' },
  { duongDan: 'he-thong/audit-log', tieuDe: 'Audit log', tinhNang: 'F8', demo: 'ui-demo/src/app/(web)/he-thong/audit-log' },
];

export const MAN_HINH_TV: ManHinh = { duongDan: 'tv', tieuDe: 'Dashboard TV', tinhNang: 'F7', demo: 'ui-demo/src/app/tv' };
