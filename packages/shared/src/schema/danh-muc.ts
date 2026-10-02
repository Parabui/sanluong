/** Danh mục Xưởng – Chuyền/Nhóm – Trạm · F9 */
import { z } from 'zod';
import { zUuid } from './co-ban.js';

export const TRANG_THAI = ['HOAT_DONG', 'NGUNG'] as const;
export type TrangThai = (typeof TRANG_THAI)[number];
export const TEN_TRANG_THAI: Record<TrangThai, string> = { HOAT_DONG: 'Hoạt động', NGUNG: 'Ngưng' };

export const LOAI_CHUYEN = ['CHUYEN_MAY', 'VONG_NGOAI'] as const;
export type LoaiChuyen = (typeof LOAI_CHUYEN)[number];
export const TEN_LOAI_CHUYEN: Record<LoaiChuyen, string> = { CHUYEN_MAY: 'Chuyền may', VONG_NGOAI: 'Vòng ngoài' };

/** Trạm nhập qua app trong MVP: 26–41 (chuyền chi tiết) + 12 (QC) + 25 (Ủi) — PRD ① */
export const TRAM_NHAP_QUA_APP_MVP: readonly number[] = [12, 25, ...Array.from({ length: 16 }, (_, i) => 26 + i)];
export const SO_TRAM_TOI_DA = 99;

/** Mã xưởng / chuyền: trim + viết hoa; chữ, số, gạch ngang, gạch dưới */
export const zMaDanhMuc = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Nhập mã.')
  .max(20, 'Mã tối đa 20 ký tự.')
  .regex(/^[A-Z0-9_-]+$/, 'Mã chỉ gồm chữ không dấu, số, "-" và "_".');
export const zTenDanhMuc = z.string().trim().min(1, 'Nhập tên.').max(100, 'Tên tối đa 100 ký tự.');
const zVersion = z.number().int().min(0);
/** Thao tác có cảnh báo: lần đầu gửi false → nhận 409 CAN_XAC_NHAN kèm cảnh báo; xác nhận thì gửi true */
const zXacNhan = z.boolean().default(false);

// ── Xưởng ──
export const zXuong = z.object({
  id: z.string(),
  ma: z.string(),
  ten: z.string(),
  trangThai: z.enum(TRANG_THAI),
  version: z.number().int(),
  soChuyen: z.number().int(),
});
export type Xuong = z.infer<typeof zXuong>;

export const zTaoXuong = z.object({ ma: zMaDanhMuc, ten: zTenDanhMuc });
export type TaoXuong = z.infer<typeof zTaoXuong>;

export const zSuaXuong = z.object({
  ma: zMaDanhMuc.optional(),
  ten: zTenDanhMuc.optional(),
  trangThai: z.enum(TRANG_THAI).optional(),
  version: zVersion,
  xacNhan: zXacNhan,
});
export type SuaXuong = z.input<typeof zSuaXuong>;

// ── Chuyền / nhóm ──
export const zChuyen = z.object({
  id: z.string(),
  ma: z.string(),
  ten: z.string(),
  loai: z.enum(LOAI_CHUYEN),
  xuongId: z.string(),
  trangThai: z.enum(TRANG_THAI),
  version: z.number().int(),
  soTram: z.number().int(),
  soTramApp: z.number().int(),
});
export type Chuyen = z.infer<typeof zChuyen>;

export const zTaoChuyen = z
  .object({
    ma: zMaDanhMuc,
    ten: zTenDanhMuc,
    loai: z.enum(LOAI_CHUYEN),
    xuongId: zUuid,
    soTram: z
      .number({ message: 'Nhập số trạm.' })
      .int('Số trạm là số nguyên.')
      .min(0, 'Số trạm không được âm.')
      .max(SO_TRAM_TOI_DA, `Tối đa ${SO_TRAM_TOI_DA} trạm.`),
  })
  .refine((c) => c.loai !== 'CHUYEN_MAY' || c.soTram >= 1, {
    path: ['soTram'],
    message: 'Chuyền may phải có ít nhất 1 trạm.',
  });
export type TaoChuyen = z.infer<typeof zTaoChuyen>;

export const zSuaChuyen = z.object({
  ma: zMaDanhMuc.optional(),
  ten: zTenDanhMuc.optional(),
  loai: z.enum(LOAI_CHUYEN).optional(),
  trangThai: z.enum(TRANG_THAI).optional(),
  version: zVersion,
  xacNhan: zXacNhan,
});
export type SuaChuyen = z.input<typeof zSuaChuyen>;

// ── Trạm ──
export const zTram = z.object({
  /** Mã định danh cố định — nội dung QR (F12) */
  id: z.string(),
  chuyenId: z.string(),
  soTram: z.number().int(),
  nhapQuaApp: z.boolean(),
  trangThai: z.enum(TRANG_THAI),
  version: z.number().int(),
  /** Đang có công đoạn gán (sơ đồ hiện hành) */
  coCongDoanGan: z.boolean(),
  /** Mã NV đang đăng nhập hôm nay, nếu có */
  maNVDangDangNhap: z.string().nullable(),
});
export type Tram = z.infer<typeof zTram>;

export const zSuaTram = z.object({
  nhapQuaApp: z.boolean().optional(),
  trangThai: z.enum(TRANG_THAI).optional(),
  version: zVersion,
  xacNhan: zXacNhan,
});
export type SuaTram = z.input<typeof zSuaTram>;

/** Chi tiết cảnh báo trả kèm 409 CAN_XAC_NHAN */
export const zCanhBaoXacNhan = z.object({
  canhBao: z.string(),
  danhSach: z.array(z.string()).default([]),
});
export type CanhBaoXacNhan = z.infer<typeof zCanhBaoXacNhan>;
