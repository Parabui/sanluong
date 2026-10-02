# PRD — VSN Sản Lượng

> **Phiên bản:** v2.1 · 30/09/2026 · Người phụ trách: Duy
> Mô tả ngắn: Công nhân chuyền may tự nhập sản lượng hằng ngày trên điện thoại; tổ trưởng, quản lý, IE, HR theo dõi sản lượng – hiệu suất và dùng số liệu đã khóa để tính lương.
> Các thay đổi so với v1 được đánh mã `[R x.y]` theo biên bản review, tổng hợp ở mục Changelog.
> v2.1 đồng bộ với `TDD-VSN-SanLuong-v1.md`; các thay đổi đánh mã `[D x]` theo nhật ký quyết định kỹ thuật.

---

## ① Overview

- **App name:** VSN Sản Lượng
- **Tagline:** Nhập nhanh – Đúng số – Đúng tiến độ
- **Problem:** Công nhân ghi sản lượng theo công đoạn vào sổ tay, báo miệng cho tổ trưởng; tổ trưởng tổng hợp lại vào file Excel. Quy mô: 15 chuyền × 41 trạm, khoảng 450–525 công nhân. Hệ quả: số liệu lệch, nhập sai, quản lý không xem được sản lượng trong ngày, tranh cãi khi tính lương.
- **Solution:** Công nhân tự nhập sản lượng trên điện thoại (PWA); hệ thống tự tổng hợp, tính hiệu suất, cho chốt – khóa số liệu và xuất báo cáo, xuất dữ liệu tính lương.
- **Platform:** Both — Mobile (PWA) cho công nhân nhập sản lượng; Web cho tổ trưởng, quản lý, IE, HR, BGĐ; chế độ TV cho dashboard tại xưởng.
- **Phạm vi trạm MVP:** Trạm 26–41 (chuyền chi tiết) + Trạm 12 (QC) + Trạm 25 (Ủi) → 18 trạm/chuyền, 270 trạm toàn nhà máy. Trạm 1–25 còn lại do chuyền treo JACK ghi nhận (tích hợp ở giai đoạn sau).

---

## ①b Quy ước chung & Thuật ngữ `[R 1]`

> Áp dụng cho mọi tính năng. Khi một tính năng không ghi rõ, dùng quy ước ở đây.

**Quy ước kỹ thuật**

| Hạng mục | Quy ước |
|---|---|
| Múi giờ | `Asia/Ho_Chi_Minh` cho server, database, báo cáo. Server đồng bộ NTP |
| Ngày làm việc | = ngày lịch theo **giờ server**. Nhà máy làm 1 ca/ngày, không có ca qua 00:00 |
| Lịch làm việc | Thứ 2 – Thứ 7; nghỉ Chủ nhật |
| Định dạng hiển thị | Số `1.234,5` · Ngày `dd/MM/yyyy` · Giờ `HH:mm` · Tiếng Việt |
| Mã NV | Lưu dạng **text**; tự `trim` + viết hoa khi import và khi đăng nhập (`" nv00123 "` → `NV00123`). Không bao giờ tái sử dụng |
| Đơn vị sản lượng | **Sản phẩm** (áo/quần) đã qua công đoạn. SMV = giây / 1 sản phẩm |
| Số lượng hợp lệ | Số nguyên 0 – 99.999 |
| Cấu trúc lỗi API | `{ code, message (tiếng Việt), field?, traceId }` — `message` hiển thị trực tiếp cho người dùng |
| Phân quyền | Kiểm tra ở server cho mọi API; client chỉ ẩn/hiện |
| Audit log | Mọi thao tác ghi (tạo/sửa/xóa/chốt/khóa/đăng xuất hộ/phân quyền) ghi vào audit log chỉ-thêm (append-only) |

**Thuật ngữ**

| Thuật ngữ | Định nghĩa |
|---|---|
| **Phiên trạm** | Cặp (Trạm, Mã NV, Ngày làm việc). Mỗi trạm tại một ngày chỉ có tối đa 1 phiên đang hoạt động |
| **Bản ghi sản lượng** | Duy nhất theo **Ngày làm việc + Trạm + Công đoạn + Mã NV** `[R 1.1]`. Giá trị = tổng số đã làm trong ngày tính đến lần nhập cuối |
| **Chuyền của trạm** | Chuyền chứa trạm. Sản lượng luôn tính cho chuyền của trạm |
| **Chuyền gốc của NV** | Chuyền/Nhóm của NV trong danh mục nhân viên (F2). Dùng để duyệt giờ làm và gắn nhãn "Hỗ trợ" |
| **Ngày mở nhập** | Hôm nay + các ngày **chưa chốt** trong 3 ngày lịch liền trước `[R 3.1]` |
| **Giờ mở chốt ngày** | Mốc giờ (mặc định 08:00, cấu hình chung) từ đó tổ trưởng được chốt ngày hôm trước và F13 bắt đầu cảnh báo `[R 5.9]` |
| **Ô đã điều chỉnh** | Bản ghi sản lượng mà tổ trưởng đã sửa hoặc nhập hộ trên Web. Công nhân không ghi đè được nữa `[R 5.4]` |

**Quy tắc phạm vi dữ liệu (R3)** `[R 5.8]`
- **Sản lượng:** tổ trưởng của *chuyền của trạm* được xem, sửa, nhập hộ — cho bất kỳ NV đang hoạt động nào (kể cả NV hỗ trợ từ chuyền khác).
- **Giờ làm:** tổ trưởng của *chuyền gốc của NV* duyệt/sửa; được xem sản lượng của NV chuyền mình ở mọi chuyền (chỉ xem).

---

## ② Target User

**Persona chính — Công nhân chuyền may**
- Tên / độ tuổi / nghề nghiệp: Công nhân may, 20–45 tuổi, đứng máy tại trạm
- Họ đang làm gì hàng ngày: Ghi số sản phẩm theo từng công đoạn, nhiều lần trong ca, cộng tổng cuối ca; báo miệng cho tổ trưởng
- Nỗi đau cụ thể: Số báo lệch với số tổ trưởng ghi; tranh cãi số lượng khi tính lương; không tự kiểm tra được số của mình
- Họ dùng tool nào hiện tại: Sổ tay, báo miệng

**Persona phụ — Tổ trưởng / Quản lý chuyền**
- Tên / độ tuổi / nghề nghiệp: Tổ trưởng / quản lý chuyền, 30–45 tuổi
- Họ đang làm gì hàng ngày: Nhận số báo miệng, tổng hợp vào Excel của tổ
- Nỗi đau cụ thể: Nhập lại Excel mất thời gian, hay sai; quản lý không xem được sản lượng trong ngày, phải chờ cuối ca hoặc hôm sau; tranh cãi với công nhân khi tính lương
- Họ dùng tool nào hiện tại: File Excel · Máy tính màn hình tối thiểu 1366×768

**Các vai trò khác trong hệ thống:** Quản lý xưởng · Kỹ thuật/IE · IT/HR · Kế hoạch sản xuất · Ban Giám đốc · Superadmin · Tài khoản TV (chỉ xem dashboard)

---

## ③ Features & User Stories

> Mỗi feature gồm: Tên · Story · Done khi. Luồng nhiều bước có thêm Steps và Edge cases.
> Các chỉ tiêu thời gian đo theo điều kiện chuẩn ở mục ⑥ (p95, 300 người dùng đồng thời, dữ liệu 12 tháng).

---

### 🟢 MUST (bắt buộc có trong MVP)

#### Feature 1: Nhập sản lượng theo trạm
**Story:** Là công nhân chuyền may, tôi muốn đăng nhập vào trạm mình đang đứng và nhập số sản phẩm của từng công đoạn, để sản lượng được ghi đúng cho mã nhân viên của tôi mà không phải ghi sổ rồi báo miệng.

**Steps to Complete:**
1. Mở app → chọn trạm từ danh sách (Xưởng → Chuyền → Trạm), hoặc quét QR khi có F12
2. Nếu trạm đang có người khác đăng nhập trong ngày → bấm Đăng xuất người đó (ghi audit log)
3. Đăng nhập bằng mã NV → tạo phiên trạm cho **ngày hôm nay**
4. Chọn ngày làm việc trong danh sách **Ngày mở nhập** mà điện thoại còn giữ phiên của trạm đó (mặc định: hôm nay)
5. App hiện danh sách công đoạn đã gán cho trạm **trong ngày đang chọn** (nhãn mã hàng nếu chuyền chạy 2 mã) → nhập số lượng từng công đoạn
6. Bấm Lưu → app báo thành công
7. Công nhân đứng nhiều trạm: mỗi trạm là một tab trên đầu màn hình, chuyển qua lại không cần đăng nhập lại

**Quy tắc nghiệp vụ:**
- Số nhập là **tổng số đã làm trong ngày** tính đến lúc nhập; lần nhập sau **ghi đè** lần trước của chính bản ghi đó (key: Ngày + Trạm + Công đoạn + Mã NV). Sản lượng ngày = số nhập cuối cùng. `[R 1.1]`
- **R1 — Phiên trạm theo ngày làm việc:** đăng nhập luôn tạo phiên cho hôm nay; sang ngày mới phải đăng nhập lại. Phiên của các ngày trước **vẫn được giữ trên điện thoại** và nhập được khi ngày đó còn thuộc Ngày mở nhập; phiên tự hết khi ngày đó được chốt hoặc ra khỏi 3 ngày. Không đăng nhập lùi ngày được — thiếu phiên thì tổ trưởng nhập hộ (F19). `[R 3.1]`
- **R2 — Hỗ trợ chuyền khác:** sản lượng tính cho chuyền của trạm; báo cáo theo công nhân ghi rõ "Hỗ trợ từ chuyền X" dựa trên **chuyền gốc của NV lưu tại thời điểm nhập**. `[R 3.7]`
- **R4 — Một điện thoại = một mã NV trong một ngày:** được đăng nhập nhiều trạm. Muốn đổi người phải đăng xuất hết các trạm của ngày hôm nay. Điện thoại dùng chung giữa nhiều người không hỗ trợ — dùng F19. `[R 1.3]`
- **R5 — Snapshot khi lưu:** mỗi bản ghi lưu kèm SMV đang áp dụng cho ngày đó, chuyền của trạm, chuyền gốc của NV. `[R 3.7, 5.5]`
- **R6 — Ô đã điều chỉnh:** bản ghi đã được tổ trưởng sửa/nhập hộ → app hiện "Tổ trưởng đã điều chỉnh: [số] – [lý do]" ở chế độ chỉ đọc; không cho ghi đè. `[R 5.4]`

