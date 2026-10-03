/**
 * `pnpm --filter @vsn/api db:seed` (dev) · `node dist/seed/main.js` (production, sau `prisma migrate deploy`).
 * Kết nối bằng DATABASE_URL (vsn_app). Superadmin đầu tiên lấy từ VSN_SUPERADMIN_TEN / VSN_SUPERADMIN_MAT_KHAU_TAM.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { docMoiTruong, napEnvDev } from '../core/moi-truong.js';
import { chaySeed } from './seed.js';

napEnvDev();
const env = docMoiTruong();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 1 }) });

try {
  const kq = await chaySeed(prisma, process.env);
  console.log(`Seed xong: +${kq.quyenThem} quyền, +${kq.cauHinhThem} cấu hình.`);
  if (kq.superadmin === 'DA_TAO') {
    console.log(`Đã tạo Superadmin "${process.env['VSN_SUPERADMIN_TEN']}" — đăng nhập rồi đổi mật khẩu tạm ngay.`);
  } else if (kq.superadmin === 'THIEU_BIEN_MOI_TRUONG') {
    console.warn('Chưa có Superadmin: đặt VSN_SUPERADMIN_TEN và VSN_SUPERADMIN_MAT_KHAU_TAM trong .env rồi chạy lại.');
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
