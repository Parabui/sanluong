import { Module } from '@nestjs/common';
import { NhanVienImport } from '../nhan-vien/nhan-vien-import.js';
import { NhanVienModule } from '../nhan-vien/nhan-vien.module.js';
import { BO_XU_LY_IMPORT } from './bo-xu-ly.js';
import { ImportController } from './import.controller.js';
import { ImportService } from './import.service.js';

/** Khung import dùng chung. Thêm loại mới (F3 mã hàng, F16 kế hoạch): import module + thêm vào BO_XU_LY_IMPORT */
@Module({
  imports: [NhanVienModule],
  controllers: [ImportController],
  providers: [
    ImportService,
    { provide: BO_XU_LY_IMPORT, useFactory: (nv: NhanVienImport) => [nv], inject: [NhanVienImport] },
  ],
})
export class ImportModule {}
