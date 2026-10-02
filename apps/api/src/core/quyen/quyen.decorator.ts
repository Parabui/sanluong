import { SetMetadata } from '@nestjs/common';
import type { ChucNang } from '@vsn/shared';

export const KHOA_QUYEN = 'vsn:quyen';
export const KHOA_CONG_KHAI = 'vsn:cong-khai';
export const KHOA_DA_DANG_NHAP = 'vsn:da-dang-nhap';

/** Route yêu cầu phiên Web hợp lệ + vai trò có (ít nhất một trong) các chức năng này [D8] */
export const Quyen = (...chucNang: [ChucNang, ...ChucNang[]]) => SetMetadata(KHOA_QUYEN, chucNang);

/** Route công khai — không cần phiên. Dùng rất hạn chế (health, đăng nhập…) */
export const CongKhai = () => SetMetadata(KHOA_CONG_KHAI, true);

/**
 * Route chỉ cần phiên Web hợp lệ, không gắn chức năng nào: thông tin tài khoản, đổi mật khẩu, đăng xuất.
 * Đây là các route DUY NHẤT còn dùng được khi tài khoản đang bị buộc đổi mật khẩu.
 */
export const DaDangNhap = () => SetMetadata(KHOA_DA_DANG_NHAP, true);
