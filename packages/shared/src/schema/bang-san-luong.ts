/**
 * Bảng sản lượng ngày, chốt ngày, khóa tháng, sơ đồ trạm trực tiếp · F10, F17, F19 [TDD 7.3, 8.3–8.5, 8.8]
 */
import { z } from 'zod';
import { zNgayLamViec, zThang, zUuid } from './co-ban.js';
import { zSoLuong } from './cong-nhan.js';

export const NGUON_SAN_LUONG = ['APP', 'OFFLINE', 'NHAP_HO', 'SUA_WEB'] as const;
export type NguonSanLuong = (typeof NGUON_SAN_LUONG)[number];
export const TEN_NGUON: Record<NguonSanLuong, string> = { APP: 'App', OFFLINE: 'Offline', NHAP_HO: 'Nhập hộ', SUA_WEB: 'Sửa Web' };

/** Lý do chuẩn (chip) — chép từ ui-demo/lib/demo-data */
export const LY_DO_SUA = ['Công nhân báo lại', 'Đếm lại bó hàng', 'Nhập nhầm công đoạn', 'Khác'];
export const LY_DO_NHAP_HO = ['Không mang điện thoại', 'Hết pin', 'Không có phiên trạm', 'Khác'];
export const LY_DO_XAC_NHAN = 'Đã kiểm tra, số đúng';
export const LY_DO_CANH_BAO = [LY_DO_XAC_NHAN, 'Công nhân báo lại', 'Đếm lại bó hàng', 'Nhập nhầm công đoạn', 'Khác'];
export const LY_DO_DANG_XUAT_HO = ['Đăng nhập nhầm trạm', 'Đổi vị trí làm việc', 'Công nhân nghỉ giữa ca', 'Khác'];
export const LY_DO_MO_KHOA = ['Tổ trưởng báo sai số', 'Điều chỉnh giờ làm', 'Sai SMV', 'Khác'];

const zLyDo = z.string().trim().min(1, 'Bắt buộc nhập lý do.').max(500);

// ── Bảng sản lượng ngày ──

export const zLocBangSanLuong = z.object({ chuyenId: zUuid, ngay: zNgayLamViec });

/** Trạng thái một dòng: vàng = chưa có số · cam = cờ ⚠ · tím = Ô đã điều chỉnh [F10] */
export const TRANG_THAI_DONG = ['CHUA_CO_SO', 'CANH_BAO', 'DA_DIEU_CHINH', 'BINH_THUONG'] as const;
export type TrangThaiDong = (typeof TRANG_THAI_DONG)[number];

export const zLichSuO = z.object({
  luc: z.string(),
  soCu: z.number().int().nullable(),
  soMoi: z.number().int(),
  nguon: z.enum(NGUON_SAN_LUONG),
  boi: z.string(),
  lyDo: z.string().nullable(),
});

export const zDongBang = z.object({
  /** sanLuongId, hoặc `${tramId}|${congDoanId}` cho dòng chưa có số */
  key: z.string(),
  sanLuongId: z.string().nullable(),
  version: z.number().int().nullable(),
  tramId: z.string(),
  soTram: z.number().int(),
  congDoanId: z.string(),
  maCongDoan: z.string(),
  tenCongDoan: z.string(),
  maMaHang: z.string(),
  smv: z.number().nullable(),
  laHoanThanh: z.boolean(),
  nhanVien: z.object({ id: z.string(), maNV: z.string(), hoTen: z.string() }).nullable(),
  /** Dòng chưa có số: người đang / từng đăng nhập trạm ngày đó (gợi ý khi nhập hộ) */
  dangNhap: z.object({ id: z.string(), maNV: z.string(), hoTen: z.string() }).nullable(),
  soLuong: z.number().int().nullable(),
  nguon: z.enum(NGUON_SAN_LUONG).nullable(),
  trangThai: z.enum(TRANG_THAI_DONG),
  /** Lý do cờ ⚠ (gửi sau khi công đoạn bị gỡ, nhiều thiết bị…) */
  canhBao: z.array(z.string()),
  /** Mã chuyền gốc của NV ngày đó nếu khác chuyền này (NV hỗ trợ) [D18] */
  hoTroTu: z.string().nullable(),
  /** Mã hàng × tháng đã khóa → không sửa được */
  biKhoa: z.boolean(),
  lichSu: z.array(zLichSuO),
  /** Phút SMV của dòng (view v_san_luong_chi_tiet) [CLAUDE.md #5] */
  phutSmv: z.number().nullable(),
  /** Cả ngày của NV (view v_nv_ngay, mọi chuyền): phút SMV, giờ làm, % hiệu suất */
  nvNgay: z.object({ phutSmv: z.number().nullable(), gioLam: z.number().nullable(), hieuSuat: z.number().nullable() }).nullable(),
});
export type DongBang = z.infer<typeof zDongBang>;

export const zBangSanLuong = z.object({
  chuyenId: z.string(),
  maChuyen: z.string(),
  ngay: z.string(),
  homNay: z.string(),
  chot: z.object({ boi: z.string(), luc: z.string() }).nullable(),
  /** Thời điểm được chốt (Giờ mở chốt của ngày D+1) [R 5.9] */
  moChotTu: z.string(),
  duocChot: z.boolean(),
  /** Mọi dòng có số đều thuộc mã hàng × tháng đã khóa */
  daKhoa: z.boolean(),
  gioChoDuyet: z.number().int(),
  dong: z.array(zDongBang),
  capNhatLuc: z.string(),
});
export type BangSanLuong = z.infer<typeof zBangSanLuong>;

