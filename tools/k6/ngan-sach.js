/**
 * Đo ngân sách hiệu năng [TDD 13.1] trên dữ liệu seed:perf (12 tháng × 15 chuyền), 1 VU tuần tự — mỗi thao tác chạy LAN lần, lấy p95.
 *   Bảng sản lượng ngày (1 chuyền) < 3 s · Báo cáo 1 tháng × 15 chuyền < 5 s · Xuất Excel < 10 s · API thông thường < 500 ms
 * Chạy: docker run --rm -i -e API=http://host.docker.internal:4100 -v "$PWD/tools/k6:/k6" grafana/k6 run /k6/ngan-sach.js
 * Phiên Web Superadmin `perf-sid-sa` do seed:perf tạo (hết hạn sau 12 giờ — seed lại nếu 401).
 */
import { check } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const API = __ENV.API || 'http://host.docker.internal:4100';
const LAN = Number(__ENV.LAN || 5);
const H = { headers: { 'X-VSN-Client': 'web', Cookie: 'vsn_sid=perf-sid-sa' }, timeout: '60s' };
const HC = { headers: { 'X-VSN-Client': 'worker', Cookie: 'vsn_tb=perf-tb-1' } };

const DO = {
  bang_san_luong_1_chuyen: new Trend('bang_san_luong_1_chuyen', true),
  bao_cao_cong_nhan_1_thang: new Trend('bao_cao_cong_nhan_1_thang', true),
  bao_cao_chuyen_1_thang: new Trend('bao_cao_chuyen_1_thang', true),
  bao_cao_ma_hang_1_thang: new Trend('bao_cao_ma_hang_1_thang', true),
  bao_cao_lich_su_1_thang: new Trend('bao_cao_lich_su_1_thang', true),
  xuat_excel_cong_nhan_1_thang: new Trend('xuat_excel_cong_nhan_1_thang', true),
  so_do_tram: new Trend('so_do_tram', true),
  api_khoi_dong: new Trend('api_khoi_dong', true),
  api_form: new Trend('api_form', true),
  api_cua_toi: new Trend('api_cua_toi', true),
};

export const options = {
  scenarios: { do: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '20m' } },
  thresholds: {
    bang_san_luong_1_chuyen: ['p(95)<3000'],
    bao_cao_cong_nhan_1_thang: ['p(95)<5000'],
    bao_cao_chuyen_1_thang: ['p(95)<5000'],
    bao_cao_ma_hang_1_thang: ['p(95)<5000'],
    bao_cao_lich_su_1_thang: ['p(95)<5000'],
    xuat_excel_cong_nhan_1_thang: ['p(95)<10000'],
    so_do_tram: ['p(95)<500'],
    api_khoi_dong: ['p(95)<500'],
    api_form: ['p(95)<500'],
    api_cua_toi: ['p(95)<500'],
    checks: ['rate==1'],
  },
};

const p2 = (n) => String(n).padStart(2, '0');
function thangTruoc(homNay) {
  const [y, m] = homNay.split('-').map(Number);
  const yt = m === 1 ? y - 1 : y, mt = m === 1 ? 12 : m - 1;
  const cuoi = new Date(Date.UTC(yt, mt, 0)).getUTCDate();
  return { tu: `${yt}-${p2(mt)}-01`, den: `${yt}-${p2(mt)}-${p2(cuoi)}` };
}

function lap(ten, fn) {
  for (let k = 0; k < LAN; k++) {
    const r = fn();
    check(r, { [`${ten} 200`]: (x) => x.status === 200 });
    DO[ten].add(r.timings.duration);
  }
}

export default function () {
  const kd = http.get(`${API}/api/cn/khoi-dong`, HC);
  const homNay = kd.json('homNay');
  const phien = kd.json('phien')[0];
  const chuyen = http.get(`${API}/api/chuyen`, H).json().filter((c) => c.ma.startsWith('PC'));
  const pc01 = chuyen.find((c) => c.ma === 'PC01');
  // Ngày làm việc gần nhất trước hôm nay (đủ số, chưa chốt) — bảng nặng nhất
  const ngay = http.get(`${API}/api/bang-san-luong/ngay?chuyenId=${pc01.id}`, H).json().find((d) => d.ngay < homNay && d.coSanLuong).ngay;
  const t = thangTruoc(homNay);
  const loc = `tu=${t.tu}&den=${t.den}`;

  lap('bang_san_luong_1_chuyen', () => http.get(`${API}/api/bang-san-luong?chuyenId=${pc01.id}&ngay=${ngay}`, H));
  lap('bao_cao_cong_nhan_1_thang', () => http.get(`${API}/api/bao-cao/cong-nhan?${loc}&kichThuoc=100`, H));
  lap('bao_cao_chuyen_1_thang', () => http.get(`${API}/api/bao-cao/chuyen?${loc}`, H));
  lap('bao_cao_ma_hang_1_thang', () => http.get(`${API}/api/bao-cao/ma-hang?${loc}`, H));
  lap('bao_cao_lich_su_1_thang', () => http.get(`${API}/api/bao-cao/lich-su?${loc}&kichThuoc=100`, H));
  lap('xuat_excel_cong_nhan_1_thang', () => http.get(`${API}/api/bao-cao/cong-nhan/xuat?${loc}`, Object.assign({}, H, { responseType: 'none' })));
  lap('so_do_tram', () => http.get(`${API}/api/so-do-tram?chuyenId=${pc01.id}`, H));
  lap('api_khoi_dong', () => http.get(`${API}/api/cn/khoi-dong`, HC));
  lap('api_form', () => http.get(`${API}/api/cn/form?tramId=${phien.tramId}&ngay=${phien.ngayLamViec}`, HC));
  lap('api_cua_toi', () => http.get(`${API}/api/cn/cua-toi`, HC));
}