**Done khi:**
- ✅ Mỗi trạm tại một ngày chỉ có 1 phiên đang hoạt động (ràng buộc duy nhất ở database)
- ✅ Một mã NV đăng nhập được nhiều trạm; sản lượng ghi riêng theo từng trạm
- ✅ Sản lượng ghi cho đúng mã NV của phiên trạm lúc bấm Lưu — sai lệch 0 bản ghi (kiểm bằng test tự động)
- ✅ Hiện đúng 100% công đoạn đã gán cho trạm **trong ngày đang chọn**, kể cả công đoạn đã gỡ trong ngày đó
- ✅ Nhập lại cùng bản ghi → số mới ghi đè; báo cáo chỉ lấy số mới nhất
- ✅ Mỗi lần nhập lưu lịch sử: ai nhập, số cũ, số mới, giờ server, giờ thiết bị (chỉ tổ trưởng/quản lý xem được)
- ✅ Chỉ chọn được ngày thuộc Ngày mở nhập và có phiên trên điện thoại
- ✅ Ô đã điều chỉnh hiện chỉ đọc, server từ chối mọi lệnh ghi từ app
- ✅ Bấm Lưu → báo thành công < 2 giây
- ✅ Số vượt trần lý thuyết → hộp xác nhận trước khi lưu (xem Edge cases)
- ❌ Công nhân tự thêm/sửa công đoạn của trạm
- ❌ Mã PIN khi đăng nhập trạm (rủi ro đã chấp nhận — xem ⑨)
- ❌ Hàng đợi offline trong MVP (xem F14)

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Mã NV không tồn tại hoặc đã ngưng hoạt động | Báo "Mã NV không hợp lệ", không cho đăng nhập |
| Nhập sai mã NV liên tục | Sai 10 lần / 10 phút / (thiết bị + IP) → khóa đăng nhập trạm 15 phút `[R 3.5]` |
| Nhập số âm, chữ, để trống, > 99.999 | Chặn, báo lỗi tại ô nhập |
| Số > trần lý thuyết = giờ làm × 3600 ÷ SMV × 1,5 | Hỏi "Số [X] cao bất thường, bạn chắc chắn?" — xác nhận thì vẫn lưu `[R 3.3]` |
| Số mới nhỏ hơn số cũ | Hỏi xác nhận trước khi ghi đè |
| Mất mạng / server không phản hồi khi bấm Lưu | **MVP:** giữ nguyên số trên form, báo "Chưa lưu được – kiểm tra mạng", nút **Thử lại**. Vì số nhập là tổng tích lũy, lần lưu thành công sau mang đủ số cả ngày `[R 5.3]` |
| Trạm chưa được gán công đoạn trong ngày đang chọn | Báo "Trạm chưa có công đoạn, liên hệ tổ trưởng" |
| Ngày đã chốt | Không lưu, báo "Ngày đã chốt, liên hệ tổ trưởng" |
| Đang nhập thì bị người khác chiếm trạm / bị đăng xuất hộ, rồi mới bấm Lưu | Server từ chối, **giữ số trên form**, báo "Bạn đã bị đăng xuất khỏi trạm X lúc hh:mm bởi [tên]" `[R 3.8]` |
| 2 người đăng nhập cùng trạm gần như cùng lúc | Người đến sau nhận "Trạm vừa có người đăng nhập, tải lại" `[R 3.9]` |
| Bản ghi là Ô đã điều chỉnh | Chỉ đọc, hiện số + lý do của tổ trưởng; sai thì công nhân báo miệng tổ trưởng `[R 5.4]` |

---

#### Feature 2: Quản lý danh sách nhân viên
**Story:** Là IT/HR, tôi muốn import danh sách nhân viên từ file Excel của HR và chỉnh sửa khi cần, để công nhân đăng nhập được vào trạm bằng mã nhân viên của mình.

**Steps to Complete (Import Excel):**
1. Vào Nhân viên → Import Excel
2. Tải file mẫu (cột Mã NV đã định dạng Text) → chọn file
3. Hệ thống kiểm tra, hiện xem trước: số dòng thêm mới / cập nhật / lỗi
4. Bấm Xác nhận → ghi dữ liệu

**Thao tác khác:** thêm tay, sửa, ngưng hoạt động; xóa hẳn (chỉ Superadmin, chỉ NV chưa có sản lượng).

**Dữ liệu:** Mã NV (bắt buộc, duy nhất, text) · Họ tên (bắt buộc) · Chuyền/Nhóm (bắt buộc) · Bậc tay nghề (không bắt buộc)

**Done khi:**
- ✅ Import file 600 dòng < 10 giây
- ✅ Mã NV được chuẩn hóa (trim, viết hoa) trước khi so khớp; giữ nguyên số 0 đầu `[R 3.4]`
- ✅ Mã NV đã tồn tại → cập nhật, không tạo bản trùng
- ✅ Dòng lỗi không được ghi; dòng hợp lệ vẫn ghi; có danh sách lỗi (số dòng + lý do)
- ✅ Đổi chuyền của NV chỉ ảnh hưởng bản ghi sản lượng mới; bản ghi cũ giữ chuyền gốc đã snapshot `[R 3.7]`
- ✅ Nhân viên ngưng hoạt động không đăng nhập được trạm; sản lượng cũ vẫn giữ trong báo cáo
- ✅ **Xóa hẳn chỉ cho NV chưa có bản ghi sản lượng nào** (dùng khi import nhầm). NV đã có sản lượng → nút Xóa bị ẩn, chỉ được Ngưng `[R 5.6]`
- ❌ Đồng bộ tự động với phần mềm nhân sự

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| File sai mẫu / thiếu cột | Từ chối cả file, báo cột thiếu |
| Thiếu mã NV, họ tên hoặc chuyền | Dòng lỗi, bỏ qua |
| Trùng mã NV trong cùng file (sau chuẩn hóa) | Đánh dấu cả hai dòng lỗi |
| Ô Mã NV là kiểu số (mất số 0 đầu) | Cảnh báo dòng "Mã NV đang ở dạng số, kiểm tra số 0 đầu" — vẫn cho ghi nếu xác nhận |
| Chuyền/Nhóm không tồn tại | Dòng lỗi |
| Ngưng nhân viên đang đăng nhập trạm | Tự đăng xuất khỏi mọi trạm |
| Superadmin cố xóa NV đã có sản lượng (qua API) | Server từ chối "Nhân viên đã có sản lượng — chỉ được Ngưng" |

---

#### Feature 3: Quản lý mã hàng và công đoạn
**Story:** Là Kỹ thuật/IE, tôi muốn import danh sách công đoạn của từng mã hàng từ bảng quy trình công nghệ và chỉnh sửa khi cần, để có sẵn công đoạn chuẩn khi gán vào trạm.

**Steps to Complete (Import Excel):**
1. Vào Mã hàng → Import Excel
2. Chọn file quy trình công nghệ (mỗi file = 1 mã hàng)
3. Hệ thống kiểm tra, hiện xem trước: số công đoạn thêm mới / cập nhật / lỗi / **SMV thay đổi**
4. Nếu có SMV thay đổi → chọn **"Áp dụng từ ngày"** (mặc định hôm nay)
5. Bấm Xác nhận

**Cấu trúc file import:** ⏳ *Chờ file mẫu thật của IE — bổ sung: tên sheet đọc, dòng tiêu đề, mapping cột, cách xử lý ô gộp và dòng tổng.* `[R 3 — mở]`

**Dữ liệu:**
- Mã hàng: Mã hàng (duy nhất) · Tên hàng · Khách hàng · Số lượng đơn hàng (số nguyên > 0)
- Công đoạn: Mã công đoạn (không trùng trong cùng mã hàng) · Tên công đoạn · SMV (giây/sản phẩm, > 0) · Trạng thái (Hoạt động / Ngưng) · Cờ "Công đoạn hoàn thành"
- Lịch sử SMV: SMV · Áp dụng từ ngày · Người đổi · Thời điểm `[R 5.5]`

**Quy tắc SMV** `[R 5.5]`:
- Bản ghi sản lượng dùng SMV **có hiệu lực tại ngày làm việc** của bản ghi (snapshot khi lưu).
- Đổi SMV "Áp dụng từ ngày D": D được lùi tối đa tới **ngày sớm nhất chưa khóa** của mã hàng đó. Hệ thống tính lại snapshot SMV cho các bản ghi từ D trở đi (chỉ ngày chưa khóa), ghi audit log số bản ghi bị tính lại.

**Done khi:**
- ✅ Mỗi mã hàng có danh sách công đoạn riêng
- ✅ Mỗi mã hàng có đúng 1 công đoạn được đánh dấu "Công đoạn hoàn thành" (QC); thiếu thì báo lỗi khi lưu/import
- ✅ Import file 100 công đoạn < 5 giây
- ✅ Công đoạn đã tồn tại → cập nhật, không tạo trùng
- ✅ Đổi SMV **không làm thay đổi** phút SMV / % hiệu suất của bất kỳ ngày đã khóa nào (kiểm bằng test)
- ✅ Công đoạn Ngưng không hiện để gán vào trạm; sản lượng cũ giữ nguyên
- ✅ Không cho Ngưng công đoạn còn đang gán ở trạm — báo "Công đoạn đang gán tại trạm X, Y — gỡ khỏi trạm trước khi ngưng"
- ✅ Chỉ Kỹ thuật/IE và Superadmin tạo/sửa
- ❌ Tính đơn giá, tiền lương từ SMV

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| File sai mẫu / thiếu cột bắt buộc | Từ chối cả file |
| Trùng mã công đoạn trong file | Đánh dấu cả hai dòng lỗi |
| SMV trống, 0, âm hoặc chữ | Dòng lỗi |
| Import vào mã hàng đang chạy trên chuyền | Cảnh báo "Mã hàng đang được sử dụng" trước khi ghi |
| Công đoạn có trong hệ thống nhưng không có trong file | Giữ nguyên, liệt kê trong màn hình xem trước; không tự Ngưng |
| Chọn "Áp dụng từ ngày" rơi vào ngày đã khóa | Chặn, báo ngày sớm nhất được chọn |

---

#### Feature 4: Gán công đoạn vào trạm
**Story:** Là tổ trưởng hoặc Kỹ thuật/IE, tôi muốn kéo thả công đoạn của mã hàng vào các trạm của chuyền, để công nhân mở app tại trạm là thấy đúng công đoạn cần nhập.

**Steps to Complete:**
1. Web → Sơ đồ chuyền → chọn chuyền (tổ trưởng: chỉ các chuyền được gắn)
2. Chọn mã hàng
3. Chọn Gán mới hoặc Sao chép từ sơ đồ đã có
4. Kéo công đoạn từ danh sách, thả vào trạm
5. Bấm Lưu → app công nhân cập nhật
6. Khi mã cũ chạy xong đuôi → tổ trưởng bấm "Kết thúc mã hàng" → gỡ toàn bộ công đoạn của mã cũ khỏi trạm

**Quy tắc lịch sử gán** `[R 3.6]`:
- Mỗi lần Lưu / Kết thúc mã hàng tạo phiên bản gán mới có **hiệu lực từ thời điểm lưu**; phiên bản cũ đóng lại (không xóa).
- **Sơ đồ của ngày D** = mọi công đoạn đã gán cho trạm tại *bất kỳ thời điểm nào* trong ngày D. Nhờ vậy công đoạn bị gỡ lúc 15:00 vẫn nhập được số cuối ngày, và nhập lùi ngày (F1) luôn thấy đúng sơ đồ ngày đó.

**Done khi:**
- ✅ Hiển thị đủ 18 trạm nhập liệu của chuyền trên một màn hình, không cuộn ngang ở 1366×768
- ✅ Một trạm nhận nhiều công đoạn; một công đoạn gán được vào nhiều trạm
- ✅ Một chuyền chạy tối đa 2 mã hàng cùng lúc; công đoạn trên trạm có nhãn mã hàng
- ✅ Có danh sách công đoạn chưa được gán vào trạm nào
- ✅ Sao chép cùng mã hàng → giữ bố cục + công đoạn; sao chép từ mã hàng khác → chỉ giữ bố cục trạm
- ✅ Sao chép bỏ qua công đoạn đã Ngưng và báo số lượng bị bỏ qua
- ✅ Lưu < 2 giây; app công nhân thấy thay đổi ở lần mở/tải lại tiếp theo
- ✅ Tổ trưởng chỉ sửa chuyền được gắn; IE sửa mọi chuyền
- ✅ Kết thúc mã hàng / gỡ công đoạn không làm mất sản lượng đã nhập và không làm mất công đoạn khỏi sơ đồ của các ngày trước
- ❌ Tự động cân bằng chuyền theo SMV

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Gỡ công đoạn đã có sản lượng hôm nay | Cho gỡ, sản lượng giữ nguyên; vẫn nhập được đến hết ngày |
| Gán mã hàng thứ 3 | Chặn, báo "Kết thúc mã hàng cũ trước" |
| Tổ trưởng và IE cùng sửa | Người lưu sau nhận cảnh báo, phải tải lại |
| Trạm không có công đoạn | Cho lưu (trạm trống) |

