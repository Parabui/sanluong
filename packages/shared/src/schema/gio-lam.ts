/** Giờ làm · F6 — giờ mặc định theo xưởng × thứ, yêu cầu sửa giờ, duyệt / từ chối, sửa trực tiếp [TDD 7.3] */
import { z } from 'zod';
import { docSoGio, type LoaiNgay } from '../ngay-lam-viec.js';
import { zNgayLamViec, zUuid } from './co-ban.js';

export const LOI_SO_GIO = 'Số giờ phải lớn hơn 0 và không quá 16.';

/**
 * Số giờ: nhận số hoặc chuỗi "9,5" / "9.5" (dấu phẩy hoặc chấm), > 0 và ≤ 16, tối đa 2 chữ số lẻ [F6].
 * Cột DB: numeric(4,2) + CHECK (so_gio > 0 AND so_gio <= 16).
 */
export const zSoGio = z
  .union([z.number(), z.string()], { error: LOI_SO_GIO })
  .transform((v, ctx) => {
    const n = typeof v === 'number' ? v : docSoGio(v);
    if (n == null || !Number.isFinite(n) || !(n > 0 && n <= 16) || Math.round(n * 100) !== n * 100) {
      ctx.addIssue({ code: 'custom', message: LOI_SO_GIO });
      return z.NEVER;
    }
    return n;
  });

