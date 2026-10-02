# Prompt UI — Màn hình chuẩn của VSN Sản Lượng

> Nguồn: PRD-VSN-SanLuong-v2 · 29/09/2026 · Duy
> Màn hình chọn làm chuẩn layout: **Web → Sản xuất → Bảng sản lượng ngày** (F10 + F19)

---

## 1. Vì sao chọn màn hình này

| Ứng viên | Có đủ khung layout? | Mức độ quan trọng | Độ khó UI | Kết luận |
|---|---|---|---|---|
| **Bảng sản lượng ngày (Web)** | ✅ Header, sidebar menu, toolbar lọc, vùng nội dung dạng lưới, panel bên phải, thanh trạng thái dưới | MUST · là nơi sửa, nhập hộ, chốt số liệu **dùng tính lương** | Cao nhất: nhiều trạng thái ô, sửa tại chỗ, bắt buộc lý do, hộp xác nhận | **Chọn** |
| Nhập sản lượng (App công nhân) | ⚠ Chỉ có header + tab, không sidebar | Dùng nhiều nhất | Trung bình | Làm chuẩn riêng cho App mobile ở bước sau |
| Dashboard (Web/TV) | ⚠ Chủ yếu biểu đồ, không có form, không có bảng sửa | SHOULD | Trung bình | Kế thừa khung từ màn chuẩn |
| Trang chủ Web | ✅ Có khung nhưng nội dung mỏng | MUST | Thấp | Không đủ “thử thách” để làm chuẩn |

**Lý do chính:** ~15 màn hình Web còn lại (Báo cáo, Nhân viên, Mã hàng, Duyệt giờ, Khóa sổ…) đều là *khung Web + bộ lọc + bảng + thao tác*. Làm chuẩn được màn khó nhất thì các màn còn lại chỉ việc kế thừa.

> ⚠ App công nhân (mobile) có khung khác hẳn — nên làm 1 màn chuẩn riêng (“Nhập sản lượng”) sau khi chốt màn này.

**Cách dùng 2 prompt:** dán từng prompt vào **cùng một công cụ AI** (Claude, v0, Lovable…) trong 2 phiên riêng. Hai prompt dùng **chung một bộ dữ liệu mẫu** để so sánh công bằng. Tiêu chí so sánh ở mục 4.

---

## 2. 📐 Phiên bản rõ ràng — AI làm đúng y chang

