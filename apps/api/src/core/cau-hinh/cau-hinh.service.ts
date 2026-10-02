import { Injectable } from '@nestjs/common';
import { CAU_HINH_MAC_DINH, type CauHinh, type KhoaCauHinh, zCauHinh } from '@vsn/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

/** Đọc cấu hình hệ thống; giá trị thiếu/sai kiểu → dùng mặc định trong @vsn/shared */
@Injectable()
export class CauHinhService {
  constructor(private readonly prisma: PrismaService) {}

  async doc<K extends KhoaCauHinh>(khoa: K): Promise<CauHinh[K]> {
    const dong = await this.prisma.cauHinh.findUnique({ where: { khoa } });
    const kq = zCauHinh.shape[khoa].safeParse(dong?.giaTri);
    return (kq.success ? kq.data : CAU_HINH_MAC_DINH[khoa]) as CauHinh[K];
  }

  async tatCa(): Promise<CauHinh> {
    const ds = await this.prisma.cauHinh.findMany();
    const kq = { ...CAU_HINH_MAC_DINH };
    for (const d of ds) {
      const k = d.khoa as KhoaCauHinh;
      const v = zCauHinh.shape[k]?.safeParse(d.giaTri);
      if (v?.success) (kq as Record<KhoaCauHinh, unknown>)[k] = v.data;
    }
    return kq;
  }

  /** Ghi 1 khóa trong transaction của người gọi (người gọi ghi audit) */
  async ghi<K extends KhoaCauHinh>(tx: Tx, khoa: K, giaTri: CauHinh[K]): Promise<void> {
    const v = zCauHinh.shape[khoa].parse(giaTri) as Prisma.InputJsonValue;
    await tx.cauHinh.upsert({ where: { khoa }, create: { khoa, giaTri: v }, update: { giaTri: v } });
  }
}
