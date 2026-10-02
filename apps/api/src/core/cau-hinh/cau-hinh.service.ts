import { Injectable } from '@nestjs/common';
import { CAU_HINH_MAC_DINH, type CauHinh, type KhoaCauHinh, zCauHinh } from '@vsn/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Đọc cấu hình hệ thống; giá trị thiếu/sai kiểu → dùng mặc định trong @vsn/shared */
@Injectable()
export class CauHinhService {
  constructor(private readonly prisma: PrismaService) {}

  async doc<K extends KhoaCauHinh>(khoa: K): Promise<CauHinh[K]> {
    const dong = await this.prisma.cauHinh.findUnique({ where: { khoa } });
    const kq = zCauHinh.shape[khoa].safeParse(dong?.giaTri);
    return (kq.success ? kq.data : CAU_HINH_MAC_DINH[khoa]) as CauHinh[K];
  }
}
