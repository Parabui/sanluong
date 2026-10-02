/** Hệ thống: audit log, cài đặt hệ thống, health chi tiết · F8 [TDD 7.3, 12, 18] */
import { z } from 'zod';
import { zCauHinh } from '../cau-hinh.js';
import { zNgayLamViec } from './co-ban.js';
import { trongBaThang } from './bao-cao.js';

// ── Audit log ──

export const zLocAuditLog = z
  .object({
    tu: zNgayLamViec.optional(),
    den: zNgayLamViec.optional(),
    hanhDong: z.string().trim().max(64).optional(),
    /** Người thực hiện: tên đăng nhập, họ tên hoặc mã NV */
    q: z.string().trim().max(50).optional(),
    trang: z.coerce.number().int().min(1).default(1),
    kichThuoc: z.coerce.number().int().min(1).max(500).default(100),
  })
  .refine((l) => !l.tu || !l.den || l.tu <= l.den, { message: 'Ngày bắt đầu phải trước ngày kết thúc.', path: ['den'] })
  .refine((l) => !l.tu || !l.den || trongBaThang(l.tu, l.den), { message: 'Chọn tối đa 3 tháng.', path: ['den'] });
export type LocAuditLog = z.input<typeof zLocAuditLog>;

export const zDongAuditLog = z.object({
  id: z.string(),
  luc: z.string(),
  loaiNguoiThucHien: z.enum(['TAI_KHOAN', 'NHAN_VIEN', 'HE_THONG', 'DB_TRUC_TIEP']),
  /** Tên đăng nhập / mã NV / tài khoản DB */
  nguoi: z.string(),
  hoTen: z.string().nullable(),
  hanhDong: z.string(),
  doiTuong: z.string(),
  doiTuongId: z.string().nullable(),
  duLieuCu: z.unknown().nullable(),
  duLieuMoi: z.unknown().nullable(),
  lyDo: z.string().nullable(),
  ip: z.string().nullable(),
  traceId: z.string().nullable(),
});
export type DongAuditLog = z.infer<typeof zDongAuditLog>;

export const zDsAuditLog = z.object({
  tu: z.string(),
  den: z.string(),
  dong: z.array(zDongAuditLog),
  tongDong: z.number().int(),
  trang: z.number().int(),
  kichThuoc: z.number().int(),
  /** Các hành động có trong khoảng (cho ô lọc) */
  dsHanhDong: z.array(z.string()),
});

// ── Cài đặt hệ thống (Superadmin) ──

/** PUT /api/cau-hinh — chỉ các khóa sửa được trên màn Cài đặt (số ngày nhập lùi cố định theo [D22]) */
export const zSuaCauHinh = z.object({
  gioMoChotNgay: zCauHinh.shape.gioMoChotNgay,
  chuKyLamMoiDashboard: z.coerce.number().int('Chu kỳ là số phút nguyên.').min(1, 'Từ 1 đến 60 phút.').max(60, 'Từ 1 đến 60 phút.'),
  ipNhaMay: z.array(z.ipv4({ message: 'Địa chỉ IP không hợp lệ.' })).max(10),
});
export type SuaCauHinh = z.input<typeof zSuaCauHinh>;

export const zCaiDatHeThong = z.object({
  cauHinh: zCauHinh,
  /** Tài khoản TV và phiên đang mở (thu hồi → bắt buộc đăng nhập lại) [D24] */
  phienTv: z.array(z.object({ taiKhoanId: z.string(), hoTen: z.string(), tenDangNhap: z.string(), soPhien: z.number().int(), lanCuoi: z.string().nullable() })),
});
export type CaiDatHeThong = z.infer<typeof zCaiDatHeThong>;

// ── Health chi tiết (Uptime Kuma / Superadmin) [D24] ──

export const zHealthChiTiet = z.object({ phienBan: z.string(), db: z.literal('ok'), migration: z.string().nullable(), gioServer: z.string() });