---

#### Feature 5: Xem và xuất báo cáo sản lượng
**Story:** Là tổ trưởng, quản lý xưởng, Kỹ thuật/IE hoặc IT/HR, tôi muốn xem và xuất báo cáo sản lượng, hiệu suất theo nhiều góc nhìn, để theo dõi tiến độ và có số liệu chính xác khi tính lương.

**Steps to Complete:**
1. Web → Báo cáo → chọn loại
2. Chọn thời gian: Ngày / Tuần / Tháng / Từ ngày – Đến ngày
3. Lọc theo xưởng, chuyền, mã hàng, công nhân
4. Bấm Xuất Excel → tải .xlsx đúng dữ liệu đang xem

**Loại báo cáo:**

| Báo cáo | Nội dung chính |
|---|---|
| Theo công nhân | Mã NV, họ tên, trạm, công đoạn, sản lượng, phút SMV, giờ làm, % hiệu suất, ghi chú hỗ trợ chuyền |
| Theo công đoạn / trạm | Sản lượng từng công đoạn, từng trạm |
| Theo chuyền | So sánh các chuyền: sản lượng, % hiệu suất chuyền chi tiết |
| Theo mã hàng | Sản lượng theo công đoạn; Đã làm / Tổng đơn / Còn lại / % hoàn thành |
| Lịch sử chỉnh sửa | Ai nhập/sửa, số cũ, số mới, thời điểm, lý do, nguồn (App / Nhập hộ / Sửa Web) |

**Công thức:**
- Phút SMV = Σ (sản lượng × **SMV snapshot** giây) ÷ 60
- % hiệu suất công nhân = Phút SMV ÷ (giờ làm × 60) × 100
- % hiệu suất chuyền = Σ Phút SMV ÷ Σ phút làm việc × 100 (chỉ NV có sản lượng tại trạm của chuyền chi tiết trong MVP). NV làm ở nhiều chuyền trong ngày → giờ làm được **chia cho từng chuyền theo tỷ lệ phút SMV** (thiếu SMV thì theo tỷ lệ số sản phẩm), để tổng các chuyền khớp toàn nhà máy `[D15]`
- Đã làm (mã hàng) = sản lượng của công đoạn hoàn thành (QC)
- Giờ làm = giờ đã duyệt/sửa nếu có, ngược lại giờ mặc định theo thứ trong tuần (F6)

**Phân quyền (theo R3):** Tổ trưởng — sản lượng tại các chuyền được gắn + sản lượng của NV chuyền mình ở chuyền khác (chỉ xem); Quản lý xưởng — các xưởng được gắn; IE, IT/HR — tất cả chuyền.

**Done khi:**
- ✅ Báo cáo lấy số nhập cuối cùng trong ngày của mỗi bản ghi
- ✅ Công nhân nhiều trạm: phút SMV cộng dồn các trạm, chia giờ làm của người đó
- ✅ Tổng trên màn hình = tổng trong file Excel; lệch 0 bản ghi so với dữ liệu nhập
- ✅ Hiển thị trạng thái từng ngày / mã hàng: Chưa chốt / Đã chốt / Đã khóa
- ✅ Xem báo cáo 1 tháng × 15 chuyền < 5 giây; xuất Excel < 10 giây
- ✅ Người dùng không xem được dữ liệu ngoài phạm vi, kể cả khi sửa URL/gọi API trực tiếp
- ❌ Tính tiền lương, xuất PDF, tự động gửi báo cáo

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Không có dữ liệu | Hiện "Không có dữ liệu", không xuất file rỗng |
| Có sản lượng nhưng giờ làm = 0/trống (ví dụ Chủ nhật không có giờ mặc định) | % hiệu suất "—" + cảnh báo |
| % hiệu suất > 150% | Tô màu cảnh báo |
| Công đoạn chưa có SMV | Phút SMV "—" |
| Khoảng thời gian > 3 tháng | Báo "Chọn tối đa 3 tháng" |

---

#### Feature 6: Cài đặt và điều chỉnh giờ làm việc
**Story:** Là quản lý xưởng và tổ trưởng, tôi muốn cài giờ làm mặc định và duyệt yêu cầu sửa giờ của công nhân, để % hiệu suất tính trên giờ làm thực tế và có kiểm soát.

**Steps to Complete:**
1. Web: quản lý xưởng cài giờ mặc định **cho xưởng mình, theo thứ trong tuần**: T2–T6 (mặc định 9 giờ) · T7 (mặc định 8 giờ) · CN (mặc định trống) `[R 4.3]`
2. App: công nhân thấy giờ mặc định của ngày
3. Về sớm / tăng ca → công nhân sửa số giờ cho một Ngày mở nhập → Gửi duyệt
4. Web: tổ trưởng **chuyền gốc của NV** Duyệt hoặc Từ chối (bắt buộc lý do khi từ chối) `[R 5.8]`
5. Tổ trưởng cũng có thể **sửa giờ trực tiếp** cho NV chuyền mình (bắt buộc lý do) — dùng khi công nhân không gửi được yêu cầu hoặc làm lẫn trạm JACK `[R 4.2]`
6. Được duyệt/sửa → báo cáo dùng giờ mới

**Quy tắc khóa giờ làm** `[R 5.7]`: giờ làm của NV ngày D được gửi/duyệt/sửa **cho tới khi có bất kỳ Mã hàng × Tháng nào chứa sản lượng của NV đó ngày D bị khóa**. Sau đó chỉ sửa được qua quy trình mở khóa (F10).

**Done khi:**
- ✅ Chỉ quản lý xưởng cài giờ mặc định cho xưởng được gắn; tổ trưởng chỉ duyệt/sửa giờ NV chuyền gốc của mình
- ✅ Giờ làm tính theo công nhân × ngày; nhiều trạm (kể cả nhiều chuyền) vẫn chỉ 1 giờ làm
- ✅ Giờ nhận số thập phân (9,5 / 10,5), chấp nhận dấu phẩy hoặc chấm, trong khoảng > 0 và ≤ 16
- ✅ Chưa duyệt / bị từ chối → dùng giờ mặc định; đã duyệt / tổ trưởng sửa → dùng giờ mới
- ✅ Công nhân thấy trạng thái: Chờ duyệt / Đã duyệt / Từ chối (kèm lý do)
- ✅ Đổi giờ mặc định chỉ áp dụng từ ngày thay đổi trở đi (lưu lịch sử theo ngày hiệu lực)
- ✅ Giờ làm của ngày đã khóa không sửa được (server từ chối)
- ✅ Mọi thay đổi và duyệt đều lưu lịch sử
- ❌ Chấm công, kết nối máy chấm công, tính tiền tăng ca

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Giờ ≤ 0, > 16, hoặc chữ | Chặn, báo lỗi |
| Gửi yêu cầu mới khi yêu cầu cũ còn chờ | Yêu cầu mới thay thế yêu cầu cũ |
| Tổ trưởng chưa duyệt hết ngày | Vẫn chờ, duyệt bù được đến khi khóa; báo cáo tạm tính giờ mặc định |
| Ngày không có giờ mặc định (CN, ngày lễ) mà có sản lượng | Không tự gán giờ; % hiệu suất "—" đến khi có yêu cầu được duyệt hoặc tổ trưởng sửa |
| NV hỗ trợ chuyền khác | Tổ trưởng chuyền gốc duyệt; màn hình duyệt hiện sản lượng của NV ở mọi chuyền |

---

#### Feature 8: Quản lý tài khoản và phân quyền Web
**Story:** Là Superadmin, tôi muốn tạo tài khoản Web, gán vai trò và phạm vi cho từng người, để mỗi người chỉ thấy và thao tác đúng phạm vi công việc.

**Steps to Complete:**
1. Tài khoản → Thêm tài khoản
2. Nhập tên đăng nhập, họ tên, mật khẩu tạm
3. Chọn vai trò; nếu **Tổ trưởng** → chọn 1..n chuyền phụ trách; nếu **Quản lý xưởng** → chọn 1..n xưởng `[R 1.5, 4.4]`
4. Lưu; lần đầu đăng nhập bắt buộc đổi mật khẩu

**Mô hình quyền** `[R 1.5]`:
- **Vai trò** quyết định *được làm chức năng gì*. Superadmin bật/tắt chức năng theo vai trò (không chỉnh phạm vi).
- **Phạm vi gắn với tài khoản** quyết định *thấy dữ liệu nào*: Tổ trưởng → danh sách chuyền; Quản lý xưởng → danh sách xưởng. Các vai trò khác → toàn nhà máy. Phạm vi cố định theo vai trò, không tùy chỉnh.
- Tổ trưởng phải gắn ≥ 1 chuyền; Quản lý xưởng phải gắn ≥ 1 xưởng — thiếu thì không lưu được.
- Một chuyền gắn được cho nhiều tổ trưởng (tổ trưởng, tổ phó); một xưởng gắn được cho nhiều quản lý.
- Đổi phạm vi có hiệu lực ngay; quyền xem theo **phạm vi hiện tại**, kể cả dữ liệu cũ.

**Ma trận phân quyền mặc định** (Superadmin bật/tắt được từng ô, trừ F8 của Superadmin):

| Chức năng | Superadmin | QL xưởng | Tổ trưởng | IE | IT/HR | Kế hoạch | BGĐ | TV |
|---|---|---|---|---|---|---|---|---|
| Tài khoản & phân quyền (F8) | ✅ | | | | | | | |
| Xưởng / chuyền / trạm (F9) | ✅ | | | | | | | |
| Nhân viên (F2) | ✅ | | | | ✅ | | | |
| Mã hàng / công đoạn (F3) | ✅ | | | ✅ | | | | |
| Gán công đoạn (F4) | ✅ | | Chuyền gắn | ✅ | | | | |
| Giờ mặc định (F6) | ✅ | Xưởng gắn | | | | | | |
| Duyệt / sửa giờ (F6) | ✅ | | NV chuyền gốc | | | | | |
| Bảng sản lượng ngày: sửa, nhập hộ (F10, F19) | ✅ | | Chuyền gắn | | | | | |
| Chốt ngày (F10) | ✅ | | Chuyền gắn | | | | | |
| Khóa / mở khóa (F10) | ✅ | | | | ✅ | | | |
| Báo cáo (F5) | ✅ | Xưởng gắn | Chuyền gắn (R3) | ✅ | ✅ | | | |
| Dashboard (F7) | ✅ | Xưởng gắn | Chuyền gắn | | | | ✅ | ✅ |
| Kế hoạch (F16) | ✅ | | | | | ✅ | | |
| Xuất dữ liệu lương (F15) | ✅ | | | | ✅ | | | |
| Cài đặt hệ thống (giờ mở chốt ngày, dashboard) | ✅ | | | | | | | |

