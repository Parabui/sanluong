import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { type TaiKhoanToi, zDangNhap, zDoiMatKhau } from '@vsn/shared';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { createZodDto } from 'nestjs-zod';
import type { TaiKhoanPhien, VsnClsStore } from '../../core/ngu-canh.js';
import { PhienWebService } from '../../core/phien/phien-web.service.js';
import { CongKhai, DaDangNhap } from '../../core/quyen/quyen.decorator.js';
import { AuthService } from './auth.service.js';

class DangNhapDto extends createZodDto(zDangNhap) {}
class DoiMatKhauDto extends createZodDto(zDoiMatKhau) {}

/** Xác thực Web/TV [D6] [TDD 7.3, 9.2] · F8 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly phien: PhienWebService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get taiKhoan(): TaiKhoanPhien {
    return this.cls.get('taiKhoan')!;
  }

  @Post('dang-nhap')
  @CongKhai()
  @HttpCode(200)
  async dangNhap(
    @Body() dto: DangNhapDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TaiKhoanToi> {
    const { token, loai, toi } = await this.auth.dangNhap(dto, req);
    this.phien.datCookie(res, token, loai);
    return toi;
  }

  @Post('dang-xuat')
  @DaDangNhap()
  @HttpCode(204)
  async dangXuat(@Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.dangXuat(this.taiKhoan);
    this.phien.xoaCookie(res);
  }

  @Post('doi-mat-khau')
  @DaDangNhap()
  @HttpCode(200)
  doiMatKhau(@Body() dto: DoiMatKhauDto): Promise<TaiKhoanToi> {
    return this.auth.doiMatKhau(this.taiKhoan, dto);
  }

  @Get('toi')
  @DaDangNhap()
  toi(): Promise<TaiKhoanToi> {
    return this.auth.toi(this.taiKhoan);
  }
}
