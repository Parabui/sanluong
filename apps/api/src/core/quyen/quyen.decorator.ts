import { SetMetadata } from '@nestjs/common';
import type { ChucNang } from '@vsn/shared';

export const KHOA_QUYEN = 'vsn:quyen';
export const KHOA_CONG_KHAI = 'vsn:cong-khai';
export const KHOA_DA_DANG_NHAP = 'vsn:da-dang-nhap';
export const KHOA_CONG_NHAN = 'vsn:cong-nhan';

/** Route yêu cầu phiên Web hợp lệ + vai trò có (ít nhất một trong) các chức năng này [D8] */
export const Quyen = (...chucNang: [ChucNang, ...ChucNang[]]) => SetMetadata(KHOA_QUYEN, chucNang);

/** Route công khai — không cần phiên. Dùng rất hạn chế (health, đăng nhập…) */
export const CongKhai = () => SetMetadata(KHOA_CONG_KHAI, true);

/**
 * Route chỉ cần phiên Web hợp lệ, không gắn chức năng nào: thông tin tài khoản, đổi mật khẩu, đăng xuất.
 * Đây là các route DUY NHẤT còn dùng được khi tài khoản đang bị buộc đổi mật khẩu.
 */
export const DaDangNhap = () => SetMetadata(KHOA_DA_DANG_NHAP, true);

/**
 * Route của app công nhân (/api/cn/*) cần cookie thiết bị `vsn_tb` hợp lệ (không dùng phiên Web) [D6].
 * Quyền theo dữ liệu (phiên trạm của chính thiết bị) do service kiểm tra.
 */
export const CongNhan = () => SetMetadata(KHOA_CONG_NHAN, true);
