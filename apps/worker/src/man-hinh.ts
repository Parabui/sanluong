/**
 * Màn hình app công nhân [TDD 14.2] ↔ giao diện gốc trong ui-demo (`/app/*`).
 * Mỗi màn hình hiện là trang tạm; khi implement User Story thì chuyển giao diện từ `demo`.
 */
export interface ManHinh {
  duongDan: string;
  tieuDe: string;
  tinhNang: string;
  demo: string;
}

export const MAN_HINH_WORKER: ManHinh[] = [
  { duongDan: 'huong-dan', tieuDe: 'Hướng dẫn lần đầu', tinhNang: 'F18', demo: 'ui-demo/src/app/app/huong-dan' },
  { duongDan: 'chon-tram', tieuDe: 'Chọn trạm', tinhNang: 'F1, F12', demo: 'ui-demo/src/app/app/chon-tram' },
  { duongDan: 'dang-nhap/:tramId', tieuDe: 'Đăng nhập mã NV', tinhNang: 'F1', demo: 'ui-demo/src/app/app/dang-nhap' },
  { duongDan: 'nhap', tieuDe: 'Nhập sản lượng', tinhNang: 'F1', demo: 'ui-demo/src/app/app/nhap' },
  { duongDan: 'cua-toi', tieuDe: 'Của tôi', tinhNang: 'F11', demo: 'ui-demo/src/app/app/cua-toi' },
  { duongDan: 'cua-toi/:ngay', tieuDe: 'Của tôi — chi tiết ngày', tinhNang: 'F11', demo: 'ui-demo/src/app/app/cua-toi/[ngay]' },
  { duongDan: 'gio-lam', tieuDe: 'Giờ làm', tinhNang: 'F6', demo: 'ui-demo/src/app/app/gio-lam' },
];
