/**
 * Dữ liệu "trực tiếp" [TDD 14.5] [D11]: TanStack Query `refetchInterval`, tab ẩn thì dừng.
 * Gửi `phienBan` của lần trước — server trả { khongDoi: true } nếu chưa đổi → giữ nguyên dữ liệu cũ (không vẽ lại).
 * Sau này đổi sang SSE chỉ sửa bên trong hook.
 */
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import type { z } from 'zod';
import { api } from './api';

type CoPhienBan = { khongDoi: false; phienBan: string };

export function useDuLieuTrucTiep<S extends z.ZodType<{ khongDoi: true } | CoPhienBan>>(
  key: readonly unknown[],
  duongDan: string,
  schema: S,
  tc: { chuKyGiay: number; enabled?: boolean },
) {
  const cu = useRef<{ duongDan: string; data: Extract<z.infer<S>, CoPhienBan> } | null>(null);
  return useQuery({
    queryKey: key,
    enabled: tc.enabled ?? true,
    refetchInterval: tc.chuKyGiay * 1000,
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) => {
      const truoc = cu.current?.duongDan === duongDan ? cu.current.data : null;
      const noi = duongDan.includes('?') ? '&' : '?';
      const kq = await api.goi(truoc ? `${duongDan}${noi}phienBan=${encodeURIComponent(truoc.phienBan)}` : duongDan, { schema, signal });
      if (kq.khongDoi && truoc) return truoc;
      if (kq.khongDoi) throw new Error('Không có dữ liệu trước đó');
      const moi = kq as Extract<z.infer<S>, CoPhienBan>;
      cu.current = { duongDan, data: moi };
      return moi;
    },
  });
}