**Done khi:**
- ✅ Mỗi tài khoản có đúng 1 vai trò
- ✅ Superadmin bật/tắt quyền theo vai trò trên Web; quyền Quản lý tài khoản của Superadmin không tắt được
- ✅ Truy cập ngoài quyền hoặc ngoài phạm vi (kể cả gõ URL, gọi API) → "Không có quyền" + audit log
- ✅ Sai mật khẩu 5 lần → khóa 15 phút
- ✅ Superadmin đặt lại mật khẩu; người dùng phải đổi ở lần đăng nhập sau
- ✅ Tài khoản vô hiệu hóa không đăng nhập được; lịch sử giữ nguyên
- ✅ Phiên Web hết hạn sau 8 giờ không thao tác; tài khoản TV không hết hạn nhưng **Superadmin thu hồi được phiên TV** (bắt buộc đăng nhập lại) `[R 5.12]`
- ✅ Mọi thay đổi phân quyền và phạm vi lưu lịch sử
- ❌ Đăng nhập Windows/AD, xác thực 2 lớp

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Tên đăng nhập đã tồn tại | Báo trùng |
| Vô hiệu hóa tài khoản đang đăng nhập | Đăng xuất ở lần thao tác kế tiếp |
| Superadmin cuối cùng tự vô hiệu hóa | Chặn — luôn còn ít nhất 1 Superadmin |
| Gỡ hết chuyền của tổ trưởng / hết xưởng của quản lý | Chặn lưu, báo "Phải gắn ít nhất 1 chuyền/xưởng" |
| Tổ trưởng đang mở Bảng sản lượng của chuyền vừa bị gỡ | Lần thao tác kế tiếp → "Không có quyền", về trang chủ |

---

#### Feature 9: Quản lý danh mục Xưởng – Chuyền/Nhóm – Trạm
**Story:** Là Superadmin, tôi muốn thêm, sửa, ngưng xưởng, chuyền/nhóm và trạm, để hệ thống khớp với sơ đồ nhà máy thực tế.

**Cấu trúc:** Nhà máy → Xưởng (hiện tại 1, thiết kế cho n) → Chuyền/Nhóm (loại: Chuyền may / Vòng ngoài) → Trạm

**Steps to Complete:**
1. Chuyền & Trạm → Thêm xưởng / Thêm chuyền (mã, tên, loại, xưởng, số trạm)
2. Hệ thống tự tạo trạm 1 → N
3. Đánh dấu trạm nhập qua app (MVP: 26–41, 12, 25)
4. Lưu

**Done khi:**
- ✅ Tạo chuyền 41 trạm bằng 1 thao tác nhập số trạm
- ✅ Mã xưởng, mã chuyền duy nhất; số trạm không trùng trong chuyền
- ✅ Mỗi chuyền/nhóm thuộc đúng 1 xưởng
- ✅ Mỗi trạm có mã định danh cố định (UUID) dùng cho QR, không đổi khi sửa tên/số trạm
- ✅ Chỉ trạm được đánh dấu nhập qua app mới hiện trên app, sơ đồ gán (F4), Bảng sản lượng ngày (F10), F13, F17
- ✅ Chuyền/trạm Ngưng không hiện trên app và sơ đồ; sản lượng cũ giữ nguyên
- ✅ Danh mục chuyền/nhóm dùng cho F2 (nhân viên) và F8 (phạm vi); báo cáo, dashboard lọc được theo xưởng
- ✅ Chỉ Superadmin quản lý
- ❌ Vẽ sơ đồ mặt bằng xưởng; nhập sản lượng cho khu vực vòng ngoài

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Ngưng trạm đang có công đoạn gán | Chặn, "Gỡ công đoạn khỏi trạm trước" |
| Ngưng trạm đang có công nhân đăng nhập | Tự đăng xuất |
| Ngưng chuyền còn nhân viên hoạt động | Chặn, "Chuyển nhân viên sang chuyền khác trước" |
| Ngưng chuyền còn tổ trưởng được gắn | Cảnh báo danh sách tổ trưởng; xác nhận → tự gỡ chuyền khỏi các tài khoản đó (nếu đó là chuyền duy nhất của tài khoản → chặn, phải gắn chuyền khác trước) `[R 5.10]` |
| Ngưng xưởng còn chuyền hoạt động | Chặn |
| Ngưng xưởng còn quản lý xưởng được gắn | Xử lý như ngưng chuyền còn tổ trưởng |

---

#### Feature 10: Bảng sản lượng ngày & Chốt số liệu 2 cấp
**Story:** Là tổ trưởng và IT/HR, tôi muốn rà soát – sửa – chốt số liệu theo ngày trên một màn hình, và khóa theo mã hàng × tháng, để số liệu dùng tính lương đầy đủ, đúng và không bị thay đổi sau khi đã xác nhận.

**Màn hình "Bảng sản lượng ngày"** `[R 1.2, 5.1, 5.2]`
- Chọn chuyền (trong phạm vi) + ngày → lưới: **hàng = Trạm → Công đoạn** (theo sơ đồ của ngày đó), **cột = Mã NV, họ tên, số lượng, nguồn, trạng thái**.
- Ô **chưa có số** (trạm có công đoạn gán nhưng chưa có bản ghi) → tô màu vàng; đầu trang hiện "Còn X ô chưa có số".
- Ô có cờ ⚠ (bản ghi gửi lên sau khi công đoạn bị gỡ / NV bị ngưng) → tô cam để tổ trưởng xem lại.
- Sửa trực tiếp từng ô (bắt buộc lý do) → ô trở thành **Ô đã điều chỉnh**.
- Nhập hộ (F19) thực hiện ngay trên lưới này.
- Nút **Chốt ngày** nằm trên cùng màn hình.

**Bảng trạng thái:**

| Trạng thái | Công nhân (App) | Tổ trưởng (Web) | IT/HR |
|---|---|---|---|
| Chưa chốt | Nhập, ghi đè (trừ Ô đã điều chỉnh); trong phạm vi Ngày mở nhập | Sửa, nhập hộ (bắt buộc lý do) | — |
| Đã chốt ngày | ❌ | Sửa, nhập hộ (bắt buộc lý do) | — |
| Đã khóa Mã hàng × Tháng | ❌ | ❌ (cả sản lượng và giờ làm) | Mở khóa (lý do) → tổ trưởng sửa → khóa lại |

**Steps to Complete:**
1. Từ **Giờ mở chốt ngày** (mặc định 08:00) của ngày hôm sau, tổ trưởng mở Bảng sản lượng ngày hôm trước → xử lý ô vàng/cam, sửa nếu sai → Chốt ngày. Số của Thứ 7 được chốt vào sáng Thứ 2.
2. Cuối tháng / khi mã hàng xong, IT/HR khóa theo Mã hàng × Tháng (có nút "Khóa tất cả mã hàng của tháng")
3. Phát hiện sai sau khi khóa: IT/HR Mở khóa (lý do) → tổ trưởng sửa (lý do) → khóa lại

**Done khi:**
- ✅ Bảng sản lượng ngày hiện đủ mọi trạm/công đoạn theo sơ đồ của ngày đó, mở < 3 giây với 1 chuyền
- ✅ Nút Chốt ngày của ngày D bị khóa trước Giờ mở chốt ngày của ngày D+1 (dùng chung cấu hình với F13) `[R 5.9]`
- ✅ Sau khi chốt ngày, app không lưu được số của ngày đó; phiên trạm của ngày đó trên điện thoại tự hết
- ✅ Tổ trưởng sửa trên Web bắt buộc có lý do; ô sửa trở thành Ô đã điều chỉnh, app không ghi đè được `[R 5.4]`
- ✅ Mã hàng vắt qua 2 tháng khóa riêng từng tháng (ví dụ tháng 9: 3.000, tháng 10: 500); mở khóa tháng này không ảnh hưởng tháng khác
- ✅ Khóa Mã hàng × Tháng chỉ được khi mọi ngày liên quan đã chốt
- ✅ Khóa Mã hàng × Tháng cũng khóa giờ làm của các NV × ngày có sản lượng thuộc mã hàng × tháng đó `[R 5.7]`
- ✅ Tổ trưởng quên chốt → không tự chốt; Web hiện "Còn X ngày chưa chốt" khi tổ trưởng đăng nhập
- ✅ Mọi thao tác chốt, khóa, mở khóa, sửa lưu lịch sử (ai, lúc nào, lý do, số cũ, số mới)
- ❌ Duyệt nhiều cấp khi mở khóa

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Công nhân lưu sau thời điểm chốt | Từ chối, "Ngày đã chốt, liên hệ tổ trưởng" |
| Chốt ngày khi còn ô vàng (chưa có số) | Cảnh báo "Còn X ô chưa có số", vẫn cho chốt nếu xác nhận |
| Chốt ngày khi còn yêu cầu giờ chờ duyệt | Cảnh báo, vẫn cho chốt nếu xác nhận |
| Khóa khi còn ngày chưa chốt | Chặn, hiện danh sách ngày chưa chốt |
| Hai tổ trưởng cùng chuyền cùng sửa một ô | Người lưu sau nhận "Dữ liệu đã bị [tên] thay đổi lúc hh:mm", phải tải lại |
| Hai tổ trưởng cùng bấm Chốt ngày | Lần thứ hai không tạo bản ghi mới, báo "Ngày đã được [tên] chốt lúc hh:mm" |

---

#### Feature 11: Công nhân xem sản lượng của mình
**Story:** Là công nhân chuyền may, tôi muốn xem lại sản lượng và hiệu suất của mình theo ngày, để tự đối chiếu và báo tổ trưởng kịp thời nếu có sai trước khi khóa sổ.

**Steps to Complete:**
1. Đăng nhập trạm → tab "Của tôi" (hiển thị dữ liệu của mã NV trong phiên hôm nay)
2. Xem 30 ngày gần nhất: tổng sản lượng, phút SMV, giờ làm, % hiệu suất, trạng thái (Chưa chốt / Đã chốt / Đã khóa)
3. Bấm vào ngày → chi tiết từng trạm, công đoạn, số lượng

**Done khi:**
- ✅ Chỉ xem được dữ liệu của chính mình
- ✅ Hiển thị 30 ngày gần nhất
- ✅ Số liệu khớp 100% với báo cáo theo công nhân (F5)
- ✅ Ô đã điều chỉnh (tổ trưởng sửa hoặc nhập hộ) → dấu ✏️ kèm số cũ, lý do, người thực hiện
- ✅ Mở màn hình < 2 giây
- ❌ Hiển thị tiền lương, đơn giá; gửi khiếu nại trên app (công nhân báo miệng tổ trưởng)

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Ngày không có sản lượng | Không hiện |
| Giờ làm chờ duyệt | % hiệu suất tạm tính + nhãn "Giờ làm chờ duyệt" |
| Ngày không có giờ mặc định (CN) | % hiệu suất "—" + nhãn "Chưa có giờ làm" |
| Nhiều trạm trong ngày | Tổng hợp chung, chi tiết tách theo trạm |

---

#### Feature 19: Tổ trưởng nhập hộ `[R 5.1 — chuyển từ SHOULD lên MUST]`
**Story:** Là tổ trưởng, tôi muốn nhập sản lượng thay cho công nhân không có điện thoại, hết pin, quên điện thoại hoặc không còn phiên trạm, để sản lượng của họ vẫn được ghi nhận mà không quay lại sổ giấy.

**Steps to Complete:**
1. Web → Bảng sản lượng ngày (F10) → chọn chuyền, ngày
2. Tại ô vàng (hoặc thêm dòng NV cho một công đoạn của trạm) → chọn mã NV → nhập số → nhập lý do → Lưu

