import { Injectable } from '@nestjs/common';
import type { ChucNang, VaiTro } from '@vsn/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Ma trận QuyenVaiTro (vai trò → chức năng được bật) [D8] [TDD 10.1].
 * Cache trong bộ nhớ; PUT /api/quyen-vai-tro gọi `xoaCache()` để có hiệu lực ngay.
 * Dòng thiếu trong bảng = TẮT (mặc định từ chối) — seed tạo đủ dòng từ QUYEN_MAC_DINH.
 */
@Injectable()
export class QuyenService {
  private cache: Promise<Map<VaiTro, Set<ChucNang>>> | null = null;

  private nap(): Promise<Map<VaiTro, Set<ChucNang>>> {
    this.cache ??= this.prisma.quyenVaiTro
      .findMany({ where: { batTat: true } })
      .then((dong) => {
        const m = new Map<VaiTro, Set<ChucNang>>();
        for (const d of dong) {
          const s = m.get(d.vaiTro) ?? new Set<ChucNang>();
          s.add(d.chucNang);
          m.set(d.vaiTro, s);
        }
        return m;
      })
      .catch((e: unknown) => {
        this.cache = null; // lỗi DB tạm thời → lần sau nạp lại
        throw e;
      });
    return this.cache;
  }

  constructor(private readonly prisma: PrismaService) {}

  async chucNangCua(vaiTro: VaiTro): Promise<ChucNang[]> {
    return [...((await this.nap()).get(vaiTro) ?? [])];
  }

  /** true nếu vai trò có ÍT NHẤT MỘT trong các chức năng */
  async coMotTrong(vaiTro: VaiTro, chucNang: readonly ChucNang[]): Promise<boolean> {
    const s = (await this.nap()).get(vaiTro);
    return !!s && chucNang.some((c) => s.has(c));
  }

  xoaCache(): void {
    this.cache = null;
  }
}
