/** Xác thực Web/TV — phiên lưu ở server [D6] [TDD 9.2] · F8 */
import { z } from 'zod';
import { CHUC_NANG, VAI_TRO } from '../chuc-nang.js';
import { zPhamVi } from '../pham-vi.js';

/** Tên đăng nhập: trim + chữ thường (so khớp không phân biệt hoa/thường) */
export const zTenDangNhap = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Nhập tên đăng nhập.')
  .max(64, 'Tên đăng nhập tối đa 64 ký tự.');

/** POST /api/auth/dang-nhap */
export const zDangNhap = z.object({
  tenDangNhap: zTenDangNhap,
  matKhau: z.string().min(1, 'Nhập mật khẩu.').max(128),
});
export type DangNhap = z.infer<typeof zDangNhap>;

/** Quy tắc mật khẩu mới (theo màn Đổi mật khẩu của ui-demo). bcrypt chỉ dùng 72 byte đầu */
export const QUY_TAC_MAT_KHAU = [
  { ma: 'DO_DAI', moTa: 'Ít nhất 8 ký tự', kiemTra: (mk: string) => mk.length >= 8 },
  { ma: 'CHU_SO', moTa: 'Có cả chữ và số', kiemTra: (mk: string) => /[A-Za-z]/.test(mk) && /\d/.test(mk) },
] as const;

export const zMatKhauMoi = z
  .string()
  .max(72, 'Mật khẩu tối đa 72 ký tự.')
  .superRefine((mk, ctx) => {
    for (const q of QUY_TAC_MAT_KHAU) if (!q.kiemTra(mk)) ctx.addIssue({ code: 'custom', message: q.moTa });
  });

/** POST /api/auth/doi-mat-khau */
export const zDoiMatKhau = z
  .object({
    matKhauHienTai: z.string().min(1, 'Nhập mật khẩu hiện tại.').max(128),
    matKhauMoi: zMatKhauMoi,
  })
  .refine((d) => d.matKhauMoi !== d.matKhauHienTai, {
    path: ['matKhauMoi'],
    message: 'Khác mật khẩu hiện tại',
  });
export type DoiMatKhau = z.infer<typeof zDoiMatKhau>;

/** GET /api/auth/toi — dùng để ẩn/hiện menu; server vẫn kiểm tra lại mọi API [TDD 14.3] */
export const zTaiKhoanToi = z.object({
  id: z.string(),
  tenDangNhap: z.string(),
  hoTen: z.string(),
  vaiTro: z.enum(VAI_TRO),
  chucNang: z.array(z.enum(CHUC_NANG)),
  phamVi: zPhamVi,
  /** Hiển thị: "Toàn nhà máy" | "C05, C06" | "Xưởng May 1" */
  tenPhamVi: z.string(),
  phaiDoiMatKhau: z.boolean(),
  /** Ngày làm việc hiện tại do SERVER tính — frontend không tự tính 'hôm nay' [D5] */
  homNay: z.string(),
});
export type TaiKhoanToi = z.infer<typeof zTaiKhoanToi>;

export const zKhongNoiDung = z.undefined();
