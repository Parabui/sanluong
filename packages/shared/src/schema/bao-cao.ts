/**
 * Báo cáo sản lượng (F5) và "Của tôi" (F11) [TDD 7.3, 13.2].
 * Màn hình và Excel gọi CÙNG một hàm truy vấn → tổng màn hình = tổng Excel. Mọi phút SMV / giờ làm / % hiệu suất lấy từ view.
 */
import { z } from 'zod';
import { zNgayLamViec, zUuid } from './co-ban.js';
import { NGUON_SAN_LUONG } from './bang-san-luong.js';

export const LOAI_BAO_CAO = ['cong-nhan', 'cong-doan', 'chuyen', 'ma-hang', 'lich-su'] as const;
export type LoaiBaoCao = (typeof LOAI_BAO_CAO)[number];
export const TEN_BAO_CAO: Record<LoaiBaoCao, string> = {
  'cong-nhan': 'Theo công nhân',
  'cong-doan': 'Theo công đoạn / trạm',
  chuyen: 'Theo chuyền',
  'ma-hang': 'Theo mã hàng',
  'lich-su': 'Lịch sử chỉnh sửa',
};
/** Báo cáo theo NV × ngày dùng giờ làm của cả ngày → lọc mã hàng không có nghĩa */
export const BAO_CAO_LOC_MA_HANG: Record<LoaiBaoCao, boolean> = { 'cong-nhan': false, 'cong-doan': true, chuyen: false, 'ma-hang': true, 'lich-su': true };

export const LOI_KHOANG_3_THANG = 'Chọn tối đa 3 tháng.';
/** Ngày `den` nằm trong 3 tháng kể từ `tu` (vd. 15/01 → tối đa 14/04) */
export function trongBaThang(tu: string, den: string): boolean {
  const [y, m, d] = tu.split('-').map(Number) as [number, number, number];
  const g = new Date(Date.UTC(y, m - 1 + 3, d)); // tràn ngày (31/11) tự sang tháng sau — đúng ý "3 tháng"
  const p = (n: number) => String(n).padStart(2, '0');
  return den < `${g.getUTCFullYear()}-${p(g.getUTCMonth() + 1)}-${p(g.getUTCDate())}`;
}

/** Ngưỡng tô màu cảnh báo % hiệu suất [F5] */
export const NGUONG_HIEU_SUAT_CAO = 150;

export const TRANG_THAI_SO_LIEU = ['CHUA_CHOT', 'DA_CHOT', 'DA_KHOA'] as const;
export type TrangThaiSoLieu = (typeof TRANG_THAI_SO_LIEU)[number];

export const zLocBaoCao = z
  .object({
    tu: zNgayLamViec.optional(),
    den: zNgayLamViec.optional(),
    xuongId: zUuid.optional(),
    chuyenId: zUuid.optional(),
    maHangId: zUuid.optional(),
    /** Công nhân: mã NV hoặc họ tên */
    q: z.string().trim().max(50).optional(),
    trang: z.coerce.number().int().min(1).default(1),
    kichThuoc: z.coerce.number().int().min(1).max(500).default(100),
  })
  .refine((l) => !l.tu || !l.den || l.tu <= l.den, { message: 'Ngày bắt đầu phải trước ngày kết thúc.', path: ['den'] })
  .refine((l) => !l.tu || !l.den || trongBaThang(l.tu, l.den), { message: LOI_KHOANG_3_THANG, path: ['den'] });
export type LocBaoCao = z.input<typeof zLocBaoCao>;

const zTrangThai = z.enum(TRANG_THAI_SO_LIEU);

