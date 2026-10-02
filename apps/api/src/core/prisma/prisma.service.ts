import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { MOI_TRUONG, type MoiTruong } from '../moi-truong.js';

/**
 * Prisma Client (v7, driver adapter `pg`). Kết nối lười: mở khi có truy vấn đầu tiên.
 * Pool: tối đa DB_POOL_MAX (20) kết nối, chờ tối đa DB_POOL_TIMEOUT_MS [D25].
 *
 * ⏳ TDD 6.2: chuyển đổi DateTime @db.Date ↔ chuỗi 'YYYY-MM-DD' đặt ở MỘT chỗ —
 *    client extension tại đây, thêm cùng lúc với schema đầy đủ.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(MOI_TRUONG) env: MoiTruong) {
    super({
      adapter: new PrismaPg({
        connectionString: env.DATABASE_URL,
        max: env.DB_POOL_MAX,
        connectionTimeoutMillis: env.DB_POOL_TIMEOUT_MS,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
