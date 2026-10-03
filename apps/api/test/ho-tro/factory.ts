/**
 * Factory dữ liệu test [TDD 16.2]: tạo nhanh dữ liệu tối thiểu hợp lệ, cho phép ghi đè từng trường.
 * Viết bằng SQL thẳng (không qua Prisma) để test được chính ràng buộc của DB.
 */
import type { Db } from './db.js';

let dem = 0;
const ma = (tienTo: string) => `${tienTo}${String(++dem).padStart(5, '0')}`;

async function id(db: Db, sql: string, thamSo: unknown[]): Promise<string> {
  const { rows } = await db.query<{ id: string }>(`${sql} RETURNING id`, thamSo);
  return rows[0]!.id;
}

export function taoXuong(db: Db): Promise<string> {
  return id(db, `INSERT INTO xuong (ma, ten) VALUES ($1, 'Xưởng test')`, [ma('X')]);
}

export async function taoChuyen(db: Db, t: { xuongId?: string } = {}): Promise<string> {
  const xuongId = t.xuongId ?? (await taoXuong(db));
  return id(db, `INSERT INTO chuyen (ma, ten, loai, xuong_id) VALUES ($1, 'Chuyền test', 'CHUYEN_MAY', $2)`, [
    ma('C'),
    xuongId,
  ]);
}

export function taoTram(db: Db, chuyenId: string, soTram = 26): Promise<string> {
  return id(db, `INSERT INTO tram (chuyen_id, so_tram, nhap_qua_app) VALUES ($1, $2, true)`, [chuyenId, soTram]);
}

export function taoNhanVien(db: Db, chuyenId: string, t: { maNV?: string } = {}): Promise<string> {
  return id(db, `INSERT INTO nhan_vien (ma_nv, ho_ten, chuyen_id) VALUES ($1, 'Nguyễn Thị Lan', $2)`, [
    t.maNV ?? ma('NV'),
    chuyenId,
  ]);
}

/** Ghi lịch sử chuyền gốc lùi ngày — chỉ tài khoản chủ schema làm được (vsn_app bị REVOKE) */
export async function datChuyenGoc(db: Db, nhanVienId: string, tuNgay: string, chuyenId: string): Promise<void> {
  await db.query(
    `INSERT INTO nhan_vien_chuyen_goc (nhan_vien_id, tu_ngay, chuyen_id) VALUES ($1, $2, $3)
     ON CONFLICT (nhan_vien_id, tu_ngay) DO UPDATE SET chuyen_id = EXCLUDED.chuyen_id`,
    [nhanVienId, tuNgay, chuyenId],
  );
}

export function taoMaHang(db: Db): Promise<string> {
  return id(db, `INSERT INTO ma_hang (ma, ten, so_luong_don_hang) VALUES ($1, 'Áo test', 5000)`, [ma('MH')]);
}

export function taoCongDoan(db: Db, maHangId: string, t: { hoanThanh?: boolean } = {}): Promise<string> {
  return id(
    db,
    `INSERT INTO cong_doan (ma_hang_id, ma, ten, la_cong_doan_hoan_thanh) VALUES ($1, $2, 'May cổ', $3)`,
    [maHangId, ma('CD'), t.hoanThanh ?? false],
  );
}

export function taoTaiKhoan(db: Db, vaiTro = 'TO_TRUONG'): Promise<string> {
  return id(db, `INSERT INTO tai_khoan (ten_dang_nhap, ho_ten, mat_khau_hash, vai_tro) VALUES ($1, 'Tổ trưởng', 'x', $2)`, [
    ma('tk'),
    vaiTro,
  ]);
}

export function taoThietBi(db: Db): Promise<string> {
  return id(db, `INSERT INTO thiet_bi (token_hash) VALUES ($1)`, [ma('hash')]);
}

export function taoPhienTram(
  db: Db,
  t: { tramId: string; nhanVienId: string; thietBiId: string; ngay: string },
): Promise<string> {
  return id(db, `INSERT INTO phien_tram (tram_id, nhan_vien_id, ngay_lam_viec, thiet_bi_id) VALUES ($1, $2, $3, $4)`, [
    t.tramId,
    t.nhanVienId,
    t.ngay,
    t.thietBiId,
  ]);
}

/** Bộ khung chuyền tối thiểu: xưởng → chuyền → trạm, mã hàng → công đoạn, NV chuyền đó */
export async function taoKhung(db: Db) {
  const xuongId = await taoXuong(db);
  const chuyenId = await taoChuyen(db, { xuongId });
  const tramId = await taoTram(db, chuyenId);
  const maHangId = await taoMaHang(db);
  const congDoanId = await taoCongDoan(db, maHangId);
  const nhanVienId = await taoNhanVien(db, chuyenId);
  return { xuongId, chuyenId, tramId, maHangId, congDoanId, nhanVienId };
}

export interface SanLuongTest {
  ngay: string;
  tramId: string;
  congDoanId: string;
  nhanVienId: string;
  soLuong: number;
  smv?: number | null;
  /** Mặc định = chuyền của trạm */
  chuyenId?: string;
  nguon?: 'APP' | 'OFFLINE' | 'NHAP_HO' | 'SUA_WEB';
  taiKhoanId?: string;
}

export function taoSanLuong(db: Db, s: SanLuongTest): Promise<string> {
  const web = s.nguon === 'NHAP_HO' || s.nguon === 'SUA_WEB';
  return id(
    db,
    `INSERT INTO san_luong (ngay_lam_viec, tram_id, cong_doan_id, nhan_vien_id, so_luong, smv_snapshot,
                            chuyen_tram_snapshot, nguon, da_dieu_chinh, cap_nhat_boi_tai_khoan_id)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, (SELECT chuyen_id FROM tram WHERE id = $2)), $8, $9, $10)`,
    [
      s.ngay,
      s.tramId,
      s.congDoanId,
      s.nhanVienId,
      s.soLuong,
      s.smv === undefined ? 30 : s.smv,
      s.chuyenId ?? null,
      s.nguon ?? 'APP',
      web,
      web ? s.taiKhoanId : null,
    ],
  );
}

export async function khoaThang(db: Db, maHangId: string, thang: string, trangThai: 'KHOA' | 'MO' = 'KHOA') {
  const tk = await taoTaiKhoan(db, 'IT_HR');
  await db.query(
    `INSERT INTO khoa_thang (ma_hang_id, thang, trang_thai, nguoi_thuc_hien_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (ma_hang_id, thang) DO UPDATE SET trang_thai = EXCLUDED.trang_thai`,
    [maHangId, thang, trangThai, tk],
  );
}

export async function chotNgay(db: Db, chuyenId: string, ngay: string) {
  const tk = await taoTaiKhoan(db);
  await db.query(`INSERT INTO chot_ngay (chuyen_id, ngay_lam_viec, chot_boi_id) VALUES ($1, $2, $3)`, [
    chuyenId,
    ngay,
    tk,
  ]);
}

export async function taoGioMacDinh(
  db: Db,
  xuongId: string,
  t: { loaiNgay: 'T2_T6' | 'T7' | 'CN'; soGio: number | null; tuNgay?: string },
) {
  await db.query(`INSERT INTO gio_mac_dinh (xuong_id, loai_ngay, so_gio, ap_dung_tu_ngay) VALUES ($1, $2, $3, $4)`, [
    xuongId,
    t.loaiNgay,
    t.soGio,
    t.tuNgay ?? '2026-01-01',
  ]);
}
