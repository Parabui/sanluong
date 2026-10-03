import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { MOI_TRUONG, type MoiTruong } from '../moi-truong.js';

/** Client trong transaction — mọi hàm ghi nhận `tx` này */
export type Tx = Prisma.TransactionClient;

/**
 * Prisma Client (v7, driver adapter `pg`). Kết nối lười: mở khi có truy vấn đầu tiên.
 * Pool: tối đa DB_POOL_MAX (20) kết nối, chờ tối đa DB_POOL_TIMEOUT_MS [D25].
 * Chuyển đổi cột ngày ↔ 'YYYY-MM-DD': ./ngay-db.ts (một chỗ duy nhất, TDD 6.2).
 * Transaction ghi: dùng AuditService.giaoDich() để luôn đặt vsn.nguoi_thuc_hien [D9].
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
