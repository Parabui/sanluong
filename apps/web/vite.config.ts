import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defaultClientConditions, defineConfig } from 'vite';

// Web quản lý + TV — phục vụ dưới /quanly/ [TDD 2.2]
export default defineConfig({
  base: '/quanly/',
  plugins: [react()],
  // Phiên bản hiển thị ở chân trang [TDD 17.4]
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version) },
  resolve: {
    // Đọc thẳng mã nguồn TS của @vsn/shared (điều kiện "source") → HMR khi sửa shared
    conditions: ['source', ...defaultClientConditions],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    target: ['es2020', 'safari15', 'chrome100'],
  },
});
