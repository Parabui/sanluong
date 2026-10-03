/** Sơ đồ chuyền — gán công đoạn vào trạm · F4 [R 3.6] [TDD 8.7] */
import { z } from 'zod';
import { zNgayLamViec, zUuid } from './co-ban.js';

export const SO_MA_HANG_TOI_DA = 2;

export const zCongDoanSoDo = z.object({
  congDoanId: z.string(),
  ma: z.string(),
  ten: z.string(),
  smv: z.number().nullable(),
  laCongDoanHoanThanh: z.boolean(),
  maHangId: z.string(),
  maMaHang: z.string(),
  /** false = công đoạn đã ngưng (chỉ còn trong sơ đồ cũ) */
  hoatDong: z.boolean(),
});
export type CongDoanSoDo = z.infer<typeof zCongDoanSoDo>;

export const zSoDo = z.object({
  chuyenId: z.string(),
  maChuyen: z.string(),
  tenChuyen: z.string(),
  /** Optimistic lock của sơ đồ — gửi kèm khi Lưu */
  versionSoDo: z.number().int(),
  ngay: z.string(),
  /** true = sơ đồ hiện hành (sửa được); false = xem sơ đồ của một ngày đã qua */
  hienHanh: z.boolean(),
  maHangDangChay: z.array(z.object({ id: z.string(), ma: z.string(), ten: z.string(), batDau: z.string() })),
  /** Chỉ trạm nhập qua app, đang hoạt động — theo số trạm */
  tram: z.array(z.object({ id: z.string(), soTram: z.number().int(), congDoan: z.array(zCongDoanSoDo) })),
  /** Công đoạn (đang hoạt động) của mã hàng đang chạy mà chưa gán vào trạm nào của chuyền */
  chuaGan: z.array(zCongDoanSoDo),
  phienBan: z.object({ luc: z.string(), nguoi: z.string().nullable() }).nullable(),
});
export type SoDo = z.infer<typeof zSoDo>;

/** PUT /api/so-do — trạng thái MONG MUỐN của các trạm; server tự so sánh, đóng/mở dòng gán */
export const zLuuSoDo = z.object({
  chuyenId: zUuid,
  versionSoDo: z.number().int().min(0),
  gan: z.array(z.object({ tramId: zUuid, congDoanIds: z.array(zUuid) })),
});
export type LuuSoDo = z.infer<typeof zLuuSoDo>;

export const zKetQuaLuuSoDo = z.object({
  them: z.number().int(),
  go: z.number().int(),
  versionSoDo: z.number().int(),
});

/** POST /api/so-do/ket-thuc-ma-hang */
export const zKetThucMaHang = z.object({ chuyenId: zUuid, maHangId: zUuid, versionSoDo: z.number().int().min(0) });
export type KetThucMaHang = z.infer<typeof zKetThucMaHang>;

/** POST /api/so-do/sao-chep — trả về đề xuất gán (CHƯA lưu) để người dùng xem rồi bấm Lưu */
export const zSaoChepSoDo = z.object({ chuyenDichId: zUuid, chuyenNguonId: zUuid, maHangId: zUuid });
export type SaoChepSoDo = z.infer<typeof zSaoChepSoDo>;

export const zDeXuatSaoChep = z.object({
  gan: z.array(z.object({ soTram: z.number().int(), congDoan: z.array(zCongDoanSoDo) })),
  /** Công đoạn đã ngưng bị bỏ qua [F4] */
  boQuaNgung: z.number().int(),
  /** Trạm nguồn không có ở chuyền đích (khác số trạm / không nhập qua app) */
  boQuaTram: z.number().int(),
});
export type DeXuatSaoChep = z.infer<typeof zDeXuatSaoChep>;

export const zLocSoDo = z.object({ chuyenId: zUuid, ngay: zNgayLamViec.optional() });
