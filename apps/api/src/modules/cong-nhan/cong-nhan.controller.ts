import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import {
  type CayTram,
  type FormNhap,
  type KetQuaGhi,
  type KhoiDong,
  type TramQr,
  zDangNhapTram,
  zGhiSanLuong,
  zNgayLamViec,
  zUuid,
} from '@vsn/shared';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { AuditService } from '../../core/audit/audit.service.js';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { CongKhai, CongNhan } from '../../core/quyen/quyen.decorator.js';
import { GhiSanLuongService } from '../san-luong/ghi-san-luong.service.js';
import { FormService } from './form.service.js';
import { PhienTramService } from './phien-tram.service.js';

class DangNhapTramDto extends createZodDto(zDangNhapTram) {}
class GhiSanLuongDto extends createZodDto(zGhiSanLuong) {}
class LocFormDto extends createZodDto(z.object({ tramId: zUuid, ngay: zNgayLamViec })) {}

const Id = () => Param('id', new ZodValidationPipe(zUuid));

/**
 * App công nhân [TDD 7.3] — xác thực bằng cookie thiết bị `vsn_tb`, không mật khẩu [D6].
 * Route trước đăng nhập là @CongKhai (đăng nhập trạm có Turnstile + giới hạn sai theo thiết bị [D23]).
 */
@Controller('cn')
export class CongNhanController {
  constructor(
    private readonly phien: PhienTramService,
    private readonly formService: FormService,
    private readonly ghi: GhiSanLuongService,
    private readonly audit: AuditService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get thietBiId(): string {
    return this.cls.get('thietBi')!.id;
  }

  /** Giờ server, phiên của thiết bị, thông báo chuyển phiên — KHÔNG tạo cookie [D21] */
  @Get('khoi-dong')
  @CongKhai()
  khoiDong(@Req() req: Request): Promise<KhoiDong> {
    return this.phien.khoiDong(req);
  }

  @Get('cay-tram')
  @CongKhai()
  cayTram(): Promise<CayTram> {
    return this.phien.cayTram();
  }

  /** Tra trạm theo UUID khi quét QR [F12] */
  @Get('tram/:id')
  @CongKhai()
  tram(@Param('id', new ZodValidationPipe(zUuid.catch('00000000-0000-0000-0000-000000000000'))) id: string): Promise<TramQr> {
    return this.phien.tramQr(id);
  }

  @Post('phien-tram')
  @CongKhai()
  @HttpCode(200)
  dangNhap(@Body() dto: DangNhapTramDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<KhoiDong> {
    return this.phien.dangNhap(dto, req, res);
  }

  @Delete('phien-tram/:id')
  @CongNhan()
  @HttpCode(204)
  dangXuat(@Id() id: string): Promise<void> {
    return this.phien.dangXuat(id, this.thietBiId);
  }

  @Get('form')
  @CongNhan()
  form(@Query() q: LocFormDto): Promise<FormNhap> {
    return this.formService.form(this.thietBiId, q.tramId, q.ngay);
  }

  @Put('san-luong')
  @CongNhan()
  ghiSanLuong(@Body() dto: GhiSanLuongDto): Promise<KetQuaGhi> {
    return this.ghi.ghiApp(dto, this.thietBiId, this.audit.nguCanh());
  }
}
