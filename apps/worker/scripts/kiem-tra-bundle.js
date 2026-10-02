/**
 * Kiểm tra dung lượng tải lần đầu của app công nhân ≤ 180 KB gzip [TDD 14.2].
 * Tính JS + CSS được index.html tham chiếu trực tiếp (script, modulepreload, stylesheet).
 * Chạy sau `vite build`: node scripts/kiem-tra-bundle.js
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const GIOI_HAN_KB = 180;
const dist = join(import.meta.dirname, '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const tep = new Set();
for (const m of html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g)) tep.add(m[1]);

let tong = 0;
for (const f of tep) {
  const kb = gzipSync(readFileSync(join(dist, f))).length / 1024;
  tong += kb;
  console.log(`  ${f.padEnd(48)} ${kb.toFixed(1).padStart(7)} KB`);
}
console.log(`Tổng tải lần đầu (gzip): ${tong.toFixed(1)} KB / giới hạn ${GIOI_HAN_KB} KB`);

if (tong > GIOI_HAN_KB) {
  console.error('❌ Vượt giới hạn dung lượng app công nhân');
  process.exit(1);
}
