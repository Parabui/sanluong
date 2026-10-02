import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

// Web quản lý + TV — phục vụ dưới /quanly/ [TDD 2.2]
export default defineConfig({
  base: '/quanly/',
  plugins: [react()],
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
