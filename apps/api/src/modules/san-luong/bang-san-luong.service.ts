import { Injectable } from '@nestjs/common';
import {
  type BangSanLuong,
  type CanhBaoChot,
  congNgay,
  daQuaGioMoChot,
  type DongBang,
  type NgayLamViec,
  type NguonSanLuong,
  thangCua,
  type zNgayBang,
  type zNvTimDuoc,
} from '@vsn/shared';
import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { CauHinhService } from '../../core/cau-hinh/cau-hinh.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { MaHangService } from '../ma-hang/ma-hang.service.js';
import { SoDoService } from '../so-do/so-do.service.js';

type Db = PrismaService | Tx;
const so = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));

interface BanGhi {
  id: string; version: number; tram_id: string; cong_doan_id: string; so_luong: number; nguon: NguonSanLuong;
  da_dieu_chinh: boolean; canh_bao: boolean; smv: Prisma.Decimal | null;
  nv_id: string; ma_nv: string; ho_ten: string; nv_ngung: boolean; ma_cg: string | null; cg: string | null;
  phut: Prisma.Decimal | null; nv_phut: Prisma.Decimal | null; nv_gio: Prisma.Decimal | null; nv_hs: Prisma.Decimal | null;
}

/**
 * Bảng sản lượng ngày · F10 [TDD 8.3, 14.3] — hàng = Trạm → Công đoạn theo SƠ ĐỒ CỦA NGÀY ĐÓ [R 3.6],
 * dòng của bản ghi lấy theo chuyền của bản ghi (chuyen_tram_snapshot) [CLAUDE.md #12].
 * Ô vàng: công đoạn có trong sơ đồ mà chưa có bản ghi · ô cam: cờ ⚠ (gửi sau khi gỡ công đoạn, NV đã ngưng,
 * "nhiều thiết bị" [D23]) · ô tím: Ô đã điều chỉnh.
 */
