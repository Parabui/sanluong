import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { LOI, type MaLoi, type PhanHoiLoi } from '@vsn/shared';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { z } from 'zod';
import { layTraceId } from '../trace-id.js';
import { maLoiTuTrigger } from './loi-db.js';
import { LoiNghiepVu } from './loi-nghiep-vu.js';

const MA_THEO_HTTP: Record<number, MaLoi> = {
  400: 'DU_LIEU_KHONG_HOP_LE',
  401: 'CHUA_DANG_NHAP',
  403: 'KHONG_CO_QUYEN',
  404: 'KHONG_TIM_THAY',
  413: 'DU_LIEU_KHONG_HOP_LE',
  429: 'QUA_SO_LAN_SAI',
};

/**
 * Bộ lọc lỗi toàn cục: mọi lỗi → `{ code, message, field?, traceId, chiTiet? }` [TDD 7.1].
 * Lỗi không xác định → 500 LOI_HE_THONG, KHÔNG lộ thông tin kỹ thuật ra ngoài; chi tiết nằm trong log theo traceId.
 */
@Catch()
export class LoiFilter implements ExceptionFilter {
  private readonly logger = new Logger(LoiFilter.name);

  catch(loi: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const traceId = layTraceId(req);

    const { status, body } = this.chuyenDoi(loi, traceId);
    if (status >= 500) this.logger.error({ err: loi, traceId }, 'Lỗi hệ thống');
    res.status(status).json(body);
  }

  private chuyenDoi(loi: unknown, traceId: string): { status: number; body: PhanHoiLoi } {
    if (loi instanceof LoiNghiepVu) {
      return {
        status: loi.http,
        body: { code: loi.code, message: loi.message, field: loi.field, traceId, chiTiet: loi.chiTiet },
      };
    }

    if (loi instanceof ZodValidationException) {
      const issues = (loi.getZodError() as z.ZodError).issues;
      const chiTiet = issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return {
        status: 400,
        body: {
          code: 'DU_LIEU_KHONG_HOP_LE',
          message: LOI.DU_LIEU_KHONG_HOP_LE.message,
          field: chiTiet[0]?.field,
          traceId,
          chiTiet,
        },
      };
    }

    // Trigger nghiệp vụ của DB (hàng rào cuối) — vd. THANG_DA_KHOA, TRAM_KHONG_DOI_CHUYEN
    const maDb = maLoiTuTrigger(loi);
    if (maDb) {
      return { status: LOI[maDb].http, body: { code: maDb, message: LOI[maDb].message, traceId } };
    }

    if (loi instanceof HttpException) {
      const status = loi.getStatus();
      const code = MA_THEO_HTTP[status] ?? 'LOI_HE_THONG';
      return { status, body: { code, message: LOI[code].message, traceId } };
    }

    return { status: 500, body: { code: 'LOI_HE_THONG', message: LOI.LOI_HE_THONG.message, traceId } };
  }
}
