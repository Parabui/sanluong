# Báo cáo hiệu năng — tuần 12 [TDD 13.1, 13.3]

Đo ngày 02/10/2026 trên **máy dev** (laptop 8 nhân, Windows 11 + Docker Desktop). API, PostgreSQL 17 và k6 chạy **cùng một máy**,
nên đây là mức sàn: VM production (chỉ chạy API + DB) sẽ thoải mái hơn. **Đo lại trên VM thật trước go-live** (tiêu chí "CPU VM < 70%" chỉ
đánh giá được ở đó).

## Cách chạy lại

```bash
pnpm seed:perf          # DB thử cổng 5434 (infra/compose.thu.yml) → migrate → seed 12 tháng
pnpm perf:api           # API trỏ vào DB perf, cổng 4100
docker run --rm -i -e API=http://host.docker.internal:4100 -v "$PWD/tools/k6:/k6" grafana/k6 run /k6/ngan-sach.js
docker run --rm -i -e API=http://host.docker.internal:4100 -v "$PWD/tools/k6:/k6" grafana/k6 run /k6/tan-ca.js
pnpm thu:db:down        # xóa DB thử
```

## Dữ liệu (`seed:perf`)

| | Số lượng |
|---|---|
| Thời gian | 12 tháng, T2–T7, đến hôm qua |
| Xưởng / chuyền / trạm | 3 / 15 / 525 (**35 trạm/chuyền**, TDD ghi 18 — tăng để 525 VU mỗi người 1 trạm; đổi bằng `PERF_TRAM_MOI_CHUYEN`) |
| Mã hàng / công đoạn | 20 / 700, xoay mã hàng mỗi tháng, đổi SMV giữa tháng |
| Nhân viên | 525 (4% vắng, 3% đi hỗ trợ chuyền khác, 2% làm 10 giờ) |
| `san_luong` / lịch sử | 157.890 / 159.527 (1% ô tổ trưởng điều chỉnh) |
| Chốt ngày / khóa tháng | 4.650 / 165 |
| Seed mất | 13,9 giây |

Kiểm toàn vẹn sau seed: 0 bất thường, % hiệu suất TB 84,6% (48–110%), 4.682 dòng hỗ trợ chuyền.

## Sửa trong tuần: view lọc theo ngày

Đo lần đầu, báo cáo 1 tháng **quá 60 giây**. Nguyên nhân: `v_nv_ngay` / `v_nv_chuyen_ngay` gọi hàm `gio_lam_hieu_luc()` và
`chuyen_goc_ngay()` cho **mọi dòng của 12 tháng** (hàm SQL có ORDER BY/LIMIT không được inline, ~0,6 ms/lần), và điều kiện khoảng
ngày không lan qua JOIN. Migration `20261002160000_view_loc_theo_ngay` viết lại 2 view bằng `LATERAL` (cùng cột, cùng công thức),
và báo cáo lọc thẳng `n.ngay_lam_viec BETWEEN tu AND den`. Test `[D18]` mới so từng dòng view với hàm gốc: khớp 100%.

| Truy vấn | Trước | Sau |
|---|---|---|
| `SELECT … FROM v_nv_ngay` (12 tháng) | 4,4 s | 0,40 s |
| `SELECT … FROM v_nv_chuyen_ngay` (12 tháng) | 8,5 s | 0,19 s |
| Báo cáo công nhân 1 tháng × 15 chuyền | > 60 s (timeout) | 1,19 s |
| Báo cáo chuyền 1 tháng | > 60 s (timeout) | 1,71 s |
| Xuất Excel báo cáo 1 tháng | > 60 s (timeout) | 3,23 s |
| Bảng sản lượng ngày (1 chuyền) | 0,83 s | 91 ms |

## Ngân sách mục 13.1 (`tools/k6/ngan-sach.js`, p95 của 5 lần, 1 người dùng)

| Thao tác | Mục tiêu PRD | Nội bộ server | Đo được | |
|---|---|---|---|---|
| Bảng sản lượng ngày (1 chuyền) | < 3 s | < 400 ms | 91 ms | ✅ |
| Báo cáo công nhân 1 tháng × 15 chuyền | < 5 s | < 1,5 s | 1,19 s | ✅ |
| Báo cáo chuyền 1 tháng | < 5 s | < 1,5 s | 1,71 s | ✅ PRD · 🟡 vượt mục tiêu nội bộ |
| Báo cáo mã hàng / lịch sử | < 5 s | < 1,5 s | 72 ms / 101 ms | ✅ |
| Xuất Excel báo cáo | < 10 s | < 5 s | 3,23 s | ✅ |
| API thông thường (sơ đồ trạm, khởi động, form, của tôi) | < 500 ms | < 200 ms | 30 / 18 / 35 / 23 ms | ✅ |
| Dashboard | < 3 s | < 500 ms | — | chưa làm F7 |
| Xuất lương | < 15 s | < 8 s | — | chưa làm F15 |

## k6 "tan ca" (`tools/k6/tan-ca.js`) — 525 VU trong 3 phút, rồi 100 VU đến phút 15

| Tiêu chí TDD | Kết quả | |
|---|---|---|
| p95 Lưu < 2 s | **1,91 s** (trung vị 40 ms, p90 1,46 s, max 2,43 s) | ✅ sát ngưỡng |
| 0 lỗi P2028 | 0 (grep log API) | ✅ |
| 0 lỗi 5xx | 0 | ✅ |
| 0 lần Lưu thất bại | 0 / 9.477 vòng; 288 lần gửi lại cùng `requestId` đều trả đúng kết quả cũ | ✅ |
| CPU VM < 70% | API ≈ 1 nhân (13% của 8 nhân), PostgreSQL 65–114% 1 nhân lúc đỉnh; cả máy 63–80% **gồm k6 + Docker** | ⏳ đo trên VM |

51.930 request, `http_req_failed` 0,47% (249): **toàn bộ** là `dial: i/o timeout` từ container k6 tới `host.docker.internal`
(NAT của Docker Desktop không kịp mở kết nối mới lúc 525 VU cùng vào) — API không nhận được các request đó và không ghi lỗi nào.
Trên VM thật k6 chạy từ máy khác, không đi qua lớp NAT này.

**Rủi ro ghi nhận:** lúc đỉnh, tiến trình Node của API dùng gần trọn 1 nhân CPU — p95 Lưu chủ yếu là thời gian xếp hàng ở event
loop (trung vị chỉ 40 ms). Nếu VM thật có nhân yếu hơn laptop: chạy 2 replica API sau Caddy (trước đó rà mọi trạng thái giữ trong bộ
nhớ tiến trình: đếm sai mã NV, cache, @Cron chỉ chạy ở 1 replica) hoặc profile đường Lưu (Zod + Prisma) trước khi tăng phần cứng.
