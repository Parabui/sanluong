import { Injectable } from '@nestjs/common';
import { homNay, type NgayLamViec } from '@vsn/shared';

/**
 * Nguồn giờ DUY NHẤT của server [D5].
 * Code trong src/modules/** không được gọi new Date() / Date.now() (ESLint chặn).
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }

  /** Ngày làm việc hiện tại theo giờ Việt Nam */
  homNay(): NgayLamViec {
    return homNay(this.now());
  }
}

/** Đồng hồ giả cho test: kịch bản 06:30, 07:59/08:00, Thứ 7 → Thứ 2… [TDD 11] */
export class FakeClock extends ClockService {
  constructor(private hienTai: Date) {
    super();
  }

  override now(): Date {
    return new Date(this.hienTai.getTime());
  }

  dat(thoiDiem: Date): void {
    this.hienTai = thoiDiem;
  }

  tien(ms: number): void {
    this.hienTai = new Date(this.hienTai.getTime() + ms);
  }
}