**Done khi:**
- ✅ Bản ghi đánh dấu "Nhập hộ bởi [tên tổ trưởng]", là Ô đã điều chỉnh, hiện trong lịch sử (F5) và "Của tôi" (F11)
- ✅ Chỉ nhập hộ tại **trạm thuộc chuyền được gắn**; chọn được **bất kỳ NV đang hoạt động** (kể cả NV hỗ trợ từ chuyền khác) `[R 5.8]`
- ✅ Chỉ nhập hộ cho ngày chưa khóa Mã hàng × Tháng; không giới hạn 3 ngày (dùng cho nghỉ lễ dài)
- ✅ Bắt buộc lý do
- ❌ Nhập hộ hàng loạt từ file Excel

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Công nhân đã tự nhập công đoạn đó trong ngày | Ghi đè, lưu lịch sử số cũ – số mới; ô thành Ô đã điều chỉnh |
| Ngày đã chốt | Cho nhập, bắt buộc lý do |
| Chọn NV không đứng trạm đó hôm đó | Cho phép (tổ trưởng chịu trách nhiệm), ghi audit log |

---

### 🔵 SHOULD (nên có, không gấp)

#### Feature 7: Dashboard sản lượng và hiệu suất
**Story:** Là quản lý xưởng hoặc Ban Giám đốc, tôi muốn xem biểu đồ sản lượng và hiệu suất trên Web và TV tại xưởng, để nắm tình hình sản xuất mà không phải mở báo cáo.

**Khối hiển thị:**
1. Tổng sản lượng **hôm nay** (realtime) + % hiệu suất **ngày đã chốt gần nhất** toàn nhà máy
2. So sánh các chuyền: sản lượng hôm nay + % hiệu suất ngày đã chốt gần nhất
3. Xu hướng % hiệu suất 7/30 ngày (chỉ ngày đã chốt)
4. Top 5 / Bottom 5 công nhân theo chuyền
5. Công đoạn nghẽn mỗi chuyền
6. Kế hoạch / Thực tế / % đạt (khi có F16)

**Định nghĩa chỉ số** `[R 1.4]`:
- **Công đoạn nghẽn** = công đoạn có **tổng sản lượng thấp nhất hôm nay** trong từng mã hàng của chuyền (cộng mọi trạm cùng công đoạn; chỉ xét công đoạn đang gán). Hòa → hiện tất cả.
- **Top 5 / Bottom 5** = xếp theo **% hiệu suất của ngày đã chốt gần nhất**, chỉ tính NV có giờ làm ≥ 4 giờ ngày đó. *Lý do: số hôm nay chưa đủ nhưng giờ mặc định đã tính đủ 9 giờ → buổi sáng mọi người đều có hiệu suất thấp.*
- Chuyền có < 5 NV đủ điều kiện → hiện số người hiện có.

**Phân quyền:** Tổ trưởng — chuyền được gắn; Quản lý xưởng — xưởng được gắn; BGĐ, tài khoản TV — tất cả chuyền.

**Done khi:**
- ✅ Số liệu khớp 100% với F5 (cùng ngày, cùng công thức)
- ✅ Chu kỳ tự làm mới cài được 1–60 phút, mặc định 5 phút
- ✅ Chế độ TV (1920×1080): toàn màn hình; **số chính ≥ 72px, nhãn ≥ 32px, tương phản ≥ 7:1** (đọc được từ 5 m) `[R 2.6]`
- ✅ Chế độ TV chạy liên tục 12 giờ: **RAM của tab tăng < 30%, không trắng màn hình**; trang tự tải lại lúc 05:00 hằng ngày `[R 2.7]`
- ✅ Hiển thị đủ các khối (kể cả Bottom 5)
- ✅ Tài khoản TV riêng: chỉ xem dashboard, phiên không hết hạn, Superadmin thu hồi được
- ✅ Mở dashboard < 3 giây
- ❌ Cảnh báo đẩy, dự báo sản lượng

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Chưa có dữ liệu trong ngày | Hiện 0 + "Chưa có dữ liệu hôm nay" |
| Chưa có ngày nào đã chốt | Khối hiệu suất / Top-Bottom hiện "Chưa có ngày đã chốt" |
| TV mất mạng | Giữ số cuối, hiện "Mất kết nối – cập nhật lúc hh:mm", tự kết nối lại |
| Chuyền nối đuôi 2 mã hàng | Công đoạn nghẽn tính riêng theo mã hàng |

---

#### Feature 12: Mã QR tại trạm
**Story:** Là công nhân chuyền may, tôi muốn quét mã QR dán tại trạm để vào đúng trạm ngay, để không phải tìm trong danh sách và không chọn nhầm trạm.

**Steps to Complete:**
1. Web: Superadmin → Chuyền & Trạm → In QR → PDF QR của các trạm (ghi tên chuyền + số trạm)
2. Dán QR tại trạm
3. App: Quét QR → vào đúng trạm → đăng nhập mã NV

**Done khi:**
- ✅ Từ lúc bấm Quét đến khi vào màn hình đăng nhập của đúng trạm < 3 giây
- ✅ In QR của một chuyền trong 1 thao tác; A4, 12 QR/trang
- ✅ QR chỉ chứa mã định danh trạm (UUID, F9)
- ✅ Vẫn chọn trạm thủ công được khi QR hỏng
- ❌ In thẻ nhân viên có QR

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| QR trạm đã ngưng | "Trạm không còn hoạt động" |
| QR không thuộc hệ thống | "Mã QR không hợp lệ" |
| Không có quyền camera | Hướng dẫn cấp quyền hoặc chọn thủ công |

---

#### Feature 13: Danh sách tổng hợp trạm chưa nhập
**Story:** Là tổ trưởng, tôi muốn thấy nhanh danh sách trạm nào chưa nhập sản lượng của ngày hôm trước trên mọi chuyền mình phụ trách, để nhắc công nhân hoặc nhập hộ trước khi chốt ngày.

> Phần tô màu ô chưa có số đã nằm trong Bảng sản lượng ngày (F10, MUST). F13 chỉ bổ sung danh sách tổng hợp nhiều chuyền trên trang chủ. `[R 5.2]`

**Steps to Complete:**
1. Superadmin cài **Giờ mở chốt ngày** (mặc định 08:00, dùng chung với F10)
2. Từ mốc đó, trang chủ Web của tổ trưởng hiện "Trạm chưa nhập ngày [D]" cho các chuyền được gắn
3. Bấm vào dòng → mở Bảng sản lượng ngày đúng chuyền/ngày để nhập hộ → chốt ngày

**Done khi:**
- ✅ "Chưa nhập" = trạm có công đoạn trong sơ đồ của ngày đó nhưng không có bản ghi sản lượng nào
- ✅ Hiện số trạm, mã NV đăng nhập (nếu có), công đoạn chưa có số
- ✅ Trạm không có công đoạn hoặc đã ngưng không bị tính
- ✅ Danh sách tự cập nhật ≤ 10 giây sau khi công nhân nhập xong (polling 10 giây) `[R 2.8, D11]`
- ❌ Gửi thông báo đẩy / Zalo cho công nhân

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Ngày nghỉ, cả chuyền không có bản ghi | Không cảnh báo |
| Trạm chưa có người đăng nhập | "Chưa có người đăng nhập" |

---

#### Feature 14: Nhập khi mất mạng (offline)
**Story:** Là công nhân chuyền may, tôi muốn vẫn lưu được sản lượng khi mất mạng, để không phải nhớ số rồi nhập lại.

> MVP chỉ có "giữ số trên form + Thử lại" (F1). F14 bổ sung hàng đợi lưu bền trên điện thoại. `[R 5.3]`

**Steps to Complete:**
1. Nhập số → Lưu khi không có mạng
2. App lưu tạm (IndexedDB), hiện nhãn "Chờ gửi"
3. Có mạng lại → tự gửi → nhãn "Đã gửi"

**Done khi:**
- ✅ Không mất số khi tắt app hoặc khởi động lại điện thoại
- ✅ Có mạng lại → tự gửi < 30 giây **khi app đang mở**; nếu app đã đóng thì gửi ngay ở lần mở kế tiếp (iOS Safari không hỗ trợ gửi ngầm) `[R 2.4]`
- ✅ Bản ghi giữ thời điểm nhập trên máy và ngày làm việc đã chọn
- ✅ Header luôn hiện "Chờ gửi: X"
- ✅ Nhập offline nhiều lần cùng bản ghi → chỉ gửi số cuối cùng
- ❌ Đăng nhập trạm khi offline (lần đầu bắt buộc có mạng)

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Gửi lên khi ngày đã chốt hoặc mã hàng đã khóa | Từ chối, giữ lại số, "Không gửi được – ngày đã chốt/khóa, báo tổ trưởng" |
| Gửi lên vào Ô đã điều chỉnh | Từ chối, giữ lại số, "Tổ trưởng đã điều chỉnh số này" `[R 5.4]` |
| Công đoạn đã bị gỡ khỏi trạm / NV đã bị ngưng khi gửi | **Vẫn nhận** (việc đã làm thật), gắn cờ ⚠ trên Bảng sản lượng ngày `[R 3.10]` |
| Trạm đã đổi người khi gửi | Vẫn ghi cho mã NV đã nhập offline |
| Xóa dữ liệu trình duyệt khi còn bản ghi chờ | Mất dữ liệu; cảnh báo "Còn X bản ghi chưa gửi" trước khi đăng xuất |
| Chờ gửi quá 24 giờ | Cảnh báo đỏ |

---

#### Feature 15: Xuất dữ liệu tính lương
**Story:** Là IT/HR, tôi muốn xuất dữ liệu sản lượng đã khóa ra Excel theo mẫu cố định, để tính lương trên Excel hiện tại và import vào phần mềm lương sau này.

**Steps to Complete:**
1. Xuất dữ liệu lương → chọn tháng
2. Xem trạng thái khóa từng mã hàng trong tháng
3. Xuất Excel → .xlsx chỉ gồm dữ liệu đã khóa

**Cột:** Mã NV · Họ tên · Chuyền · Ngày · Mã hàng · Mã công đoạn · Sản lượng · SMV (giây, snapshot) · Phút SMV · Giờ làm *(tạm chốt, bổ sung sau)*

**Done khi:**
- ✅ Chỉ có dữ liệu đã khóa Mã hàng × Tháng
- ✅ Tên và thứ tự cột cố định giữa các lần xuất
- ✅ Tổng sản lượng khớp 100% với F5 cùng phạm vi
- ✅ Xuất cùng tháng 2 lần mà không có mở khóa ở giữa → 2 file giống hệt nhau
- ✅ Xuất 1 tháng toàn nhà máy < 15 giây
- ✅ Mỗi lần xuất lưu lịch sử (ai, lúc nào, tháng nào)
- ❌ API kết nối phần mềm lương, tính tiền lương

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Còn mã hàng chưa khóa | Xuất phần đã khóa + cảnh báo "X mã hàng chưa khóa – không có trong file" |
| Không có dữ liệu đã khóa | "Chưa có dữ liệu đã khóa", không xuất file rỗng |
| Mở khóa sau khi đã xuất | Lần xuất sau lấy số mới; lịch sử thể hiện thứ tự |

---

#### Feature 16: Kế hoạch sản lượng
**Story:** Là nhân viên Kế hoạch sản xuất, tôi muốn nhập kế hoạch sản lượng theo chuyền × mã hàng × ngày, để quản lý so sánh kế hoạch với thực tế và phát hiện chuyền chậm tiến độ.

