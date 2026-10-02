/** App công nhân — phiên trạm, form nhập, ghi sản lượng · F1, F12 [TDD 7.3, 8.1, 8.2] */
import { z } from 'zod';
import { zNgayLamViec, zUuid } from './co-ban.js';
import { zMaNV } from './nhan-vien.js';

/** Số lượng hợp lệ: số nguyên 0 – 99.999 [R 1.1] */
export const zSoLuong = z.number().int('Số lượng phải là số nguyên.').min(0, 'Số lượng không được âm.').max(99_999, 'Tối đa 99.999.');

/**
 * Tên viết tắt (không lộ cặp mã NV ↔ họ tên khi trạm có người khác) [D23]: "Nguyễn Thị Lan" → "Ng. T. Lan"
 */
export function tenVietTat(hoTen: string): string {
  const p = hoTen.trim().split(/\s+/);
  if (p.length <= 1) return hoTen.trim();
  const dau = (w: string) => (/^(ngh|ng|nh|th|tr|ch|ph|kh|gh|gi|qu)/i.exec(w)?.[0] ?? w[0] ?? '');
  // Họ: giữ cụm phụ âm đầu (Nguyễn → Ng.) · tên đệm: chữ cái đầu (Thị → T.) · tên: đầy đủ
  return [`${dau(p[0]!)}.`, ...p.slice(1, -1).map((w) => `${w[0] ?? ''}.`), p.at(-1)].join(' ');
}

/** Chuỗi trong QR trạm: UUID trần hoặc URL .../dang-nhap/<uuid> (camera iPhone mở thẳng trình duyệt) [F12] [D21] */
export function tramIdTuQr(noiDung: string): string | null {
  const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(noiDung.trim());
  return m ? m[1]!.toLowerCase() : null;
}

export const zPhienCuaToi = z.object({
  id: z.string(),
  tramId: z.string(),
  soTram: z.number().int(),
  maChuyen: z.string(),
  tenChuyen: z.string(),
  ngayLamViec: z.string(),
  dangNhapLuc: z.string(),
});
export type PhienCuaToi = z.infer<typeof zPhienCuaToi>;

export const zThongBaoPhien = z.object({
  loai: z.enum(['CHUYEN_THIET_BI', 'DANG_XUAT_HO']),
  soTram: z.number().int(),
  luc: z.string(),
  /** Người đăng xuất hộ (tổ trưởng) */
  boi: z.string().nullable(),
  lyDo: z.string().nullable(),
});
export type ThongBaoPhien = z.infer<typeof zThongBaoPhien>;

/** GET /api/cn/khoi-dong — KHÔNG tạo cookie [D21] */
export const zKhoiDong = z.object({
  gioServer: z.string(),
  homNay: z.string(),
  /** NV của thiết bị (theo phiên còn hiệu lực), null = chưa đăng nhập */
  nhanVien: z.object({ maNV: z.string(), hoTen: z.string(), maChuyen: z.string() }).nullable(),
  /** Phiên còn hiệu lực trên thiết bị: hôm nay + ngày làm việc liền trước chưa chốt [D22] */
  phien: z.array(zPhienCuaToi),
  /** Phiên vừa bị chuyển sang thiết bị khác / bị tổ trưởng đăng xuất hộ [D21] [R 3.8] */
  thongBao: z.array(zThongBaoPhien),
});
export type KhoiDong = z.infer<typeof zKhoiDong>;

/** GET /api/cn/cay-tram */
export const zCayTram = z.array(
  z.object({
    id: z.string(),
    ten: z.string(),
    chuyen: z.array(
      z.object({
        id: z.string(),
        ma: z.string(),
        ten: z.string(),
        tram: z.array(z.object({ id: z.string(), soTram: z.number().int(), dangCoNguoi: z.boolean() })),
      }),
    ),
  }),
);
export type CayTram = z.infer<typeof zCayTram>;

