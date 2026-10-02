import { LOI, type MaLoi } from '@vsn/shared';

/**
 * Lỗi nghiệp vụ có mã trong `@vsn/shared/loi`. Ném ra từ service/guard;
 * `LoiFilter` chuyển thành response `{ code, message, field?, traceId, chiTiet? }`.
 */
export class LoiNghiepVu extends Error {
  readonly field?: string;
  readonly chiTiet?: unknown;

  constructor(
    readonly code: MaLoi,
    tuyChon: { message?: string; field?: string; chiTiet?: unknown } = {},
  ) {
    super(tuyChon.message ?? LOI[code].message);
    this.name = 'LoiNghiepVu';
    this.field = tuyChon.field;
    this.chiTiet = tuyChon.chiTiet;
  }

  get http(): number {
    return LOI[this.code].http;
  }
}
