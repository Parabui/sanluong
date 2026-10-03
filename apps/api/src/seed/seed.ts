/**
 * Dữ liệu khởi tạo — chạy lại bao nhiêu lần cũng được (chỉ THÊM phần còn thiếu, không ghi đè thay đổi của Superadmin):
 *   1. QuyenVaiTro: đủ 8 vai trò × 17 chức năng, giá trị mặc định từ QUYEN_MAC_DINH (PRD F8)
 *   2. CauHinh: giá trị mặc định từ CAU_HINH_MAC_DINH
 *   3. Superadmin đầu tiên (chỉ khi CHƯA có Superadmin nào) — mật khẩu tạm, bắt buộc đổi ở lần đăng nhập đầu
 */
import { CAU_HINH_MAC_DINH, CHUC_NANG, QUYEN_MAC_DINH, VAI_TRO, zMatKhauMoi, zTenDangNhap } from '@vsn/shared';
import { hash } from 'bcryptjs';
import type { PrismaClient } from '../generated/prisma/client.js';
import { BCRYPT_COST } from '../modules/auth/auth.service.js';

export interface KetQuaSeed {
  quyenThem: number;
  cauHinhThem: number;
  superadmin: 'DA_TAO' | 'DA_CO' | 'THIEU_BIEN_MOI_TRUONG';
}

export async function chaySeed(
  prisma: PrismaClient,
  env: { VSN_SUPERADMIN_TEN?: string; VSN_SUPERADMIN_MAT_KHAU_TAM?: string; VSN_SUPERADMIN_HO_TEN?: string },
): Promise<KetQuaSeed> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('vsn.nguoi_thuc_hien', 'HE_THONG', true)`;

    const quyen = await tx.quyenVaiTro.createMany({
      data: VAI_TRO.flatMap((vaiTro) =>
        CHUC_NANG.map((chucNang) => ({ vaiTro, chucNang, batTat: QUYEN_MAC_DINH[chucNang].includes(vaiTro) })),
      ),
      skipDuplicates: true,
    });

    const cauHinh = await tx.cauHinh.createMany({
      data: Object.entries(CAU_HINH_MAC_DINH).map(([khoa, giaTri]) => ({ khoa, giaTri })),
      skipDuplicates: true,
    });

    let superadmin: KetQuaSeed['superadmin'] = 'DA_CO';
    if (!(await tx.taiKhoan.count({ where: { vaiTro: 'SUPERADMIN' } }))) {
      if (!env.VSN_SUPERADMIN_TEN || !env.VSN_SUPERADMIN_MAT_KHAU_TAM) {
        superadmin = 'THIEU_BIEN_MOI_TRUONG';
      } else {
        const tenDangNhap = zTenDangNhap.parse(env.VSN_SUPERADMIN_TEN);
        const matKhau = zMatKhauMoi.parse(env.VSN_SUPERADMIN_MAT_KHAU_TAM);
        const tk = await tx.taiKhoan.create({
          data: {
            tenDangNhap,
            hoTen: env.VSN_SUPERADMIN_HO_TEN?.trim() || 'Superadmin',
            matKhauHash: await hash(matKhau, BCRYPT_COST),
            vaiTro: 'SUPERADMIN',
            phaiDoiMatKhau: true,
          },
        });
        await tx.auditLog.create({
          data: { loaiNguoiThucHien: 'HE_THONG', hanhDong: 'TAO_TAI_KHOAN', doiTuong: 'tai_khoan', doiTuongId: tk.id, duLieuMoi: { tenDangNhap, vaiTro: 'SUPERADMIN' }, lyDo: 'Seed' },
        });
        superadmin = 'DA_TAO';
      }
    }

    if (quyen.count || cauHinh.count) {
      await tx.auditLog.create({
        data: { loaiNguoiThucHien: 'HE_THONG', hanhDong: 'SEED', doiTuong: 'he_thong', duLieuMoi: { quyenThem: quyen.count, cauHinhThem: cauHinh.count } },
      });
    }
    return { quyenThem: quyen.count, cauHinhThem: cauHinh.count, superadmin };
  });
}
