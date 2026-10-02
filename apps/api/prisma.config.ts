import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Dev: đọc .env ở gốc repo. Production: biến môi trường do docker compose cấp.
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../.env'));
} catch {
  /* không có .env → dùng biến môi trường sẵn có */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migration chạy bằng tài khoản vsn_migrate (chủ schema, có DDL) [D9]
  datasource: { url: process.env['MIGRATE_DATABASE_URL'] },
});
