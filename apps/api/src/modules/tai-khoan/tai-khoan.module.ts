import { Module } from '@nestjs/common';
import { TaiKhoanController } from './tai-khoan.controller.js';
import { TaiKhoanService } from './tai-khoan.service.js';

@Module({ controllers: [TaiKhoanController], providers: [TaiKhoanService] })
export class TaiKhoanModule {}
