/**
 * Khung import Excel 2 bước: xem trước → xác nhận [TDD 6.1 ImportTam, 7.3] · F2 (F3, F16 dùng lại).
 * Giới hạn file [PRD ⑦] [TDD 19]: chỉ .xlsx · ≤ 10 MB · ≤ 5.000 dòng · giải nén ≤ 50 MB.
 */
import { z } from 'zod';

export const IMPORT_TOI_DA_BYTE = 10 * 1024 * 1024;
export const IMPORT_TOI_DA_DONG = 5000;
export const IMPORT_TOI_DA_GIAI_NEN_BYTE = 50 * 1024 * 1024;
/** Bản xem trước hết hạn sau 30 phút */
export const IMPORT_HET_HAN_PHUT = 30;

/** Loại import trên URL (/api/import/:loai/…) */
export const LOAI_IMPORT = ['nhan-vien'] as const;
export type LoaiImport = (typeof LOAI_IMPORT)[number];

/** Cột file mẫu nhân viên — dòng 1 là tiêu đề, đọc sheet đầu tiên (PRD F2) */
export const COT_IMPORT_NHAN_VIEN = [
  { khoa: 'maNV', tieuDe: 'Mã NV', batBuoc: true },
  { khoa: 'hoTen', tieuDe: 'Họ tên', batBuoc: true },
  { khoa: 'maChuyen', tieuDe: 'Chuyền/Nhóm', batBuoc: true },
  { khoa: 'bacTayNghe', tieuDe: 'Bậc tay nghề', batBuoc: false },
] as const;

export const zDongBaoCao = z.object({
  /** Số dòng trong Excel (dòng tiêu đề = 1) */
  dong: z.array(z.number().int()),
  lyDo: z.string(),
});
export type DongBaoCao = z.infer<typeof zDongBaoCao>;

/** POST /api/import/:loai/xem-truoc */
export const zXemTruocImport = z.object({
  importId: z.string(),
  tenFile: z.string(),
  tongDong: z.number().int(),
  them: z.number().int(),
  capNhat: z.number().int(),
  /** Đã có, dữ liệu không đổi — bỏ qua */
  khongDoi: z.number().int(),
  /** Dòng lỗi — không được ghi */
  loi: z.number().int(),
  /** Dòng có cảnh báo — vẫn ghi nếu người dùng xác nhận */
  canhBao: z.number().int(),
  dsLoi: z.array(zDongBaoCao),
  dsCanhBao: z.array(zDongBaoCao),
  hetHanLuc: z.string(),
});
export type XemTruocImport = z.infer<typeof zXemTruocImport>;

/** POST /api/import/:importId/xac-nhan */
export const zXacNhanImport = z.object({
  /** Bắt buộc true khi bản xem trước có cảnh báo */
  xacNhanCanhBao: z.boolean().default(false),
});
export type XacNhanImport = z.input<typeof zXacNhanImport>;

export const zKetQuaImport = z.object({
  them: z.number().int(),
  capNhat: z.number().int(),
  boQua: z.number().int(),
});
export type KetQuaImport = z.infer<typeof zKetQuaImport>;
