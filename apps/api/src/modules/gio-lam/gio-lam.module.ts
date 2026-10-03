import { Module } from '@nestjs/common';
import { GioLamController, GioMacDinhController } from './gio-lam.controller.js';
import { GioLamService } from './gio-lam.service.js';
import { GioMacDinhService } from './gio-mac-dinh.service.js';

/** Giờ làm · F6 — Web (duyệt, sửa, giờ mặc định) + dùng chung cho app công nhân (/api/cn/gio-lam) */
@Module({
  controllers: [GioLamController, GioMacDinhController],
  providers: [GioLamService, GioMacDinhService],
  exports: [GioLamService],
})
export class GioLamModule {}
