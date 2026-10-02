import { defineConfig } from 'vitest/config';

// Test đơn vị: không cần DB. Test nghiệp vụ dùng DB thật → vitest.int.config.ts [D13]
export default defineConfig({
  oxc: {
    // NestJS cần decorator kiểu cũ + metadata kiểu tham số để DI hoạt động
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Prisma kết nối lười → test đơn vị không chạm DB
      DATABASE_URL: 'postgresql://khong-dung:khong-dung@127.0.0.1:1/khong_dung',
    },
  },
});
