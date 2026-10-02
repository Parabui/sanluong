/**
 * k6 "tan ca" [TDD 13.3] [D25] — 15 chuyền tan ca cùng giờ, công nhân Lưu 1 lần cuối ngày, dùng 4G.
 *   Giai đoạn 1 (0 → 3 phút): tăng lên 525 VU · Giai đoạn 2 (3 → 15 phút): duy trì ~100 VU (người nhập tại nhà).
 *   Mỗi VU: khoi-dong → cay-tram → form → PUT san-luong (1–2 lần) → cua-toi.
 *   Trễ mạng 4G giả lập bằng thời gian nghỉ ~150 ms giữa các bước; 2% lần Lưu "mất phản hồi" → gửi lại CÙNG requestId [D19].
 * Đạt khi: p95 Lưu < 2 s · 0 lỗi 5xx (gồm P2028 — hết thời gian chờ kết nối pool) · 0 lần Lưu thất bại.
 *
 * Chạy (DB đã seed:perf, API trỏ vào DB perf):
 *   docker run --rm -i -e API=http://host.docker.internal:4100 -v "$PWD/tools/k6:/k6" grafana/k6 run /k6/tan-ca.js
 * Biến: API (gốc API), SO_NV (mặc định 525), NHANH=1 (rút gọn còn 1 + 2 phút để thử nhanh).
 */
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const API = __ENV.API || 'http://host.docker.internal:4100';
const SO_NV = Number(__ENV.SO_NV || 525);
const NHANH = __ENV.NHANH === '1';

const thoiGianLuu = new Trend('thoi_gian_luu', true);
const loi5xx = new Counter('loi_5xx');
const luuThatBai = new Counter('luu_that_bai');
const guiLai = new Counter('gui_lai_cung_request_id');

export const options = {
  scenarios: {
    tan_ca: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: NHANH
        ? [{ duration: '1m', target: SO_NV }, { duration: '2m', target: 100 }]
        : [{ duration: '3m', target: SO_NV }, { duration: '30s', target: 100 }, { duration: '11m30s', target: 100 }],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    thoi_gian_luu: ['p(95)<2000'],
    loi_5xx: ['count==0'],
    luu_that_bai: ['count==0'],
    http_req_failed: ['rate<0.01'],
  },
};

/** Mỗi VU = 1 công nhân (thiết bị perf-tb-<i>, đã có phiên trạm hôm nay từ seed:perf) */
function headers(i) {
  return { headers: { 'X-VSN-Client': 'worker', 'Content-Type': 'application/json', Cookie: `vsn_tb=perf-tb-${i}` } };
}
const tre = () => sleep(0.15 + Math.random() * 0.1); // trễ 4G
function dem(r) {
  if (r.status >= 500) loi5xx.add(1);
  return r;
}
function uuid() {
  const h = '0123456789abcdef';
  let s = '';
  for (let k = 0; k < 32; k++) s += h[(Math.random() * 16) | 0];
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${'89ab'[(Math.random() * 4) | 0]}${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

export default function () {
  // VU id 1..n → NV 1..SO_NV (vòng lại khi giai đoạn 2 tạo VU mới)
  const i = ((exec.vu.idInTest - 1) % SO_NV) + 1;
  const h = headers(i);

  const kd = dem(http.get(`${API}/api/cn/khoi-dong`, h));
  check(kd, { 'khoi-dong 200': (r) => r.status === 200 });
  const phien = kd.status === 200 ? kd.json('phien') : [];
  tre();
  dem(http.get(`${API}/api/cn/cay-tram`, h));
  tre();

  for (const p of phien.slice(0, 2)) {
    const f = dem(http.get(`${API}/api/cn/form?tramId=${p.tramId}&ngay=${p.ngayLamViec}`, h));
    check(f, { 'form 200': (r) => r.status === 200 });
    if (f.status !== 200) continue;
    const cd = f.json('congDoan');
    tre();
    // 1–2 lần Lưu: số tăng dần (nhập tổng từ đầu ngày)
    const soLan = Math.random() < 0.5 ? 1 : 2;
    for (let lan = 0; lan < soLan; lan++) {
      const body = JSON.stringify({
        requestId: uuid(), tramId: p.tramId, ngay: p.ngayLamViec,
        dong: cd.map((c, k) => ({ congDoanId: c.congDoanId, soLuong: 300 + lan * 20 + k, thuTuThietBi: Date.now() * 10 + lan })),
      });
      let r = dem(http.put(`${API}/api/cn/san-luong`, body, h));
      thoiGianLuu.add(r.timings.duration);
      // 2%: mất phản hồi → app bấm Thử lại với CÙNG requestId → phải nhận lại đúng kết quả cũ
      if (Math.random() < 0.02) {
        guiLai.add(1);
        r = dem(http.put(`${API}/api/cn/san-luong`, body, h));
        thoiGianLuu.add(r.timings.duration);
      }
      const ok = check(r, { 'Lưu 200': (x) => x.status === 200, 'Lưu: mọi dòng DA_LUU/KHONG_DOI': (x) => x.status === 200 && x.json('dong').every((d) => d.ketQua === 'DA_LUU' || d.ketQua === 'KHONG_DOI') });
      if (!ok) luuThatBai.add(1);
      tre();
    }
  }

  const ct = dem(http.get(`${API}/api/cn/cua-toi`, h));
  check(ct, { 'cua-toi 200': (r) => r.status === 200 });
  // Nghỉ giữa các vòng (người dùng không bấm liên tục)
  sleep(5 + Math.random() * 10);
}
