import { Injectable } from '@nestjs/common';
import {
  congNgay,
  type CuaToiNgay,
  type DongChuyen,
  type DongCongDoan,
  type DongCongNhan,
  type DongLichSu,
  type DongMaHang,
  type LoaiBaoCao,
  type NgayCuaToi,
  type NguonSanLuong,
  type PhamVi,
  thangCua,
  type TrangThaiSoLieu,
} from '@vsn/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';

type Dec = Prisma.Decimal | number | null;
const so = (d: Dec | undefined) => (d == null ? null : Number(d));
const soNguyen = (d: Dec | undefined) => (d == null ? 0 : Number(d));

export interface Loc {
  tu: string; den: string; xuongId?: string; chuyenId?: string; maHangId?: string; q?: string;
}
/** null = lấy toàn bộ dòng (Excel) */
export type Trang = { trang: number; kichThuoc: number } | null;
export interface KetQua<T> { dong: T[]; tongDong: number; tongCong: Record<string, number | null> }
export type DongTheoLoai = { 'cong-nhan': DongCongNhan; 'cong-doan': DongCongDoan; chuyen: DongChuyen; 'ma-hang': DongMaHang; 'lich-su': DongLichSu };

/** Trạng thái gộp của nhiều (chuyền, mã hàng) trong 1 ngày: mọi mã hàng đã khóa → DA_KHOA; đã chốt → DA_CHOT */
const gopTrangThai = (ds: string[] | null): TrangThaiSoLieu =>
  !ds?.length ? 'CHUA_CHOT' : ds.every((x) => x === 'DA_KHOA') ? 'DA_KHOA' : ds.some((x) => x !== 'CHUA_CHOT') ? 'DA_CHOT' : 'CHUA_CHOT';

/**
 * Báo cáo sản lượng · F5 [TDD 13.2] [D10] [D15] [D18] [D20] + "Của tôi" · F11.
 * - Đọc qua view v_san_luong_chi_tiet / v_nv_ngay / v_nv_chuyen_ngay — KHÔNG tự tính công thức [CLAUDE.md #5].
 * - Màn hình (1 trang) và Excel (toàn bộ) gọi CÙNG hàm → tổng màn hình = tổng Excel.
 * - Phạm vi R3 [R 5.8]: sản lượng theo chuyền của trạm (chuyen_tram_snapshot); tổ trưởng xem thêm (chỉ đọc) sản lượng của NV
 *   chuyền mình ở chuyền khác — chỉ ở báo cáo theo người (theo công nhân, lịch sử). Tham số ngoài phạm vi → 403.
 */