```text
# VAI TRÒ
Bạn là Senior UI Engineer. Hãy dựng ĐÚNG màn hình mô tả dưới đây — không tự thêm, bớt hay đổi thiết kế. Chỗ nào không được mô tả, chọn phương án đơn giản nhất và ghi chú lại ở cuối.

# ĐẦU RA
- 1 file HTML duy nhất (HTML + CSS + JavaScript thuần), chạy được khi mở trực tiếp trên trình duyệt.
- Được dùng: Google Fonts (Be Vietnam Pro), icon Lucide qua CDN (https://unpkg.com/lucide@latest). Không dùng framework CSS.
- Khai báo toàn bộ màu, cỡ chữ, khoảng cách bằng CSS variables trong :root (đây sẽ là design token cho cả app).
- Toàn bộ chữ tiếng Việt. Số: định dạng 1.234 (dấu chấm hàng nghìn), ngày dd/MM/yyyy, giờ HH:mm.

# BỐI CẢNH
App "VSN Sản Lượng" của nhà máy may VIETSUN Đồng Nai. Màn hình "Bảng sản lượng ngày" dành cho TỔ TRƯỞNG chuyền: mỗi sáng từ 08:00, họ mở số liệu ngày hôm trước của chuyền mình, xử lý ô thiếu số / ô cảnh báo, sửa hoặc nhập hộ (bắt buộc lý do), rồi bấm Chốt ngày. Số liệu này dùng để tính lương.
Màn hình này là CHUẨN LAYOUT cho mọi màn Web khác của app.

# KÍCH THƯỚC MỤC TIÊU
- Thiết kế cho 1366×768 (viewport thực ~1366×657). KHÔNG được có thanh cuộn ngang ở 1366px.
- Từ 1600px trở lên: vùng nội dung giãn ra, bảng tối đa 1440px.
- Dưới 1280px: sidebar tự thu gọn còn icon (64px).

# DESIGN TOKENS
## Màu
--brand: #F29830            (cam VIETSUN — nền nút chính, viền focus phụ, chỉ báo menu đang chọn)
--brand-hover: #E0851C
--brand-soft: #FEF3E6       (nền mục menu đang chọn)
--brand-text: #9A5306       (chữ màu cam trên nền trắng — tương phản 5,8:1)
--brand-gray: #686868       (xám logo — chỉ dùng cho logo/chữ phụ trong sidebar)
--bg: #F6F7F9               (nền trang)
--surface: #FFFFFF          (nền card, bảng, header, sidebar)
--border: #E5E7EB
--border-strong: #D0D5DD
--text: #1F2328
--text-muted: #5F6670
--row-hover: #F9FAFB
--group-bg: #F3F4F6         (dòng tiêu đề nhóm Trạm)

Trạng thái (nền / chữ / viền trái 3px):
--empty-bg: #FEF9C3 · --empty-text: #854D0E · --empty-bar: #CA8A04     (ô chưa có số — VÀNG)
--warn-bg: #FFEDD5  · --warn-text: #9A3412  · --warn-bar: #EA580C      (ô cờ ⚠ — CAM ĐẬM, luôn kèm icon ⚠ để không lẫn với màu thương hiệu)
--adjust-bg: #EEF2FF · --adjust-text: #4338CA                         (ô đã điều chỉnh)
--support-bg: #F0F9FF · --support-text: #0369A1                       (nhãn "Hỗ trợ từ Cxx")
--open-bg: #EFF6FF · --open-text: #1D4ED8                             (Chưa chốt)
--closed-bg: #F0FDF4 · --closed-text: #15803D                         (Đã chốt)
--locked-bg: #F3F4F6 · --locked-text: #374151                         (Đã khóa, kèm icon ổ khóa)
--danger: #B42318 · --success: #15803D

QUY TẮC MÀU CAM: chữ trắng trên nền #F29830 KHÔNG đạt tương phản (2,3:1). Nút chính dùng nền --brand + chữ --text (#1F2328, tương phản 7:1), font-weight 600.

## Chữ
- Font: "Be Vietnam Pro", fallback: "Segoe UI", Roboto, Arial, sans-serif.
- Mọi cột số: font-variant-numeric: tabular-nums; căn phải.
- Thang cỡ chữ:
  - Tiêu đề trang: 20px / 600 / line-height 28px
  - Tiêu đề khối, tên chuyền trong dropdown: 16px / 600
  - Chữ thường, ô bảng: 14px / 400 / line-height 20px
  - Tiêu đề cột bảng: 12px / 600 / chữ HOA / letter-spacing 0.02em / màu --text-muted
  - Chữ phụ (SMV, mã công đoạn, giờ): 12px / 400 / --text-muted
  - Số lượng trong bảng: 15px / 600
  - Nhãn nhóm menu sidebar: 11px / 600 / HOA / letter-spacing 0.06em / --text-muted

## Khoảng cách, bo góc, bóng
- Lưới 4px. Padding vùng nội dung: 20px. Khoảng cách giữa các khối: 16px.
- Bo góc: card/bảng 8px · nút/input/dropdown 6px · pill/chip 999px.
- Bóng: chỉ dùng cho popover, modal, drawer: 0 8px 24px rgba(16,24,40,.12). Card và bảng KHÔNG có bóng, chỉ viền 1px --border.
- Focus: outline 2px solid --brand-text, offset 2px (mọi phần tử tương tác).
- Icon: Lucide, 18px, stroke-width 1.75.
- Không animation trang trí. Chỉ transition 120ms cho hover/màu nền.

# CẤU TRÚC LAYOUT (CSS Grid toàn trang)
grid-template-columns: 232px 1fr ; grid-template-rows: 56px 1fr
┌──────────┬─────────────────────────────────────────────────────┐
│ SIDEBAR  │ HEADER (56px, sticky)                               │
│ 232px    ├─────────────────────────────────────────────────────┤
│ (full    │ VÙNG NỘI DUNG (cuộn riêng)                          │
│ chiều    │  ① Thanh tiêu đề + bộ lọc + nút Chốt ngày (56px)    │
│ cao,     │  ② Dải tóm tắt (chip trạng thái, 44px)              │
│ sticky)  │  ③ Bảng dữ liệu (cuộn dọc bên trong, header dính)   │
│          │  ④ Thanh trạng thái dưới (40px, dính đáy)           │
└──────────┴─────────────────────────────────────── [Drawer phải 380px khi mở]

## A. SIDEBAR (nền --surface, viền phải 1px --border)
- Đỉnh (56px, cao bằng header): ô vuông 32×32 bo 6px nền --brand, chữ "VS" 14px/700 màu --text; bên phải: "VSN Sản Lượng" 15px/700 --text và dòng dưới "VIETSUN Đồng Nai" 11px --brand-gray.
- Menu (padding 12px 8px). Mỗi mục: cao 36px, padding 0 12px, icon 18px + chữ 14px/500, bo 6px, cách nhau 2px.
  - Hover: nền --row-hover.
  - Đang chọn: nền --brand-soft, chữ --brand-text 600, thanh dọc 3px --brand ở mép trái.
  - Badge số (nếu có): pill nền --danger chữ trắng 11px/600, căn phải.
- Menu hiển thị THEO QUYỀN của vai trò Tổ trưởng (nhóm không có mục nào thì ẩn luôn tiêu đề nhóm):
  - (không nhóm) Trang chủ [icon home]
  - SẢN XUẤT: Bảng sản lượng ngày [table-2] ← ĐANG CHỌN · Sơ đồ chuyền [git-branch] · Sơ đồ trạm trực tiếp [radio] · Duyệt giờ làm [clock] badge "1"
  - BÁO CÁO: Báo cáo [bar-chart-3] · Dashboard [layout-dashboard]
  - Khoảng cách 16px giữa các nhóm; tiêu đề nhóm cao 28px.
- Đáy sidebar: nút "Thu gọn" [panel-left-close] 36px; dưới cùng dòng "v1.0 · © VIETSUN Đồng Nai" 11px --text-muted.
- Trạng thái thu gọn (64px): chỉ icon, tooltip tên mục khi hover, ẩn tiêu đề nhóm.

## B. HEADER (56px, nền --surface, viền dưới 1px --border, padding 0 20px, flex căn giữa dọc)
- Trái: breadcrumb "Sản xuất / Bảng sản lượng ngày" 14px — phần cuối --text 500, phần trước --text-muted, dấu "/" --border-strong.
- Phải (cách nhau 12px):
  1. Trạng thái kết nối: chấm tròn 8px --success + "Đã kết nối" 12px --text-muted. (Khi mất mạng: chấm --danger + "Mất kết nối" và thanh cảnh báo đỏ 32px dưới header — dựng sẵn CSS, bật bằng biến JS.)
  2. Pill cảnh báo: nền --empty-bg, chữ --empty-text 13px/600, icon [alert-triangle] 16px: "Còn 2 ngày chưa chốt" — bấm mở dropdown liệt kê: "C05 · 28/09/2026", "C06 · 28/09/2026".
  3. Vách ngăn dọc 1px cao 24px.
  4. Người dùng: avatar tròn 32px nền --brand-soft chữ --brand-text "NB" 13px/600; bên phải 2 dòng: "Nguyễn Văn Bình" 13px/600 + "Tổ trưởng · C05, C06" 12px --text-muted; icon [chevron-down]. Bấm mở menu: Đổi mật khẩu · Đăng xuất.

## C. VÙNG NỘI DUNG (nền --bg, padding 20px, các khối cách nhau 16px)

### ① Thanh tiêu đề & bộ lọc (1 hàng, cao 56px trong card --surface, bo 8px, viền, padding 0 16px)
Trái → phải:
- Tiêu đề "Bảng sản lượng ngày" 20px/600.
- Dropdown Chuyền (rộng 160px, cao 36px): giá trị "C05 · Chuyền 5". Lựa chọn: C05, C06 (chỉ chuyền được gắn).
- Bộ chọn ngày (cao 36px): nút [chevron-left] 36×36 · ô ngày "Thứ 2, 28/09/2026" rộng 180px có icon [calendar] · nút [chevron-right] 36×36. Nút phải bị vô hiệu khi đang ở hôm nay.
- Chip trạng thái ngày (pill, cao 24px, 12px/600): "Chưa chốt" (--open) / "Đã chốt" (--closed) / "Đã khóa" + icon lock (--locked).
- Toggle "Chỉ hiện dòng cần xử lý" (switch 32×18, bật = nền --brand).
- Đẩy sang phải cùng (margin-left:auto): nút chính "Chốt ngày" — cao 36px, padding 0 16px, nền --brand, chữ --text 14px/600, icon [check-circle-2]. Hover nền --brand-hover.
  - Trước Giờ mở chốt ngày: nút disabled (nền #F3F4F6, chữ #9CA3AF) + tooltip "Chốt được từ 08:00 ngày 30/09/2026".
  - Ngày đã chốt: thay nút bằng chữ 13px --closed-text "Đã chốt bởi Nguyễn Văn Bình lúc 08:10 28/09/2026".

### ② Dải tóm tắt (1 hàng chip, cao 44px, không card, căn trái, cách nhau 8px)
Mỗi chip: pill cao 32px, padding 0 12px, 13px, số 600:
- "18 trạm · 21 dòng" (nền --surface, viền --border)
- "3 ô chưa có số" (--empty) — bấm = lọc các dòng này
- "1 ô cảnh báo ⚠" (--warn) — bấm = lọc
- "2 ô đã điều chỉnh" (--adjust) — bấm = lọc
- "1 yêu cầu giờ chờ duyệt" (nền --surface, viền --border, chữ --text-muted, icon [clock]) — là link sang Duyệt giờ làm
- Căn phải cùng hàng: "Hoàn thành (QC, PL-2641): 412 sp" 13px --text-muted, số 600 --text.

### ③ Bảng dữ liệu (card --surface, viền 1px --border, bo 8px, overflow hidden)
- Chiều cao: lấp phần còn lại của viewport; tbody cuộn dọc; thead sticky nền #FAFAFB, viền dưới 1px --border, cao 36px.
- Cột (tổng ≤ 1080px):
  | # | Cột          | Rộng   | Căn   | Nội dung |
  | 1 | Trạm         | 64px   | giữa  | số trạm 15px/600; chỉ hiện ở dòng đầu của nhóm |
  | 2 | Công đoạn    | tự giãn (min 260px) | trái | Dòng 1: pill mã hàng (11px/600, nền --group-bg, ví dụ "PL-2641") + tên công đoạn 14px/500. Dòng 2: "CD-06 · SMV 52s" 12px --text-muted. Công đoạn hoàn thành có thêm pill "QC ★" (--closed). |
  | 3 | Mã NV        | 96px   | trái  | 14px, font monospace nhẹ không bắt buộc |
  | 4 | Họ tên       | 180px  | trái  | 14px; dưới tên có thể có pill "Hỗ trợ từ C03" (--support, 11px) |
  | 5 | Số lượng     | 110px  | phải  | 15px/600 tabular; ô bấm để sửa |
  | 6 | Nguồn        | 104px  | trái  | chữ 13px + icon 14px: App [smartphone] · Offline [wifi-off] · Nhập hộ [user-plus] · Sửa Web [pencil] |
  | 7 | Trạng thái   | 160px  | trái  | pill trạng thái (xem bên dưới) |
  | 8 | (thao tác)   | 56px   | giữa  | icon [history] 16px, chỉ hiện khi hover dòng; bấm mở Drawer lịch sử |
- Dòng dữ liệu cao 44px (2 dòng chữ), padding ô 8px 12px, viền dưới 1px --border.
- Nhóm theo Trạm: giữa các trạm có viền trên 1px --border-strong. Cột Trạm hợp dòng (rowspan) khi trạm có nhiều công đoạn.
- Trạng thái dòng:
  - Bình thường: không nền; cột Trạng thái để trống (không hiện "OK").
  - CHƯA CÓ SỐ: cả dòng nền --empty-bg, viền trái 3px --empty-bar; cột Số lượng hiện "—" + nút nhỏ "Nhập hộ" (cao 28px, viền --border-strong, nền trắng, 13px/500, icon [user-plus]); cột Mã NV/Họ tên hiện NV đang đăng nhập trạm (chữ nghiêng --text-muted) hoặc "Chưa có người đăng nhập"; pill trạng thái "Chưa có số" (--empty).
  - CẢNH BÁO ⚠: nền --warn-bg, viền trái 3px --warn-bar; pill "⚠ Cần xem lại" (--warn); tooltip lý do cờ.
  - ĐÃ ĐIỀU CHỈNH: không tô nền dòng; ô Số lượng có icon [pencil] 14px --adjust-text trước số; pill "Đã điều chỉnh" (--adjust); tooltip: "Số cũ → số mới · lý do · người · giờ".
- Hover dòng: nền --row-hover (không áp lên dòng vàng/cam).

### ④ Thanh trạng thái dưới (40px, dính đáy vùng nội dung, nền --surface, viền trên 1px --border, padding 0 16px, 12px --text-muted)
- Trái: chú thích màu — ô vuông 10px + chữ: "Chưa có số" (vàng) · "Cần xem lại" (cam) · "Đã điều chỉnh" (tím) · "Hỗ trợ chuyền khác" (xanh).
- Phải: "Cập nhật lúc 09:15 · Tự làm mới khi có thay đổi" + icon [refresh-cw] bấm để tải lại.

## D. DRAWER LỊCH SỬ (panel phải, rộng 380px, trượt vào 160ms, nền --surface, bóng, overlay rgba(16,24,40,.24))
- Header drawer 56px: "Lịch sử bản ghi" 16px/600 + nút đóng [x].
- Khối tóm tắt: "Trạm 32 · CD-15 Vắt sổ sườn · NV00702 Ngô Thị Yến · 28/09/2026".
- Timeline dọc (mới nhất trên cùng), mỗi mục: giờ "08:07 29/09" 12px --text-muted · "460 → 430" 15px/600 · nguồn (pill) · "Nguyễn Văn Bình — Đếm lại bó hàng" 13px. Mục đầu tiên (nhập từ App) không có lý do.
- Đóng bằng nút X, phím Esc, hoặc bấm overlay.

# TƯƠNG TÁC BẮT BUỘC
1. Sửa số: bấm ô Số lượng → thành input số (cao 32px, căn phải, viền --brand-text). Chỉ nhận số nguyên 0–99.999; sai → viền --danger + dòng lỗi 12px dưới ô ("Số lượng phải là số nguyên từ 0 đến 99.999"). Enter → mở popover lý do ngay dưới ô: dropdown lý do (Công nhân báo lại · Đếm lại bó hàng · Nhập nhầm công đoạn · Khác) + textarea (bắt buộc khi chọn "Khác") + nút "Hủy" / "Lưu" (nút chính). Lưu → dòng thành ĐÃ ĐIỀU CHỈNH, thêm 1 mục vào lịch sử, toast "Đã lưu" 3 giây góc dưới phải. Esc → hủy, trả số cũ. Nếu số mới nhỏ hơn số cũ, trong popover hiện dòng cảnh báo "Số mới nhỏ hơn số cũ (460 → 430)".
2. Nhập hộ: bấm "Nhập hộ" ở dòng vàng → popover: ô Mã NV có gợi ý (gõ "NV005" → gợi ý danh sách; mặc định điền sẵn NV đang đăng nhập trạm nếu có), ô Số lượng, lý do (Không mang điện thoại · Hết pin · Không có phiên trạm · Khác) → Lưu → dòng hết vàng, nguồn "Nhập hộ", trạng thái "Đã điều chỉnh"; dải tóm tắt cập nhật số đếm.
3. Bàn phím: khi đang sửa, Enter lưu (sau khi có lý do), Tab chuyển xuống ô Số lượng của dòng kế tiếp.
4. Chốt ngày: bấm → modal 480px: tiêu đề "Chốt ngày 28/09/2026 – C05?"; danh sách cảnh báo (icon + chữ): "Còn 3 ô chưa có số", "Còn 1 yêu cầu giờ chờ duyệt"; câu "Sau khi chốt, công nhân không nhập được số của ngày này. Tổ trưởng vẫn sửa được (bắt buộc lý do)."; nút "Hủy" (viền) và "Vẫn chốt ngày" (nút chính). Xác nhận → chip thành "Đã chốt", nút thay bằng dòng "Đã chốt bởi…", toast.
5. Toggle / chip lọc: chỉ hiện dòng tương ứng; bấm lại để bỏ lọc.
6. Đổi ngày bằng mũi tên:
   - 29/09/2026 (hôm nay): chỉ 5 dòng đầu có số, còn lại vàng; nút Chốt ngày disabled + tooltip.
   - 28/09/2026: BỘ DỮ LIỆU CHÍNH (bên dưới). Mặc định mở ngày này.
   - 27/09/2026 (Chủ nhật): trạng thái rỗng giữa bảng — icon [calendar-x] 40px --text-muted, "Không có dữ liệu ngày 27/09/2026 (Chủ nhật)".
   - 26/09/2026 (Thứ 7): giống dữ liệu chính nhưng không còn ô vàng/cam; trạng thái "Đã chốt".
7. Thời gian giả lập hiện tại: 09:15 Thứ 3, 29/09/2026.

# DỮ LIỆU MẪU — Chuyền C05, ngày 28/09/2026, Chưa chốt
Mã hàng: PL-2641 Áo polo nam (chính) · SH-2655 Quần short nữ (nối đuôi, trạm 39–41)
Trạm | Mã hàng | Mã CĐ | Công đoạn | SMV(s) | Mã NV | Họ tên | SL | Nguồn | Ghi chú
12 | PL-2641 | CD-40 | Kiểm thành phẩm (QC ★) | 45 | NV00231 | Nguyễn Thị Lan | 412 | App |
25 | PL-2641 | CD-38 | Ủi thành phẩm | 40 | NV00318 | Trần Văn Hùng | 405 | App |
26 | PL-2641 | CD-05 | May nẹp cổ | 38 | NV00412 | Lê Thị Hoa | 520 | App |
27 | PL-2641 | CD-06 | Tra cổ | 52 | NV00127 | Phạm Thị Mai | 388 | App |
27 | PL-2641 | CD-07 | Diễu chân cổ | 24 | NV00127 | Phạm Thị Mai | 390 | App |
28 | PL-2641 | CD-08 | Ráp vai | 30 | — | — | — | — | CHƯA CÓ SỐ · đang đăng nhập: NV00509 Võ Thị Thu
29 | PL-2641 | CD-12 | May măng sét | 35 | NV01022 | Đỗ Thị Ngọc | 610 | Nhập hộ | ĐÃ ĐIỀU CHỈNH · "Không mang điện thoại" · Nguyễn Văn Bình 08:05 29/09
30 | PL-2641 | CD-13 | Tra tay | 48 | NV00788 | Huỳnh Thị Kim | 455 | App | Hỗ trợ từ C03
31 | PL-2641 | CD-14 | Can sườn | 42 | NV00655 | Bùi Thị Hạnh | 470 | App |
32 | PL-2641 | CD-15 | Vắt sổ sườn | 28 | NV00702 | Ngô Thị Yến | 430 | Sửa Web | ĐÃ ĐIỀU CHỈNH · 460 → 430 · "Đếm lại bó hàng" · Nguyễn Văn Bình 08:07 29/09
33 | PL-2641 | CD-16 | May nhãn sườn | 20 | NV00833 | Lý Thị Trang | 300 | Offline | ⚠ Gửi sau khi công đoạn bị gỡ lúc 15:02 28/09
34 | PL-2641 | CD-18 | Lên lai áo | 36 | — | — | — | — | CHƯA CÓ SỐ · Chưa có người đăng nhập
35 | PL-2641 | CD-20 | Đính nút | 18 | NV00914 | Phan Thị Nhung | 1.120 | App |
35 | PL-2641 | CD-21 | Thùa khuy | 16 | NV00914 | Phan Thị Nhung | 1.080 | App |
36 | PL-2641 | CD-22 | Cắt chỉ | 12 | NV00956 | Đặng Thị Vân | 1.350 | App |
37 | PL-2641 | CD-23 | Gắn thẻ bài | 10 | NV00987 | Trương Thị Hằng | 800 | App |
38 | PL-2641 | CD-24 | Gấp xếp | 22 | NV01003 | Mai Thị Diễm | 395 | App |
39 | SH-2655 | CD-03 | Ráp đáy quần | 34 | NV01045 | Châu Thị Thảo | 160 | App |
40 | SH-2655 | CD-04 | Tra lưng | 50 | — | — | — | — | CHƯA CÓ SỐ · đang đăng nhập: NV01051 Tạ Thị Loan
41 | SH-2655 | CD-05 | Luồn thun | 26 | NV01060 | La Thị Phương | 150 | App |
Người dùng: Nguyễn Văn Bình — Tổ trưởng — phụ trách C05, C06. Có 1 yêu cầu giờ chờ duyệt (NV00655, 28/09, 10,5 giờ).

# TIÊU CHÍ NGHIỆM THU (tự kiểm trước khi trả kết quả)
- [ ] Ở 1366×768: không cuộn ngang; thấy đủ header, sidebar, thanh lọc, dải tóm tắt, ≥ 8 dòng bảng, thanh trạng thái.
- [ ] Mọi màu lấy từ CSS variables; không mã màu rời rạc trong CSS thành phần.
- [ ] Không có chữ trắng trên nền cam #F29830.
- [ ] Đủ 4 trạng thái dòng (bình thường, chưa có số, cảnh báo, đã điều chỉnh) + nhãn hỗ trợ đúng dữ liệu mẫu.
- [ ] Sửa số và nhập hộ KHÔNG lưu được nếu thiếu lý do.
- [ ] Số lượng căn phải, tabular-nums, định dạng 1.234.
- [ ] Đủ 4 ngày mẫu (hôm nay / chưa chốt / Chủ nhật rỗng / đã chốt).
- [ ] Mọi thao tác dùng được bằng bàn phím; có focus ring.

Cuối câu trả lời: liệt kê ngắn các điểm bạn phải tự quyết vì prompt chưa mô tả.
```

