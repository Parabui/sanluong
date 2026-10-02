import { Controller, Get } from '@nestjs/common';
import type { Health } from '@vsn/shared';
import { CongKhai } from '../../core/quyen/quyen.decorator.js';

@Controller('health')
export class HealthController {
  /** Công khai: chỉ trả { ok } — không lộ phiên bản/DB [D24] */
  @Get()
  @CongKhai()
  kiemTra(): Health {
    return { ok: true };
  }

  // ⏳ GET /api/health/chi-tiet (token Uptime Kuma hoặc Superadmin): { phienBan, db, migration, gioServer }
}