@Injectable()
export class BaoCaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly phamVi: PhamViService,
  ) {}

  homNay(): string {
    return this.clock.homNay();
  }

  /**
   * Điều kiện WHERE trên bí danh `s` (cột chuyen_tram_snapshot, nhan_vien_id, ngay_lam_viec[, ma_hang_id]).
   * `theoNv`: báo cáo theo người → tổ trưởng thấy cả NV có chuyền gốc NGÀY ĐÓ thuộc chuyền mình [D18].
   */
  private async dk(pv: PhamVi, loc: Loc, tc: { theoNv: boolean; maHang: boolean }): Promise<Prisma.Sql> {
    const parts: Prisma.Sql[] = [Prisma.sql`s.ngay_lam_viec BETWEEN ${loc.tu}::date AND ${loc.den}::date`];
    const ids = await this.phamVi.chuyenIds(pv);
    if (ids) {
      parts.push(pv.loai === 'CHUYEN' && tc.theoNv
        ? Prisma.sql`(s.chuyen_tram_snapshot = ANY(${ids}::uuid[]) OR chuyen_goc_ngay(s.nhan_vien_id, s.ngay_lam_viec) = ANY(${ids}::uuid[]))`
        : Prisma.sql`s.chuyen_tram_snapshot = ANY(${ids}::uuid[])`);
    }
    if (loc.chuyenId) {
      await this.phamVi.kiemTraChuyen(pv, loc.chuyenId);
      parts.push(tc.theoNv
        ? Prisma.sql`(s.chuyen_tram_snapshot = ${loc.chuyenId}::uuid OR chuyen_goc_ngay(s.nhan_vien_id, s.ngay_lam_viec) = ${loc.chuyenId}::uuid)`
        : Prisma.sql`s.chuyen_tram_snapshot = ${loc.chuyenId}::uuid`);
    }
    if (loc.xuongId) {
      await this.phamVi.kiemTraXuong(pv, loc.xuongId);
      parts.push(Prisma.sql`s.chuyen_tram_snapshot IN (SELECT id FROM chuyen WHERE xuong_id = ${loc.xuongId}::uuid)`);
    }
    if (loc.maHangId && tc.maHang) parts.push(Prisma.sql`s.ma_hang_id = ${loc.maHangId}::uuid`);
    if (loc.q) {
      parts.push(Prisma.sql`s.nhan_vien_id IN (SELECT id FROM nhan_vien WHERE ma_nv ILIKE ${`${loc.q}%`} OR ho_ten ILIKE ${`%${loc.q}%`})`);
    }
    return Prisma.join(parts, ' AND ');
  }

  private gioiHan(trang: Trang): Prisma.Sql {
    return trang ? Prisma.sql`LIMIT ${trang.kichThuoc} OFFSET ${(trang.trang - 1) * trang.kichThuoc}` : Prisma.empty;
  }

  async chay<L extends LoaiBaoCao>(loai: L, pv: PhamVi, loc: Loc, trang: Trang): Promise<KetQua<DongTheoLoai[L]>> {
    const fn = {
      'cong-nhan': () => this.congNhan(pv, loc, trang),
      'cong-doan': () => this.congDoan(pv, loc, trang),
      chuyen: () => this.chuyen(pv, loc, trang),
      'ma-hang': () => this.maHang(pv, loc, trang),
      'lich-su': () => this.lichSu(pv, loc, trang),
    }[loai];
    return fn() as Promise<KetQua<DongTheoLoai[L]>>;
  }

  // ── Theo công nhân: 1 dòng = NV × ngày × chuyền (v_nv_chuyen_ngay — giờ làm phân bổ theo phút SMV [D15]) ──
  private async congNhan(pv: PhamVi, loc: Loc, trang: Trang): Promise<KetQua<DongCongNhan>> {
    const dk = await this.dk(pv, loc, { theoNv: true, maHang: false });
    const cte = Prisma.sql`
      WITH s AS (SELECT v.nhan_vien_id, v.ngay_lam_viec, v.chuyen_id AS chuyen_tram_snapshot, v.san_luong_chuyen,
                        v.phut_smv_chuyen, v.phut_lam_phan_bo, v.thieu_smv FROM v_nv_chuyen_ngay v),
           r AS (SELECT s.* FROM s WHERE ${dk})`;
    const ds = await this.prisma.$queryRaw<{
      nhan_vien_id: string; ngay_lam_viec: Date; chuyen_tram_snapshot: string; san_luong_chuyen: Dec; phut_smv_chuyen: Dec;
      phut_lam_phan_bo: Dec; thieu_smv: boolean; ma_nv: string; ho_ten: string; ma_chuyen: string; hieu_suat: Dec;
      tam_tinh: boolean; gio_cho_duyet: boolean; chuyen_goc_id: string | null; ma_cg: string | null; tram: number[] | null;
      cong_doan: string[] | null; tt: string[] | null;
    }[]>`${cte}
      SELECT r.*, nv.ma_nv, nv.ho_ten, c.ma AS ma_chuyen, n.hieu_suat,
             (n.hieu_suat_tam_tinh AND gio_lam_bi_khoa(r.nhan_vien_id, r.ngay_lam_viec)) AS tam_tinh,
             n.gio_cho_duyet, n.chuyen_goc_id, cg.ma AS ma_cg,
             (SELECT array_agg(DISTINCT t.so_tram ORDER BY t.so_tram) FROM san_luong x JOIN tram t ON t.id = x.tram_id
               WHERE x.nhan_vien_id = r.nhan_vien_id AND x.ngay_lam_viec = r.ngay_lam_viec AND x.chuyen_tram_snapshot = r.chuyen_tram_snapshot) AS tram,
             (SELECT array_agg(DISTINCT cd.ma ORDER BY cd.ma) FROM san_luong x JOIN cong_doan cd ON cd.id = x.cong_doan_id
               WHERE x.nhan_vien_id = r.nhan_vien_id AND x.ngay_lam_viec = r.ngay_lam_viec AND x.chuyen_tram_snapshot = r.chuyen_tram_snapshot) AS cong_doan,
             (SELECT array_agg(DISTINCT trang_thai_ngay(r.chuyen_tram_snapshot, r.ngay_lam_viec, cd.ma_hang_id))
                FROM san_luong x JOIN cong_doan cd ON cd.id = x.cong_doan_id
               WHERE x.nhan_vien_id = r.nhan_vien_id AND x.ngay_lam_viec = r.ngay_lam_viec AND x.chuyen_tram_snapshot = r.chuyen_tram_snapshot) AS tt
      FROM r
      JOIN nhan_vien nv ON nv.id = r.nhan_vien_id
      JOIN chuyen c ON c.id = r.chuyen_tram_snapshot
      -- Khoảng ngày lặp lại trên vế view → PostgreSQL đẩy xuống (điều kiện khoảng không tự lan qua phép JOIN)
      JOIN v_nv_ngay n ON n.nhan_vien_id = r.nhan_vien_id AND n.ngay_lam_viec = r.ngay_lam_viec
        AND n.ngay_lam_viec BETWEEN ${loc.tu}::date AND ${loc.den}::date
      LEFT JOIN chuyen cg ON cg.id = n.chuyen_goc_id
      ORDER BY nv.ma_nv, r.ngay_lam_viec, c.ma
      ${this.gioiHan(trang)}`;
    const [t] = await this.prisma.$queryRaw<{ so_dong: number; san_luong: Dec; phut_smv: Dec; phut_lam: Dec; hieu_suat: Dec }[]>`${cte}
      SELECT count(*)::int AS so_dong, sum(san_luong_chuyen) AS san_luong, sum(phut_smv_chuyen) AS phut_smv, sum(phut_lam_phan_bo) AS phut_lam,
             sum(phut_smv_chuyen) FILTER (WHERE phut_lam_phan_bo IS NOT NULL) / NULLIF(sum(phut_lam_phan_bo), 0) * 100 AS hieu_suat
      FROM r`;
    return {
      dong: ds.map((d) => ({
        nhanVienId: d.nhan_vien_id, maNV: d.ma_nv, hoTen: d.ho_ten, ngay: tuNgayDb(d.ngay_lam_viec),
        chuyenId: d.chuyen_tram_snapshot, maChuyen: d.ma_chuyen, tram: d.tram ?? [], congDoan: d.cong_doan ?? [],
        sanLuong: soNguyen(d.san_luong_chuyen), phutSmv: so(d.phut_smv_chuyen),
        gioLam: d.phut_lam_phan_bo == null ? null : Number(d.phut_lam_phan_bo) / 60,
        hieuSuat: so(d.hieu_suat), tamTinh: d.tam_tinh, gioChoDuyet: d.gio_cho_duyet, thieuSmv: d.thieu_smv,
        hoTroTu: d.chuyen_goc_id && d.chuyen_goc_id !== d.chuyen_tram_snapshot ? d.ma_cg : null,
        trangThai: gopTrangThai(d.tt),
      })),
      tongDong: t?.so_dong ?? 0,
      tongCong: { sanLuong: soNguyen(t?.san_luong), phutSmv: so(t?.phut_smv), phutLam: so(t?.phut_lam), hieuSuat: so(t?.hieu_suat) },
    };
  }

  // ── Theo công đoạn / trạm: 1 dòng = chuyền × trạm × công đoạn trong kỳ ──
  private async congDoan(pv: PhamVi, loc: Loc, trang: Trang): Promise<KetQua<DongCongDoan>> {
    const dk = await this.dk(pv, loc, { theoNv: false, maHang: true });
    const nhom = Prisma.sql`
      SELECT s.chuyen_tram_snapshot AS chuyen_id, c.ma AS ma_chuyen, s.tram_id, t.so_tram, s.cong_doan_id, cd.ma, cd.ten, mh.ma AS ma_mh,
             CASE WHEN count(DISTINCT s.smv_snapshot) = 1 AND bool_and(s.smv_snapshot IS NOT NULL) THEN max(s.smv_snapshot) END AS smv,
             sum(s.so_luong) AS san_luong, sum(s.phut_smv) AS phut_smv
      FROM v_san_luong_chi_tiet s
      JOIN chuyen c ON c.id = s.chuyen_tram_snapshot JOIN tram t ON t.id = s.tram_id
      JOIN cong_doan cd ON cd.id = s.cong_doan_id JOIN ma_hang mh ON mh.id = s.ma_hang_id
      WHERE ${dk}
      GROUP BY s.chuyen_tram_snapshot, c.ma, s.tram_id, t.so_tram, s.cong_doan_id, cd.ma, cd.ten, mh.ma`;
    const ds = await this.prisma.$queryRaw<{ chuyen_id: string; ma_chuyen: string; tram_id: string; so_tram: number; cong_doan_id: string; ma: string; ten: string; ma_mh: string; smv: Dec; san_luong: Dec; phut_smv: Dec }[]>`
      ${nhom} ORDER BY c.ma, t.so_tram, cd.ma ${this.gioiHan(trang)}`;
    const [t] = await this.prisma.$queryRaw<{ so_dong: number; san_luong: Dec; phut_smv: Dec }[]>`
      SELECT count(*)::int AS so_dong, sum(san_luong) AS san_luong, sum(phut_smv) AS phut_smv FROM (${nhom}) g`;
    return {
      dong: ds.map((d) => ({
        chuyenId: d.chuyen_id, maChuyen: d.ma_chuyen, tramId: d.tram_id, soTram: d.so_tram, congDoanId: d.cong_doan_id,
        maCongDoan: d.ma, tenCongDoan: d.ten, maMaHang: d.ma_mh, smv: so(d.smv), sanLuong: soNguyen(d.san_luong), phutSmv: so(d.phut_smv),
      })),
      tongDong: t?.so_dong ?? 0,
      tongCong: { sanLuong: soNguyen(t?.san_luong), phutSmv: so(t?.phut_smv) },
    };
  }

  // ── Theo chuyền: % hiệu suất chuyền = Σ phút SMV ÷ Σ phút làm (phân bổ) [D15] ──
  private async chuyen(pv: PhamVi, loc: Loc, trang: Trang): Promise<KetQua<DongChuyen>> {
    const dkV = await this.dk(pv, loc, { theoNv: false, maHang: false });
    const dkS = await this.dk(pv, loc, { theoNv: false, maHang: false });
    const nhom = Prisma.sql`
      WITH a AS (
        SELECT s.* FROM (SELECT v.nhan_vien_id, v.ngay_lam_viec, v.chuyen_id AS chuyen_tram_snapshot, v.san_luong_chuyen,
                                v.phut_smv_chuyen, v.phut_lam_phan_bo FROM v_nv_chuyen_ngay v) s WHERE ${dkV}),
      h AS (
        SELECT s.chuyen_tram_snapshot, sum(s.so_luong) FILTER (WHERE cd.la_cong_doan_hoan_thanh) AS hoan_thanh
        FROM v_san_luong_chi_tiet s JOIN cong_doan cd ON cd.id = s.cong_doan_id WHERE ${dkS} GROUP BY 1)
      SELECT c.id, c.ma, c.ten, COALESCE(max(h.hoan_thanh), 0) AS hoan_thanh,
             sum(a.san_luong_chuyen) AS san_luong, sum(a.phut_smv_chuyen) AS phut_smv, sum(a.phut_lam_phan_bo) AS phut_lam,
             sum(a.phut_smv_chuyen) FILTER (WHERE a.phut_lam_phan_bo IS NOT NULL) / NULLIF(sum(a.phut_lam_phan_bo), 0) * 100 AS hieu_suat,
             count(DISTINCT a.nhan_vien_id)::int AS so_nv,
             bool_or(n.hieu_suat_tam_tinh AND gio_lam_bi_khoa(a.nhan_vien_id, a.ngay_lam_viec)) AS tam_tinh
      FROM a JOIN chuyen c ON c.id = a.chuyen_tram_snapshot
      JOIN v_nv_ngay n ON n.nhan_vien_id = a.nhan_vien_id AND n.ngay_lam_viec = a.ngay_lam_viec
        AND n.ngay_lam_viec BETWEEN ${loc.tu}::date AND ${loc.den}::date
      LEFT JOIN h ON h.chuyen_tram_snapshot = c.id
      GROUP BY c.id, c.ma, c.ten`;
    const ds = await this.prisma.$queryRaw<{ id: string; ma: string; ten: string; hoan_thanh: Dec; san_luong: Dec; phut_smv: Dec; phut_lam: Dec; hieu_suat: Dec; so_nv: number; tam_tinh: boolean }[]>`
      ${nhom} ORDER BY c.ma ${this.gioiHan(trang)}`;
    const [t] = await this.prisma.$queryRaw<{ so_dong: number; hoan_thanh: Dec; san_luong: Dec; phut_smv: Dec; phut_lam: Dec; hieu_suat: Dec }[]>`
      SELECT count(*)::int AS so_dong, sum(hoan_thanh) AS hoan_thanh, sum(san_luong) AS san_luong, sum(phut_smv) AS phut_smv, sum(phut_lam) AS phut_lam,
             sum(phut_smv) FILTER (WHERE phut_lam IS NOT NULL) / NULLIF(sum(phut_lam), 0) * 100 AS hieu_suat
      FROM (${nhom}) g`;
    return {
      dong: ds.map((d) => ({
        chuyenId: d.id, maChuyen: d.ma, tenChuyen: d.ten, hoanThanh: soNguyen(d.hoan_thanh), sanLuong: soNguyen(d.san_luong),
        phutSmv: so(d.phut_smv), phutLam: so(d.phut_lam), hieuSuat: so(d.hieu_suat), soNv: d.so_nv, tamTinh: !!d.tam_tinh,
      })),
      tongDong: t?.so_dong ?? 0,
      tongCong: { hoanThanh: soNguyen(t?.hoan_thanh), sanLuong: soNguyen(t?.san_luong), phutSmv: so(t?.phut_smv), phutLam: so(t?.phut_lam), hieuSuat: so(t?.hieu_suat) },
    };
  }

  // ── Theo mã hàng: Đã làm = sản lượng công đoạn hoàn thành; lũy kế đến ngày cuối kỳ ──
  private async maHang(pv: PhamVi, loc: Loc, trang: Trang): Promise<KetQua<DongMaHang>> {
    const dk = await this.dk(pv, loc, { theoNv: false, maHang: true });
    const dkLuyKe = await this.dk(pv, { ...loc, tu: '2000-01-01' }, { theoNv: false, maHang: true });
    const ds = await this.prisma.$queryRaw<{ id: string; ma: string; ten: string; so_luong_don_hang: number; da_lam: Dec }[]>`
      SELECT mh.id, mh.ma, mh.ten, mh.so_luong_don_hang, COALESCE(sum(s.so_luong) FILTER (WHERE cd.la_cong_doan_hoan_thanh), 0) AS da_lam
      FROM v_san_luong_chi_tiet s JOIN cong_doan cd ON cd.id = s.cong_doan_id JOIN ma_hang mh ON mh.id = s.ma_hang_id
      WHERE ${dk} GROUP BY mh.id, mh.ma, mh.ten, mh.so_luong_don_hang ORDER BY mh.ma`;
    const ids = ds.map((d) => d.id);
    const luyKe = ids.length
      ? await this.prisma.$queryRaw<{ id: string; da_lam: Dec }[]>`
          SELECT s.ma_hang_id AS id, COALESCE(sum(s.so_luong) FILTER (WHERE cd.la_cong_doan_hoan_thanh), 0) AS da_lam
          FROM v_san_luong_chi_tiet s JOIN cong_doan cd ON cd.id = s.cong_doan_id
          WHERE ${dkLuyKe} AND s.ma_hang_id = ANY(${ids}::uuid[]) GROUP BY s.ma_hang_id`
      : [];
    const cd = ids.length
      ? await this.prisma.$queryRaw<{ ma_hang_id: string; ma: string; ten: string; san_luong: Dec }[]>`
          SELECT s.ma_hang_id, cd.ma, cd.ten, sum(s.so_luong) AS san_luong
          FROM v_san_luong_chi_tiet s JOIN cong_doan cd ON cd.id = s.cong_doan_id
          WHERE ${dk} GROUP BY s.ma_hang_id, cd.ma, cd.ten ORDER BY cd.ma`
      : [];
    const khoa = await this.prisma.khoaThang.findMany({ where: { maHangId: { in: ids }, thang: thangCua(loc.den) }, select: { maHangId: true, trangThai: true } });
    const tatCa = ds.map((d): DongMaHang => {
      const lk = soNguyen(luyKe.find((x) => x.id === d.id)?.da_lam);
      return {
        maHangId: d.id, ma: d.ma, ten: d.ten, soLuongDonHang: d.so_luong_don_hang, daLamKy: soNguyen(d.da_lam), daLamLuyKe: lk,
        conLai: Math.max(0, d.so_luong_don_hang - lk), phanTram: d.so_luong_don_hang > 0 ? (lk / d.so_luong_don_hang) * 100 : null,
        trangThaiThang: khoa.find((k) => k.maHangId === d.id)?.trangThai ?? null,
        congDoan: cd.filter((x) => x.ma_hang_id === d.id).map((x) => ({ ma: x.ma, ten: x.ten, sanLuong: soNguyen(x.san_luong) })),
      };
    });
    const dong = trang ? tatCa.slice((trang.trang - 1) * trang.kichThuoc, trang.trang * trang.kichThuoc) : tatCa;
    return { dong, tongDong: tatCa.length, tongCong: { daLamKy: tatCa.reduce((a, d) => a + d.daLamKy, 0) } };
  }

  // ── Lịch sử chỉnh sửa: mọi lần ghi (App / Nhập hộ / Sửa Web) — ai, lúc nào, số cũ → mới, lý do ──
  private async lichSu(pv: PhamVi, loc: Loc, trang: Trang): Promise<KetQua<DongLichSu>> {
    const dk = await this.dk(pv, loc, { theoNv: true, maHang: true });
    const tu = Prisma.sql`
      FROM san_luong_lich_su l JOIN v_san_luong_chi_tiet s ON s.id = l.san_luong_id
      JOIN chuyen c ON c.id = s.chuyen_tram_snapshot JOIN tram t ON t.id = s.tram_id
      JOIN cong_doan cd ON cd.id = s.cong_doan_id JOIN nhan_vien nv ON nv.id = s.nhan_vien_id
      LEFT JOIN tai_khoan tk ON l.loai_nguoi_thuc_hien = 'TAI_KHOAN' AND tk.id = l.nguoi_thuc_hien_id
      LEFT JOIN nhan_vien nvt ON l.loai_nguoi_thuc_hien = 'NHAN_VIEN' AND nvt.id = l.nguoi_thuc_hien_id
      WHERE ${dk}`;
    const ds = await this.prisma.$queryRaw<{ id: string; luc: Date; nguoi: string; ngay: Date; ma_chuyen: string; so_tram: number; ma_cd: string; ma_nv: string; ho_ten: string; so_cu: number | null; so_moi: number; nguon: NguonSanLuong; ly_do: string | null }[]>`
      SELECT l.id, l.luc_server AS luc, COALESCE(tk.ho_ten, nvt.ho_ten, 'Hệ thống') AS nguoi, s.ngay_lam_viec AS ngay, c.ma AS ma_chuyen,
             t.so_tram, cd.ma AS ma_cd, nv.ma_nv, nv.ho_ten, l.so_cu, l.so_moi, l.nguon::text AS nguon, l.ly_do
      ${tu} ORDER BY l.luc_server DESC, l.id DESC ${this.gioiHan(trang)}`;
    const [t] = await this.prisma.$queryRaw<{ so_dong: number }[]>`SELECT count(*)::int AS so_dong ${tu}`;
    return {
      dong: ds.map((d) => ({
        id: d.id, luc: d.luc.toISOString(), nguoi: d.nguoi, ngay: tuNgayDb(d.ngay), maChuyen: d.ma_chuyen, soTram: d.so_tram,
        maCongDoan: d.ma_cd, maNV: d.ma_nv, hoTenNV: d.ho_ten, soCu: d.so_cu, soMoi: d.so_moi, nguon: d.nguon, lyDo: d.ly_do,
      })),
      tongDong: t?.so_dong ?? 0,
      tongCong: { soLanGhi: t?.so_dong ?? 0 },
    };
  }

  // ── F11 "Của tôi" — cùng view với F5 → số khớp 100% ──

  private async ngayCuaNv(nhanVienId: string, tu: string, den: string): Promise<NgayCuaToi[]> {
    const ds = await this.prisma.$queryRaw<{ ngay: Date; san_luong: Dec; phut_smv: Dec; gio_lam: Dec; hieu_suat: Dec; tam_tinh: boolean; gio_cho_duyet: boolean; tt: string[] | null; co_dc: boolean }[]>`
      SELECT n.ngay_lam_viec AS ngay, n.tong_san_luong AS san_luong, n.phut_smv, n.gio_lam, n.hieu_suat,
             (n.hieu_suat_tam_tinh AND gio_lam_bi_khoa(n.nhan_vien_id, n.ngay_lam_viec)) AS tam_tinh, n.gio_cho_duyet,
             (SELECT array_agg(DISTINCT trang_thai_ngay(x.chuyen_tram_snapshot, x.ngay_lam_viec, cd.ma_hang_id))
                FROM san_luong x JOIN cong_doan cd ON cd.id = x.cong_doan_id
               WHERE x.nhan_vien_id = n.nhan_vien_id AND x.ngay_lam_viec = n.ngay_lam_viec) AS tt,
             EXISTS (SELECT 1 FROM san_luong x WHERE x.nhan_vien_id = n.nhan_vien_id AND x.ngay_lam_viec = n.ngay_lam_viec AND x.da_dieu_chinh) AS co_dc
      FROM v_nv_ngay n
      WHERE n.nhan_vien_id = ${nhanVienId}::uuid AND n.ngay_lam_viec BETWEEN ${tu}::date AND ${den}::date
      ORDER BY n.ngay_lam_viec DESC`;
    return ds.map((d) => ({
      ngay: tuNgayDb(d.ngay), sanLuong: soNguyen(d.san_luong), phutSmv: so(d.phut_smv), gioLam: so(d.gio_lam), hieuSuat: so(d.hieu_suat),
      tamTinh: d.tam_tinh, gioChoDuyet: d.gio_cho_duyet, trangThai: gopTrangThai(d.tt), coDieuChinh: d.co_dc,
    }));
  }

  /** 30 ngày gần nhất (kể cả hôm nay) có sản lượng — ngày không có sản lượng không hiện */
  async cuaToi(nhanVienId: string) {
    const den = this.clock.homNay();
    const tu = congNgay(den, -29);
    return { tu, den, ngay: await this.ngayCuaNv(nhanVienId, tu, den) };
  }

  async cuaToiNgay(nhanVienId: string, ngay: string): Promise<CuaToiNgay | null> {
    const [tongHop] = await this.ngayCuaNv(nhanVienId, ngay, ngay);
    if (!tongHop) return null;
    const ds = await this.prisma.$queryRaw<{ id: string; tram_id: string; so_tram: number; ma_chuyen: string; cong_doan_id: string; ma: string; ten: string; so_luong: number; da_dieu_chinh: boolean }[]>`
      SELECT s.id, s.tram_id, t.so_tram, c.ma AS ma_chuyen, s.cong_doan_id, cd.ma, cd.ten, s.so_luong, s.da_dieu_chinh
      FROM san_luong s JOIN tram t ON t.id = s.tram_id JOIN chuyen c ON c.id = s.chuyen_tram_snapshot JOIN cong_doan cd ON cd.id = s.cong_doan_id
      WHERE s.nhan_vien_id = ${nhanVienId}::uuid AND s.ngay_lam_viec = ${ngay}::date
      ORDER BY t.so_tram, cd.ma`;
    const dcIds = ds.filter((d) => d.da_dieu_chinh).map((d) => d.id);
    const dc = dcIds.length
      ? await this.prisma.$queryRaw<{ san_luong_id: string; so_cu: number | null; ly_do: string | null; boi: string; luc: Date }[]>`
          SELECT DISTINCT ON (l.san_luong_id) l.san_luong_id, l.so_cu, l.ly_do, COALESCE(tk.ho_ten, 'Tổ trưởng') AS boi, l.luc_server AS luc
          FROM san_luong_lich_su l LEFT JOIN tai_khoan tk ON l.loai_nguoi_thuc_hien = 'TAI_KHOAN' AND tk.id = l.nguoi_thuc_hien_id
          WHERE l.san_luong_id = ANY(${dcIds}::uuid[]) AND l.nguon IN ('NHAP_HO', 'SUA_WEB')
          ORDER BY l.san_luong_id, l.luc_server DESC`
      : [];
    const tram: CuaToiNgay['tram'] = [];
    for (const d of ds) {
      let t = tram.find((x) => x.tramId === d.tram_id);
      if (!t) tram.push((t = { tramId: d.tram_id, soTram: d.so_tram, maChuyen: d.ma_chuyen, dong: [] }));
      const a = dc.find((x) => x.san_luong_id === d.id);
      t.dong.push({
        congDoanId: d.cong_doan_id, ma: d.ma, ten: d.ten, soLuong: d.so_luong,
        dieuChinh: a ? { soCu: a.so_cu, lyDo: a.ly_do, boi: a.boi, luc: a.luc.toISOString() } : null,
      });
    }
    return { ...tongHop, tram };
  }
}
