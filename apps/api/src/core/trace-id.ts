import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HEADER_TRACE_ID } from '@vsn/shared';

type RequestCoId = IncomingMessage & { id?: string };

/**
 * Gắn traceId cho mọi request (header X-Trace-Id) — CHẠY TRƯỚC mọi middleware khác
 * để log (pino), CLS và response lỗi dùng chung một mã [TDD 7.1, 18].
 */
export function ganTraceId(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  const id = randomUUID();
  (req as RequestCoId).id = id;
  res.setHeader(HEADER_TRACE_ID, id);
  next();
}

export function layTraceId(req: IncomingMessage): string {
  return (req as RequestCoId).id ?? '';
}

/** Trường thêm vào dòng log "request completed" [TDD 18]: route + người thực hiện (QuyenGuard gắn sau khi xác thực) */
export interface ThongTinNhatKy {
  route?: string;
  nguoiThucHienId?: string;
  thietBiId?: string;
}
const NHAT_KY = Symbol('vsnNhatKy');
type RequestCoNhatKy = IncomingMessage & { [NHAT_KY]?: ThongTinNhatKy };

export function ganNhatKy(req: IncomingMessage, tt: ThongTinNhatKy): void {
  (req as RequestCoNhatKy)[NHAT_KY] = tt;
}

/**
 * customProps của pino-http: route + người thực hiện (traceId nằm trong `req` của serializer).
 * pino-http gọi hàm này cả lúc bắt đầu (guard chưa chạy → rỗng) lẫn lúc kết thúc request → không trả trường trùng.
 */
export function thuocTinhNhatKy(req: IncomingMessage): Record<string, string> {
  const tt = (req as RequestCoNhatKy)[NHAT_KY];
  return {
    ...(tt?.route && { route: tt.route }),
    ...(tt?.nguoiThucHienId && { nguoiThucHienId: tt.nguoiThucHienId }),
    ...(tt?.thietBiId && { thietBiId: tt.thietBiId }),
  };
}