/** Ngày gần đây của chuyền (menu chọn ngày) */
export const zNgayBang = z.object({
  ngay: z.string(),
  coSanLuong: z.boolean(),
  daChot: z.boolean(),
  daKhoa: z.boolean(),
});

/** PUT /api/bang-san-luong/o — sửa ô (hoặc xác nhận ô cảnh báo khi số không đổi) [R 5.4] */
export const zSuaO = z.object({ sanLuongId: zUuid, soLuong: zSoLuong, lyDo: zLyDo, version: z.number().int() });
export type SuaO = z.input<typeof zSuaO>;

/** POST /api/bang-san-luong/nhap-ho [F19] */
export const zNhapHo = z.object({
  tramId: zUuid,
  congDoanId: zUuid,
  ngay: zNgayLamViec,
  nhanVienId: zUuid,
  soLuong: zSoLuong,
  lyDo: zLyDo,
});
export type NhapHo = z.input<typeof zNhapHo>;

export const zKetQuaGhiWeb = z.object({ sanLuongId: z.string(), soLuong: z.number().int(), version: z.number().int() });

/** GET /api/bang-san-luong/nhan-vien?q= — NV đang hoạt động (mọi chuyền) để nhập hộ [R 5.8] */
export const zTimNhanVien = z.object({ q: z.string().trim().min(1).max(50) });
export const zNvTimDuoc = z.object({ id: z.string(), maNV: z.string(), hoTen: z.string(), maChuyen: z.string().nullable() });

// ── Chốt ngày ──

export const zChotNgay = z.object({ chuyenId: zUuid, ngay: zNgayLamViec, xacNhan: z.boolean().default(false) });
export type ChotNgay = z.input<typeof zChotNgay>;

/** Cảnh báo trước khi chốt — trả trong `chiTiet` của lỗi CAN_XAC_NHAN [TDD 8.4] */
export const zCanhBaoChot = z.object({
  oChuaCoSo: z.array(z.object({ soTram: z.number().int(), maCongDoan: z.string(), nhanVien: z.string().nullable() })),
  oCanhBao: z.number().int(),
  yeuCauGioChoDuyet: z.number().int(),
});
export type CanhBaoChot = z.infer<typeof zCanhBaoChot>;

/** GET /api/chot-ngay/chua-chot — "Còn X ngày chưa chốt" trên header [F10] */
export const zNgayChuaChot = z.object({ chuyenId: z.string(), maChuyen: z.string(), ngay: z.string() });

// ── Khóa tháng ──

export const zLocKhoaThang = z.object({ thang: zThang.optional() });
export const zDongKhoaThang = z.object({
  maHangId: z.string(),
  ma: z.string(),
  ten: z.string(),
  /** Sản lượng tháng = số qua công đoạn hoàn thành */
  sanLuong: z.number().int(),
  soNgay: z.number().int(),
  chuaChot: z.array(z.object({ chuyenId: z.string(), maChuyen: z.string(), ngay: z.string() })),
  khoa: z.object({ trangThai: z.enum(['KHOA', 'MO']), boi: z.string(), luc: z.string(), lyDo: z.string().nullable() }).nullable(),
});
export type DongKhoaThang = z.infer<typeof zDongKhoaThang>;
export const zKhoaThangThang = z.object({ thang: z.string(), dsThang: z.array(z.string()), dong: z.array(zDongKhoaThang) });

export const zKhoaMaHang = z.object({ maHangId: zUuid, thang: zThang });
export const zKhoaTatCa = z.object({ thang: zThang });
export const zMoKhoa = z.object({ maHangId: zUuid, thang: zThang, lyDo: zLyDo });
export const zKetQuaKhoaTatCa = z.object({ daKhoa: z.array(z.string()), boQua: z.array(z.object({ ma: z.string(), soNgayChuaChot: z.number().int() })) });

// ── Sơ đồ trạm trực tiếp (F17) ──

export const zLocSoDoTram = z.object({ chuyenId: zUuid, phienBan: z.string().optional() });
export const zTramTrucTiep = z.object({
  id: z.string(),
  soTram: z.number().int(),
  congDoan: z.array(z.object({ id: z.string(), ma: z.string(), ten: z.string() })),
  phien: z
    .object({
      id: z.string(),
      nhanVien: z.object({ maNV: z.string(), hoTen: z.string() }),
      dangNhapLuc: z.string(),
      thietBi: z.string().nullable(),
      /** Công đoạn NV đã có số hôm nay tại trạm */
      daNhap: z.array(z.string()),
    })
    .nullable(),
});
export type TramTrucTiep = z.infer<typeof zTramTrucTiep>;
export const zSoDoTram = z.union([
  z.object({ khongDoi: z.literal(true) }),
  z.object({ khongDoi: z.literal(false), phienBan: z.string(), homNay: z.string(), tram: z.array(zTramTrucTiep) }),
]);
export type SoDoTram = z.infer<typeof zSoDoTram>;

/** POST /api/so-do-tram/dang-xuat-ho [TDD 8.8] [D26] */
export const zDangXuatHo = z.object({ phienId: zUuid, lyDo: zLyDo, xacNhan: z.boolean().default(false) });
export type DangXuatHo = z.input<typeof zDangXuatHo>;
