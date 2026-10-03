/**
 * Dựng app NestJS THẬT (AppModule đầy đủ) trỏ vào PostgreSQL của Testcontainers, kết nối bằng vsn_app.
 * Dữ liệu API test được COMMIT thật → mọi mã/tên đăng nhập đều sinh ngẫu nhiên để các file test không đụng nhau.
 */
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { COOKIE_PHIEN, HEADER_CLIENT, type VaiTro } from '@vsn/shared';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { inject } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { cauHinhApp } from '../../src/cau-hinh-app.js';
import { ClockService } from '../../src/core/clock/clock.service.js';
import { PrismaService } from '../../src/core/prisma/prisma.service.js';
import { QuyenService } from '../../src/core/quyen/quyen.service.js';
import { chaySeed } from '../../src/seed/seed.js';

export const MAT_KHAU_TEST = 'MatKhau123';
let hashMatKhau: Promise<string> | undefined;

export const ngauNhien = (tienTo = '') => `${tienTo}${randomBytes(4).toString('hex')}`.toUpperCase();

export interface AppTest {
  app: INestApplication;
  prisma: PrismaService;
  quyen: QuyenService;
  http: () => ReturnType<typeof request>;
  dong: () => Promise<void>;
}

export async function taoAppTest(tuyChon: { clock?: ClockService } = {}): Promise<AppTest> {
  process.env['DATABASE_URL'] = inject('urlDb').vsn_app;
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (tuyChon.clock) builder.overrideProvider(ClockService).useValue(tuyChon.clock);
  const ref = await builder.compile();
  const app = cauHinhApp(ref.createNestApplication<NestExpressApplication>({ logger: false }));
  await app.init();
  const prisma = app.get(PrismaService);
  await chaySeed(prisma, {});
  return {
    app,
    prisma,
    quyen: app.get(QuyenService),
    http: () => request(app.getHttpServer()),
    dong: () => app.close(),
  };
}

export interface TaiKhoanTest {
  id: string;
  tenDangNhap: string;
  hoTen: string;
}

export async function taoTaiKhoan(
  t: AppTest,
  tc: { vaiTro: VaiTro; phaiDoiMatKhau?: boolean; chuyenIds?: string[]; xuongIds?: string[]; trangThai?: 'HOAT_DONG' | 'NGUNG' },
): Promise<TaiKhoanTest> {
  hashMatKhau ??= hash(MAT_KHAU_TEST, 4); // cost thấp cho test; luồng thật dùng cost 12
  const tenDangNhap = ngauNhien('tk.').toLowerCase();
  const hoTen = `Người thử ${tenDangNhap}`;
  const tk = await t.prisma.taiKhoan.create({
    data: {
      tenDangNhap,
      hoTen,
      matKhauHash: await hashMatKhau,
      vaiTro: tc.vaiTro,
      phaiDoiMatKhau: tc.phaiDoiMatKhau ?? false,
      trangThai: tc.trangThai ?? 'HOAT_DONG',
      taiKhoanChuyen: tc.chuyenIds ? { create: tc.chuyenIds.map((chuyenId) => ({ chuyenId })) } : undefined,
      taiKhoanXuong: tc.xuongIds ? { create: tc.xuongIds.map((xuongId) => ({ xuongId })) } : undefined,
    },
  });
  return { id: tk.id, tenDangNhap, hoTen };
}

/** Đăng nhập → chuỗi Cookie để gửi kèm request sau */
export async function dangNhap(t: AppTest, tenDangNhap: string, matKhau = MAT_KHAU_TEST): Promise<string> {
  const res = await t.http().post('/api/auth/dang-nhap').set(HEADER_CLIENT, 'web').send({ tenDangNhap, matKhau });
  if (res.status !== 200) throw new Error(`Đăng nhập ${tenDangNhap} thất bại: ${res.status} ${JSON.stringify(res.body)}`);
  return layCookie(res.headers['set-cookie']);
}

export function layCookie(setCookie: string | string[] | undefined): string {
  const ds = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const dong = ds.find((c) => c.startsWith(`${COOKIE_PHIEN}=`));
  if (!dong) throw new Error('Không có cookie phiên');
  return dong.split(';')[0]!;
}

/** Tài khoản + đăng nhập sẵn */
export async function taoVaDangNhap(t: AppTest, tc: Parameters<typeof taoTaiKhoan>[1]) {
  const tk = await taoTaiKhoan(t, tc);
  return { ...tk, cookie: await dangNhap(t, tk.tenDangNhap) };
}

/** Xưởng + chuyền (+ N trạm) tạo thẳng bằng Prisma — dữ liệu nền cho test */
export async function taoChuyenNhanh(t: AppTest, tc: { soTram?: number; xuongId?: string } = {}) {
  const xuongId = tc.xuongId ?? (await t.prisma.xuong.create({ data: { ma: ngauNhien('X'), ten: 'Xưởng thử' } })).id;
  const chuyen = await t.prisma.chuyen.create({
    data: {
      ma: ngauNhien('C'),
      ten: 'Chuyền thử',
      loai: 'CHUYEN_MAY',
      xuongId,
      tram: { create: Array.from({ length: tc.soTram ?? 2 }, (_, i) => ({ soTram: i + 1, nhapQuaApp: true })) },
    },
    include: { tram: { orderBy: { soTram: 'asc' } } },
  });
  return { xuongId, chuyen };
}
