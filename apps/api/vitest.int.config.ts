import { defineConfig } from 'vitest/config';

/**
 * Test tích hợp: PostgreSQL 17 thật qua Testcontainers, chạy migration thật [D13] [TDD 16].
 * Cần Docker đang chạy. Container dựng 1 lần cho cả lượt chạy (test/ho-tro/global-setup.ts).
 */
export default defineConfig({
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/ho-tro/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent', TZ: 'Asia/Ho_Chi_Minh' },
  },
});
