/**
 * Lối thoát khi Superadmin DUY NHẤT quên mật khẩu / bị khóa (RUNBOOK "Mở khóa tài khoản · đặt lại mật khẩu").
 * Tài khoản khác → Superadmin đặt lại trên Web (F8), không dùng lệnh này.
 *   read -rsp 'Mật khẩu tạm: ' VSN_MAT_KHAU_TAM; export VSN_MAT_KHAU_TAM
 *   docker compose -f infra/compose.prod.yml --env-file .env run --rm --no-deps -T -e VSN_MAT_KHAU_TAM api \
 *     node dist/seed/dat-lai-superadmin.js <tên đăng nhập>
 * Giống thao tác "Đặt lại mật khẩu" trên Web: mật khẩu tạm (bắt buộc đổi ở lần đăng nhập sau) · mở khóa sai mật khẩu ·
 * thu hồi mọi phiên · audit DAT_LAI_MAT_KHAU (HE_THONG) trong cùng transaction. Mật khẩu đọc từ biến môi trường, không qua argv.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { zMatKhauMoi, zTenDangNhap } from '@vsn/shared';
import { PrismaClient } from '../generated/prisma/client.js';
import { docMoiTruong, napEnvDev } from '../core/moi-truong.js';
import { BCRYPT_COST } from '../modules/auth/auth.service.js';

napEnvDev();
const env = docMoiTruong();
const ten = zTenDangNhap.safeParse(process.argv[2]);
const mk = zMatKhauMoi.safeParse(process.env['VSN_MAT_KHAU_TAM'] ?? '');
if (!ten.success) {
  console.error('Dùng: node dist/seed/dat-lai-superadmin.js <tên đăng nhập Superadmin>');
  process.exit(2);
}
if (!mk.success) {
  console.error(`VSN_MAT_KHAU_TAM chưa hợp lệ: ${mk.error.issues.map((i) => i.message).join(' ')}`);
  process.exit(2);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: 1 }) });
try {
  const matKhauHash = await hash(mk.data, BCRYPT_COST);
  const kq = await prisma.$transaction(async (tx) => {
    const tk = await tx.taiKhoan.findUnique({ where: { tenDangNhap: ten.data }, select: { id: true, vaiTro: true } });
    if (!tk) return 'KHONG_CO' as const;
    if (tk.vaiTro !== 'SUPERADMIN') return 'KHONG_PHAI_SA' as const;
    await tx.taiKhoan.update({
      where: { id: tk.id },
      data: { matKhauHash, phaiDoiMatKhau: true, soLanSai: 0, khoaDen: null, version: { increment: 1 } },
    });
    const { count } = await tx.phienDangNhap.deleteMany({ where: { taiKhoanId: tk.id } });
    await tx.auditLog.create({
      data: {
        loaiNguoiThucHien: 'HE_THONG', hanhDong: 'DAT_LAI_MAT_KHAU', doiTuong: 'tai_khoan', doiTuongId: tk.id,
        duLieuMoi: { soPhienThuHoi: count }, lyDo: 'RUNBOOK: Superadmin mất mật khẩu (lệnh trên server)',
      },
    });
    return 'DA_DAT_LAI' as const;
  });
  if (kq === 'KHONG_CO') { console.error(`Không có tài khoản "${ten.data}"`); process.exitCode = 1; }
  else if (kq === 'KHONG_PHAI_SA') { console.error(`"${ten.data}" không phải Superadmin — đặt lại trên Web (Hệ thống → Tài khoản)`); process.exitCode = 1; }
  else console.log(`Đã đặt lại mật khẩu tạm cho "${ten.data}" — đăng nhập và đổi mật khẩu ngay.`);
} finally {
  await prisma.$disconnect();
}
