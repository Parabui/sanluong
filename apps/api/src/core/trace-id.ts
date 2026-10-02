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
