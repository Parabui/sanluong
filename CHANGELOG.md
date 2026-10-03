# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo SemVer `[TDD 17.4]`.
Mỗi bản phát hành: thêm mục `## [x.y.z] – YYYY-MM-DD` **trước** khi tạo tag `vx.y.z` (workflow `release` lấy ghi chú từ mục này;
tag thử `vx.y.z-rc.N` dùng mục `[x.y.z]`).

## [Chưa phát hành]

## [0.1.0] – chưa phát hành (bản pilot 2 chuyền, tuần 14)

MVP giai đoạn 1 (PRD ⑨ tuần 1–13).

### Công nhân (app điện thoại, PWA)
- Chọn trạm (danh sách hoặc quét QR trong app), đăng nhập bằng mã NV, phiên theo ngày làm việc, phiên đi theo người khi đổi thiết bị (≤ 3 lần/ngày) — F1
- Nhập **tổng số** theo công đoạn, nhiều trạm cùng lúc, hỏi lại khi số nhỏ hơn hoặc cao bất thường, giữ số + Thử lại khi mất mạng — F1
- "Của tôi": 30 ngày gần nhất, chi tiết từng ngày, ô tổ trưởng điều chỉnh — F11 · Giờ làm + yêu cầu sửa giờ — F6

### Web quản lý
- Danh mục xưởng – chuyền – trạm (F9), nhân viên + import Excel (F2), mã hàng – công đoạn – lịch sử SMV (F3), sơ đồ chuyền (F4)
- Bảng sản lượng ngày: ô chưa có số, cờ ⚠ (gồm "nhiều thiết bị"), sửa có lý do, nhập hộ (F19), chốt ngày — F10
- Sơ đồ trạm trực tiếp + đăng xuất hộ — F17 · Duyệt giờ làm — F6 · Khóa sổ mã hàng × tháng — F10
- Báo cáo theo công nhân / chuyền / mã hàng / lịch sử + Excel — F5
- Tài khoản & phân quyền theo vai trò + phạm vi (F8), audit log, cài đặt hệ thống

### Vận hành
- Production: `infra/compose.prod.yml` (Caddy, API, PostgreSQL 17, backup, Dozzle, cloudflared), `infra/khoi-tao.sh`, `infra/deploy.sh`
  (dump trước deploy, migrate, tự quay về khi lỗi), script dựng server Hyper-V / WSL2 — [D1b]
- Backup đêm mã hóa GPG + cloud, diễn tập khôi phục, **khôi phục thật** `khoi-phuc.sh`, Sentry, Uptime Kuma, Telegram
- Chạy tạm trên laptop bằng distro WSL2 riêng (`tao-wsl-vsn.ps1`), chuyển sang server bằng `infra/chuyen-may.sh xuat` / `nhap`
  (gói mã hóa, so số dòng, khóa máy cũ) — RUNBOOK mục 6
- Trang chủ (F13) chưa làm: đăng nhập xong vào thẳng màn hình đầu tiên được xem
- Lỗi hệ thống hiện "mã lỗi" 8 ký tự; log request có `traceId`, `route`, người thực hiện
- [docs/RUNBOOK.md](docs/RUNBOOK.md) · [docs/DAO-TAO-IT.md](docs/DAO-TAO-IT.md) · [docs/UAT-PILOT.md](docs/UAT-PILOT.md)

### Chưa có trong bản này (giai đoạn 2)
Dashboard F7 / TV · Trang chủ tổng hợp F13 · In QR F12 · Nhập offline F14 · Xuất dữ liệu lương F15 · Kế hoạch F16 · Hướng dẫn trong app F18 ·
"Của tôi" hiện lịch sử thiết bị (TDD §D23 mục 2)
