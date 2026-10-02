import { Body, Controller, Get, Put, Query, Res } from '@nestjs/common';
import { type CaiDatHeThong, type SuaCauHinh, zLocAuditLog, zSuaCauHinh } from '@vsn/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { AuditService } from '../../core/audit/audit.service.js';
import { CauHinhService } from '../../core/cau-hinh/cau-hinh.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { AuditLogService } from './audit-log.service.js';

class LocAuditDto extends createZodDto(zLocAuditLog) {}
class SuaCauHinhDto extends createZodDto(zSuaCauHinh) {}

/** Audit log · F8 — chỉ Superadmin (AUDIT_XEM) [TDD 10.1, 12] */
@Controller('audit-log')
@Quyen('AUDIT_XEM')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  async ds(@Query() q: LocAuditDto) {
    const k = this.auditLog.khoang(q.tu, q.den);
    const kq = await this.auditLog.ds({ ...q, ...k }, { trang: q.trang, kichThuoc: q.kichThuoc });
    return { ...k, trang: q.trang, kichThuoc: q.kichThuoc, ...kq };
  }

  @Get('xuat')
  async xuat(@Query() q: LocAuditDto, @Res() res: Response): Promise<void> {
    const k = this.auditLog.khoang(q.tu, q.den);
    const loc = { ...q, ...k };
    if (!(await this.auditLog.ds(loc, { trang: 1, kichThuoc: 1 })).tongDong) throw new LoiNghiepVu('KHONG_CO_DU_LIEU', { message: 'Không có dữ liệu để xuất.' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${k.tu}-${k.den}.xlsx"`);
    await this.auditLog.xuat(loc, res);
    res.end();
  }
}

/** Cài đặt hệ thống · F8 — chỉ Superadmin (CAU_HINH): giờ mở chốt ngày, chu kỳ dashboard, IP nhà máy, phiên TV */
@Controller('cau-hinh')
@Quyen('CAU_HINH')
export class CauHinhController {
  constructor(
    private readonly cauHinh: CauHinhService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async xem(): Promise<CaiDatHeThong> {
    const tv = await this.prisma.taiKhoan.findMany({
      where: { vaiTro: 'TV' },
      orderBy: { hoTen: 'asc' },
      select: { id: true, hoTen: true, tenDangNhap: true, phienDangNhap: { where: { loai: 'TV' }, select: { lanCuoi: true }, orderBy: { lanCuoi: 'desc' } } },
    });
    return {
      cauHinh: await this.cauHinh.tatCa(),
      phienTv: tv.map((t) => ({
        taiKhoanId: t.id, hoTen: t.hoTen, tenDangNhap: t.tenDangNhap, soPhien: t.phienDangNhap.length, lanCuoi: t.phienDangNhap[0]?.lanCuoi.toISOString() ?? null,
      })),
    };
  }

  @Put()
  async sua(@Body() dto: SuaCauHinhDto): Promise<CaiDatHeThong> {
    const cu = await this.cauHinh.tatCa();
    const moi: SuaCauHinh = dto;
    await this.audit.giaoDich(async (tx) => {
      await this.cauHinh.ghi(tx, 'gioMoChotNgay', dto.gioMoChotNgay);
      await this.cauHinh.ghi(tx, 'chuKyLamMoiDashboard', dto.chuKyLamMoiDashboard);
      await this.cauHinh.ghi(tx, 'ipNhaMay', dto.ipNhaMay);
      await this.audit.ghi(tx, {
        hanhDong: 'SUA_CAU_HINH', doiTuong: 'cau_hinh',
        cu: { gioMoChotNgay: cu.gioMoChotNgay, chuKyLamMoiDashboard: cu.chuKyLamMoiDashboard, ipNhaMay: cu.ipNhaMay }, moi,
      });
    });
    return this.xem();
  }
}