**Steps to Complete:**
1. Kế hoạch → Import Excel hoặc Thêm tay
2. Mỗi dòng: Ngày · Chuyền · Mã hàng · Số lượng kế hoạch
3. Xem trước: thêm mới / cập nhật / lỗi
4. Xác nhận → F5, F7 hiện Kế hoạch / Thực tế / % đạt

**Done khi:**
- ✅ Thực tế = sản lượng công đoạn hoàn thành (QC) của mã hàng, chuyền, ngày đó
- ✅ % đạt = Thực tế ÷ Kế hoạch × 100
- ✅ Trùng Ngày + Chuyền + Mã hàng → cập nhật, không tạo trùng
- ✅ Import 1 tháng × 15 chuyền < 10 giây
- ✅ Mọi thay đổi lưu lịch sử
- ❌ Tự lập kế hoạch từ đơn hàng, tính năng lực chuyền

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Mã hàng / chuyền không tồn tại | Dòng lỗi |
| Số lượng ≤ 0 hoặc không phải số | Dòng lỗi |
| Tổng kế hoạch vượt số lượng đơn hàng | Cảnh báo, vẫn lưu |
| Có thực tế nhưng không có kế hoạch | % đạt "—" |
| Sửa kế hoạch ngày đã qua | Cho sửa, bắt buộc lý do |

---

#### Feature 17: Sơ đồ trạm trực tiếp
**Story:** Là tổ trưởng, tôi muốn xem trạm nào đang có ai đăng nhập và đăng xuất hộ khi cần, để xử lý nhanh trường hợp đăng nhập nhầm trạm.

**Steps to Complete:**
1. Web → Sơ đồ trạm → chọn chuyền (trong phạm vi)
2. Mỗi trạm hiện: mã NV, họ tên (hoặc "Trống"), đã nhập hôm nay Có/Chưa
3. Bấm trạm → Đăng xuất hộ (bắt buộc lý do)

**Done khi:**
- ✅ Trạng thái cập nhật ≤ 10 giây sau khi công nhân đăng nhập/đăng xuất (polling 5 giây) `[R 5.11, D11]`
- ✅ Tổ trưởng chỉ xem, thao tác chuyền được gắn
- ✅ Mỗi lần đăng xuất hộ lưu lịch sử
- ✅ Công nhân bị đăng xuất thấy thông báo ở lần mở app tiếp theo, hoặc ngay khi bấm Lưu (F1)
- ❌ Tổ trưởng đăng nhập hộ công nhân vào trạm

**Edge cases:**

| Tình huống | Xử lý |
|---|---|
| Đăng xuất hộ khi còn bản ghi offline (F14) | Bản ghi vẫn gửi, tính cho người đã nhập |
| Công nhân đăng nhập nhiều trạm | Đăng xuất trạm nào chỉ ảnh hưởng trạm đó |

---

#### Feature 18: Hướng dẫn sử dụng trong app
**Story:** Là công nhân mới dùng app, tôi muốn xem hướng dẫn ngắn khi mở app lần đầu, để tự thao tác mà không phải hỏi tổ trưởng.

**Done khi:**
- ✅ Mở lần đầu → 4 màn hình: Chọn trạm / quét QR → Đăng nhập mã NV → Nhập & lưu → Xem "Của tôi"
- ✅ Mỗi màn hình 1 hình minh họa, tối đa 2 câu
- ✅ Có nút Bỏ qua; xem lại được từ menu "Hướng dẫn"
- ✅ Đã xem hoặc bỏ qua → không tự hiện lại trên điện thoại đó
- ✅ Trong pilot, ≥ 80% công nhân mới tự hoàn thành lần nhập đầu tiên không cần tổ trưởng hỗ trợ `[R 2.10]`
- ❌ Video hướng dẫn, hướng dẫn cho Web

---

### 🟠 NICE TO HAVE (sau này thêm)

- [ ] Mở rộng nhập sản lượng cho khu vực vòng ngoài — Cắt, Hoàn thành… (cần khảo sát cách tính sản lượng riêng)
- [ ] Ghi nhận hàng lỗi / hàng sửa tại công đoạn QC — theo dõi tỷ lệ lỗi theo chuyền, mã hàng
- [ ] DNS nội bộ (split DNS) để wifi xưởng vẫn vào app khi mất Internet `[R 4.9]`
- [ ] Tách giờ làm theo khu vực (trạm JACK / trạm app) cho NV đứng lẫn `[R 4.2]`

---

## ④ Tech Stack

| Layer | Tech | Lý do chọn |
|---|---|---|
| Frontend | React + Vite + TypeScript (monorepo pnpm: app công nhân + Web quản lý), PWA (vite-plugin-pwa), Tailwind CSS v3.4 + Radix UI, TanStack Query/Table, dnd-kit, Recharts, IndexedDB (Dexie – dùng cho F14) `[D2, D12, D14]` | Đã quen; dùng chung code giữa Mobile và Web; không cần app store; hỗ trợ offline; giữ thiết kế UI demo; hỗ trợ iOS Safari 15 |
| Backend | Node.js + TypeScript (NestJS), Zod (nestjs-zod), polling ≤ 10 giây cho màn hình trực tiếp, ExcelJS (streaming), qrcode, pdfmake `[D3, D11]` | Dùng chung TypeScript và schema kiểm tra dữ liệu; module phân quyền hợp với ma trận quyền tùy chỉnh |
| Database | PostgreSQL 17 (Docker) + Prisma ORM, SQL tay cho ràng buộc/trigger/báo cáo `[D4]` | Miễn phí, không giới hạn dung lượng; Prisma quản lý schema/migration an toàn khi 1 người bảo trì. Khối lượng ước tính ~0,5 triệu dòng sản lượng/năm. Audit log chặn UPDATE/DELETE bằng trigger |
| Auth | Web/TV: phiên lưu ở server, cookie httpOnly, bcrypt. App công nhân: cookie thiết bị httpOnly + phiên trạm lưu ở server (không mật khẩu) `[D6]` | Phiên Web 8 giờ, TV không hết hạn nhưng thu hồi được (xóa phiên), khóa tài khoản sau 5 lần sai |
| Giám sát | Uptime Kuma (Docker) | Miễn phí; đo uptime mỗi 1 phút, cảnh báo IT |
| Hosting | Docker Engine trên Windows Server tại nhà máy (ưu tiên VM Ubuntu trên Hyper-V, dự phòng WSL2 `[D1]`) + Cloudflare Tunnel (`sanluong.vsn-dn.com`) | Hạ tầng có sẵn; không cần IP tĩnh, không mở port; HTTPS và chống DDoS miễn phí; công nhân truy cập được từ nhà |

---

## ⑤ Integration Points

> Ghi rõ luồng cho mỗi tích hợp bên thứ 3

### Cloudflare Tunnel (MVP)
1. Chạy cloudflared như một container trong Docker
2. Tunnel trỏ `sanluong.vsn-dn.com` → reverse proxy / app nội bộ
3. Cloudflare cấp HTTPS; truy cập từ wifi xưởng, 4G, wifi nhà qua cùng địa chỉ
4. Tunnel mất kết nối → container tự khởi động lại (`restart: always`); app công nhân giữ số trên form (MVP) / lưu offline (F14)
5. Màn hình trực tiếp (F13, F17, dashboard) dùng polling ≤ 10 giây, không cần kết nối mở lâu qua Tunnel `[R 5.11, D11]`

❌ Không xử lý: chặn truy cập theo quốc gia/IP, Cloudflare Access

### Import file JACK — chuyền treo (giai đoạn sau)
1. IT xuất file sản lượng từ hệ thống JACK
2. Upload vào app → map mã NV, trạm, công đoạn, mã hàng
3. Báo cáo, dashboard hiện toàn chuyền (trạm 1–41)

❌ Không xử lý: kết nối API/database trực tiếp với JACK; quy tắc chống trùng số liệu trạm 12 (QC) và 25 (Ủi) giữa app và JACK — quyết định khi triển khai

### Telegram Bot cho quản lý (giai đoạn sau)
1. Tạo bot qua @BotFather, thêm vào nhóm Telegram quản lý
2. Sau khi chốt ngày, bot gửi tóm tắt sản lượng, % hiệu suất theo chuyền
3. Quản lý tra cứu bằng lệnh (ví dụ `/sanluong chuyen5`)

❌ Không xử lý: gửi tin cho công nhân; Zalo OA / ZNS

### Phần mềm tính lương (giai đoạn sau)
1. Hiện tại: file Excel mẫu cố định (F15)
2. Khi HR có phần mềm lương: import file này; nâng cấp API sau

❌ Không xử lý: API trong MVP

---

## ⑥ Non-Functional Requirements

- **Performance:** Lưu sản lượng < 2s · Mở dashboard < 3s · Bảng sản lượng ngày (1 chuyền) < 3s · Báo cáo 1 tháng < 5s · Xuất Excel < 10s (dữ liệu lương < 15s) · API thông thường < 500ms
- **Điều kiện đo chuẩn** `[R 2.1]`: đo **p95**, với **300 người dùng đồng thời**, mạng mô phỏng 4G, database có sẵn **12 tháng dữ liệu giả (~500.000 dòng sản lượng)**.
- **Kịch bản tải** `[R 2.2]`: k6 với 300 người dùng ảo; mỗi người trong 10 phút đăng nhập trạm, lưu 3 công đoạn, mở "Của tôi". Đạt khi tỷ lệ lỗi < 0,1% và p95 lưu < 2s.
- **Security:** HTTPS (Cloudflare) · Phiên lưu ở server, cookie httpOnly `[D6]` · bcrypt · Kiểm tra quyền và phạm vi ở server cho mọi API · Khóa 15 phút sau 5 lần sai mật khẩu Web · Đăng nhập trạm: 10 lần sai / 10 phút / (thiết bị + IP) → khóa 15 phút · Audit log chỉ-thêm, không ai sửa/xóa được (kể cả Superadmin)
- **Responsive:** App công nhân tối ưu điện thoại (≥ 5 inch); Web quản lý tối ưu máy tính, tối thiểu **1366×768**; TV Full HD 1920×1080
- **Trình duyệt:** Android Chrome 2 phiên bản gần nhất · iOS Safari 15+ (vì vậy dùng Tailwind v3.4 `[D14]`) · Web Chrome / Edge
- **Concurrency:** 300 người dùng đồng thời (cao điểm buổi tối khi công nhân nhập tại nhà)
- **Uptime:** 99,5% trong khung 06:00–23:00; bảo trì 23:00–05:00. **Đo bằng Uptime Kuma**, kiểm tra mỗi 1 phút, báo cáo hằng tháng `[R 2.5]`
- **Backup:** Tự động backup PostgreSQL 02:00 hằng ngày · Giữ 30 bản · 1 bản sao mã hóa (AES-256) trên cloud (Google Drive hoặc OneDrive) · RPO 24 giờ · RTO 4 giờ · **Thử khôi phục mỗi quý: đạt khi khôi phục bản mới nhất sang máy test ≤ 4 giờ, số dòng các bảng chính khớp, có biên bản** `[R 2.9]`
- **Lưu trữ dữ liệu:** 3 năm
- **Ngôn ngữ:** Tiếng Việt

---

## ⑦ Edge Cases & Error States

> Tình huống chung toàn hệ thống. Edge case riêng từng tính năng nằm trong mục ③.

