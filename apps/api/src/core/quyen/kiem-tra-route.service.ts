import { Injectable, type OnApplicationBootstrap, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { ChucNang } from '@vsn/shared';
import { KHOA_CONG_KHAI, KHOA_DA_DANG_NHAP, KHOA_QUYEN } from './quyen.decorator.js';

/** Một route và yêu cầu quyền khai báo trên nó */
export interface RouteQuyen {
  /** Ví dụ "PATCH /api/chuyen/:id" */
  route: string;
  /** Tên handler, ví dụ "DanhMucController.suaChuyen" */
  handler: string;
  quyen: 'CONG_KHAI' | 'DA_DANG_NHAP' | ChucNang[] | null;
}

const ghepDuongDan = (...p: string[]) =>
  '/' + p.flatMap((x) => x.split('/')).filter(Boolean).join('/');

/**
 * Lúc khởi động: quét MỌI route, có route thiếu @Quyen(...) / @CongKhai() / @DaDangNhap() → DỪNG KHỞI ĐỘNG [D8].
 * Không thể "quên" khai báo quyền cho một API mới. `danhSach()` cũng dùng cho test ma trận quyền (TDD 10.3).
 */
@Injectable()
export class KiemTraRouteService implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const thieu = this.danhSach().filter((r) => r.quyen === null);
    if (thieu.length) {
      throw new Error(`[D8] Route thiếu @Quyen(...) hoặc @CongKhai(): ${thieu.map((r) => r.handler).join(', ')}`);
    }
  }

  danhSach(tienTo = 'api'): RouteQuyen[] {
    const kq: RouteQuyen[] = [];
    for (const { instance, metatype } of this.discovery.getControllers()) {
      if (!instance || !metatype) continue;
      const goc = (Reflect.getMetadata(PATH_METADATA, metatype) as string | undefined) ?? '';
      const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
      for (const ten of this.scanner.getAllMethodNames(proto)) {
        const handler = proto[ten] as object;
        const duongDan = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        if (duongDan === undefined) continue; // không phải route
        const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
        const dich = [handler, metatype] as Parameters<Reflector['getAllAndOverride']>[1];
        const quyen = this.reflector.getAllAndOverride<ChucNang[] | undefined>(KHOA_QUYEN, dich);
        kq.push({
          route: `${method} ${ghepDuongDan(tienTo, goc, duongDan)}`,
          handler: `${metatype.name}.${ten}`,
          quyen: this.reflector.getAllAndOverride<boolean>(KHOA_CONG_KHAI, dich)
            ? 'CONG_KHAI'
            : this.reflector.getAllAndOverride<boolean>(KHOA_DA_DANG_NHAP, dich)
              ? 'DA_DANG_NHAP'
              : quyen?.length
                ? quyen
                : null,
        });
      }
    }
    return kq;
  }
}
