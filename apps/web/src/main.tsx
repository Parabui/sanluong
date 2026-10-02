import '@vsn/ui/fonts';
import '@vsn/ui/styles.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider, TooltipLayer } from '@vsn/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { datKhiHetPhien, queryClient } from './lib/api';
import { duongDanDangNhap } from './lib/xac-thuc';
import { router } from './router';
import { khoiTaoSentry } from './lib/sentry';

khoiTaoSentry(__APP_VERSION__);

// Phiên hết hạn / bị thu hồi giữa chừng → về đăng nhập, sau đó quay lại đúng trang cũ [PRD ⑦]
datKhiHetPhien(() => {
  const { pathname, search } = router.state.location;
  if (pathname === '/dang-nhap') return;
  queryClient.clear();
  void router.navigate(duongDanDangNhap(pathname + search), { replace: true });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
        <TooltipLayer />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