---

## 3. 🎨 Phiên bản để AI sáng tạo — chỉ nêu mục tiêu & ngữ cảnh

```text
# VAI TRÒ
Bạn là Product Designer kiêm Front-end Engineer có kinh nghiệm thiết kế phần mềm cho nhà máy sản xuất. Tôi chỉ cho bạn bối cảnh và mục tiêu — mọi quyết định thiết kế (bố cục, điều hướng, màu, font, cách thể hiện trạng thái, tương tác) do bạn tự chọn.

# ĐẦU RA
1 file HTML duy nhất (HTML + CSS + JS, được dùng thư viện qua CDN nếu bạn thấy cần), mở trực tiếp trên trình duyệt là chạy, có dữ liệu mẫu và tương tác thật (không chỉ là ảnh tĩnh). Giao diện tiếng Việt.

# BỐI CẢNH
- "VSN Sản Lượng" là web app nội bộ của nhà máy may VIETSUN Đồng Nai (15 chuyền may). Công nhân tự nhập sản lượng theo công đoạn trên điện thoại; tổ trưởng, quản lý, kỹ thuật, nhân sự dùng bản Web trên máy tính.
- Số liệu sản lượng được CHỐT theo ngày và dùng để TÍNH LƯƠNG — sai số là tranh cãi với công nhân.
- Công ty có màu thương hiệu cam #F29830 (tham khảo, không bắt buộc).

# MÀN HÌNH CẦN THIẾT KẾ: "Bảng sản lượng ngày"
Đây là màn hình quan trọng nhất của bản Web và sẽ là CHUẨN LAYOUT cho khoảng 15 màn hình Web khác (báo cáo, danh mục nhân viên, mã hàng, duyệt giờ làm, khóa sổ…). Vì vậy hãy thiết kế cả khung ứng dụng (điều hướng, thông tin người dùng, vùng nội dung…), không chỉ riêng cái bảng.

# NGƯỜI DÙNG & CÔNG VIỆC
- Tổ trưởng chuyền, 30–45 tuổi, quen Excel, không rành công nghệ, thường phụ trách 1–2 chuyền.
- Mỗi sáng từ 08:00, họ mở số liệu NGÀY HÔM TRƯỚC của chuyền mình, cần trong vài phút:
  1. Biết ngay còn chỗ nào thiếu số hoặc bất thường.
  2. Sửa số sai hoặc nhập hộ cho công nhân không có điện thoại — mọi thay đổi đều BẮT BUỘC có lý do và được lưu lịch sử.
  3. Xác nhận "Chốt ngày" (được chốt cả khi còn thiếu, nhưng phải được cảnh báo rõ).
- Máy tính văn phòng xưởng, màn hình tối thiểu 1366×768.

# THÔNG TIN & THAO TÁC PHẢI CÓ (còn cách thể hiện do bạn quyết)
- Chọn chuyền (chỉ các chuyền được phụ trách) và chọn ngày.
- Trạng thái của ngày: Chưa chốt / Đã chốt / Đã khóa. Chỉ được chốt ngày hôm trước từ 08:00 sáng hôm sau.
- Dữ liệu theo từng Trạm → Công đoạn → công nhân: mã NV, họ tên, số lượng, nguồn nhập (App / Offline / Nhập hộ / Sửa Web).
- Phân biệt được: ô chưa có số · ô cần xem lại (⚠) · ô tổ trưởng đã điều chỉnh · công nhân hỗ trợ từ chuyền khác.
- Xem lịch sử thay đổi của một bản ghi (số cũ → số mới, ai, lúc nào, lý do).
- Cảnh báo "còn X ngày chưa chốt" của các chuyền mình phụ trách.
- Các trạng thái: đang có dữ liệu, ngày không có dữ liệu (Chủ nhật), ngày đã chốt, chưa đến giờ được chốt.

# DỮ LIỆU MẪU — Chuyền C05, ngày 28/09/2026, Chưa chốt (giờ hiện tại: 09:15 Thứ 3, 29/09/2026)
Mã hàng: PL-2641 Áo polo nam · SH-2655 Quần short nữ (nối đuôi, trạm 39–41)
Trạm | Mã hàng | Mã CĐ | Công đoạn | SMV(s) | Mã NV | Họ tên | SL | Nguồn | Ghi chú
12 | PL-2641 | CD-40 | Kiểm thành phẩm (công đoạn hoàn thành) | 45 | NV00231 | Nguyễn Thị Lan | 412 | App |
25 | PL-2641 | CD-38 | Ủi thành phẩm | 40 | NV00318 | Trần Văn Hùng | 405 | App |
26 | PL-2641 | CD-05 | May nẹp cổ | 38 | NV00412 | Lê Thị Hoa | 520 | App |
27 | PL-2641 | CD-06 | Tra cổ | 52 | NV00127 | Phạm Thị Mai | 388 | App |
27 | PL-2641 | CD-07 | Diễu chân cổ | 24 | NV00127 | Phạm Thị Mai | 390 | App |
28 | PL-2641 | CD-08 | Ráp vai | 30 | — | — | — | — | Chưa có số · đang đăng nhập: NV00509 Võ Thị Thu
29 | PL-2641 | CD-12 | May măng sét | 35 | NV01022 | Đỗ Thị Ngọc | 610 | Nhập hộ | Đã điều chỉnh · "Không mang điện thoại" · Nguyễn Văn Bình 08:05 29/09
30 | PL-2641 | CD-13 | Tra tay | 48 | NV00788 | Huỳnh Thị Kim | 455 | App | Hỗ trợ từ C03
31 | PL-2641 | CD-14 | Can sườn | 42 | NV00655 | Bùi Thị Hạnh | 470 | App |
32 | PL-2641 | CD-15 | Vắt sổ sườn | 28 | NV00702 | Ngô Thị Yến | 430 | Sửa Web | Đã điều chỉnh · 460 → 430 · "Đếm lại bó hàng" · Nguyễn Văn Bình 08:07 29/09
33 | PL-2641 | CD-16 | May nhãn sườn | 20 | NV00833 | Lý Thị Trang | 300 | Offline | ⚠ Gửi sau khi công đoạn bị gỡ lúc 15:02 28/09
34 | PL-2641 | CD-18 | Lên lai áo | 36 | — | — | — | — | Chưa có số · Chưa có người đăng nhập
35 | PL-2641 | CD-20 | Đính nút | 18 | NV00914 | Phan Thị Nhung | 1.120 | App |
35 | PL-2641 | CD-21 | Thùa khuy | 16 | NV00914 | Phan Thị Nhung | 1.080 | App |
36 | PL-2641 | CD-22 | Cắt chỉ | 12 | NV00956 | Đặng Thị Vân | 1.350 | App |
37 | PL-2641 | CD-23 | Gắn thẻ bài | 10 | NV00987 | Trương Thị Hằng | 800 | App |
38 | PL-2641 | CD-24 | Gấp xếp | 22 | NV01003 | Mai Thị Diễm | 395 | App |
39 | SH-2655 | CD-03 | Ráp đáy quần | 34 | NV01045 | Châu Thị Thảo | 160 | App |
40 | SH-2655 | CD-04 | Tra lưng | 50 | — | — | — | — | Chưa có số · đang đăng nhập: NV01051 Tạ Thị Loan
41 | SH-2655 | CD-05 | Luồn thun | 26 | NV01060 | La Thị Phương | 150 | App |
Người dùng: Nguyễn Văn Bình — Tổ trưởng — phụ trách C05, C06. Có 1 yêu cầu sửa giờ làm đang chờ duyệt.

# ĐIỀU TÔI MUỐN THẤY
Hãy thiết kế theo cách BẠN cho là tốt nhất cho người dùng này — kể cả khi khác với kiểu "bảng Excel" quen thuộc. Tôi muốn thấy bạn làm gì khi được tự do.

Cuối câu trả lời, giải thích ngắn (5–7 gạch đầu dòng) các quyết định thiết kế chính và lý do — đặc biệt: vì sao chọn bố cục này, cách bạn giúp tổ trưởng xử lý xong trong vài phút, và cách khung này mở rộng cho các màn hình khác.
```

