import type { Writable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { congNgay, type DongAuditLog, dinhDangNgay } from '@vsn/shared';
import ExcelJS from 'exceljs';
import { Prisma } from '../../generated/prisma/client.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';

export interface LocAudit { tu: string; den: string; hanhDong?: string; q?: string }

/** Khoảng thời điểm của ngày làm việc theo giờ VN (+07:00 cố định) */
const moc = (ngay: string) => new Date(`${ngay}T00:00:00.000+07:00`);

/**
 * Xem audit log · F8 (Superadmin, AUDIT_XEM) [TDD 12]. Bảng chỉ-thêm: vsn_app không có UPDATE/DELETE [D9].
 * Người thực hiện hiển thị theo loại: tài khoản Web (tên đăng nhập), công nhân (mã NV), DB trực tiếp (tài khoản DB).
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Mặc định 7 ngày gần nhất */
  khoang(tu?: string, den?: string): { tu: string; den: string } {
    const d = den ?? this.clock.homNay();
    return { tu: tu ?? congNgay(d, -6), den: d };
  }

  private dk(loc: LocAudit): Prisma.Sql {
    const parts = [Prisma.sql`a.luc >= ${moc(loc.tu)} AND a.luc < ${moc(congNgay(loc.den, 1))}`];
    if (loc.hanhDong) parts.push(Prisma.sql`a.hanh_dong = ${loc.hanhDong}`);
    if (loc.q) {
      const t = `%${loc.q}%`;
      parts.push(Prisma.sql`(tk.ten_dang_nhap ILIKE ${t} OR tk.ho_ten ILIKE ${t} OR nv.ma_nv ILIKE ${t} OR nv.ho_ten ILIKE ${t} OR a.db_user ILIKE ${t})`);
    }
    return Prisma.join(parts, ' AND ');
  }

  private readonly tu = Prisma.sql`
    FROM audit_log a
    LEFT JOIN tai_khoan tk ON a.loai_nguoi_thuc_hien = 'TAI_KHOAN' AND tk.id = a.nguoi_thuc_hien_id
    LEFT JOIN nhan_vien nv ON a.loai_nguoi_thuc_hien = 'NHAN_VIEN' AND nv.id = a.nguoi_thuc_hien_id`;

  async ds(loc: LocAudit, trang: { trang: number; kichThuoc: number } | null) {
    const dk = this.dk(loc);
    const gioiHan = trang ? Prisma.sql`LIMIT ${trang.kichThuoc} OFFSET ${(trang.trang - 1) * trang.kichThuoc}` : Prisma.empty;
    const ds = await this.prisma.$queryRaw<{
      id: string; luc: Date; loai: DongAuditLog['loaiNguoiThucHien']; ten_dang_nhap: string | null; tk_ho_ten: string | null; ma_nv: string | null;
      nv_ho_ten: string | null; db_user: string | null; hanh_dong: string; doi_tuong: string; doi_tuong_id: string | null;
      du_lieu_cu: unknown; du_lieu_moi: unknown; ly_do: string | null; ip: string | null; trace_id: string | null;
    }[]>`
      SELECT a.id, a.luc, a.loai_nguoi_thuc_hien::text AS loai, tk.ten_dang_nhap, tk.ho_ten AS tk_ho_ten, nv.ma_nv, nv.ho_ten AS nv_ho_ten,
             a.db_user, a.hanh_dong, a.doi_tuong, a.doi_tuong_id, a.du_lieu_cu, a.du_lieu_moi, a.ly_do, a.ip, a.trace_id
      ${this.tu} WHERE ${dk} ORDER BY a.luc DESC, a.id DESC ${gioiHan}`;
    const [t] = await this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${this.tu} WHERE ${dk}`;
    const hd = await this.prisma.$queryRaw<{ hanh_dong: string }[]>`
      SELECT DISTINCT a.hanh_dong FROM audit_log a
      WHERE a.luc >= ${moc(loc.tu)} AND a.luc < ${moc(congNgay(loc.den, 1))} ORDER BY 1`;
    return {
      dong: ds.map((d): DongAuditLog => ({
        id: d.id, luc: d.luc.toISOString(), loaiNguoiThucHien: d.loai,
        nguoi: d.ten_dang_nhap ?? d.ma_nv ?? d.db_user ?? (d.loai === 'HE_THONG' ? 'Hệ thống' : d.loai === 'NHAN_VIEN' ? 'Công nhân' : '—'),
        hoTen: d.tk_ho_ten ?? d.nv_ho_ten ?? null,
        hanhDong: d.hanh_dong, doiTuong: d.doi_tuong, doiTuongId: d.doi_tuong_id, duLieuCu: d.du_lieu_cu ?? null, duLieuMoi: d.du_lieu_moi ?? null,
        lyDo: d.ly_do, ip: d.ip, traceId: d.trace_id,
      })),
      tongDong: t?.n ?? 0,
      dsHanhDong: hd.map((h) => h.hanh_dong),
    };
  }

  /** Xuất Excel (stream) — cùng hàm truy vấn với màn hình */
  async xuat(loc: LocAudit, dich: Writable): Promise<number> {
    const { dong } = await this.ds(loc, null);
    if (!dong.length) return 0;
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: dich, useStyles: true });
    const ws = wb.addWorksheet('Audit log');
    ws.columns = [
      { header: 'Thời điểm (giờ VN)', width: 22 }, { header: 'Người thực hiện', width: 20 }, { header: 'Họ tên', width: 24 },
      { header: 'Hành động', width: 22 }, { header: 'Đối tượng', width: 16 }, { header: 'Mã đối tượng', width: 38 },
      { header: 'Lý do', width: 30 }, { header: 'Dữ liệu cũ', width: 40 }, { header: 'Dữ liệu mới', width: 40 }, { header: 'IP', width: 16 }, { header: 'Trace ID', width: 38 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).commit();
    const fmt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' });
    for (const d of dong) {
      ws.addRow([
        fmt.format(new Date(d.luc)), d.nguoi, d.hoTen ?? '', d.hanhDong, d.doiTuong, d.doiTuongId ?? '', d.lyDo ?? '',
        d.duLieuCu == null ? '' : JSON.stringify(d.duLieuCu), d.duLieuMoi == null ? '' : JSON.stringify(d.duLieuMoi), d.ip ?? '', d.traceId ?? '',
      ]).commit();
    }
    ws.commit();
    const tt = wb.addWorksheet('Thông tin');
    tt.addRow(['Từ ngày', dinhDangNgay(loc.tu)]).commit();
    tt.addRow(['Đến ngày', dinhDangNgay(loc.den)]).commit();
    tt.commit();
    await wb.commit();
    return dong.length;
  }
}
