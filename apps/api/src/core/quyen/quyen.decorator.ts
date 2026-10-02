import { SetMetadata } from '@nestjs/common';
import type { ChucNang } from '@vsn/shared';

export const KHOA_QUYEN = 'vsn:quyen';
export const KHOA_CONG_KHAI = 'vsn:cong-khai';

/** Route yêu cầu phiên Web hợp lệ + vai trò có (ít nhất một trong) các chức năng này [D8] */
export const Quyen = (...chucNang: [ChucNang, ...ChucNang[]]) => SetMetadata(KHOA_QUYEN, chucNang);

/** Route công khai — không cần phiên. Dùng rất hạn chế (health, đăng nhập…) */
export const CongKhai = () => SetMetadata(KHOA_CONG_KHAI, true);
