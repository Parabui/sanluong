import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { zKhoaMaHang, zKhoaTatCa, zLocKhoaThang, zMoKhoa } from '@vsn/shared';
import { createZodDto } from 'nestjs-zod';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { KhoaThangService } from './khoa-thang.service.js';

class LocDto extends createZodDto(zLocKhoaThang) {}
class KhoaDto extends createZodDto(zKhoaMaHang) {}
class KhoaTatCaDto extends createZodDto(zKhoaTatCa) {}
class MoKhoaDto extends createZodDto(zMoKhoa) {}

/** Khóa sổ Mã hàng × Tháng · F10 — Superadmin, IT/HR (toàn nhà máy) */
@Controller('khoa-thang')
@Quyen('KHOA_THANG')
export class KhoaThangController {
  constructor(private readonly khoaThang: KhoaThangService) {}

  @Get()
  xem(@Query() loc: LocDto) {
    return this.khoaThang.xem(loc.thang);
  }

  @Post('khoa')
  @HttpCode(204)
  khoa(@Body() dto: KhoaDto): Promise<void> {
    return this.khoaThang.khoa(dto.maHangId, dto.thang);
  }

  @Post('khoa-tat-ca')
  @HttpCode(200)
  khoaTatCa(@Body() dto: KhoaTatCaDto) {
    return this.khoaThang.khoaTatCa(dto.thang);
  }

  @Post('mo-khoa')
  @HttpCode(204)
  moKhoa(@Body() dto: MoKhoaDto): Promise<void> {
    return this.khoaThang.moKhoa(dto.maHangId, dto.thang, dto.lyDo);
  }
}
