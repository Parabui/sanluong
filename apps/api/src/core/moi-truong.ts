/**
 * Biến môi trường — đọc và kiểm tra MỘT lần bằng Zod. Thiếu/sai → dừng khởi động ngay.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const MOI_TRUONG = Symbol('MOI_TRUONG');

const zMoiTruong = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL (xem .env.example)'),
  // Pool kết nối [D25]: không dựa vào mặc định
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_POOL_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  APP_VERSION: z.string().default('0.0.0-dev'),
  /** Cloudflare Turnstile [D23]. Dev/test để trống → bỏ qua xác minh; production BẮT BUỘC có */
  TURNSTILE_SECRET: z.string().optional(),
  /** Token cho Uptime Kuma gọi /api/health/chi-tiet (header X-Uptime-Token) [D24]; trống → chỉ Superadmin xem được */
  UPTIME_TOKEN: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16, 'UPTIME_TOKEN tối thiểu 16 ký tự').optional()),
  /** Sentry DSN của API [TDD 18]; trống → không gửi lỗi */
  SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  /** Chỉ E2E trên http://localhost đặt "false" (xem core/phien/cookie.ts); production bắt buộc Secure */
  COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
}).refine((e) => e.NODE_ENV !== 'production' || e.COOKIE_SECURE === 'true', { message: 'Production không được tắt cookie Secure', path: ['COOKIE_SECURE'] });

export type MoiTruong = z.infer<typeof zMoiTruong>;

export function docMoiTruong(env: NodeJS.ProcessEnv = process.env): MoiTruong {
  const kq = zMoiTruong.safeParse(env);
  if (!kq.success) {
    const loi = kq.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Biến môi trường không hợp lệ:\n${loi}`);
  }
  return kq.data;
}

/** Dev: nạp `.env` ở gốc repo (production do docker compose cấp biến môi trường). */
export function napEnvDev(): void {
  if (process.env['NODE_ENV'] === 'production') return;
  for (const f of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(f)) {
      process.loadEnvFile(f);
      return;
    }
  }
}
