import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ChucNang } from '@vsn/shared';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../audit/audit.service.js';
import { layIp } from '../http/ip.js';
import { ganNhatKy } from '../trace-id.js';
import { LoiNghiepVu } from '../loi/loi-nghiep-vu.js';
import type { VsnClsStore } from '../ngu-canh.js';
import { PhienWebService } from '../phien/phien-web.service.js';
import { ThietBiService } from '../phien/thiet-bi.service.js';
import { PhamViService } from './pham-vi.service.js';
import { KHOA_CONG_KHAI, KHOA_CONG_NHAN, KHOA_DA_DANG_NHAP, KHOA_QUYEN } from './quyen.decorator.js';
import { QuyenService } from './quyen.service.js';

/**
 * Guard toàn cục — MẶC ĐỊNH TỪ CHỐI [D8] [TDD 10.1]:
 *  1. @CongKhai() → cho qua · @CongNhan() → cookie thiết bị vsn_tb hợp lệ (app công nhân) → cho qua
 *  2. Nạp phiên `vsn_sid` → không có: 401 CHUA_DANG_NHAP · hết hạn: 401 PHIEN_HET_HAN
 *     → đặt NguCanhAudit, PhamVi (đọc lại từ DB mỗi request), TaiKhoan vào CLS
 *  3. @DaDangNhap() → cho qua
 *  4. @Quyen(...): tài khoản đang bị buộc đổi mật khẩu → 403 PHAI_DOI_MAT_KHAU;
 *     vai trò có ≥ 1 chức năng được bật → cho qua; ngược lại 403 KHONG_CO_QUYEN + audit (gộp theo phút)
 *  5. Route không có decorator nào → từ chối (KiemTraRouteService đã chặn khởi động)
 */
@Injectable()
export class QuyenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService<VsnClsStore>,
    private readonly phien: PhienWebService,
    private readonly quyen: QuyenService,
    private readonly phamVi: PhamViService,
    private readonly audit: AuditService,
    private readonly thietBi: ThietBiService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const dich = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(KHOA_CONG_KHAI, dich)) return true;

    // App công nhân: cookie thiết bị thay cho phiên Web [D6]. Người thực hiện (NV) do service đặt theo phiên trạm.
    if (this.reflector.getAllAndOverride<boolean>(KHOA_CONG_NHAN, dich)) {
      const req = ctx.switchToHttp().getRequest<Request>();
      const tb = await this.thietBi.xacThuc(req);
      if (!tb) throw new LoiNghiepVu('CHUA_DANG_NHAP_TRAM');
      this.cls.set('thietBi', tb);
      this.cls.set('route', `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`);
      ganNhatKy(req, { route: this.cls.get('route'), thietBiId: tb.id });
      this.cls.set('nguCanhAudit', {
        loaiNguoiThucHien: 'NHAN_VIEN',
        nguoiThucHienId: null,
        thietBiId: tb.id,
        ip: layIp(req),
        traceId: this.cls.getId() ?? '',
      });
      return true;
    }

    const chucNang = this.reflector.getAllAndOverride<ChucNang[] | undefined>(KHOA_QUYEN, dich);
    const chiCanDangNhap = this.reflector.getAllAndOverride<boolean>(KHOA_DA_DANG_NHAP, dich);
    if (!chucNang?.length && !chiCanDangNhap) throw new LoiNghiepVu('KHONG_CO_QUYEN');

    const req = ctx.switchToHttp().getRequest<Request>();
    const tk = await this.phien.xacThuc(req);
    if (!tk) throw new LoiNghiepVu('CHUA_DANG_NHAP');

    this.cls.set('route', `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`);
    ganNhatKy(req, { route: this.cls.get('route'), nguoiThucHienId: tk.id });
    this.cls.set('taiKhoan', tk);
    this.cls.set('phamVi', await this.phamVi.cuaTaiKhoan(tk.id, tk.vaiTro));
    this.cls.set('nguCanhAudit', {
      loaiNguoiThucHien: 'TAI_KHOAN',
      nguoiThucHienId: tk.id,
      ip: layIp(req),
      traceId: this.cls.getId() ?? '',
    });

    if (chiCanDangNhap) return true;
    if (tk.phaiDoiMatKhau) throw new LoiNghiepVu('PHAI_DOI_MAT_KHAU');
    if (await this.quyen.coMotTrong(tk.vaiTro, chucNang!)) return true;

    await this.audit.ghiTuChoi('CHUC_NANG');
    throw new LoiNghiepVu('KHONG_CO_QUYEN');
  }
}
