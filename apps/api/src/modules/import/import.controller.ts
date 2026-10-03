import { Body, Controller, Get, HttpCode, Param, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IMPORT_TOI_DA_BYTE,
  type KetQuaImport,
  LOAI_IMPORT,
  type LoaiImport,
  type XemTruocImport,
  zUuid,
  zXacNhanImport,
} from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { TaiKhoanPhien, VsnClsStore } from '../../core/ngu-canh.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { ImportService } from './import.service.js';

class XacNhanImportDto extends createZodDto(zXacNhanImport) {}

const Loai = () => Param('loai', new ZodValidationPipe(z.enum(LOAI_IMPORT)));

/**
 * Import Excel [TDD 7.3]. @Quyen liệt kê chức năng của MỌI loại import; service kiểm tra đúng chức năng của từng loại.
 * File chỉ nằm trong bộ nhớ (multer memoryStorage), ≤ 10 MB, 1 file [TDD 19].
 */
@Controller('import')
@Quyen('NHAN_VIEN_QUAN_LY')
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get taiKhoan(): TaiKhoanPhien {
    return this.cls.get('taiKhoan')!;
  }

  @Post(':loai/xem-truoc')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_TOI_DA_BYTE, files: 1, fields: 5 } }))
  xemTruoc(@Loai() loai: LoaiImport, @UploadedFile() file?: Express.Multer.File): Promise<XemTruocImport> {
    if (!file) throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', { field: 'file', message: 'Chưa chọn file.' });
    // multer giải mã tên file UTF-8 theo latin1 → đổi lại để giữ tiếng Việt
    const tenFile = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.importService.xemTruoc(loai, { tenFile, buf: file.buffer }, this.taiKhoan);
  }

  @Post(':importId/xac-nhan')
  @HttpCode(200)
  xacNhan(@Param('importId', new ZodValidationPipe(zUuid)) importId: string, @Body() dto: XacNhanImportDto): Promise<KetQuaImport> {
    return this.importService.xacNhan(importId, dto, this.taiKhoan);
  }

  @Get(':loai/mau')
  async mau(@Loai() loai: LoaiImport): Promise<StreamableFile> {
    const { ten, buf } = await this.importService.fileMau(loai, this.taiKhoan);
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${ten}"`,
    });
  }
}
