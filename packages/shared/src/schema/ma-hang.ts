/** Mã hàng, công đoạn, lịch sử SMV · F3 [R 5.5] */
import { z } from 'zod';
import { zNgayLamViec } from './co-ban.js';
import { TRANG_THAI, zMaDanhMuc, zTenDanhMuc } from './danh-muc.js';

/**
 * SMV ban đầu của công đoạn "áp dụng từ đầu" — mọi bản ghi (kể cả nhập lùi ngày) đều có SMV.
 * Ngày mốc này chỉ dùng nội bộ; giao diện hiển thị "Từ đầu".
 */
export const NGAY_SMV_TU_DAU = '2000-01-01';

/** SMV: giây / 1 sản phẩm, > 0, tối đa 3 chữ số thập phân (khớp cột Decimal(10,3)) */
export const zSmv = z
  .number({ message: 'Nhập SMV.' })
  .positive('SMV phải lớn hơn 0.')
  .max(99_999, 'SMV quá lớn.')
  .refine((v) => Math.round(v * 1000) === v * 1000, 'SMV tối đa 3 chữ số thập phân.');

export const TRANG_THAI_MA_HANG = ['SAP_CHAY', 'DANG_CHAY', 'DA_KET_THUC'] as const;
export type TrangThaiMaHang = (typeof TRANG_THAI_MA_HANG)[number];
export const TEN_TRANG_THAI_MA_HANG: Record<TrangThaiMaHang, string> = {
  SAP_CHAY: 'Sắp chạy',
  DANG_CHAY: 'Đang chạy',
  DA_KET_THUC: 'Đã kết thúc',
};

export const zMaHang = z.object({
  id: z.string(),
  ma: z.string(),
  ten: z.string(),
  khachHang: z.string().nullable(),
  soLuongDonHang: z.number().int(),
  version: z.number().int(),
  soCongDoan: z.number().int(),
  /** Mã các chuyền đang chạy mã hàng (ChuyenMaHang chưa kết thúc) */
  dangChayTren: z.array(z.string()),
  trangThai: z.enum(TRANG_THAI_MA_HANG),
  /** Đã làm = sản lượng của công đoạn hoàn thành (QC) — PRD F5 */
  daLam: z.number().int(),
  /** Có công đoạn nhưng chưa đánh dấu công đoạn hoàn thành */
  thieuCongDoanHoanThanh: z.boolean(),
  /** Ngày sớm nhất được chọn khi đổi SMV (sau tháng khóa gần nhất); null = không giới hạn */
  ngaySomNhatDoiSmv: z.string().nullable(),
});
export type MaHang = z.infer<typeof zMaHang>;

export const zTaoMaHang = z.object({
  ma: zMaDanhMuc,
  ten: zTenDanhMuc,
  khachHang: z.string().trim().max(100).transform((v) => v || null).nullable().optional(),
  soLuongDonHang: z.number({ message: 'Nhập số lượng đơn hàng.' }).int('Số lượng là số nguyên.').positive('Số lượng đơn hàng phải lớn hơn 0.'),
});
export type TaoMaHang = z.input<typeof zTaoMaHang>;

export const zSuaMaHang = zTaoMaHang.partial().extend({ version: z.number().int().min(0) });
export type SuaMaHang = z.input<typeof zSuaMaHang>;

export const zCongDoan = z.object({
  id: z.string(),
  maHangId: z.string(),
  ma: z.string(),
  ten: z.string(),
  laCongDoanHoanThanh: z.boolean(),
  trangThai: z.enum(TRANG_THAI),
  version: z.number().int(),
  /** SMV đang áp dụng hôm nay; null = chưa có SMV */
  smv: z.number().nullable(),
  /** Đổi SMV đã đặt cho một ngày sau hôm nay */
  smvSapApDung: z.object({ smv: z.number(), tuNgay: z.string() }).nullable(),
  /** Nơi đang gán (sơ đồ hiện hành): "C05 · trạm 27, 28" */
  dangGan: z.array(z.object({ maChuyen: z.string(), soTram: z.array(z.number().int()) })),
});
export type CongDoan = z.infer<typeof zCongDoan>;

export const zTaoCongDoan = z.object({
  ma: zMaDanhMuc,
  ten: zTenDanhMuc,
  smv: zSmv.nullable().optional(),
  laCongDoanHoanThanh: z.boolean().default(false),
});
export type TaoCongDoan = z.input<typeof zTaoCongDoan>;

export const zSuaCongDoan = z.object({
  ma: zMaDanhMuc.optional(),
  ten: zTenDanhMuc.optional(),
  /** Chỉ đặt true được — đặt công đoạn khác làm hoàn thành thì công đoạn cũ tự bỏ (luôn đúng 1 / mã hàng) */
  laCongDoanHoanThanh: z.literal(true).optional(),
  trangThai: z.enum(TRANG_THAI).optional(),
  version: z.number().int().min(0),
});
export type SuaCongDoan = z.input<typeof zSuaCongDoan>;

/** POST /api/cong-doan/:id/smv — đổi SMV "áp dụng từ ngày" [R 5.5] [TDD 8.6] */
export const zDoiSmv = z.object({ smv: zSmv, apDungTuNgay: zNgayLamViec });
export type DoiSmv = z.infer<typeof zDoiSmv>;

export const zKetQuaDoiSmv = z.object({ soBanGhiTinhLai: z.number().int() });

export const zLichSuSmv = z.object({
  luc: z.string(),
  nguoi: z.string().nullable(),
  maCongDoan: z.string(),
  tenCongDoan: z.string(),
  smvCu: z.number().nullable(),
  smvMoi: z.number(),
  apDungTuNgay: z.string(),
  soBanGhiTinhLai: z.number().int(),
});
export type LichSuSmv = z.infer<typeof zLichSuSmv>;
