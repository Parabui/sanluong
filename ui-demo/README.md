# VSN Sản Lượng — UI demo

Bản demo giao diện theo `../PRD-VSN-SanLuong-v2.md`. Màn đầu tiên (**Bảng sản lượng ngày**) giữ đúng layout, màu, font, spacing của `../ui-demo-options/merged.html`; App công nhân theo `../ui-demo-options/app-nhap-san-luong.html`.

Chỉ có dữ liệu mẫu, chưa có logic thật: bấm được, điều hướng được, trạng thái giữ trong trình duyệt. Giả lập thời điểm **09:15 Thứ 3, 29/09/2026**.

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Trang gốc `/` chuyển thẳng tới Bảng sản lượng ngày; `/man-hinh` liệt kê mọi màn.

## Công nghệ

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 — token nằm ở `:root` trong `src/app/globals.css` (giữ nguyên tên biến của merged.html), map sang utility qua `@theme inline`
- `lucide-react` (icon), `recharts` (biểu đồ), `qrcode.react` (QR in tại trạm)
- Font Be Vietnam Pro + JetBrains Mono qua `next/font`

## Màn hình

| Nhóm | Route |
|---|---|
| Đăng nhập · Đổi mật khẩu | `/dang-nhap`, `/doi-mat-khau` |
| Trang chủ | `/trang-chu` |
| Sản xuất | `/san-xuat/bang-san-luong` ★, `/san-xuat/so-do-chuyen`, `/san-xuat/so-do-tram`, `/san-xuat/duyet-gio` |
| Báo cáo | `/bao-cao`, `/bao-cao/dashboard` |
| Lương | `/luong/khoa-so`, `/luong/xuat-du-lieu` |
| Kế hoạch | `/ke-hoach` |
| Danh mục | `/danh-muc/nhan-vien`, `/danh-muc/ma-hang`, `/danh-muc/chuyen-tram` |
| Hệ thống | `/he-thong/tai-khoan`, `/he-thong/cai-dat`, `/he-thong/audit-log` |
| App công nhân | `/app/huong-dan`, `/app/chon-tram`, `/app/dang-nhap`, `/app/nhap`, `/app/cua-toi`, `/app/cua-toi/[ngay]`, `/app/gio-lam` |
| TV | `/tv` (thiết kế 1920×1080, tự co theo cửa sổ) |

## Mẹo demo

- **Đổi vai trò** ở menu tài khoản (góc trên phải): menu trái lọc theo ma trận phân quyền F8; vào màn ngoài quyền sẽ thấy "Không có quyền truy cập".
- Bảng sản lượng ngày: phím `/` tìm, `N` mở ô cần xử lý kế tiếp, `Enter`/`Tab` khi sửa số; chip tóm tắt để lọc.
- App công nhân: bảng bên phải khung điện thoại có các kịch bản (mất mạng, ô đã điều chỉnh, trạm chưa có công đoạn).
- Đăng nhập Web: mật khẩu bất kỳ; gõ `sai` để xem thông báo lỗi.

## Cấu trúc

```
src/
  app/(web)/…        màn Web trong khung sidebar + header (AppShell)
  app/(auth)/…       đăng nhập, đổi mật khẩu
  app/app/…          App công nhân (khung điện thoại + bảng kịch bản)
  app/tv/            chế độ TV
  components/shell/  AppShell, StatusBar
  components/ui/     primitives (Button, Modal, Drawer, Menu…), DataTable, toast, tooltip
  components/mobile/ store + UI dùng chung của App công nhân
  components/charts.tsx  biểu đồ Web + TV
  lib/               dữ liệu mẫu, điều hướng/phân quyền, tiện ích định dạng VN
```