/** GET /api/cn/tram/:id — tra trạm khi quét QR [F12] */
export const zTramQr = z.object({
  id: z.string(),
  soTram: z.number().int(),
  chuyenId: z.string(),
  maChuyen: z.string(),
  tenChuyen: z.string(),
  /** Công đoạn của trạm hôm nay (hiện ở màn đăng nhập) */
  congDoan: z.array(z.object({ ma: z.string(), ten: z.string(), maMaHang: z.string() })),
});
export type TramQr = z.infer<typeof zTramQr>;

/** POST /api/cn/phien-tram */
export const zDangNhapTram = z.object({
  tramId: zUuid,
  maNV: zMaNV,
  /** Cloudflare Turnstile (chế độ ẩn) [D23] */
  turnstileToken: z.string().max(4096).default(''),
});
export type DangNhapTram = z.input<typeof zDangNhapTram>;

export const TRANG_THAI_O = ['CHUA_NHAP', 'DA_LUU', 'DA_DIEU_CHINH'] as const;

/** GET /api/cn/form?tramId=&ngay= */
export const zFormNhap = z.object({
  tramId: z.string(),
  soTram: z.number().int(),
  maChuyen: z.string(),
  ngay: z.string(),
  laHomNay: z.boolean(),
  /** Giờ làm hiệu lực (để app tính trần lý thuyết); null = chưa có giờ */
  gioLam: z.number().nullable(),
  congDoan: z.array(
    z.object({
      congDoanId: z.string(),
      ma: z.string(),
      ten: z.string(),
      maMaHang: z.string(),
      smv: z.number().nullable(),
      /** Số đã lưu; null = chưa nhập */
      soLuong: z.number().int().nullable(),
      capNhatLuc: z.string().nullable(),
      trangThai: z.enum(TRANG_THAI_O),
      /** Ô đã điều chỉnh: số cũ, lý do, người, lúc [R 5.4] */
      dieuChinh: z.object({ soCu: z.number().int().nullable(), lyDo: z.string().nullable(), boi: z.string().nullable(), luc: z.string() }).nullable(),
      /** Công đoạn đã gỡ khỏi trạm trong ngày — vẫn nhập được đến hết ngày [R 3.6] */
      daGo: z.boolean(),
    }),
  ),
});
export type FormNhap = z.infer<typeof zFormNhap>;

/** PUT /api/cn/san-luong [TDD 8.2] */
export const zGhiSanLuong = z.object({
  /** Mã request: Thử lại khi số CHƯA đổi → dùng lại mã cũ; sửa số → mã mới [D19] */
  requestId: zUuid,
  tramId: zUuid,
  ngay: zNgayLamViec,
  dong: z
    .array(
      z.object({
        congDoanId: zUuid,
        soLuong: zSoLuong,
        /** Bộ đếm tăng dần trong localStorage của thiết bị [D16] */
        thuTuThietBi: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        /** Giờ trên điện thoại lúc bấm Lưu (tham khảo — server dùng giờ server) */
        lucThietBi: z.string().datetime({ offset: true }).optional(),
      }),
    )
    .min(1, 'Chưa có số nào để lưu.')
    .max(50),
});
export type GhiSanLuong = z.infer<typeof zGhiSanLuong>;

export const KET_QUA_DONG = ['DA_LUU', 'KHONG_DOI', 'GOI_CU_BO_QUA', 'O_DA_DIEU_CHINH'] as const;
export type KetQuaDong = (typeof KET_QUA_DONG)[number];

export const zKetQuaGhi = z.object({
  dong: z.array(
    z.object({
      congDoanId: z.string(),
      ketQua: z.enum(KET_QUA_DONG),
      /** Số hiện tại trong DB (để form hiển thị đúng thực tế) [D16] */
      soHienTai: z.number().int().nullable(),
    }),
  ),
  luc: z.string(),
});
export type KetQuaGhi = z.infer<typeof zKetQuaGhi>;
