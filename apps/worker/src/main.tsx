import '@vsn/ui/fonts';
import '@vsn/ui/styles.css';
import './app.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { queryClient } from './lib/api';
import { dangKyPwa } from './lib/pwa';
import { router } from './router';
import { ToastProvider } from './ui/mobile';

dangKyPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Toast / sheet định vị absolute trong khung app */}
      <div className="app-root">
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
