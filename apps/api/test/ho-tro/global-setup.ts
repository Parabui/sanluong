/**
 * Global setup cho test tích hợp [D13] [TDD 16]:
 *   1. PostgreSQL 17 thật qua Testcontainers, chạy CHÍNH script tạo tài khoản của infra (3 tài khoản [D9])
 *   2. `prisma migrate deploy` bằng tài khoản vsn_migrate — migration thật, giống bước deploy
 *   3. Cấp URL kết nối cho các file test qua `inject()`
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

const GOC_API = resolve(import.meta.dirname, '../..');
const THU_MUC_INIT = resolve(GOC_API, '../../infra/postgres/init');
const PRISMA_CLI = createRequire(import.meta.url).resolve('prisma/build/index.js');

const MAT_KHAU = {
  postgres: 'test-postgres',
  vsn_app: 'test-app',
  vsn_migrate: 'test-migrate',
  vsn_backup: 'test-backup',
} as const;

export type TaiKhoanDb = keyof typeof MAT_KHAU;

declare module 'vitest' {
  export interface ProvidedContext {
    urlDb: Record<TaiKhoanDb, string>;
  }
}

let container: StartedPostgreSqlContainer | undefined;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  container = await new PostgreSqlContainer('postgres:17')
    .withDatabase('vsn_sanluong')
    .withUsername('postgres')
    .withPassword(MAT_KHAU.postgres)
    .withEnvironment({
      TZ: 'Asia/Ho_Chi_Minh',
      PGTZ: 'Asia/Ho_Chi_Minh',
      VSN_APP_PASSWORD: MAT_KHAU.vsn_app,
      VSN_MIGRATE_PASSWORD: MAT_KHAU.vsn_migrate,
      VSN_BACKUP_PASSWORD: MAT_KHAU.vsn_backup,
    })
    .withCopyDirectoriesToContainer([{ source: THU_MUC_INIT, target: '/docker-entrypoint-initdb.d' }])
    .start();

  const url = (tk: TaiKhoanDb) =>
    `postgresql://${tk}:${MAT_KHAU[tk]}@${container!.getHost()}:${container!.getPort()}/vsn_sanluong`;

  // Gọi thẳng Prisma CLI bằng node (không qua shell — chạy giống nhau trên Windows và CI)
  const prisma = (...thamSo: string[]) =>
    execFileSync(process.execPath, [PRISMA_CLI, ...thamSo], {
      cwd: GOC_API,
      env: { ...process.env, MIGRATE_DATABASE_URL: url('vsn_migrate') },
      stdio: 'pipe',
    });
  prisma('migrate', 'deploy');
  // schema.prisma phải khớp DB sau migration — sửa schema mà quên tạo migration thì dừng ở đây (exit code 2)
  try {
    prisma('migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code');
  } catch (e) {
    await container.stop();
    const out = (e as { stdout?: Buffer }).stdout?.toString() ?? '';
    throw new Error(`schema.prisma lệch với migration — chạy \`pnpm --filter @vsn/api db:migrate\`:\n${out}`, {
      cause: e,
    });
  }

  project.provide('urlDb', {
    postgres: url('postgres'),
    vsn_app: url('vsn_app'),
    vsn_migrate: url('vsn_migrate'),
    vsn_backup: url('vsn_backup'),
  });

  return async () => {
    await container?.stop();
  };
}
