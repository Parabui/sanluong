import { Injectable } from '@nestjs/common';
import { type NgayLamViec, ngayLamViecLienTruoc, ngayMoNhap } from '@vsn/shared';
import { CauHinhService } from '../../core/cau-hinh/cau-hinh.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import type { PrismaService, Tx } from '../../core/prisma/prisma.service.js';

/**
 * Ngày mở nhập của công nhân cho một chuyền [R 3.1] [D22]:
 * hôm nay + `soNgayNhapLui` ngày làm việc liền trước (bỏ Chủ nhật) mà chuyền đó CHƯA chốt. "Hôm nay" do server tính [D5].
 */
@Injectable()
export class CuaSoNhapService {
  constructor(
    private readonly clock: ClockService,
    private readonly cauHinh: CauHinhService,
  ) {}

  async ngayMoNhap(db: PrismaService | Tx, chuyenId: string): Promise<NgayLamViec[]> {
    const now = this.clock.now();
    const soNgay = await this.cauHinh.doc('soNgayNhapLui');
    const ungVien: NgayLamViec[] = [];
    let d = this.clock.homNay();
    for (let i = 0; i < soNgay; i++) ungVien.push((d = ngayLamViecLienTruoc(d)));
    const chot = new Set(
      (await db.chotNgay.findMany({ where: { chuyenId, ngayLamViec: { in: ungVien.map(ngayDb) } }, select: { ngayLamViec: true } }))
        .map((c) => tuNgayDb(c.ngayLamViec)),
    );
    return ngayMoNhap(now, (x) => chot.has(x), soNgay);
  }

  /** Hôm nay + các ngày làm việc liền trước có thể còn mở (CHƯA xét chốt — chốt kiểm dưới khóa) */
  async ungVien(): Promise<NgayLamViec[]> {
    const soNgay = await this.cauHinh.doc('soNgayNhapLui');
    const kq = [this.clock.homNay()];
    for (let i = 0; i < soNgay; i++) kq.push(ngayLamViecLienTruoc(kq.at(-1)!));
    return kq;
  }

  /** Ngày sớm nhất có thể còn mở (để lọc phiên trước khi xét chốt) */
  async ngaySomNhatCoThe(): Promise<NgayLamViec> {
    const soNgay = await this.cauHinh.doc('soNgayNhapLui');
    let d = this.clock.homNay();
    for (let i = 0; i < soNgay; i++) d = ngayLamViecLienTruoc(d);
    return d;
  }
}
