import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { KHOA_CONG_KHAI, KHOA_QUYEN } from './quyen.decorator.js';

/**
 * Lúc khởi động: quét MỌI route, có route thiếu @Quyen(...) / @CongKhai() → DỪNG KHỞI ĐỘNG [D8].
 * Không thể "quên" khai báo quyền cho một API mới.
 */
@Injectable()
export class KiemTraRouteService implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const thieu = this.timRouteThieuQuyen();
    if (thieu.length) {
      throw new Error(`[D8] Route thiếu @Quyen(...) hoặc @CongKhai(): ${thieu.join(', ')}`);
    }
  }

  timRouteThieuQuyen(): string[] {
    const thieu: string[] = [];
    for (const { instance, metatype } of this.discovery.getControllers()) {
      if (!instance || !metatype) continue;
      const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
      for (const ten of this.scanner.getAllMethodNames(proto)) {
        const handler = proto[ten] as object;
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue; // không phải route
        const dich = [handler, metatype] as Parameters<Reflector['getAllAndOverride']>[1];
        const congKhai = this.reflector.getAllAndOverride<boolean>(KHOA_CONG_KHAI, dich);
        const quyen = this.reflector.getAllAndOverride<string[] | undefined>(KHOA_QUYEN, dich);
        if (!congKhai && !quyen?.length) thieu.push(`${metatype.name}.${ten}`);
      }
    }
    return thieu;
  }
}