| Tình huống | Hành vi mong muốn |
|---|---|
| User nhập sai form | Báo lỗi ngay tại ô nhập, tiếng Việt, nói rõ cách sửa; không xóa dữ liệu đã nhập |
| Mất mạng giữa chừng | App công nhân: **MVP** giữ số trên form + nút Thử lại; **khi có F14** lưu offline, tự gửi. Web: thanh "Mất kết nối", chặn lưu, giữ dữ liệu trên form |
| File upload quá lớn | Giới hạn 10 MB hoặc 5.000 dòng; từ chối trước khi upload |
| File sai định dạng | Chỉ nhận .xlsx |
| Session hết hạn | Web: về trang đăng nhập, sau đó quay lại đúng trang cũ. App: giữ phiên trạm theo ngày làm việc (R1) |
| API bên thứ 3 lỗi (Cloudflare Tunnel) | Container tự khởi động lại; app giữ số / lưu offline; Web báo "Hệ thống tạm gián đoạn" |
| Hai người cùng sửa một dữ liệu | Người lưu sau nhận cảnh báo "Dữ liệu đã bị [tên] thay đổi lúc hh:mm", phải tải lại (optimistic lock theo `version`) |
| Bấm Lưu nhiều lần | Khóa nút đến khi có phản hồi; server không tạo bản ghi trùng (idempotency key) |
| Truy cập không có quyền / ngoài phạm vi | "Không có quyền truy cập" + ghi audit log |
| Lỗi không xác định | "Có lỗi xảy ra, vui lòng thử lại" + mã lỗi (`traceId`); không hiện thông tin kỹ thuật |
| Giờ điện thoại công nhân sai | Ngày làm việc và thời điểm lưu lấy theo giờ server; bản ghi giữ thêm giờ máy để tham khảo |
| Server gần hết ổ cứng | Cảnh báo IT khi đạt 80% |

---

## ⑧ Success Metrics

> Triển khai: pilot 2 chuyền (BGĐ chọn) → mở rộng 15 chuyền. HR cung cấp số khiếu nại sản lượng các tháng trước go-live làm baseline.
> ⏳ *Định nghĩa đo lường chi tiết (mẫu số, cách kiểm đếm, cách ghi nhận khiếu nại) — tạm gác, bổ sung trước pilot.*

- **Tuần 1 (pilot 2 chuyền):** ≥ 90% công nhân pilot đăng nhập và nhập được · ≥ 80% trạm có dữ liệu mỗi ngày · 0 lần mất/sai lệch dữ liệu (đối chiếu sổ tay song song)
- **Tháng 1 (15 chuyền):** ≥ 95% trạm có dữ liệu mỗi ngày · ≥ 90% ngày được chốt trước 10:00 sáng hôm sau · Chênh lệch app vs kiểm đếm thực tế < 2% · 100% chuyền bỏ sổ tay và Excel của tổ trưởng
- **Tháng 3:** 100% lương sản phẩm tính từ dữ liệu đã khóa · Khiếu nại sản lượng giảm ≥ 50% so với baseline · Tỷ lệ số liệu sửa sau chốt ngày < 3%

---

## ⑨ Constraints & Assumptions

**Giới hạn:**
- Budget: ≈ 0 đồng — dùng hạ tầng có sẵn
- Timeline: Làm song song với công việc khác. *Lộ trình ước tính — cần xác nhận (MVP +1 tuần do F19 lên MUST):*
  - Giai đoạn 1 — MVP (Must): tuần 1–13
  - Pilot 2 chuyền: tuần 14–15
  - Mở rộng 15 chuyền: tuần 16–17
  - Giai đoạn 2 — Should: tuần 18–27
  - Giai đoạn 3 — Import JACK, Telegram Bot, phần mềm lương, Nice to have: sau tuần 27
- Team size: 1 người (Duy tự phát triển và vận hành)
- Tech constraints: Windows Server tại nhà máy + Docker Engine/WSL2 · PostgreSQL · Cloudflare Tunnel trên `vsn-dn.com` · Công nhân dùng điện thoại cá nhân

**Assumptions (giả định):**

*Vận hành nhà máy*
- Làm Thứ 2 – Thứ 7, nghỉ Chủ nhật; 1 ca/ngày; tăng ca không qua 00:00 `[R 3.2, 4.6]`
- Giờ mặc định: T2–T6 = 9 giờ *(giữ theo v1, cần xác nhận)* · T7 = 8 giờ `[R 4.3]`
- Hiện có 1 xưởng; hệ thống thiết kế cho n xưởng `[R 4.4]`
- Đơn vị sản lượng là sản phẩm; SMV tính trên 1 sản phẩm `[R 4.1]`
- Công nhân gần như luôn đứng trạm app cả ngày; trường hợp đứng lẫn trạm JACK hiếm → tổ trưởng sửa giờ `[R 4.2]`
- Mỗi NV thuộc đúng 1 chuyền/nhóm tại một thời điểm `[R 4.7]`
- Mã NV do HR cấp, không bao giờ tái sử dụng `[R 4.5]`
- Tổ trưởng có mặt từ 08:00 mỗi ngày làm việc để chốt ngày; số của Thứ 7 chốt sáng Thứ 2 `[R 4.8]`
- Mỗi file quy trình công nghệ của IE = 1 mã hàng
- Mỗi chuyền chạy tối đa 2 mã hàng cùng lúc (giai đoạn nối đuôi)
- Trạm 1–25 do JACK ghi nhận; MVP chỉ nhập trạm 26–41 + trạm 12 (QC) + trạm 25 (Ủi); QC và Ủi tính là công đoạn của chuyền may

*Người dùng & chính sách*
- Công nhân có smartphone Android/iPhone chạy được trình duyệt; người không có → tổ trưởng nhập hộ (F19, MUST)
- Đăng nhập trạm chỉ bằng mã NV, không PIN — **rủi ro đã chấp nhận**: người khác có thể nhập thay; kiểm soát bằng audit log, chốt ngày, giới hạn số lần sai
- Chế độ TV hiển thị Bottom 5 công nhân — theo quyết định của chủ dự án
- ⚠ **Cần BGĐ/HR xác nhận bằng văn bản trước pilot:** công nhân dùng điện thoại và 4G cá nhân; việc nhập tại nhà sau giờ làm không được tính là làm thêm giờ `[R 4.12]`

*Hạ tầng*
- Wifi xưởng phủ đủ khu vực chuyền chi tiết, trạm 12 và trạm 25
- **Mọi truy cập đi qua Internet (Cloudflare), kể cả trong xưởng** — mất Internet nhà máy thì wifi xưởng cũng không vào được app; dự phòng là giữ số trên form (MVP) / F14 `[R 4.9]`
- Windows Server chạy 24/7, có UPS, đồng bộ NTP `[R 4.10]`
- Docker chạy bằng Docker Engine, **không dùng Docker Desktop** (doanh nghiệp ≥ 250 nhân viên phải mua giấy phép trả phí) `[D1]`
- **1 người vận hành** → bắt buộc có runbook (khởi động lại, khôi phục backup, thu hồi phiên TV) và ≥ 1 người IT thứ hai được hướng dẫn thao tác cơ bản trước go-live `[R 4.11]`

*Số liệu tạm giả định, có thể chỉnh*
- Import 600 dòng < 10s · cảnh báo hiệu suất > 150% · báo cáo tối đa 3 tháng · trần lý thuyết × 1,5 · Top/Bottom 5 yêu cầu ≥ 4 giờ làm · nhập lùi 3 ngày
- Cột file xuất lương (F15) là tạm chốt, bổ sung khi HR xây phần mềm lương

**Việc còn mở (chặn trước khi implement phần liên quan):**

| # | Việc | Chặn tính năng | Người phụ trách |
|---|---|---|---|
| 1 | File mẫu quy trình công nghệ của IE → cấu trúc import | F3 | Duy / IE |
| 2 | Xác nhận giờ mặc định T2–T6 | F6 | Quản lý xưởng |
| 3 | Văn bản chính sách điện thoại cá nhân & nhập ngoài giờ | Pilot | BGĐ / HR |
| 4 | Định nghĩa đo lường Success Metrics | Pilot | Duy / HR |
| 5 | Chạy script kiểm tra máy (`_kiem-tra-may/CHAY-KIEM-TRA.cmd`) trên Windows Server để chốt Hyper-V VM hay WSL2 `[D1]` | Hạ tầng | Duy |

---

## ⑩ Data Model `[R 1]`

> Mô tả mức logic cho Prisma. Tên bảng/trường gợi ý; `id` là UUID; mọi bảng có `createdAt`, `updatedAt`. Bảng nghiệp vụ có `version` (optimistic lock).

**Danh mục**

| Bảng | Trường chính | Ràng buộc |
|---|---|---|
| `Xuong` | ma, ten, trangThai | UNIQUE(ma) |
| `Chuyen` | ma, ten, loai (CHUYEN_MAY / VONG_NGOAI), xuongId, trangThai | UNIQUE(ma) |
| `Tram` | chuyenId, soTram, nhapQuaApp, trangThai | UNIQUE(chuyenId, soTram); `id` dùng cho QR |
| `NhanVien` | maNV (text, chuẩn hóa), hoTen, chuyenId, bacTayNghe?, trangThai | UNIQUE(maNV) |
| `MaHang` | ma, ten, khachHang, soLuongDonHang | UNIQUE(ma) |
| `CongDoan` | maHangId, ma, ten, laCongDoanHoanThanh, trangThai | UNIQUE(maHangId, ma); đúng 1 `laCongDoanHoanThanh` / mã hàng |
| `SmvLichSu` | congDoanId, smv, apDungTuNgay, nguoiTao | UNIQUE(congDoanId, apDungTuNgay) |

**Sơ đồ & phiên**

| Bảng | Trường chính | Ràng buộc |
|---|---|---|
| `ChuyenMaHang` | chuyenId, maHangId, batDau, ketThuc? | Tối đa 2 dòng `ketThuc = null` / chuyền |
| `GanCongDoan` | tramId, congDoanId, hieuLucTu, hieuLucDen? | Lịch sử; sơ đồ ngày D = các dòng có khoảng hiệu lực giao với ngày D |
| `PhienTram` | tramId, nhanVienId, ngayLamViec, thietBiId, dangNhapLuc, dangXuatLuc?, dangXuatBoi?, lyDo? | Partial UNIQUE(tramId, ngayLamViec) WHERE dangXuatLuc IS NULL |
| `ThietBi` | tokenHash, userAgent, taoLuc, lanCuoi | UNIQUE(tokenHash) — cookie thiết bị `[D6]` |

**Sản lượng & giờ làm**

| Bảng | Trường chính | Ràng buộc |
|---|---|---|
| `SanLuong` | ngayLamViec, tramId, congDoanId, nhanVienId, soLuong, smvSnapshot, chuyenTramSnapshot, chuyenGocNVSnapshot, nguon (APP / OFFLINE / NHAP_HO / SUA_WEB), daDieuChinh (bool), canhBao (bool), capNhatBoi, capNhatLucServer, capNhatLucThietBi?, thuTuThietBi, thietBiId? `[D7]` | **UNIQUE(ngayLamViec, tramId, congDoanId, nhanVienId)** |
| `SanLuongLichSu` | sanLuongId, soCu, soMoi, nguon, lyDo?, nguoiThucHien, lucServer, lucThietBi? | Chỉ thêm |
| `GioMacDinh` | xuongId, loaiNgay (T2_T6 / T7 / CN), soGio?, apDungTuNgay | UNIQUE(xuongId, loaiNgay, apDungTuNgay) |
| `GioLam` | nhanVienId, ngayLamViec, soGio, nguon (YEU_CAU_DUYET / TO_TRUONG_SUA), lyDo? | UNIQUE(nhanVienId, ngayLamViec); không có dòng → dùng giờ mặc định |
| `YeuCauGio` | nhanVienId, ngayLamViec, soGio, trangThai (CHO / DUYET / TU_CHOI), lyDoTuChoi?, nguoiDuyet? | Tối đa 1 yêu cầu CHO / NV × ngày |
| `ChotNgay` | chuyenId, ngayLamViec, chotBoi, chotLuc | UNIQUE(chuyenId, ngayLamViec) |
| `KhoaThang` | maHangId, thang (YYYY-MM), trangThai (KHOA / MO), nguoiThucHien, lyDo? | UNIQUE(maHangId, thang); lịch sử trong AuditLog |
| `KeHoach` | ngay, chuyenId, maHangId, soLuong | UNIQUE(ngay, chuyenId, maHangId) |

