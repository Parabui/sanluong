/**
 * Fetch client mỏng, có kiểu, dùng chung cho worker và web [D3].
 * - Mọi request gửi kèm header X-VSN-Client (chống CSRF [D6]).
 * - Response được parse bằng schema Zod trong shared → kiểu suy ra từ schema.
 * - Lỗi API ném `LoiApi` mang `code`/`message` tiếng Việt + `traceId`.
 */
import type { z } from 'zod';
import { HEADER_CLIENT, HEADER_TRACE_ID, type LoaiClient } from './http.js';
import { LOI, laMaLoi, type MaLoi, type PhanHoiLoi } from './loi.js';

export class LoiApi extends Error {
  constructor(
    readonly status: number,
    readonly code: MaLoi | 'LOI_MANG',
    message: string,
    readonly traceId?: string,
    readonly field?: string,
    readonly chiTiet?: unknown,
  ) {
    super(message);
    this.name = 'LoiApi';
  }
}

export interface TuyChonGoi<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema: S;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function taoApiClient(client: LoaiClient, goc = '/api') {
  async function goi<S extends z.ZodType>(duongDan: string, tc: TuyChonGoi<S>): Promise<z.infer<S>> {
    // FormData (upload file): để trình duyệt tự đặt Content-Type multipart kèm boundary
    const laForm = typeof FormData !== 'undefined' && tc.body instanceof FormData;
    let res: Response;
    try {
      res = await fetch(goc + duongDan, {
        method: tc.method ?? 'GET',
        credentials: 'same-origin',
        signal: tc.signal,
        headers: {
          [HEADER_CLIENT]: client,
          ...(tc.body !== undefined && !laForm ? { 'Content-Type': 'application/json' } : {}),
          ...tc.headers,
        },
        body: laForm ? (tc.body as FormData) : tc.body !== undefined ? JSON.stringify(tc.body) : undefined,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      throw new LoiApi(0, 'LOI_MANG', 'Mất kết nối, vui lòng thử lại.');
    }

    const traceId = res.headers.get(HEADER_TRACE_ID) ?? undefined;
    const json: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);

    if (!res.ok) {
      const loi = json as Partial<PhanHoiLoi> | undefined;
      const code = laMaLoi(loi?.code) ? loi.code : 'LOI_HE_THONG';
      throw new LoiApi(res.status, code, loi?.message ?? LOI[code].message, loi?.traceId ?? traceId, loi?.field, loi?.chiTiet);
    }
    return tc.schema.parse(json);
  }

  return { goi };
}

export type ApiClient = ReturnType<typeof taoApiClient>;
