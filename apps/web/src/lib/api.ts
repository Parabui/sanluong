import { QueryClient } from '@tanstack/react-query';
import { taoApiClient } from '@vsn/shared';

export const api = taoApiClient('web');

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
