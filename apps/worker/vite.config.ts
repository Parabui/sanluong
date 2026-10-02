import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA công nhân — phục vụ ở gốc "/" [TDD 2.2, 14.2]
export default defineConfig({
  // Đọc .env ở gốc monorepo — Vite chỉ lộ biến VITE_* ra trình duyệt
  envDir: '../..',
  plugins: [
    react(),
    VitePWA({
      // Không tự tải lại khi form còn số chưa lưu → hỏi người dùng [TDD 14.2]
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'VSN Sản Lượng',
        short_name: 'VSN Sản Lượng',
        description: 'Nhập sản lượng công nhân',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F6F7F9',
        theme_color: '#F29830',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,woff2}'],
        // ⚠ Bẫy service worker scope "/" [TDD 2.2]: không can thiệp web quản lý, TV, API
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/quanly/, /^\/api/, /^\/tv/],
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  resolve: {
    conditions: ['source', ...defaultClientConditions],
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    // iOS Safari 15+ [D14]
    target: ['es2020', 'safari15', 'chrome100'],
  },
});
