import { defineConfig } from 'vitest/config';

/**
 * Test tích hợp: PostgreSQL 17 thật qua Testcontainers, chạy migration thật [D13] [TDD 16].
 * ⏳ Thiết lập Testcontainers + factory dữ liệu ở bước Prisma schema (tuần 1).
 */
export default defineConfig({
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
  },
});