/** Số giờ hiển thị: 9 → "9", 10.5 → "10,5", 9.25 → "9,25" */
export function dinhDangSoGio(n: number | null | undefined): string {
  if (n == null) return '—';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

const zLyDo = z.string().trim().min(1, 'Bắt buộc nhập lý do.').max(500);

export const LOAI_NGAY = ['T2_T6', 'T7', 'CN'] as const satisfies readonly LoaiNgay[];
export const TEN_LOAI_NGAY: Record<LoaiNgay, string> = { T2_T6: 'Thứ 2 – Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật' };
/** Giá trị đề xuất khi xưởng chưa cài [R 4.3]: T2–T6 9 giờ · T7 8 giờ · CN trống */
export const GIO_MAC_DINH_DE_XUAT: Record<LoaiNgay, number | null> = { T2_T6: 9, T7: 8, CN: null };

export const TRANG_THAI_YEU_CAU_GIO = ['CHO', 'DUYET', 'TU_CHOI'] as const;
export type TrangThaiYeuCauGio = (typeof TRANG_THAI_YEU_CAU_GIO)[number];

/** Nguồn của giờ đang dùng tính hiệu suất */
export const NGUON_GIO = ['MAC_DINH', 'YEU_CAU_DUYET', 'TO_TRUONG_SUA'] as const;

// ── Giờ mặc định (Cài đặt) ──

const zBoGio = z.object({ T2_T6: z.number().nullable(), T7: z.number().nullable(), CN: z.number().nullable() });

/** GET /api/gio-mac-dinh — mọi xưởng trong phạm vi */
export const zGioMacDinhXuong = z.object({
  xuongId: z.string(),
  tenXuong: z.string(),
  /** Xưởng chưa lưu giờ mặc định lần nào → form điền giá trị đề xuất, QL xưởng bấm Lưu để áp dụng */
  chuaCai: z.boolean(),
  /** Giờ đang áp dụng hôm nay */
  hienTai: zBoGio,
  /** Lịch sử theo ngày hiệu lực, mới nhất trước */
  lichSu: z.array(
    z.object({ loaiNgay: z.enum(LOAI_NGAY), soGio: z.number().nullable(), apDungTuNgay: z.string(), nguoiTao: z.string().nullable() }),
  ),
});
export type GioMacDinhXuong = z.infer<typeof zGioMacDinhXuong>;

/** PUT /api/gio-mac-dinh — trống (null) = ngày không có giờ mặc định; áp dụng từ HÔM NAY trở đi */
export const zLuuGioMacDinh = z.object({
  xuongId: zUuid,
  T2_T6: zSoGio.nullable(),
  T7: zSoGio.nullable(),
  CN: zSoGio.nullable(),
});
export type LuuGioMacDinh = z.input<typeof zLuuGioMacDinh>;

// ── App công nhân ──

/** GET /api/cn/gio-lam */
export const zGioLamCuaToi = z.object({
  /** Ngày mở nhập (theo phiên trạm còn hiệu lực của thiết bị), mới nhất trước */
  ngayMo: z.array(
    z.object({
      ngay: z.string(),
      gioMacDinh: z.number().nullable(),
      /** Giờ đang dùng tính hiệu suất (null = chưa có giờ, vd. Chủ nhật) */
      gioHieuLuc: z.number().nullable(),
      nguon: z.enum(NGUON_GIO),
      yeuCauCho: z.object({ soGio: z.number(), guiLuc: z.string() }).nullable(),
      /** Mã hàng × tháng đã khóa [R 5.7] → không gửi được */
      biKhoa: z.boolean(),
    }),
  ),
  /** Yêu cầu đã gửi 30 ngày gần nhất, mới nhất trước */
  yeuCau: z.array(
    z.object({
      id: z.string(),
      ngay: z.string(),
      soGio: z.number(),
      trangThai: z.enum(TRANG_THAI_YEU_CAU_GIO),
      guiLuc: z.string(),
      xuLyLuc: z.string().nullable(),
      nguoiXuLy: z.string().nullable(),
      lyDoTuChoi: z.string().nullable(),
    }),
  ),
});
export type GioLamCuaToi = z.infer<typeof zGioLamCuaToi>;

/** POST /api/cn/gio-lam — yêu cầu mới THAY THẾ yêu cầu đang chờ cùng ngày [F6] */
export const zGuiYeuCauGio = z.object({ ngay: zNgayLamViec, soGio: zSoGio });
export type GuiYeuCauGio = z.input<typeof zGuiYeuCauGio>;

// ── Web: duyệt / sửa giờ ──

export const zLocYeuCauGio = z.object({
  chuyenId: zUuid.optional(),
  trangThai: z.enum(TRANG_THAI_YEU_CAU_GIO).default('CHO'),
});

export const zYeuCauGioDuyet = z.object({
  id: z.string(),
  version: z.number().int(),
  nhanVien: z.object({ id: z.string(), maNV: z.string(), hoTen: z.string() }),
  /** Chuyền gốc của NV TẠI NGÀY ĐÓ [D18] */
  chuyenGoc: z.object({ id: z.string(), ma: z.string() }).nullable(),
  ngay: z.string(),
  gioMacDinh: z.number().nullable(),
  soGio: z.number(),
  trangThai: z.enum(TRANG_THAI_YEU_CAU_GIO),
  guiLuc: z.string(),
  xuLy: z.object({ boi: z.string().nullable(), luc: z.string() }).nullable(),
  lyDoTuChoi: z.string().nullable(),
  /** Sản lượng của NV ngày đó ở MỌI chuyền (theo chuyền của trạm) — hoTro = khác chuyền gốc [F6] [R 5.8] */
  sanLuong: z.array(z.object({ maChuyen: z.string(), soLuong: z.number().int(), hoTro: z.boolean() })),
  biKhoa: z.boolean(),
});
export type YeuCauGioDuyet = z.infer<typeof zYeuCauGioDuyet>;

/** GET /api/gio-lam/cho-duyet */
export const zDsYeuCauGio = z.object({
  homNay: z.string(),
  ds: z.array(zYeuCauGioDuyet),
  dem: z.object({ CHO: z.number().int(), DUYET: z.number().int(), TU_CHOI: z.number().int() }),
  /** Giờ mặc định đang áp dụng của xưởng chứa chuyền đang lọc */
  macDinh: z.object({ tenXuong: z.string(), gio: zBoGio }).nullable(),
});
export type DsYeuCauGio = z.infer<typeof zDsYeuCauGio>;

export const zDuyetYeuCauGio = z.object({ version: z.number().int() });
export const zTuChoiYeuCauGio = z.object({ version: z.number().int(), lyDo: zLyDo });
export type TuChoiYeuCauGio = z.input<typeof zTuChoiYeuCauGio>;

/** PUT /api/gio-lam/truc-tiep — tổ trưởng sửa giờ cho NV chuyền gốc của mình (bắt buộc lý do) [R 4.2] */
export const zSuaGioTrucTiep = z.object({ nhanVienId: zUuid, ngay: zNgayLamViec, soGio: zSoGio, lyDo: zLyDo });
export type SuaGioTrucTiep = z.input<typeof zSuaGioTrucTiep>;

/** GET /api/gio-lam/nhan-vien?chuyenId=&ngay= — NV có chuyền gốc ngày đó = chuyền (để chọn khi sửa trực tiếp) */
export const zLocNvGioLam = z.object({ chuyenId: zUuid, ngay: zNgayLamViec });
export const zNvGioLam = z.object({
  id: z.string(),
  maNV: z.string(),
  hoTen: z.string(),
  gioMacDinh: z.number().nullable(),
  gioHieuLuc: z.number().nullable(),
  nguon: z.enum(NGUON_GIO),
  biKhoa: z.boolean(),
});
export type NvGioLam = z.infer<typeof zNvGioLam>;

/** Kết quả ghi giờ (duyệt / sửa trực tiếp) */
export const zKetQuaGioLam = z.object({ nhanVienId: z.string(), ngay: z.string(), soGio: z.number(), nguon: z.enum(NGUON_GIO) });
