import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type PhamVi, type SoDoTram, tenVietTat, type TramTrucTiep } from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { ngayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';
import { SoDoService } from '../so-do/so-do.service.js';

/** "Android · Chrome" từ User-Agent (chỉ để tổ trưởng nhận ra điện thoại) */
export function tenThietBi(ua: string | null): string | null {
  if (!ua) return null;
  const may = /iPhone|iPad/i.test(ua) ? 'iPhone' : /Android/i.test(ua) ? 'Android' : /Windows|Macintosh|Linux/i.test(ua) ? 'Máy tính' : 'Điện thoại';
  const tinh = /Zalo/i.test(ua) ? 'Zalo'
    : /FBAN|FBAV/i.test(ua) ? 'Facebook'
      : /EdgA?\//i.test(ua) ? 'Edge'
        : /CriOS|Chrome/i.test(ua) ? 'Chrome'
          : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
            : /Safari/i.test(ua) ? 'Safari' : 'Trình duyệt';
  return `${may} · ${tinh}`;
}

/**
 * Sơ đồ trạm trực tiếp · F17 [D26] [TDD 8.8, 14.5]: trạm nào đang có ai, đã nhập hôm nay chưa; đăng xuất hộ (bắt buộc lý do).
 * Màn hình hỏi lại mỗi 5 giây kèm `phienBan` — dữ liệu chưa đổi thì trả { khongDoi: true }.
 */
@Injectable()
export class SoDoTramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly phamVi: PhamViService,
    private readonly soDo: SoDoService,
  ) {}

  async xem(pv: PhamVi, chuyenId: string, phienBan?: string): Promise<SoDoTram> {
    await this.phamVi.kiemTraChuyen(pv, chuyenId);
    const homNay = this.clock.homNay();
    const D = ngayDb(homNay);
    const tram = await this.prisma.tram.findMany({
      where: { chuyenId, nhapQuaApp: true, trangThai: 'HOAT_DONG' }, orderBy: { soTram: 'asc' }, select: { id: true, soTram: true },
    });
    const ids = tram.map((t) => t.id);
    const soDo = await this.soDo.soDoNgay(this.prisma, ids, homNay);
    const cds = await this.prisma.congDoan.findMany({ where: { id: { in: [...new Set([...soDo.values()].flat())] } }, select: { id: true, ma: true, ten: true } });
    const phien = await this.prisma.phienTram.findMany({
      where: { tramId: { in: ids }, ngayLamViec: D, dangXuatLuc: null },
      select: { id: true, tramId: true, nhanVienId: true, dangNhapLuc: true, nhanVien: { select: { maNV: true, hoTen: true } }, thietBi: { select: { userAgent: true } } },
    });
    const sl = await this.prisma.sanLuong.findMany({ where: { tramId: { in: ids }, ngayLamViec: D }, select: { tramId: true, nhanVienId: true, congDoanId: true } });

    const ds: TramTrucTiep[] = tram.map((t) => {
      const p = phien.find((x) => x.tramId === t.id);
      return {
        id: t.id,
        soTram: t.soTram,
        congDoan: (soDo.get(t.id) ?? [])
          .map((id) => cds.find((c) => c.id === id))
          .filter((c): c is NonNullable<typeof c> => !!c)
          .sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true })),
        phien: p
          ? {
              id: p.id, nhanVien: p.nhanVien, dangNhapLuc: p.dangNhapLuc.toISOString(), thietBi: tenThietBi(p.thietBi.userAgent),
              daNhap: sl.filter((s) => s.tramId === t.id && s.nhanVienId === p.nhanVienId).map((s) => s.congDoanId),
            }
          : null,
      };
    });
    const ban = createHash('sha1').update(JSON.stringify([homNay, ds])).digest('base64url').slice(0, 16);
    if (phienBan && phienBan === ban) return { khongDoi: true };
    return { khongDoi: false, phienBan: ban, homNay, tram: ds };
  }

  /**
   * POST /api/so-do-tram/dang-xuat-ho [TDD 8.8]: khóa dòng phiên FOR UPDATE (Lưu giữ FOR SHARE → chờ Lưu xong);
   * NV chưa có số hôm nay tại trạm và chưa xác nhận → cảnh báo (yêu cầu NV nhập ngay, phiên vẫn còn).
   */
  async dangXuatHo(pv: PhamVi, dto: { phienId: string; lyDo: string; xacNhan: boolean }): Promise<void> {
    const p0 = await this.prisma.phienTram.findUnique({ where: { id: dto.phienId }, select: { tram: { select: { chuyenId: true } } } });
    if (!p0) throw new LoiNghiepVu('KHONG_TIM_THAY');
    await this.phamVi.kiemTraChuyen(pv, p0.tram.chuyenId);
    const taiKhoanId = this.audit.nguCanh().nguoiThucHienId;
    if (!taiKhoanId) throw new LoiNghiepVu('CHUA_DANG_NHAP');

    await this.audit.giaoDich(async (tx) => {
      const [p] = await tx.$queryRaw<{ id: string; tram_id: string; nhan_vien_id: string; ngay_lam_viec: Date; dang_xuat_luc: Date | null }[]>`
        SELECT id, tram_id, nhan_vien_id, ngay_lam_viec, dang_xuat_luc FROM phien_tram WHERE id = ${dto.phienId}::uuid FOR UPDATE`;
      if (!p) throw new LoiNghiepVu('KHONG_TIM_THAY');
      if (p.dang_xuat_luc) throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', { message: 'Phiên này đã đăng xuất — tải lại.' });
      const nv = await tx.nhanVien.findUniqueOrThrow({ where: { id: p.nhan_vien_id }, select: { hoTen: true, maNV: true } });
      const tram = await tx.tram.findUniqueOrThrow({ where: { id: p.tram_id }, select: { soTram: true } });
      const coSo = await tx.sanLuong.count({ where: { tramId: p.tram_id, nhanVienId: p.nhan_vien_id, ngayLamViec: p.ngay_lam_viec } });
      if (!coSo && !dto.xacNhan) {
        throw new LoiNghiepVu('CAN_XAC_NHAN', {
          message: `${tenVietTat(nv.hoTen)} chưa nhập số tại trạm ${tram.soTram} — yêu cầu nhập ngay (phiên vẫn còn), hoặc xác nhận rồi nhập hộ sau.`,
          chiTiet: { chuaNhap: true, nhanVien: nv.hoTen, soTram: tram.soTram },
        });
      }
      await tx.phienTram.update({
        where: { id: p.id },
        data: { dangXuatLuc: this.clock.now(), dangXuatBoiId: taiKhoanId, lyDoDong: 'DANG_XUAT_HO', lyDo: dto.lyDo },
      });
      await this.audit.ghi(tx, {
        hanhDong: 'DANG_XUAT_HO', doiTuong: 'phien_tram', doiTuongId: p.id,
        moi: { tramId: p.tram_id, nhanVienId: p.nhan_vien_id, maNV: nv.maNV, chuaNhapSo: !coSo }, lyDo: dto.lyDo,
      });
    });
  }
}
