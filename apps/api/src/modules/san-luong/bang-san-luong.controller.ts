import { Body, Controller, Get, HttpCode, Post, Put, Query } from '@nestjs/common';
import {
  type BangSanLuong,
  type PhamVi,
  zChotNgay,
  zLocBangSanLuong,
  zNhapHo,
  zSuaO,
  zTimNhanVien,
  zUuid,
} from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { AuditService } from '../../core/audit/audit.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { BangSanLuongService } from './bang-san-luong.service.js';
import { ChotNgayService } from './chot-ngay.service.js';
import { GhiSanLuongService } from './ghi-san-luong.service.js';

class LocBangDto extends createZodDto(zLocBangSanLuong) {}
class SuaODto extends createZodDto(zSuaO) {}
class NhapHoDto extends createZodDto(zNhapHo) {}
class TimNvDto extends createZodDto(zTimNhanVien) {}
class ChotNgayDto extends createZodDto(zChotNgay) {}

abstract class CoPhamVi {
  constructor(protected readonly cls: ClsService<VsnClsStore>) {}
  protected get phamVi(): PhamVi {
    return this.cls.get('phamVi')!;
  }
}

/**
 * Bảng sản lượng ngày · F10, F19 — Superadmin, Tổ trưởng (chuyền gắn).
 * Phạm vi `phamViSanLuong`: chuyền của trạm / của bản ghi (chuyen_tram_snapshot) thuộc chuyền gắn [R 5.8].
 */
@Controller('bang-san-luong')
@Quyen('SAN_LUONG_SUA')
export class BangSanLuongController extends CoPhamVi {
  constructor(
    private readonly bang: BangSanLuongService,
    private readonly ghi: GhiSanLuongService,
    private readonly phamViService: PhamViService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    cls: ClsService<VsnClsStore>,
  ) {
    super(cls);
  }

  @Get()
  @Quyen('SAN_LUONG_SUA', 'CHOT_NGAY')
  async xem(@Query() loc: LocBangDto): Promise<BangSanLuong> {
    await this.phamViService.kiemTraChuyen(this.phamVi, loc.chuyenId);
    return this.bang.xem(loc.chuyenId, loc.ngay);
  }

  @Get('ngay')
  @Quyen('SAN_LUONG_SUA', 'CHOT_NGAY')
  async dsNgay(@Query('chuyenId', new ZodValidationPipe(zUuid)) chuyenId: string) {
    await this.phamViService.kiemTraChuyen(this.phamVi, chuyenId);
    return this.bang.dsNgay(chuyenId);
  }

  @Get('nhan-vien')
  timNhanVien(@Query() q: TimNvDto) {
    return this.bang.timNhanVien(q.q);
  }

  @Put('o')
  async suaO(@Body() dto: SuaODto) {
    const s = await this.prisma.sanLuong.findUnique({ where: { id: dto.sanLuongId }, select: { chuyenTramSnapshot: true } });
    if (!s) throw new LoiNghiepVu('KHONG_TIM_THAY');
    await this.phamViService.kiemTraChuyen(this.phamVi, s.chuyenTramSnapshot);
    return this.ghi.suaWeb(dto, this.audit.nguCanh());
  }

  @Post('nhap-ho')
  @HttpCode(200)
  async nhapHo(@Body() dto: NhapHoDto) {
    const tram = await this.prisma.tram.findUnique({ where: { id: dto.tramId }, select: { id: true, chuyenId: true } });
    if (!tram) throw new LoiNghiepVu('KHONG_TIM_THAY');
    // Chỉ nhập hộ tại trạm thuộc chuyền được gắn [F19]
    await this.phamViService.kiemTraChuyen(this.phamVi, tram.chuyenId);
    return this.ghi.nhapHo(dto, tram, this.audit.nguCanh());
  }
}

/** Chốt ngày · F10 — Superadmin, Tổ trưởng (chuyền gắn) */
@Controller('chot-ngay')
@Quyen('CHOT_NGAY')
export class ChotNgayController extends CoPhamVi {
  constructor(
    private readonly chotNgay: ChotNgayService,
    cls: ClsService<VsnClsStore>,
  ) {
    super(cls);
  }

  @Post()
  @HttpCode(200)
  chot(@Body() dto: ChotNgayDto) {
    return this.chotNgay.chot(this.phamVi, dto);
  }

  @Get('chua-chot')
  chuaChot() {
    return this.chotNgay.chuaChot(this.phamVi);
  }
}