**Tài khoản & hệ thống**

| Bảng | Trường chính | Ràng buộc |
|---|---|---|
| `TaiKhoan` | tenDangNhap, hoTen, matKhauHash, vaiTro, trangThai, phaiDoiMatKhau, soLanSai, khoaDen? | UNIQUE(tenDangNhap) |
| `PhienDangNhap` | tokenHash, taiKhoanId, loai (WEB / TV), taoLuc, lanCuoi, ip, userAgent | UNIQUE(tokenHash); thu hồi = xóa dòng `[D6]` |
| `TaiKhoanChuyen` | taiKhoanId, chuyenId | UNIQUE cặp; bắt buộc ≥ 1 với Tổ trưởng |
| `TaiKhoanXuong` | taiKhoanId, xuongId | UNIQUE cặp; bắt buộc ≥ 1 với QL xưởng |
| `QuyenVaiTro` | vaiTro, chucNang, batTat | UNIQUE(vaiTro, chucNang) |
| `CauHinh` | khoa, giaTri | Ví dụ: `gioMoChotNgay = 08:00`, `chuKyLamMoiDashboard = 5` |
| `LichSuXuatLuong` | thang, nguoiXuat, luc, soDong | Chỉ thêm |
| `RequestDaXuLy` | requestId, thietBiId?, taiKhoanId?, ketQua (json), luc | Chống bấm Lưu nhiều lần; dọn sau 7 ngày `[D7]` |
| `ImportTam` | loai, nguoiTao, duLieu (json), hetHanLuc | Import 2 bước xem trước → xác nhận; hết hạn 30 phút |
| `AuditLog` | luc, nguoiThucHien, hanhDong, doiTuong, doiTuongId, duLieuCu (json), duLieuMoi (json), lyDo?, ip | Chỉ thêm — trigger chặn UPDATE/DELETE |

---

## ⑪ Danh sách màn hình `[R 1]`

**App công nhân (PWA, điện thoại)**

| Màn hình | Tính năng |
|---|---|
| Hướng dẫn lần đầu | F18 |
| Chọn trạm (danh sách / quét QR) | F1, F12 |
| Đăng nhập mã NV | F1 |
| Nhập sản lượng — tab theo trạm, chọn ngày | F1, F14 |
| Của tôi — 30 ngày, chi tiết ngày | F11 |
| Giờ làm — xem, gửi yêu cầu sửa | F6 |

**Web (máy tính)**

| Nhóm menu | Màn hình | Tính năng |
|---|---|---|
| — | Đăng nhập · Đổi mật khẩu | F8 |
| Trang chủ | Cảnh báo "Còn X ngày chưa chốt", danh sách trạm chưa nhập | F10, F13 |
| Sản xuất | **Bảng sản lượng ngày** (sửa, nhập hộ, chốt ngày) | F10, F19 |
| | Sơ đồ chuyền — gán công đoạn | F4 |
| | Sơ đồ trạm trực tiếp | F17 |
| | Duyệt / sửa giờ làm | F6 |
| Báo cáo | 5 loại báo cáo · Dashboard | F5, F7 |
| Lương | Khóa / mở khóa Mã hàng × Tháng · Xuất dữ liệu lương | F10, F15 |
| Kế hoạch | Kế hoạch sản lượng | F16 |
| Danh mục | Nhân viên · Mã hàng & công đoạn · Xưởng – Chuyền – Trạm (+ In QR) | F2, F3, F9, F12 |
| Hệ thống | Tài khoản & phân quyền · Cài đặt (giờ mặc định, giờ mở chốt ngày, dashboard) · Audit log | F8, F6 |

**TV**

| Màn hình | Tính năng |
|---|---|
| Dashboard toàn màn hình (`/tv`) | F7 |

---

## Changelog

| Ngày | Thay đổi | Người cập nhật |
|---|---|---|
| 28/09/2026 | v1 — draft đầu tiên (phỏng vấn đầy đủ 9 mục, 19 tính năng) | Duy |
| 29/09/2026 | **v2 — cập nhật sau review 5 điểm (xem chi tiết bên dưới)** | Duy + Claude |
| 30/09/2026 | **v2.1 — đồng bộ với TDD v1 sau phỏng vấn 15 quyết định kỹ thuật** | Duy + Claude |

**Chi tiết thay đổi v2**

| Mã | Mục | Thay đổi |
|---|---|---|
| R 1 | ①b, ⑩, ⑪ | Thêm Quy ước chung & Thuật ngữ, Data Model, Danh sách màn hình |
| R 1.1 | ①b, F1, ⑩ | Key bản ghi sản lượng = Ngày + Trạm + Công đoạn + Mã NV |
| R 1.2 | F10 | Thêm màn hình **Bảng sản lượng ngày** (xem – sửa – nhập hộ – chốt trên một màn hình) |
| R 1.3 | F1 | 1 điện thoại = 1 mã NV / ngày, nhiều trạm; không hỗ trợ điện thoại dùng chung |
| R 1.4 | F7 | Định nghĩa Công đoạn nghẽn, Top/Bottom 5 (theo ngày đã chốt gần nhất, ≥ 4 giờ); % hiệu suất trên dashboard dùng ngày đã chốt |
| R 1.5 | F8 | Vai trò = chức năng (bật/tắt); phạm vi chuyền/xưởng gắn theo tài khoản, cố định theo vai trò; 4 quy tắc gắn phạm vi |
| R 2.1–2.2 | ⑥ | Điều kiện đo p95, 300 người dùng, dữ liệu 12 tháng; kịch bản k6 |
| R 2.3 | F4, ⑥ | Màn hình Web tối thiểu 1366×768 |
| R 2.4 | F14 | Tự gửi offline chỉ khi app đang mở (giới hạn iOS) |
| R 2.5 | ⑥, ④ | Đo uptime bằng Uptime Kuma |
| R 2.6–2.7 | F7 | Tiêu chí TV: cỡ chữ, tương phản, RAM 12 giờ, tự tải lại 05:00 |
| R 2.8 | F13 | Tự cập nhật ≤ 10 giây |
| R 2.9 | ⑥ | Tiêu chí đạt của diễn tập khôi phục backup |
| R 2.10 | F18 | Chỉ tiêu ≥ 80% công nhân mới tự nhập lần đầu |
| R 3.1 | F1, ①b | "Hôm qua" → Ngày mở nhập (hôm nay + ngày chưa chốt trong 3 ngày); phiên các ngày trước giữ trên điện thoại |
| R 3.2 | ⑨ | Bỏ xử lý qua nửa đêm (không có tăng ca qua 00:00) |
| R 3.3 | F1 | Cảnh báo số vượt trần lý thuyết; chặn > 99.999 |
| R 3.4 | F2, ①b | Mã NV lưu text, chuẩn hóa trim + viết hoa |
| R 3.5 | F1, ⑥ | Giới hạn số lần sai đăng nhập trạm |
| R 3.6 | F4, F1, F13 | Lịch sử gán công đoạn theo hiệu lực; sơ đồ theo ngày |
| R 3.7 | F1, F2 | Snapshot chuyền gốc NV vào bản ghi sản lượng |
| R 3.8–3.9 | F1 | Bị đăng xuất khi đang nhập; tranh chấp đăng nhập cùng trạm |
| R 3.10 | F14, F10 | Bản ghi offline tới công đoạn đã gỡ / NV đã ngưng → nhận + cờ ⚠ |
| R 4.1–4.12 | ⑨, F6, F8 | Ghi rõ assumptions; giờ mặc định theo thứ trong tuần và theo xưởng; QL xưởng gắn xưởng |
| R 5.1 | F19 | **F19 Nhập hộ chuyển từ SHOULD lên MUST**, gộp vào Bảng sản lượng ngày |
| R 5.2 | F10, F13 | Ô chưa có số tô màu trong Bảng sản lượng ngày (MUST); F13 còn phần danh sách tổng hợp |
| R 5.3 | F1, F14 | MVP xử lý mất mạng bằng giữ số + Thử lại; F14 giữ ở SHOULD |
| R 5.4 | F1, F10, F14 | Ô đã điều chỉnh bởi tổ trưởng → công nhân/offline không ghi đè được |
| R 5.5 | F3, F5, F15 | SMV có lịch sử theo ngày hiệu lực; snapshot vào bản ghi; không đổi dữ liệu đã khóa |
| R 5.6 | F2 | Xóa hẳn NV chỉ khi chưa có sản lượng |
| R 5.7 | F6, F10 | Giờ làm bị khóa cùng Mã hàng × Tháng |
| R 5.8 | ①b, F5, F6, F19 | Quy tắc phạm vi R3: sản lượng theo chuyền của trạm, giờ làm theo chuyền gốc NV |
| R 5.9 | F10, F13 | Gộp mốc 08:00 thành cấu hình chung "Giờ mở chốt ngày" |
| R 5.10 | F9 | Ngưng chuyền/xưởng còn tài khoản được gắn |
| R 5.11 | F17, ④, ⑤ | Heartbeat SSE 30 giây qua Cloudflare Tunnel |
| R 5.12 | F8, F7 | Superadmin thu hồi phiên TV |

**Chi tiết thay đổi v2.1** (chi tiết kỹ thuật xem `TDD-VSN-SanLuong-v1.md`, Phụ lục A)

| Mã | Mục | Thay đổi |
|---|---|---|
| D1 | ④, ⑨ | Hosting: ưu tiên VM Ubuntu trên Hyper-V, dự phòng WSL2; không dùng Docker Desktop (giấy phép trả phí với doanh nghiệp ≥ 250 NV) |
| D2, D12 | ④ | Monorepo pnpm; frontend bổ sung Tailwind CSS, Radix UI, TanStack Query/Table, dnd-kit; **ECharts → Recharts** (giữ theo UI demo) |
| D3, D4 | ④ | Zod dùng chung (nestjs-zod); Prisma + SQL tay cho ràng buộc, trigger, báo cáo |
| D6 | ④, ⑥, ⑩ | **Web/TV: JWT access + refresh → phiên lưu ở server**; bỏ `tokenVersion`; thêm bảng `PhienDangNhap`, `ThietBi` |
| D7 | ⑩ | `SanLuong` thêm `thuTuThietBi`, `thietBiId`; thêm bảng `RequestDaXuLy` (chống trùng, chống gói tin sai thứ tự) |
| D11 | ④, ⑤, F13, F17 | **SSE + heartbeat → polling ≤ 10 giây** (F17: 5 giây, F13: 10 giây) |
| D14 | ④, ⑥ | Giữ iOS Safari 15+ → dùng Tailwind v3.4 (v4 chỉ hỗ trợ Safari 16.4+) |
| D15 | F5 | % hiệu suất chuyền: NV làm nhiều chuyền trong ngày → chia giờ làm theo tỷ lệ phút SMV (thiếu SMV thì theo số sản phẩm) |
