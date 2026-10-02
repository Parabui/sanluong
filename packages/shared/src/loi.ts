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
  // 403
  KHONG_CO_QUYEN: { http: 403, message: 'Không có quyền truy cập.' },
  THIEU_HEADER_CLIENT: { http: 403, message: 'Yêu cầu không hợp lệ.' },
  // 404
  KHONG_TIM_THAY: { http: 404, message: 'Không tìm thấy dữ liệu.' },
  // 409
  NGAY_DA_CHOT: { http: 409, message: 'Ngày này đã được chốt, không thể nhập thêm.' },
  THANG_DA_KHOA: { http: 409, message: 'Mã hàng của tháng này đã khóa sổ.' },
  PHIEN_KHONG_CON: { http: 409, message: 'Phiên tại trạm này không còn hiệu lực.' },
  TRAM_DA_CO_NGUOI: { http: 409, message: 'Trạm đang có người khác – báo tổ trưởng.' },
  THIET_BI_DA_CO_NV_KHAC: { http: 409, message: 'Điện thoại này đã đăng nhập mã nhân viên khác hôm nay.' },
  O_DA_DIEU_CHINH: { http: 409, message: 'Ô này đã được tổ trưởng điều chỉnh.' },
  DU_LIEU_DA_THAY_DOI: { http: 409, message: 'Dữ liệu đã bị người khác thay đổi, vui lòng tải lại.' },
  DA_DUOC_CHOT: { http: 409, message: 'Ngày này đã được chốt trước đó.' },
  // 422
  NGAY_KHONG_MO_NHAP: { http: 422, message: 'Ngày này không còn mở để nhập.' },
  CONG_DOAN_KHONG_THUOC_SO_DO: { http: 422, message: 'Công đoạn không thuộc sơ đồ của trạm trong ngày này.' },
  CHUA_TOI_GIO_MO_CHOT: { http: 422, message: 'Chưa tới giờ được chốt ngày.' },
  QUA_2_MA_HANG: { http: 422, message: 'Mỗi chuyền chỉ chạy tối đa 2 mã hàng cùng lúc.' },
  NV_DA_CO_SAN_LUONG: { http: 422, message: 'Nhân viên đã có sản lượng — chỉ được Ngưng.' },
  MA_NV_KHONG_HOP_LE: { http: 422, message: 'Mã nhân viên không đúng.' },
  TRAM_KHONG_DOI_CHUYEN: { http: 422, message: 'Trạm không được đổi chuyền — hãy ngưng trạm cũ và tạo trạm mới.' },
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
