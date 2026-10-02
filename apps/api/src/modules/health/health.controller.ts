import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Req } from '@nestjs/common';
import type { Health, zHealthChiTiet } from '@vsn/shared';
import type { Request } from 'express';
import type { z } from 'zod';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { docMoiTruong } from '../../core/moi-truong.js';
import { PhienWebService } from '../../core/phien/phien-web.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { CongKhai } from '../../core/quyen/quyen.decorator.js';

export const HEADER_UPTIME_TOKEN = 'x-uptime-token';

const bangNhau = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly phienWeb: PhienWebService,
  ) {}

  /** Công khai: chỉ trả { ok } — không lộ phiên bản/DB [D24] */
  @Get()
  @CongKhai()
  kiemTra(): Health {
    return { ok: true };
  }

  /**
   * Chi tiết cho Uptime Kuma (header X-Uptime-Token) hoặc Superadmin đã đăng nhập [D24] [TDD 18].
   * Route công khai về mặt guard; quyền kiểm ngay tại đây (không có token/không phải Superadmin → 403).
   */
  @Get('chi-tiet')
  @CongKhai()
  async chiTiet(@Req() req: Request): Promise<z.infer<typeof zHealthChiTiet>> {
    const env = docMoiTruong();
    const token = req.header(HEADER_UPTIME_TOKEN);
    const coToken = !!env.UPTIME_TOKEN && !!token && bangNhau(token, env.UPTIME_TOKEN);
    if (!coToken) {
      const tk = await this.phienWeb.xacThuc(req).catch(() => null);
      if (tk?.vaiTro !== 'SUPERADMIN') throw new LoiNghiepVu('KHONG_CO_QUYEN');
    }
    await this.prisma.$queryRaw`SELECT 1`;
    const [m] = await this.prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC, migration_name DESC LIMIT 1`;
    return { phienBan: env.APP_VERSION, db: 'ok', migration: m?.migration_name ?? null, gioServer: this.clock.now().toISOString() };
  }
}
