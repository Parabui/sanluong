/** Tài khoản & phân quyền Web · F8 */
import { z } from 'zod';
import { CHUC_NANG, PHAM_VI_CUA_VAI_TRO, VAI_TRO } from '../chuc-nang.js';
import { zUuid } from './co-ban.js';
import { TRANG_THAI } from './danh-muc.js';
import { zMatKhauMoi, zTenDangNhap } from './auth.js';
import { zHoTen } from './nhan-vien.js';

export const zTaiKhoan = z.object({
  id: z.string(),
  tenDangNhap: z.string(),
  hoTen: z.string(),
  vaiTro: z.enum(VAI_TRO),
  trangThai: z.enum(TRANG_THAI),
  chuyenIds: z.array(z.string()),
  xuongIds: z.array(z.string()),
  tenPhamVi: z.string(),
  /** Lần đăng nhập thành công gần nhất (ISO), null = chưa đăng nhập */
  lanDangNhapCuoi: z.string().nullable(),
  /** Đang bị khóa do sai mật khẩu 5 lần (ISO), null = không khóa */
  khoaDen: z.string().nullable(),
  phaiDoiMatKhau: z.boolean(),
  version: z.number().int(),
});
export type TaiKhoan = z.infer<typeof zTaiKhoan>;

/** Tên đăng nhập mới: chữ thường không dấu, số, ".", "-", "_" */
const zTenDangNhapMoi = zTenDangNhap.pipe(
  z.string().regex(/^[a-z0-9._-]+$/, 'Tên đăng nhập chỉ gồm chữ không dấu, số, ".", "-", "_".'),
);

/**
 * Tổ trưởng phải gắn ≥ 1 chuyền; Quản lý xưởng ≥ 1 xưởng; vai trò khác không gắn phạm vi [R 1.5].
 * Dùng cho cả tạo và sửa (khi gửi vai trò / phạm vi).
 */
export function kiemTraPhamVi(
  d: { vaiTro?: (typeof VAI_TRO)[number]; chuyenIds?: string[]; xuongIds?: string[] },
  ctx: z.RefinementCtx,
): void {
  if (!d.vaiTro) return;
  const pv = PHAM_VI_CUA_VAI_TRO[d.vaiTro];
  if (pv === 'CHUYEN' && !d.chuyenIds?.length) {
    ctx.addIssue({ code: 'custom', path: ['chuyenIds'], message: 'Phải gắn ít nhất 1 chuyền.' });
  }
  if (pv === 'XUONG' && !d.xuongIds?.length) {
    ctx.addIssue({ code: 'custom', path: ['xuongIds'], message: 'Phải gắn ít nhất 1 xưởng.' });
  }
}

/** POST /api/tai-khoan */
export const zTaoTaiKhoan = z
  .object({
    tenDangNhap: zTenDangNhapMoi,
    hoTen: zHoTen,
    matKhauTam: zMatKhauMoi,
    vaiTro: z.enum(VAI_TRO),
    chuyenIds: z.array(zUuid).default([]),
    xuongIds: z.array(zUuid).default([]),
  })
  .superRefine(kiemTraPhamVi);
export type TaoTaiKhoan = z.input<typeof zTaoTaiKhoan>;

/** PATCH /api/tai-khoan/:id — gửi vai trò thì phải gửi kèm phạm vi tương ứng */
export const zSuaTaiKhoan = z
  .object({
    hoTen: zHoTen.optional(),
    vaiTro: z.enum(VAI_TRO).optional(),
    chuyenIds: z.array(zUuid).optional(),
    xuongIds: z.array(zUuid).optional(),
    trangThai: z.enum(TRANG_THAI).optional(),
    version: z.number().int().min(0),
  })
  .superRefine(kiemTraPhamVi);
export type SuaTaiKhoan = z.input<typeof zSuaTaiKhoan>;

/** POST /api/tai-khoan/:id/dat-lai-mat-khau */
export const zDatLaiMatKhau = z.object({ matKhauTam: zMatKhauMoi });
export type DatLaiMatKhau = z.infer<typeof zDatLaiMatKhau>;

// ── Ma trận quyền ──
export const zOQuyen = z.object({
  vaiTro: z.enum(VAI_TRO),
  chucNang: z.enum(CHUC_NANG),
  batTat: z.boolean(),
});
export type OQuyen = z.infer<typeof zOQuyen>;

/** PUT /api/quyen-vai-tro — chỉ gửi các ô thay đổi */
export const zSuaQuyen = z.object({ thayDoi: z.array(zOQuyen).min(1, 'Chưa có thay đổi.') });
export type SuaQuyen = z.infer<typeof zSuaQuyen>;
