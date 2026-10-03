/**
 * Playwright E2E [TDD 16.1, 16.3] — Chromium + WebKit, viewport iPhone / Android và 1366×768.
 *   pnpm e2e        (dựng DB E2E mới trên cổng 5435, API 4200, worker 4174, web 4173 — không đụng môi trường dev)
 * Mỗi project dùng 1 bộ dữ liệu riêng (metadata.k = 1..4, xem apps/api/src/seed/e2e.ts) nên chạy song song không giẫm nhau.
 */
import { defineConfig, devices } from '@playwright/test';

const API = 'http://127.0.0.1:4200';
const WORKER = 'http://localhost:4174';
const WEB = 'http://localhost:4173';
const MAN_HINH_WEB = { width: 1366, height: 768 };

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 4,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [
    { name: 'cong-nhan-iphone', testDir: 'apps/worker/e2e', use: { ...devices['iPhone 13'], baseURL: WORKER }, metadata: { k: 1 } },
    { name: 'cong-nhan-android', testDir: 'apps/worker/e2e', use: { ...devices['Pixel 7'], baseURL: WORKER }, metadata: { k: 2 } },
    { name: 'quan-ly-chromium', testDir: 'apps/web/e2e', use: { ...devices['Desktop Chrome'], viewport: MAN_HINH_WEB, baseURL: WEB }, metadata: { k: 3 } },
    { name: 'quan-ly-webkit', testDir: 'apps/web/e2e', use: { ...devices['Desktop Safari'], viewport: MAN_HINH_WEB, baseURL: WEB }, metadata: { k: 4 } },
  ],
  webServer: [
    {
      // DB E2E mới (tmpfs) → migrate → seed → API trỏ vào DB đó
      command: 'node tools/thu/chay.mjs e2e && node tools/thu/chay.mjs api e2e 4200',
      url: `${API}/api/health`,
      timeout: 240_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @vsn/worker exec vite --port 4174 --strictPort',
      url: WORKER,
      env: { VSN_API_PROXY: API },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @vsn/web exec vite --port 4173 --strictPort',
      url: `${WEB}/quanly/`,
      env: { VSN_API_PROXY: API },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
