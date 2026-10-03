import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { type TaiKhoan, zDatLaiMatKhau, zSuaQuyen, zSuaTaiKhoan, zTaoTaiKhoan, zUuid } from '@vsn/shared';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { type OQuyenDay, TaiKhoanService } from './tai-khoan.service.js';

class TaoTaiKhoanDto extends createZodDto(zTaoTaiKhoan) {}
class SuaTaiKhoanDto extends createZodDto(zSuaTaiKhoan) {}
class DatLaiMatKhauDto extends createZodDto(zDatLaiMatKhau) {}
class SuaQuyenDto extends createZodDto(zSuaQuyen) {}

const Id = () => Param('id', new ZodValidationPipe(zUuid));

/** Tài khoản & phân quyền · F8 — chỉ Superadmin (quyền này của Superadmin không tắt được) */
@Controller()
@Quyen('TAI_KHOAN_QUAN_LY')
export class TaiKhoanController {
  constructor(private readonly taiKhoan: TaiKhoanService) {}

  @Get('tai-khoan')
  ds(): Promise<TaiKhoan[]> {
    return this.taiKhoan.ds();
  }

  @Post('tai-khoan')
  tao(@Body() dto: TaoTaiKhoanDto): Promise<TaiKhoan> {
    return this.taiKhoan.tao(dto);
  }

  @Patch('tai-khoan/:id')
  sua(@Id() id: string, @Body() dto: SuaTaiKhoanDto): Promise<TaiKhoan> {
    return this.taiKhoan.sua(id, dto);
  }

  @Post('tai-khoan/:id/dat-lai-mat-khau')
  @HttpCode(200)
  datLaiMatKhau(@Id() id: string, @Body() dto: DatLaiMatKhauDto): Promise<TaiKhoan> {
    return this.taiKhoan.datLaiMatKhau(id, dto);
  }

  @Post('tai-khoan/:id/thu-hoi-phien')
  @HttpCode(200)
  thuHoiPhien(@Id() id: string): Promise<{ soPhien: number }> {
    return this.taiKhoan.thuHoiPhien(id);
  }

  @Get('quyen-vai-tro')
  maTran(): Promise<OQuyenDay[]> {
    return this.taiKhoan.maTran();
  }

  @Put('quyen-vai-tro')
  suaMaTran(@Body() dto: SuaQuyenDto): Promise<OQuyenDay[]> {
    return this.taiKhoan.suaMaTran(dto);
  }
}
