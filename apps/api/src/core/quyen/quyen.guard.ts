import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ChucNang } from '@vsn/shared';
import { LoiNghiepVu } from '../loi/loi-nghiep-vu.js';
import { KHOA_CONG_KHAI, KHOA_QUYEN } from './quyen.decorator.js';

/**
 * Guard toàn cục — MẶC ĐỊNH TỪ CHỐI [D8] [TDD 10.1]:
 *  1. @CongKhai() → cho qua
 *  2. Không có @Quyen(...) → từ chối (và KiemTraRouteService đã chặn khởi động)
 *  3. Có phiên hợp lệ + QuyenVaiTro[vaiTro][chucNang] = true → cho qua; ngược lại 403 + audit
 */
@Injectable()
export class QuyenGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const dich = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(KHOA_CONG_KHAI, dich)) return true;

    const chucNang = this.reflector.getAllAndOverride<ChucNang[] | undefined>(KHOA_QUYEN, dich);
    if (!chucNang?.length) throw new LoiNghiepVu('KHONG_CO_QUYEN');

    // ⏳ Tuần 2 (F8): đọc cookie vsn_sid → PhienDangNhap → QuyenVaiTro (cache) + PhamVi vào CLS.
    // Chưa có xác thực → mọi route cần quyền đều bị từ chối.
    throw new LoiNghiepVu('CHUA_DANG_NHAP');
  }
}