---

## 4. So sánh 2 kết quả

Chấm mỗi tiêu chí 1–5 cho từng phiên bản:

| Tiêu chí | Câu hỏi kiểm tra | 📐 | 🎨 |
|---|---|---|---|
| Vừa màn 1366×768 | Không cuộn ngang? Thấy ≥ 8 dòng dữ liệu? | | |
| Tốc độ xử lý | Tổ trưởng tìm ra 3 ô thiếu + 1 ô ⚠ trong < 10 giây? | | |
| Kiểm soát dữ liệu lương | Có thể lưu mà thiếu lý do không? Lịch sử có rõ không? | | |
| Chốt ngày an toàn | Cảnh báo trước khi chốt có đủ và rõ không? | | |
| Khả năng làm khung chuẩn | Header/sidebar/toolbar tách được thành component dùng lại? | | |
| Thương hiệu | Màu cam dùng đúng chỗ, đủ tương phản? | | |
| Ý tưởng mới đáng lấy | Có điểm nào tốt hơn thiết kế của mình không? | — | |

**Gợi ý quy trình:** lấy bản 📐 làm nền (đúng token, đúng quy tắc), gom các ý tưởng tốt từ bản 🎨, cập nhật lại design token → khóa thành chuẩn layout cho toàn bộ Web.
