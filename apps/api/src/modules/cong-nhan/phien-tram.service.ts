import { Injectable } from '@nestjs/common';
import {
  type CayTram,
  type DangNhapTram,
  type KhoiDong,
  type ThongBaoPhien,
  type TramQr,
  tenVietTat,
} from '@vsn/shared';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { layIp } from '../../core/http/ip.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { NguCanhAudit, VsnClsStore } from '../../core/ngu-canh.js';
import { ThietBiService } from '../../core/phien/thiet-bi.service.js';
import { khoangNgay, ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { CuaSoNhapService } from '../san-luong/cua-so-nhap.service.js';
import { SoDoService } from '../so-do/so-do.service.js';
import { GioiHanSaiService } from './gioi-han-sai.service.js';
import { TurnstileService } from './turnstile.service.js';

/** Tối đa 3 lần chuyển thiết bị / mã NV / ngày [D23] */
export const SO_LAN_CHUYEN_TOI_DA = 3;

const laLoiPg = (e: unknown, code: string) => {
  const s = JSON.stringify(e, Object.getOwnPropertyNames(e as object)) + String((e as { message?: string })?.message);
  return (e as { code?: string })?.code === code || s.includes(code);
};

/**
 * Phiên trạm của app công nhân · F1 [TDD 8.1] [D21] [D23] [D26].
 * Phiên luôn tạo cho HÔM NAY (server tính). Cùng mã NV ở thiết bị khác → mọi phiên còn hiệu lực chuyển sang thiết bị mới.
 * Công nhân KHÔNG đăng xuất được người khác — trạm đổi người do tổ trưởng đăng xuất hộ (F17).
 */
@Injectable()
export class PhienTramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly cls: ClsService<VsnClsStore>,
    private readonly thietBi: ThietBiService,
    private readonly turnstile: TurnstileService,
    private readonly gioiHan: GioiHanSaiService,
    private readonly cuaSo: CuaSoNhapService,
    private readonly soDo: SoDoService,
  ) {}

  /** Phiên còn hiệu lực của thiết bị: chưa đóng, ngày thuộc cửa sổ nhập của chuyền (chưa chốt) */
  async phienHieuLuc(db: PrismaService | Tx, thietBiId: string) {
    const somNhat = await this.cuaSo.ngaySomNhatCoThe();
    const ds = await db.phienTram.findMany({
      where: { thietBiId, dangXuatLuc: null, ngayLamViec: { gte: ngayDb(somNhat) } },
      orderBy: [{ ngayLamViec: 'desc' }, { dangNhapLuc: 'asc' }],
      include: { tram: { include: { chuyen: true } }, nhanVien: { include: { chuyen: { select: { ma: true } } } } },
    });
    const moNhap = new Map<string, string[]>();
    const kq: typeof ds = [];
    for (const p of ds) {
      const c = p.tram.chuyenId;
      if (!moNhap.has(c)) moNhap.set(c, await this.cuaSo.ngayMoNhap(db, c));
      if (moNhap.get(c)!.includes(tuNgayDb(p.ngayLamViec))) kq.push(p);
    }
    return kq;
  }

  async khoiDong(req: Request, thietBiId?: string): Promise<KhoiDong> {
    const now = this.clock.now();
    const id = thietBiId ?? (await this.thietBi.xacThuc(req))?.id;
    const co: KhoiDong = { gioServer: now.toISOString(), homNay: this.clock.homNay(), nhanVien: null, phien: [], thongBao: [] };
    if (!id) return co;

    const phien = await this.phienHieuLuc(this.prisma, id);
    const dong = await this.prisma.phienTram.findMany({
      where: { thietBiId: id, lyDoDong: { in: ['CHUYEN_THIET_BI', 'DANG_XUAT_HO'] }, dangXuatLuc: { gte: new Date(now.getTime() - 24 * 3_600_000) } },
      orderBy: { dangXuatLuc: 'desc' },
      include: { tram: { select: { soTram: true } }, dangXuatBoi: { select: { hoTen: true } } },
      take: 10,
    });
    const nv = phien[0]?.nhanVien;
    return {
      ...co,
      nhanVien: nv ? { maNV: nv.maNV, hoTen: nv.hoTen, maChuyen: nv.chuyen.ma } : null,
      phien: phien.map((p) => ({
        id: p.id, tramId: p.tramId, soTram: p.tram.soTram, maChuyen: p.tram.chuyen.ma, tenChuyen: p.tram.chuyen.ten,
        ngayLamViec: tuNgayDb(p.ngayLamViec), dangNhapLuc: p.dangNhapLuc.toISOString(),
      })),
      thongBao: dong.map((p): ThongBaoPhien => ({
        loai: p.lyDoDong as ThongBaoPhien['loai'], soTram: p.tram.soTram, luc: p.dangXuatLuc!.toISOString(),
        boi: p.dangXuatBoi?.hoTen ?? null, lyDo: p.lyDoDong === 'DANG_XUAT_HO' ? p.lyDo : null,
      })),
    };
  }

  async cayTram(): Promise<CayTram> {
    const homNay = ngayDb(this.clock.homNay());
    const ds = await this.prisma.xuong.findMany({
      where: { trangThai: 'HOAT_DONG' },
      orderBy: { ma: 'asc' },
      include: {
        chuyen: {
          where: { trangThai: 'HOAT_DONG', loai: 'CHUYEN_MAY' },
          orderBy: { ma: 'asc' },
          include: {
            tram: {
              where: { trangThai: 'HOAT_DONG', nhapQuaApp: true },
              orderBy: { soTram: 'asc' },
              include: { phienTram: { where: { ngayLamViec: homNay, dangXuatLuc: null }, select: { id: true }, take: 1 } },
            },
          },
        },
      },
    });
    return ds.filter((x) => x.chuyen.length).map((x) => ({
      id: x.id, ten: x.ten,
      chuyen: x.chuyen.map((c) => ({ id: c.id, ma: c.ma, ten: c.ten, tram: c.tram.map((t) => ({ id: t.id, soTram: t.soTram, dangCoNguoi: t.phienTram.length > 0 })) })),
    }));
  }

  /** Trạm hợp lệ cho app: tồn tại, nhập qua app, trạm + chuyền + xưởng đang hoạt động */
  private async tramHopLe(db: PrismaService | Tx, tramId: string) {
    const t = await db.tram.findUnique({ where: { id: tramId }, include: { chuyen: { include: { xuong: true } } } });
    if (!t) throw new LoiNghiepVu('QR_KHONG_HOP_LE');
    if (!t.nhapQuaApp || t.trangThai !== 'HOAT_DONG' || t.chuyen.trangThai !== 'HOAT_DONG' || t.chuyen.xuong.trangThai !== 'HOAT_DONG') {
      throw new LoiNghiepVu('TRAM_KHONG_HOAT_DONG');
    }
    return t;
  }

  async tramQr(tramId: string): Promise<TramQr> {
    const t = await this.tramHopLe(this.prisma, tramId);
    const ids = (await this.soDo.soDoNgay(this.prisma, [t.id], this.clock.homNay())).get(t.id) ?? [];
    const cd = await this.prisma.congDoan.findMany({ where: { id: { in: ids } }, orderBy: { ma: 'asc' }, select: { ma: true, ten: true, maHang: { select: { ma: true } } } });
    return {
      id: t.id, soTram: t.soTram, chuyenId: t.chuyenId, maChuyen: t.chuyen.ma, tenChuyen: t.chuyen.ten,
      congDoan: cd.map((c) => ({ ma: c.ma, ten: c.ten, maMaHang: c.maHang.ma })),
    };
  }

  /** POST /api/cn/phien-tram [TDD 8.1] */
  async dangNhap(dto: DangNhapTram & { maNV: string }, req: Request, res: Response): Promise<KhoiDong> {
    const tb0 = await this.thietBi.xacThuc(req);
    this.gioiHan.kiemTra(tb0?.id);
    if (!(await this.turnstile.hopLe(dto.turnstileToken ?? '', layIp(req)))) throw new LoiNghiepVu('TURNSTILE_SAI');

    const nv = await this.prisma.nhanVien.findUnique({ where: { maNV: dto.maNV } });
    if (!nv || nv.trangThai !== 'HOAT_DONG') {
      this.gioiHan.ghiSai(tb0?.id);
      throw new LoiNghiepVu('MA_NV_KHONG_HOP_LE', { field: 'maNV', message: 'Mã NV không hợp lệ.' });
    }
    const tram = await this.tramHopLe(this.prisma, dto.tramId);
    const homNay = this.clock.homNay();
    const now = this.clock.now();
    const nguCanh: NguCanhAudit = {
      loaiNguoiThucHien: 'NHAN_VIEN', nguoiThucHienId: nv.id, maNV: nv.maNV, thietBiId: tb0?.id, ip: layIp(req), traceId: this.cls.getId() ?? '',
    };

    let tokenMoi: string | null = null;
    let thietBiId: string;
    try {
      thietBiId = await this.audit.giaoDich(async (tx) => {
        let tbId = tb0?.id;
        if (!tbId) {
          const moi = await this.thietBi.tao(tx, req); // chỉ tạo khi đăng nhập thành công (rollback nếu lỗi) [D21]
          tbId = moi.id;
          tokenMoi = moi.token;
        }
        nguCanh.thietBiId = tbId;

        // Khóa các phiên liên quan: của trạm hôm nay + của NV + của thiết bị (FOR UPDATE — ma trận khóa TDD 8.9)
        const somNhat = ngayDb(await this.cuaSo.ngaySomNhatCoThe());
        await tx.$queryRaw`
          SELECT 1 FROM phien_tram
          WHERE dang_xuat_luc IS NULL AND ngay_lam_viec >= ${somNhat}
            AND (nhan_vien_id = ${nv.id}::uuid OR thiet_bi_id = ${tbId}::uuid
                 OR (tram_id = ${tram.id}::uuid AND ngay_lam_viec = ${ngayDb(homNay)}))
          ORDER BY id FOR UPDATE`;

        // R 1.3: một thiết bị một mã NV trong ngày (best effort — nhiều kho cookie trên một máy) [D21]
        const nvKhacTrenMay = await tx.phienTram.findFirst({
          where: { thietBiId: tbId, dangXuatLuc: null, ngayLamViec: ngayDb(homNay), nhanVienId: { not: nv.id } },
        });
        if (nvKhacTrenMay) throw new LoiNghiepVu('THIET_BI_DA_CO_NV_KHAC', { message: 'Điện thoại này đã đăng nhập mã NV khác hôm nay — đăng xuất hết các trạm trước.' });

        // Phiên đi theo người: phiên còn hiệu lực của NV ở THIẾT BỊ KHÁC → chuyển sang thiết bị này [D21]
        const oMayKhac = (await tx.phienTram.findMany({
          where: { nhanVienId: nv.id, dangXuatLuc: null, ngayLamViec: { gte: somNhat }, thietBiId: { not: tbId } },
          include: { tram: true },
        }));
        const conHieuLuc: typeof oMayKhac = [];
        for (const p of oMayKhac) if ((await this.cuaSo.ngayMoNhap(tx, p.tram.chuyenId)).includes(tuNgayDb(p.ngayLamViec))) conHieuLuc.push(p);
        if (conHieuLuc.length) {
          const { tu } = khoangNgay(homNay);
          const daChuyen = await tx.auditLog.count({ where: { hanhDong: 'CHUYEN_THIET_BI', doiTuong: 'nhan_vien', doiTuongId: nv.id, luc: { gte: tu } } });
          if (daChuyen >= SO_LAN_CHUYEN_TOI_DA) throw new LoiNghiepVu('QUA_SO_LAN_CHUYEN_THIET_BI');
          await tx.phienTram.updateMany({ where: { id: { in: conHieuLuc.map((p) => p.id) } }, data: { dangXuatLuc: now, lyDoDong: 'CHUYEN_THIET_BI' } });
          await tx.phienTram.createMany({
            data: conHieuLuc.map((p) => ({ tramId: p.tramId, nhanVienId: nv.id, ngayLamViec: p.ngayLamViec, thietBiId: tbId, dangNhapLuc: now })),
          });
          await this.audit.ghi(tx, {
            hanhDong: 'CHUYEN_THIET_BI', doiTuong: 'nhan_vien', doiTuongId: nv.id,
            moi: { phien: conHieuLuc.map((p) => ({ tramId: p.tramId, ngay: tuNgayDb(p.ngayLamViec), tuThietBi: p.thietBiId })) },
          }, nguCanh);
        }

        // Trạm hôm nay
        const dangCo = await tx.phienTram.findFirst({
          where: { tramId: tram.id, ngayLamViec: ngayDb(homNay), dangXuatLuc: null },
          include: { nhanVien: { select: { hoTen: true } } },
        });
        if (dangCo && dangCo.nhanVienId !== nv.id) {
          throw new LoiNghiepVu('TRAM_DA_CO_NGUOI', { message: `Trạm đang có ${tenVietTat(dangCo.nhanVien.hoTen)} – báo tổ trưởng.` });
        }
        if (!dangCo) {
          await tx.phienTram.create({ data: { tramId: tram.id, nhanVienId: nv.id, ngayLamViec: ngayDb(homNay), thietBiId: tbId, dangNhapLuc: now } });
          await this.audit.ghi(tx, { hanhDong: 'DANG_NHAP_TRAM', doiTuong: 'tram', doiTuongId: tram.id, moi: { maNV: nv.maNV, ngay: homNay } }, nguCanh);
        }
        return tbId;
      }, nguCanh);
    } catch (e) {
      // 2 người cùng đăng nhập 1 trạm gần như cùng lúc → người đến sau [R 3.9]
      if (laLoiPg(e, 'P2002') || laLoiPg(e, 'ux_phien_tram_dang_hoat_dong')) {
        throw new LoiNghiepVu('TRAM_DA_CO_NGUOI', { message: 'Trạm vừa có người đăng nhập, tải lại.' });
      }
      if (laLoiPg(e, 'ex_thiet_bi_mot_nv_mot_ngay')) throw new LoiNghiepVu('THIET_BI_DA_CO_NV_KHAC');
      throw e;
    }

    if (tokenMoi) this.thietBi.datCookie(res, tokenMoi);
    this.gioiHan.xoa(thietBiId);
    return this.khoiDong(req, thietBiId);
  }

  /** Tự đăng xuất một trạm (app chặn khi form còn số chưa Lưu) [D26] */
  async dangXuat(phienId: string, thietBiId: string): Promise<void> {
    const p = await this.prisma.phienTram.findUnique({ where: { id: phienId }, include: { nhanVien: true } });
    if (!p || p.thietBiId !== thietBiId || p.dangXuatLuc) throw new LoiNghiepVu('KHONG_TIM_THAY');
    const nguCanh: NguCanhAudit = { ...this.audit.nguCanh(), nguoiThucHienId: p.nhanVienId, maNV: p.nhanVien.maNV };
    await this.audit.giaoDich(async (tx) => {
      const { count } = await tx.phienTram.updateMany({ where: { id: phienId, dangXuatLuc: null }, data: { dangXuatLuc: this.clock.now(), lyDoDong: 'TU_DANG_XUAT' } });
      if (!count) throw new LoiNghiepVu('KHONG_TIM_THAY');
      await this.audit.ghi(tx, { hanhDong: 'DANG_XUAT_TRAM', doiTuong: 'tram', doiTuongId: p.tramId }, nguCanh);
    }, nguCanh);
  }
}