export const zDongCongNhan = z.object({
  nhanVienId: z.string(), maNV: z.string(), hoTen: z.string(), ngay: z.string(),
  chuyenId: z.string(), maChuyen: z.string(),
  tram: z.array(z.number().int()), congDoan: z.array(z.string()),
  sanLuong: z.number().int(),
  phutSmv: z.number().nullable(),
  /** Giờ làm phân bổ cho chuyền này (NV làm nhiều chuyền → chia theo phút SMV) [D15]; null = chưa có giờ làm */
  gioLam: z.number().nullable(),
  hieuSuat: z.number().nullable(),
  tamTinh: z.boolean(), gioChoDuyet: z.boolean(), thieuSmv: z.boolean(),
  /** Mã chuyền gốc ngày đó nếu khác chuyền của dòng [D18] */
  hoTroTu: z.string().nullable(),
  trangThai: zTrangThai,
});
export const zDongCongDoan = z.object({
  chuyenId: z.string(), maChuyen: z.string(), tramId: z.string(), soTram: z.number().int(),
  congDoanId: z.string(), maCongDoan: z.string(), tenCongDoan: z.string(), maMaHang: z.string(),
  /** SMV snapshot nếu cả kỳ chỉ 1 mức; null = chưa có / nhiều mức */
  smv: z.number().nullable(),
  sanLuong: z.number().int(), phutSmv: z.number().nullable(),
});
export const zDongChuyen = z.object({
  chuyenId: z.string(), maChuyen: z.string(), tenChuyen: z.string(),
  hoanThanh: z.number().int(), sanLuong: z.number().int(), phutSmv: z.number().nullable(), phutLam: z.number().nullable(),
  hieuSuat: z.number().nullable(), soNv: z.number().int(), tamTinh: z.boolean(),
});
export const zDongMaHang = z.object({
  maHangId: z.string(), ma: z.string(), ten: z.string(), soLuongDonHang: z.number().int(),
  /** Đã làm (công đoạn hoàn thành) trong kỳ / lũy kế đến ngày cuối kỳ */
  daLamKy: z.number().int(), daLamLuyKe: z.number().int(), conLai: z.number().int(), phanTram: z.number().nullable(),
  trangThaiThang: z.enum(['KHOA', 'MO']).nullable(),
  congDoan: z.array(z.object({ ma: z.string(), ten: z.string(), sanLuong: z.number().int() })),
});
export const zDongLichSu = z.object({
  id: z.string(), luc: z.string(), nguoi: z.string(), ngay: z.string(),
  maChuyen: z.string(), soTram: z.number().int(), maCongDoan: z.string(), maNV: z.string(), hoTenNV: z.string(),
  soCu: z.number().int().nullable(), soMoi: z.number().int(), nguon: z.enum(NGUON_SAN_LUONG), lyDo: z.string().nullable(),
});
export type DongCongNhan = z.infer<typeof zDongCongNhan>;
export type DongCongDoan = z.infer<typeof zDongCongDoan>;
export type DongChuyen = z.infer<typeof zDongChuyen>;
export type DongMaHang = z.infer<typeof zDongMaHang>;
export type DongLichSu = z.infer<typeof zDongLichSu>;

const DONG = { 'cong-nhan': zDongCongNhan, 'cong-doan': zDongCongDoan, chuyen: zDongChuyen, 'ma-hang': zDongMaHang, 'lich-su': zDongLichSu } as const;
export function zBaoCao<L extends LoaiBaoCao>(loai: L) {
  return z.object({
    loai: z.literal(loai),
    tu: z.string(), den: z.string(), homNay: z.string(),
    dong: z.array(DONG[loai] as (typeof DONG)[L]),
    tongDong: z.number().int(), trang: z.number().int(), kichThuoc: z.number().int(),
    /** Tổng trên TOÀN BỘ dòng (không chỉ trang đang xem) — khớp dòng Tổng của Excel */
    tongCong: z.record(z.string(), z.number().nullable()),
  });
}

// ── F11 "Của tôi" ──

export const zNgayCuaToi = z.object({
  ngay: z.string(), sanLuong: z.number().int(), phutSmv: z.number().nullable(), gioLam: z.number().nullable(),
  hieuSuat: z.number().nullable(), tamTinh: z.boolean(), gioChoDuyet: z.boolean(), trangThai: zTrangThai, coDieuChinh: z.boolean(),
});
export type NgayCuaToi = z.infer<typeof zNgayCuaToi>;
/** GET /api/cn/cua-toi — 30 ngày gần nhất có sản lượng của NV trong phiên [F11] */
export const zCuaToi = z.object({
  nhanVien: z.object({ maNV: z.string(), hoTen: z.string() }).nullable(),
  tu: z.string(), den: z.string(),
  ngay: z.array(zNgayCuaToi),
});
export type CuaToi = z.infer<typeof zCuaToi>;
/** GET /api/cn/cua-toi/:ngay — chi tiết từng trạm, công đoạn */
export const zCuaToiNgay = zNgayCuaToi.extend({
  tram: z.array(z.object({
    tramId: z.string(), soTram: z.number().int(), maChuyen: z.string(),
    dong: z.array(z.object({
      congDoanId: z.string(), ma: z.string(), ten: z.string(), soLuong: z.number().int(),
      dieuChinh: z.object({ soCu: z.number().int().nullable(), lyDo: z.string().nullable(), boi: z.string(), luc: z.string() }).nullable(),
    })),
  })),
});
export type CuaToiNgay = z.infer<typeof zCuaToiNgay>;
