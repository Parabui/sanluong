import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CongDoan,
  type LichSuSmv,
  type MaHang,
  zDoiSmv,
  zSuaCongDoan,
  zSuaMaHang,
  zTaoCongDoan,
  zTaoMaHang,
  zUuid,
} from '@vsn/shared';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { MaHangService } from './ma-hang.service.js';

class TaoMaHangDto extends createZodDto(zTaoMaHang) {}
class SuaMaHangDto extends createZodDto(zSuaMaHang) {}
class TaoCongDoanDto extends createZodDto(zTaoCongDoan) {}
class SuaCongDoanDto extends createZodDto(zSuaCongDoan) {}
class DoiSmvDto extends createZodDto(zDoiSmv) {}

const Id = () => Param('id', new ZodValidationPipe(zUuid));

/** Mã hàng / công đoạn · F3 — Superadmin, IE tạo/sửa; người gán sơ đồ (F4) được đọc */
@Controller()
@Quyen('MA_HANG_QUAN_LY')
export class MaHangController {
  constructor(private readonly maHang: MaHangService) {}

  @Get('ma-hang')
  @Quyen('MA_HANG_QUAN_LY', 'SO_DO_GAN', 'BAO_CAO_XEM') // Báo cáo: lọc theo mã hàng
  ds(): Promise<MaHang[]> {
    return this.maHang.ds();
  }

  @Post('ma-hang')
  tao(@Body() dto: TaoMaHangDto): Promise<MaHang> {
    return this.maHang.tao(dto);
  }

  @Patch('ma-hang/:id')
  sua(@Id() id: string, @Body() dto: SuaMaHangDto): Promise<MaHang> {
    return this.maHang.sua(id, dto);
  }

  @Get('ma-hang/:id/cong-doan')
  @Quyen('MA_HANG_QUAN_LY', 'SO_DO_GAN')
  dsCongDoan(@Id() id: string): Promise<CongDoan[]> {
    return this.maHang.dsCongDoan(id);
  }

  @Post('ma-hang/:id/cong-doan')
  taoCongDoan(@Id() id: string, @Body() dto: TaoCongDoanDto): Promise<CongDoan> {
    return this.maHang.taoCongDoan(id, dto);
  }

  @Get('ma-hang/:id/lich-su-smv')
  lichSuSmv(@Id() id: string): Promise<LichSuSmv[]> {
    return this.maHang.lichSuSmv(id);
  }

  @Patch('cong-doan/:id')
  suaCongDoan(@Id() id: string, @Body() dto: SuaCongDoanDto): Promise<CongDoan> {
    return this.maHang.suaCongDoan(id, dto);
  }

  @Post('cong-doan/:id/smv')
  @HttpCode(200)
  doiSmv(@Id() id: string, @Body() dto: DoiSmvDto): Promise<{ soBanGhiTinhLai: number }> {
    return this.maHang.doiSmv(id, dto);
  }
}
