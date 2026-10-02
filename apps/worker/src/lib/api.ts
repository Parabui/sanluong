import { QueryClient } from '@tanstack/react-query';
import { taoApiClient } from '@vsn/shared';

export const api = taoApiClient('worker');

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    // Ghi sản lượng KHÔNG tự retry: Thử lại do người dùng bấm, dùng lại requestId [D19]
    mutations: { retry: false },
  },
});
