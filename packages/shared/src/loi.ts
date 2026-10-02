/**
 * Danh mục mã lỗi — nguồn duy nhất [TDD 7.2].
 * `message` là tiếng Việt, hiển thị trực tiếp cho người dùng.
 * Service có thể thay `message` bằng câu cụ thể hơn (kèm tên người, giờ…) nhưng giữ nguyên `code`.
 */
export const LOI = {
  // 400
  DU_LIEU_KHONG_HOP_LE: { http: 400, message: 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.' },
  // 401
  CHUA_DANG_NHAP: { http: 401, message: 'Vui lòng đăng nhập.' },
  PHIEN_HET_HAN: { http: 401, message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' },
  SAI_DANG_NHAP: { http: 401, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' },
  // 403
  KHONG_CO_QUYEN: { http: 403, message: 'Không có quyền truy cập.' },
  THIEU_HEADER_CLIENT: { http: 403, message: 'Yêu cầu không hợp lệ.' },
  TAI_KHOAN_VO_HIEU: { http: 403, message: 'Tài khoản đã bị vô hiệu hóa. Liên hệ Superadmin.' },
  PHAI_DOI_MAT_KHAU: { http: 403, message: 'Bạn phải đổi mật khẩu trước khi tiếp tục.' },
  // 404
  KHONG_TIM_THAY: { http: 404, message: 'Không tìm thấy dữ liệu.' },
  // 409
  NGAY_DA_CHOT: { http: 409, message: 'Ngày này đã được chốt, không thể nhập thêm.' },
  THANG_DA_KHOA: { http: 409, message: 'Mã hàng của tháng này đã khóa sổ.' },
  /** [R 5.7] có Mã hàng × Tháng chứa sản lượng của NV ngày đó đã khóa */
  GIO_LAM_DA_KHOA: { http: 409, message: 'Giờ làm ngày này đã khóa sổ — chỉ sửa được sau khi mở khóa tháng.' },
  PHIEN_KHONG_CON: { http: 409, message: 'Phiên tại trạm này không còn hiệu lực.' },
  TRAM_DA_CO_NGUOI: { http: 409, message: 'Trạm đang có người khác – báo tổ trưởng.' },
  THIET_BI_DA_CO_NV_KHAC: { http: 409, message: 'Điện thoại này đã đăng nhập mã nhân viên khác hôm nay.' },
  O_DA_DIEU_CHINH: { http: 409, message: 'Ô này đã được tổ trưởng điều chỉnh.' },
  DU_LIEU_DA_THAY_DOI: { http: 409, message: 'Dữ liệu đã bị người khác thay đổi, vui lòng tải lại.' },
  DA_DUOC_CHOT: { http: 409, message: 'Ngày này đã được chốt trước đó.' },
  TRUNG_MA: { http: 409, message: 'Mã này đã tồn tại.' },
  /** Thao tác có cảnh báo — gửi lại kèm `xacNhan: true` để tiếp tục. `chiTiet` mô tả cảnh báo */
  CAN_XAC_NHAN: { http: 409, message: 'Thao tác cần được xác nhận.' },
  // 422
  NGAY_KHONG_MO_NHAP: { http: 422, message: 'Ngày này không còn mở để nhập.' },
  CONG_DOAN_KHONG_THUOC_SO_DO: { http: 422, message: 'Công đoạn không thuộc sơ đồ của trạm trong ngày này.' },
  CHUA_TOI_GIO_MO_CHOT: { http: 422, message: 'Chưa tới giờ được chốt ngày.' },
  QUA_2_MA_HANG: { http: 422, message: 'Mỗi chuyền chỉ chạy tối đa 2 mã hàng cùng lúc.' },
  NV_DA_CO_SAN_LUONG: { http: 422, message: 'Nhân viên đã có sản lượng — chỉ được Ngưng.' },
  MA_NV_KHONG_HOP_LE: { http: 422, message: 'Mã nhân viên không đúng.' },
  TRAM_KHONG_DOI_CHUYEN: { http: 422, message: 'Trạm không được đổi chuyền — hãy ngưng trạm cũ và tạo trạm mới.' },
  MAT_KHAU_HIEN_TAI_SAI: { http: 422, message: 'Mật khẩu hiện tại không đúng.' },
  CON_CHUYEN_HOAT_DONG: { http: 422, message: 'Xưởng còn chuyền đang hoạt động — ngưng các chuyền trước.' },
  CON_NHAN_VIEN_HOAT_DONG: { http: 422, message: 'Chuyền còn nhân viên đang hoạt động — chuyển nhân viên sang chuyền khác trước.' },
  CON_CONG_DOAN_GAN: { http: 422, message: 'Trạm đang có công đoạn gán — gỡ công đoạn khỏi trạm trước.' },
  PHAI_GAN_PHAM_VI: { http: 422, message: 'Tài khoản phải được gắn ít nhất 1 chuyền/xưởng.' },
  /** Kích hoạt / thêm con khi xưởng hoặc chuyền chứa nó đang ngưng */
  CAP_TREN_DANG_NGUNG: { http: 422, message: 'Đơn vị cấp trên đang ngưng — kích hoạt lại trước.' },
  VONG_NGOAI_KHONG_NHAP_APP: { http: 422, message: 'Nhóm vòng ngoài không nhập sản lượng qua app.' },
  CONG_DOAN_DANG_GAN: { http: 422, message: 'Công đoạn đang gán tại trạm — gỡ khỏi trạm trước khi ngưng.' },
  CONG_DOAN_HOAN_THANH: { http: 422, message: 'Mỗi mã hàng phải có đúng 1 công đoạn hoàn thành — chọn công đoạn hoàn thành khác trước.' },
  NGAY_SMV_DA_KHOA: { http: 422, message: 'Ngày áp dụng rơi vào tháng đã khóa sổ.' },
  CONG_DOAN_KHONG_HOP_LE: { http: 422, message: 'Công đoạn không thuộc mã hàng hoặc đã ngưng.' },
  TRAM_KHONG_HOP_LE: { http: 422, message: 'Trạm không thuộc chuyền hoặc không nhập qua app.' },
  TRAM_KHONG_HOAT_DONG: { http: 422, message: 'Trạm không còn hoạt động.' },
  QR_KHONG_HOP_LE: { http: 404, message: 'Mã QR không hợp lệ.' },
  CHUA_DANG_NHAP_TRAM: { http: 401, message: 'Chưa đăng nhập trạm — chọn trạm và nhập mã NV.' },
  TURNSTILE_SAI: { http: 403, message: 'Không xác minh được thiết bị — tải lại trang rồi thử lại.' },
  SUPERADMIN_CUOI_CUNG: { http: 422, message: 'Phải luôn còn ít nhất 1 Superadmin đang hoạt động.' },
  CHI_SUPERADMIN: { http: 403, message: 'Chỉ Superadmin được thực hiện thao tác này.' },
  // Import Excel [TDD 19]
  FILE_KHONG_HOP_LE: { http: 422, message: 'File không hợp lệ — chỉ nhận file Excel .xlsx.' },
  FILE_QUA_NHIEU_DONG: { http: 422, message: 'File có quá 5.000 dòng — tách thành nhiều file.' },
  FILE_SAI_MAU: { http: 422, message: 'File sai mẫu — thiếu cột bắt buộc.' },
  IMPORT_HET_HAN: { http: 410, message: 'Bản xem trước đã hết hạn (30 phút) — chọn lại file.' },
  // 413
  FILE_QUA_LON: { http: 413, message: 'File quá 10 MB — tách thành nhiều file.' },
  // 429
  QUA_SO_LAN_SAI: { http: 429, message: 'Nhập sai quá nhiều lần, vui lòng thử lại sau.' },
  QUA_SO_LAN_CHUYEN_THIET_BI: { http: 429, message: 'Đã chuyển thiết bị quá 3 lần hôm nay – báo tổ trưởng.' },
  // 500
  LOI_HE_THONG: { http: 500, message: 'Có lỗi xảy ra, vui lòng thử lại.' },
} as const satisfies Record<string, { http: number; message: string }>;

export type MaLoi = keyof typeof LOI;

/** Thân response lỗi của mọi API [TDD 7.1] */
export interface PhanHoiLoi {
  code: MaLoi;
  message: string;
  field?: string;
  traceId: string;
  chiTiet?: unknown;
}

export function laMaLoi(x: unknown): x is MaLoi {
  return typeof x === 'string' && Object.hasOwn(LOI, x);
}