@Injectable()
export class BangSanLuongService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly cauHinh: CauHinhService,
    private readonly soDo: SoDoService,
    private readonly maHang: MaHangService,
  ) {}

  /** Mốc được chốt ngày D = Giờ mở chốt của ngày D+1 theo giờ VN [R 5.9] */
  async moChotTu(ngay: NgayLamViec): Promise<{ luc: Date; gio: string }> {
    const gio = await this.cauHinh.doc('gioMoChotNgay');
    return { luc: new Date(`${congNgay(ngay, 1)}T${gio}:00+07:00`), gio };
  }

  async xem(chuyenId: string, ngay: NgayLamViec): Promise<BangSanLuong> {
    const c = await this.prisma.chuyen.findUniqueOrThrow({ where: { id: chuyenId }, select: { ma: true } });
    const dong = await this.dong(this.prisma, chuyenId, ngay);
    const chot = await this.prisma.chotNgay.findUnique({
      where: { chuyenId_ngayLamViec: { chuyenId, ngayLamViec: ngayDb(ngay) } },
      include: { chotBoi: { select: { hoTen: true } } },
    });
    const now = this.clock.now();
    const { luc, gio } = await this.moChotTu(ngay);
    const coSo = dong.filter((d) => d.sanLuongId);
    return {
      chuyenId, maChuyen: c.ma, ngay, homNay: this.clock.homNay(),
      chot: chot ? { boi: chot.chotBoi.hoTen, luc: chot.chotLuc.toISOString() } : null,
      moChotTu: luc.toISOString(),
      duocChot: !chot && daQuaGioMoChot(ngay, now, gio),
      daKhoa: coSo.length > 0 && coSo.every((d) => d.biKhoa),
      gioChoDuyet: await this.soGioChoDuyet(this.prisma, chuyenId, ngay),
      dong,
      capNhatLuc: now.toISOString(),
    };
  }

  /** Yêu cầu giờ đang chờ của NV có sản lượng tại chuyền ngày đó, hoặc có chuyền gốc ngày đó = chuyền */
  private async soGioChoDuyet(db: Db, chuyenId: string, ngay: NgayLamViec): Promise<number> {
    const [r] = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM yeu_cau_gio y
      WHERE y.trang_thai = 'CHO' AND y.ngay_lam_viec = ${ngay}::date
        AND (chuyen_goc_ngay(y.nhan_vien_id, y.ngay_lam_viec) = ${chuyenId}::uuid
             OR EXISTS (SELECT 1 FROM san_luong s WHERE s.nhan_vien_id = y.nhan_vien_id
                        AND s.ngay_lam_viec = y.ngay_lam_viec AND s.chuyen_tram_snapshot = ${chuyenId}::uuid))`;
    return r?.n ?? 0;
  }

  /** Cảnh báo trước khi chốt [TDD 8.4 bước 5] — gọi TRONG transaction chốt (sau khóa độc quyền) */
  async canhBaoChot(tx: Tx, chuyenId: string, ngay: NgayLamViec): Promise<CanhBaoChot> {
    const dong = await this.dong(tx, chuyenId, ngay);
    return {
      oChuaCoSo: dong.filter((d) => d.trangThai === 'CHUA_CO_SO')
        .map((d) => ({ soTram: d.soTram, maCongDoan: d.maCongDoan, nhanVien: d.dangNhap ? `${d.dangNhap.maNV} ${d.dangNhap.hoTen}` : null })),
      oCanhBao: dong.filter((d) => d.trangThai === 'CANH_BAO').length,
      yeuCauGioChoDuyet: await this.soGioChoDuyet(tx, chuyenId, ngay),
    };
  }

  async dong(db: Db, chuyenId: string, ngay: NgayLamViec): Promise<DongBang[]> {
    const D = ngayDb(ngay);
    const tram = await db.tram.findMany({ where: { chuyenId }, select: { id: true, soTram: true } });
    const soTram = new Map(tram.map((t) => [t.id, t.soTram]));
    const soDo = await this.soDo.soDoNgay(db, tram.map((t) => t.id), ngay);

    const banGhi = await db.$queryRaw<BanGhi[]>`
      SELECT s.id, s.version, s.tram_id, s.cong_doan_id, s.so_luong, s.nguon::text AS nguon, s.da_dieu_chinh, s.canh_bao,
             s.smv_snapshot AS smv, nv.id AS nv_id, nv.ma_nv, nv.ho_ten, (nv.trang_thai <> 'HOAT_DONG') AS nv_ngung,
             g.cg, c.ma AS ma_cg, v.phut_smv AS phut, n.phut_smv AS nv_phut, n.gio_lam AS nv_gio, n.hieu_suat AS nv_hs
      FROM san_luong s
      JOIN nhan_vien nv ON nv.id = s.nhan_vien_id
      JOIN v_san_luong_chi_tiet v ON v.id = s.id
      LEFT JOIN v_nv_ngay n ON n.nhan_vien_id = s.nhan_vien_id AND n.ngay_lam_viec = s.ngay_lam_viec
      CROSS JOIN LATERAL (SELECT chuyen_goc_ngay(s.nhan_vien_id, s.ngay_lam_viec) AS cg) g
      LEFT JOIN chuyen c ON c.id = g.cg
      WHERE s.chuyen_tram_snapshot = ${chuyenId}::uuid AND s.ngay_lam_viec = ${D}`;

    const cdIds = [...new Set([...[...soDo.values()].flat(), ...banGhi.map((b) => b.cong_doan_id)])];
    const cds = await db.congDoan.findMany({
      where: { id: { in: cdIds } },
      select: { id: true, ma: true, ten: true, laCongDoanHoanThanh: true, maHangId: true, maHang: { select: { ma: true } } },
    });
    const cdMap = new Map(cds.map((x) => [x.id, x]));
    const smv = await this.maHang.smvTaiNgay(db, cdIds, ngay);
    const khoa = new Set(
      (await db.khoaThang.findMany({ where: { maHangId: { in: [...new Set(cds.map((x) => x.maHangId))] }, thang: thangCua(ngay), trangThai: 'KHOA' }, select: { maHangId: true } }))
        .map((k) => k.maHangId),
    );

    // Người đăng nhập trạm ngày đó (đang giữ, hoặc phiên gần nhất) — gợi ý cho ô vàng
    const phien = await db.phienTram.findMany({
      where: { tramId: { in: tram.map((t) => t.id) }, ngayLamViec: D },
      orderBy: [{ dangNhapLuc: 'desc' }],
      select: { tramId: true, dangXuatLuc: true, nhanVien: { select: { id: true, maNV: true, hoTen: true } } },
    });
    const dangNhap = new Map<string, { id: string; maNV: string; hoTen: string }>();
    for (const p of [...phien].sort((a, b) => Number(!!a.dangXuatLuc) - Number(!!b.dangXuatLuc))) {
      if (!dangNhap.has(p.tramId)) dangNhap.set(p.tramId, p.nhanVien);
    }

    // Cờ "nhiều thiết bị" [D23]: mã NV dùng ≥ 2 thiết bị trong ngày, hoặc thiết bị của NV từng đăng nhập ≥ 2 mã NV trong 7 ngày
    const nvIds = [...new Set(banGhi.map((b) => b.nv_id))];
    const tb = nvIds.length
      ? await db.$queryRaw<{ nv: string; so_tb: number; so_nv: number }[]>`
          SELECT p.nhan_vien_id AS nv, count(DISTINCT p.thiet_bi_id)::int AS so_tb,
                 (SELECT count(DISTINCT p2.nhan_vien_id)::int FROM phien_tram p2
                   WHERE p2.thiet_bi_id IN (SELECT p3.thiet_bi_id FROM phien_tram p3 WHERE p3.nhan_vien_id = p.nhan_vien_id AND p3.ngay_lam_viec = ${D})
                     AND p2.ngay_lam_viec BETWEEN ${ngayDb(congNgay(ngay, -6))} AND ${D}) AS so_nv
          FROM phien_tram p WHERE p.nhan_vien_id = ANY(${nvIds}::uuid[]) AND p.ngay_lam_viec = ${D}
          GROUP BY p.nhan_vien_id`
      : [];
    const coTb = new Map(tb.map((x) => [x.nv, x]));

    const lichSu = banGhi.length
      ? await db.$queryRaw<{ san_luong_id: string; luc: Date; so_cu: number | null; so_moi: number; nguon: NguonSanLuong; ten: string | null; ly_do: string | null }[]>`
          SELECT l.san_luong_id, l.luc_server AS luc, l.so_cu, l.so_moi, l.nguon::text AS nguon, l.ly_do,
                 COALESCE(tk.ho_ten, nv.ho_ten) AS ten
          FROM san_luong_lich_su l
          LEFT JOIN tai_khoan tk ON l.loai_nguoi_thuc_hien = 'TAI_KHOAN' AND tk.id = l.nguoi_thuc_hien_id
          LEFT JOIN nhan_vien nv ON l.loai_nguoi_thuc_hien = 'NHAN_VIEN' AND nv.id = l.nguoi_thuc_hien_id
          WHERE l.san_luong_id = ANY(${banGhi.map((b) => b.id)}::uuid[])
          ORDER BY l.luc_server DESC`
      : [];

    const cdCua = (id: string) => {
      const x = cdMap.get(id)!;
      return {
        congDoanId: id, maCongDoan: x.ma, tenCongDoan: x.ten, maMaHang: x.maHang.ma, laHoanThanh: x.laCongDoanHoanThanh,
        biKhoa: khoa.has(x.maHangId),
      };
    };
    const kq: DongBang[] = [];
    const daCo = new Set<string>();
    for (const b of banGhi) {
      daCo.add(`${b.tram_id}|${b.cong_doan_id}`);
      const canhBao: string[] = [];
      if (b.canh_bao) canhBao.push('Gửi sau khi công đoạn bị gỡ khỏi trạm');
      if (!(soDo.get(b.tram_id) ?? []).includes(b.cong_doan_id)) canhBao.push('Công đoạn không có trong sơ đồ ngày này');
      if (b.nv_ngung) canhBao.push('Nhân viên đã ngưng');
      const t = coTb.get(b.nv_id);
      if (t && t.so_tb >= 2) canhBao.push(`Nhiều thiết bị: mã NV dùng ${t.so_tb} thiết bị trong ngày`);
      if (t && t.so_nv >= 2) canhBao.push(`Nhiều thiết bị: thiết bị từng đăng nhập ${t.so_nv} mã NV trong 7 ngày`);
      kq.push({
        key: b.id, sanLuongId: b.id, version: b.version, tramId: b.tram_id, soTram: soTram.get(b.tram_id) ?? 0,
        ...cdCua(b.cong_doan_id), smv: so(b.smv),
        nhanVien: { id: b.nv_id, maNV: b.ma_nv, hoTen: b.ho_ten }, dangNhap: null,
        soLuong: b.so_luong, nguon: b.nguon,
        trangThai: b.da_dieu_chinh ? 'DA_DIEU_CHINH' : canhBao.length ? 'CANH_BAO' : 'BINH_THUONG',
        canhBao: b.da_dieu_chinh ? [] : canhBao,
        hoTroTu: b.cg && b.cg !== chuyenId ? b.ma_cg : null,
        phutSmv: so(b.phut), nvNgay: { phutSmv: so(b.nv_phut), gioLam: so(b.nv_gio), hieuSuat: so(b.nv_hs) },
        lichSu: lichSu.filter((l) => l.san_luong_id === b.id).map((l) => ({
          luc: l.luc.toISOString(), soCu: l.so_cu, soMoi: l.so_moi, nguon: l.nguon, boi: l.ten ?? '—', lyDo: l.ly_do,
        })),
      });
    }
    for (const [tramId, ds] of soDo) {
      for (const cdId of ds) {
        if (daCo.has(`${tramId}|${cdId}`)) continue;
        kq.push({
          key: `${tramId}|${cdId}`, sanLuongId: null, version: null, tramId, soTram: soTram.get(tramId) ?? 0,
          ...cdCua(cdId), smv: smv.get(cdId) ?? null, nhanVien: null, dangNhap: dangNhap.get(tramId) ?? null,
          soLuong: null, nguon: null, trangThai: 'CHUA_CO_SO', canhBao: [], hoTroTu: null, lichSu: [], phutSmv: null, nvNgay: null,
        });
      }
    }
    return kq.sort((a, b) => a.soTram - b.soTram || a.maCongDoan.localeCompare(b.maCongDoan, 'vi', { numeric: true })
      || (a.nhanVien?.maNV ?? '').localeCompare(b.nhanVien?.maNV ?? ''));
  }

  /** 14 ngày gần nhất của chuyền: có sản lượng / đã chốt / đã khóa — menu chọn ngày */
  async dsNgay(chuyenId: string): Promise<z.infer<typeof zNgayBang>[]> {
    const den = this.clock.homNay();
    const tu = congNgay(den, -13);
    const ds = await this.prisma.$queryRaw<{ ngay: Date; co: boolean; chot: boolean; khoa: boolean }[]>`
      SELECT d::date AS ngay,
             EXISTS (SELECT 1 FROM san_luong s WHERE s.chuyen_tram_snapshot = ${chuyenId}::uuid AND s.ngay_lam_viec = d::date) AS co,
             EXISTS (SELECT 1 FROM chot_ngay c WHERE c.chuyen_id = ${chuyenId}::uuid AND c.ngay_lam_viec = d::date) AS chot,
             (EXISTS (SELECT 1 FROM san_luong s WHERE s.chuyen_tram_snapshot = ${chuyenId}::uuid AND s.ngay_lam_viec = d::date)
              AND NOT EXISTS (SELECT 1 FROM san_luong s JOIN cong_doan cd ON cd.id = s.cong_doan_id
                LEFT JOIN khoa_thang k ON k.ma_hang_id = cd.ma_hang_id AND k.thang = to_char(s.ngay_lam_viec, 'YYYY-MM') AND k.trang_thai = 'KHOA'
                WHERE s.chuyen_tram_snapshot = ${chuyenId}::uuid AND s.ngay_lam_viec = d::date AND k.id IS NULL)) AS khoa
      FROM generate_series(${tu}::date, ${den}::date, interval '1 day') d
      ORDER BY d DESC`;
    return ds.map((d) => ({ ngay: tuNgayDb(d.ngay), coSanLuong: d.co, daChot: d.chot, daKhoa: d.khoa }));
  }

  /** NV đang hoạt động (mọi chuyền) theo mã / tên — nhập hộ [R 5.8] */
  async timNhanVien(q: string): Promise<z.infer<typeof zNvTimDuoc>[]> {
    const ds = await this.prisma.nhanVien.findMany({
      where: { trangThai: 'HOAT_DONG', OR: [{ maNV: { startsWith: q.toUpperCase() } }, { hoTen: { contains: q, mode: 'insensitive' } }] },
      orderBy: { maNV: 'asc' },
      take: 20,
      select: { id: true, maNV: true, hoTen: true, chuyen: { select: { ma: true } } },
    });
    return ds.map((n) => ({ id: n.id, maNV: n.maNV, hoTen: n.hoTen, maChuyen: n.chuyen?.ma ?? null }));
  }
}
