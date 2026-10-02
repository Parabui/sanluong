#!/usr/bin/env node
/**
 * Dựng môi trường THỬ (DB riêng trong infra/compose.thu.yml) cho đo hiệu năng và E2E — không đụng DB dev.
 *   node tools/thu/chay.mjs perf        → DB perf (5434): migrate + seed cơ bản + seed:perf (12 tháng)
 *   node tools/thu/chay.mjs e2e         → DB e2e (5435): migrate + seed cơ bản + dữ liệu E2E (apps/api/src/seed/e2e.ts)
 *   node tools/thu/chay.mjs api <perf|e2e> [cổng]  → chạy API đã build (apps/api/dist) trỏ vào DB đó (mặc định cổng 4100)
 * Chạy bằng node (không qua shell) để giống nhau trên Windows và CI.
 */
import { execFileSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const API = resolve(GOC, 'apps/api');
const DB = {
  perf: { dichVu: 'postgres-perf', cong: 5434 },
  e2e: { dichVu: 'postgres-e2e', cong: 5435 },
};
const url = (ten, tk, mk) => `postgresql://${tk}:${mk}@127.0.0.1:${DB[ten].cong}/vsn_sanluong`;
const envDb = (ten) => ({
  ...process.env,
  DATABASE_URL: url(ten, 'vsn_app', 'thu-app'),
  MIGRATE_DATABASE_URL: url(ten, 'vsn_migrate', 'thu-migrate'),
  PERF_MIGRATE_URL: url(ten, 'vsn_migrate', 'thu-migrate'),
  E2E_MIGRATE_URL: url(ten, 'vsn_migrate', 'thu-migrate'),
});
const chay = (lenh, thamSo, tc = {}) => execFileSync(lenh, thamSo, { stdio: 'inherit', cwd: GOC, ...tc });
const PRISMA = resolve(API, 'node_modules/prisma/build/index.js');

const [lenh, a, b] = process.argv.slice(2);
if (lenh === 'perf' || lenh === 'e2e') {
  // E2E: luôn bắt đầu từ DB trống (container tmpfs tạo lại)
  if (lenh === 'e2e') chay('docker', ['compose', '-f', 'infra/compose.thu.yml', 'rm', '-sf', DB.e2e.dichVu]);
  chay('docker', ['compose', '-f', 'infra/compose.thu.yml', 'up', '-d', '--wait', DB[lenh].dichVu]);
  const env = envDb(lenh);
  chay(process.execPath, [PRISMA, 'migrate', 'deploy'], { cwd: API, env });
  chay(process.execPath, ['dist/seed/main.js'], {
    cwd: API,
    env: { ...env, VSN_SUPERADMIN_TEN: `${lenh}.admin`, VSN_SUPERADMIN_HO_TEN: `Admin ${lenh}`, VSN_SUPERADMIN_MAT_KHAU_TAM: `Thu${lenh}12345` },
  });
  chay(process.execPath, [`dist/seed/${lenh}.js`], { cwd: API, env });
} else if (lenh === 'api') {
  const env = { ...envDb(a), NODE_ENV: 'development', API_PORT: b ?? '4100', LOG_LEVEL: process.env['LOG_LEVEL'] ?? 'warn', ...(a === 'e2e' ? { COOKIE_SECURE: 'false' } : {}) };
  const p = spawn(process.execPath, ['dist/main.js'], { cwd: API, env, stdio: 'inherit' });
  p.on('exit', (c) => process.exit(c ?? 0));
} else {
  console.error('Dùng: node tools/thu/chay.mjs perf | e2e | api <perf|e2e> [cổng]');
  process.exit(2);
}
