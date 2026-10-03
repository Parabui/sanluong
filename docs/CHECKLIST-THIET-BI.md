# Checklist thử trên điện thoại thật — tuần 12 [TDD §20]

Playwright (`pnpm e2e`) đã chạy luồng công nhân trên **WebKit viewport iPhone 13** và **Chromium viewport Pixel 7**, nhưng giả lập
không thay được máy thật ở 4 điểm: camera / quét QR, webview Zalo, PWA đã cài (icon màn hình chính + service worker), và máy Android cũ.
Danh sách dưới đây phải do người thật làm trên máy thật trước khi go-live.

## Chuẩn bị

- **Môi trường HTTPS thật** (staging dựng bằng `infra/compose.prod.yml` + domain + Caddy). Không thử trên `http://<IP LAN>`:
  camera (`getUserMedia`), service worker và cookie `Secure` đều cần HTTPS.
- Bật Turnstile thật (`VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET`), như production.
- Dữ liệu: 1 chuyền thử, 3 trạm nhập qua app có gán công đoạn hôm nay, 3 mã NV thử. Tài khoản tổ trưởng của chuyền đó.
- **QR trạm:** chức năng *In QR* (F12) để giai đoạn 2. Tạm thời lấy UUID trạm ở *Danh mục → Chuyền & Trạm*, tạo QR chứa
  `https://<domain>/dang-nhap/<uuid-trạm>` bằng công cụ tạo QR bất kỳ, in ra giấy (thử cả QR dán ở chỗ hơi tối).
- Thiết bị tối thiểu: 1 iPhone (iOS mới nhất), 1 iPhone cũ (iOS 15–16 nếu có), 1 Android tầm trung, 1 Android cũ / RAM ≤ 3 GB, mạng 4G (tắt Wi-Fi).

Ghi kết quả: ✅ đạt · ❌ lỗi (chụp màn hình + giờ + mã NV) · — không áp dụng.

## A. iPhone — camera mặc định → Safari

| # | Bước | Kết quả mong đợi | iPhone mới | iPhone cũ |
|---|---|---|---|---|
| A1 | Mở app Camera, hướng vào QR trạm 1 → bấm banner | Safari mở `…/dang-nhap/<uuid>`, hiện "Trạm 1 · <chuyền>" và công đoạn hôm nay | | |
| A2 | Nhập mã NV (gõ chữ thường) → Đăng nhập | Mã tự viết hoa; vào màn Nhập, hiện tên NV | | |
| A3 | Nhập tổng số → Lưu (4G) | "Đã lưu 1 công đoạn · Trạm 1" **< 2 giây** | | |
| A4 | Tắt mạng → sửa số → Lưu | "Chưa lưu được – kiểm tra mạng", số giữ nguyên, nút **Thử lại**; bật mạng → Thử lại → lưu được | | |
| A5 | Đóng Safari hẳn, mở lại link | Vẫn còn phiên trạm (cookie thiết bị giữ được) | | |
| A6 | Bàn phím số: ô số lượng | Hiện bàn phím số, không phóng to trang khi chạm ô | | |

## B. Quét bằng Zalo (iPhone và Android)

| # | Bước | Kết quả mong đợi | iPhone | Android |
|---|---|---|---|---|
| B1 | Zalo → Quét QR → QR trạm 2 | Mở webview Zalo, có dải vàng "Đang mở trong Zalo/Facebook. Nên mở bằng Safari/Chrome" | | |
| B2 | Vẫn đăng nhập & Lưu trong webview | Lưu được bình thường (không chặn) | | |
| B3 | Android: bấm "Mở bằng Chrome" | Chrome mở đúng trang | — | |
| B4 | Đăng nhập **cùng mã NV** ở Safari/Chrome sau khi đã đăng nhập trong Zalo | Phiên tự chuyển sang trình duyệt mới; quay lại Zalo → "Phiên Trạm X đã chuyển sang thiết bị khác lúc hh:mm" (R7) | | |
| B5 | Chuyển lần thứ 4 trong ngày | Bị chặn, báo liên hệ tổ trưởng (tối đa 3 lần/ngày) | | |

## C. PWA đã cài (icon màn hình chính)

| # | Bước | Kết quả mong đợi | iPhone | Android |
|---|---|---|---|---|
| C1 | Safari: Chia sẻ → Thêm vào MH chính · Chrome: Cài đặt ứng dụng | Icon VSN, mở toàn màn hình, không thanh địa chỉ | | |
| C2 | Mở từ icon lần đầu | Coi như **thiết bị mới** (kho cookie riêng) → đăng nhập lại mã NV; phiên chuyển từ Safari sang | | |
| C3 | Quét QR **trong app** (nút "Quét QR tại trạm") | Xin quyền camera 1 lần; quét xong vào đúng trạm | | |
| C4 | Từ chối quyền camera | Báo hướng dẫn bật lại quyền, vẫn chọn trạm từ danh sách được | | |
| C5 | Deploy bản mới khi form đang có số chưa lưu | **Không** tự tải lại; Lưu xong mới áp dụng bản mới | | |
| C6 | Chế độ máy bay → mở app từ icon | Mở được vỏ app (service worker), báo mất kết nối, không trắng màn hình | | |
| C7 | Để app chạy nền qua đêm → sáng mở lại | Phiên hôm qua vẫn nhập được nếu chưa chốt; hôm nay phải đăng nhập lại (R1) | | |

## D. Android cũ / máy yếu

| # | Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| D1 | Lần đầu mở trên 4G (xóa cache trước) | Tải xong và dùng được < 5 giây (bundle đầu ≤ 180 KB gzip, kiểm ở CI `check:bundle`) | |
| D2 | Đăng nhập 3 trạm → chuyển tab trạm | Chuyển mượt, không đăng nhập lại | |
| D3 | Nút −/+ và ô nhập với ngón tay | Vùng bấm đủ to (≥ 52 px), không bấm nhầm | |
| D4 | Font cỡ lớn (cài đặt trợ năng 130%) | Không vỡ layout, nút Lưu không bị che | |
| D5 | Màn hình ngoài nắng (độ sáng tối đa) | Đọc được trạng thái "Đã lưu" / "chưa lưu" | |

## E. Phía tổ trưởng (máy tính, trong lúc công nhân thử)

| # | Bước | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| E1 | Sơ đồ trạm trực tiếp | Trạm vừa đăng nhập hiện tên NV ≤ 10 giây | |
| E1b | Bảng sản lượng ngày, sau bước B4 (cùng mã NV dùng Zalo + Safari) | Ô của NV đó tô cam ⚠ "Nhiều thiết bị: mã NV dùng 2 thiết bị trong ngày" [D23] | |
| E2 | Đăng xuất hộ trạm còn số chưa nhập | Cảnh báo → "Vẫn đăng xuất hộ"; máy công nhân thấy phiên đã kết thúc | |
| E3 | Bảng sản lượng ngày | Số công nhân vừa Lưu hiện ngay (≤ 10 giây) | |

## Sau khi thử

- Lỗi ❌ → mở issue kèm ảnh chụp, model máy, phiên bản iOS/Android/Zalo, giờ xảy ra (đối chiếu Sentry + log API theo giờ).
- Vô hiệu hóa tài khoản / mã NV thử trên staging.
