# UAT với tổ trưởng pilot — VSN Sản Lượng (tuần 13)

Mục tiêu: tổ trưởng 2 chuyền pilot (BGĐ chọn), 1 người HR và 1 người IE **tự tay** chạy các nghiệp vụ hằng ngày trên dữ liệu thật của
chuyền mình, xác nhận đủ dùng trước **pilot tuần 14** `[TDD 20]`. Không phải buổi demo: người dùng bấm, người hướng dẫn chỉ quan sát và ghi lại.

| | |
|---|---|
| Môi trường | **Staging** (dựng ở [DAO-TAO-IT.md](DAO-TAO-IT.md) bài 1), bản phát hành sẽ lên pilot, domain thử, Turnstile bật |
| Dữ liệu | Thật của 2 chuyền pilot: danh sách NV (import Excel HR), mã hàng + công đoạn + SMV đang chạy (file IE), sơ đồ chuyền tuần này |
| Người tham gia | Tổ trưởng chuyền A, tổ trưởng chuyền B, HR, IE, 3–5 công nhân mỗi chuyền (điện thoại của chính họ, 4G), Duy, IT thứ hai |
| Thời lượng | 2 buổi: buổi 1 (Web + app, ngày D) · buổi 2 sáng D+1 (chốt ngày, báo cáo, khóa sổ) |
| Ghi kết quả | Cột *Kết quả*: ✅ đạt · ⚠ đạt nhưng khó dùng (ghi lý do) · ❌ lỗi (ảnh chụp + giờ + mã lỗi nếu có) |

## Điều kiện trước UAT

- [ ] ⚠ **BGĐ/HR xác nhận bằng văn bản** `[R 4.12]`: công nhân dùng điện thoại và 4G cá nhân; nhập tại nhà sau giờ làm không tính làm thêm giờ
- [ ] BGĐ chọn 2 chuyền pilot; quản lý sản xuất duyệt lịch UAT (không trùng giờ cao điểm)
- [ ] IE gửi file quy trình công nghệ (mã hàng, công đoạn, SMV) của mã hàng đang chạy ở 2 chuyền
- [ ] HR gửi danh sách NV 2 chuyền (mã NV, họ tên, chuyền) theo file mẫu import
- [ ] Đã tạo tài khoản: 2 tổ trưởng (gán đúng chuyền), 1 HR (IT_HR), 1 IE — mật khẩu tạm, đổi ở lần đầu
- [ ] In sẵn bảng mã trạm + link đăng nhập trạm cho 2 chuyền (chức năng In QR F12 để giai đoạn 2 — xem [CHECKLIST-THIET-BI.md](CHECKLIST-THIET-BI.md))
- [ ] Đã chạy xong [CHECKLIST-THIET-BI.md](CHECKLIST-THIET-BI.md) mục A–D trên ít nhất 1 iPhone + 1 Android

**Ngoài phạm vi UAT (chưa có trong bản pilot, đã thống nhất):** Dashboard F7 / TV · Trang chủ tổng hợp F13 (đăng nhập xong vào thẳng màn hình
đầu tiên được xem — tổ trưởng: *Bảng sản lượng ngày*) · In QR F12 · Nhập offline F14 · Xuất dữ liệu lương F15 · Kế hoạch F16 · Hướng dẫn trong app F18 ·
"Của tôi" hiện lịch sử thiết bị. Ghi nhận nhu cầu nếu người dùng hỏi tới, không coi là lỗi.

---

## Buổi 1 (ngày D)

### A. IE — mã hàng & sơ đồ chuyền (F3, F4)
| # | Việc | Mong đợi | Kết quả | Ghi chú |
|---|---|---|---|---|
| A1 | Import file IE của mã hàng chuyền A | Đúng số công đoạn, SMV; công đoạn hoàn thành được đánh dấu | | |
| A2 | Sơ đồ chuyền: gán công đoạn vào từng trạm app của chuyền A, Lưu | Lưu được, có phiên bản; trạm chưa gán hiện rõ | | |
| A3 | Đổi SMV 1 công đoạn từ ngày mai | Ngày đã qua không đổi phút SMV | | |

### B. HR — nhân viên (F2)
| # | Việc | Mong đợi | Kết quả | Ghi chú |
|---|---|---|---|---|
| B1 | Import danh sách NV 2 chuyền | Báo đúng số thêm / lỗi từng dòng (mã trùng, thiếu cột) | | |
| B2 | Ngưng 1 NV nghỉ việc | NV đó không đăng nhập trạm được | | |

### C. Công nhân — trên điện thoại của mình (F1, F11), mỗi chuyền 3–5 người
| # | Việc | Mong đợi | Kết quả | Ghi chú |
|---|---|---|---|---|
| C1 | Mở link → chọn chuyền → trạm → nhập mã NV | Vào màn Nhập, đúng tên, đúng công đoạn của trạm hôm nay | | |
| C2 | Nhập tổng số → Lưu (4G) | "Đã lưu" **< 2 giây** | | |
| C3 | Một lúc sau nhập số lớn hơn → Lưu | Số mới thay số cũ | | |
| C4 | Nhập số nhỏ hơn số đã lưu | Hỏi xác nhận trước khi ghi | | |
| C5 | Công nhân đứng 2 trạm: đăng nhập trạm thứ 2 | 2 tab trạm, chuyển qua lại không đăng nhập lại | | |
| C6 | Người khác thử đăng nhập trạm đang có người | Báo "Trạm đang có [tên viết tắt] – báo tổ trưởng" | | |
| C7 | Xem *Của tôi* | Thấy sản lượng hôm nay (tạm tính), không thấy số người khác | | |
| C8 | Gửi yêu cầu sửa giờ làm hôm nay (F6) | Tổ trưởng thấy ở *Duyệt giờ làm* | | |
| C9 | **Tự đánh giá:** công nhân làm C1–C2 lần đầu **không cần ai giúp**? | Ghi số người tự làm được / tổng `[R 2.10]` | | |

### D. Tổ trưởng — trong ngày (F10, F17, F19, F6)
| # | Việc | Mong đợi | Kết quả | Ghi chú |
|---|---|---|---|---|
| D1 | Đăng nhập Web lần đầu → đổi mật khẩu tạm | Vào được, chỉ thấy chuyền của mình | | |
| D2 | *Sơ đồ trạm trực tiếp* trong lúc công nhân đăng nhập | Tên hiện ≤ 10 giây; trạm đã nhập / chưa nhập phân biệt rõ | | |
| D3 | Công nhân đăng nhập nhầm trạm → **Đăng xuất hộ** (có lý do) | Trạm trống lại; công nhân thấy thông báo bị đăng xuất | | |
| D4 | *Bảng sản lượng ngày* hôm nay | Đủ mọi trạm × công đoạn theo sơ đồ; ô chưa có số tô vàng; mở < 3 giây | | |
| D5 | **Nhập hộ** cho 1 công nhân không có điện thoại (lý do) | Ô thành *Đã điều chỉnh*; công nhân không ghi đè được từ app | | |
| D6 | Duyệt / từ chối yêu cầu giờ ở C8 | Giờ làm cập nhật; % hiệu suất tính lại | | |

## Buổi 2 (sáng ngày D+1, sau Giờ mở chốt ngày)

### E. Tổ trưởng — chốt ngày D (F10)
| # | Việc | Mong đợi | Kết quả | Ghi chú |
|---|---|---|---|---|
| E1 | Header hiện "Còn 1 ngày chưa chốt" → mở ngày D | Đúng chuyền, đúng ngày | | |
| E2 | Sửa 1 ô sai (bắt buộc lý do) | Ô *Đã điều chỉnh*, lịch sử ghi ai / lúc nào / số cũ → mới / lý do | | |
| E3 | Ô cam ⚠ (nếu có, vd. "Nhiều thiết bị") → xem lý do → xác nhận | Hiểu được vì sao bị cờ; xác nhận xong hết cam | | |
| E4 | Bấm **Chốt ngày** khi còn ô vàng | Cảnh báo "Còn X ô chưa có số" + danh sách NV × trạm; tích xác nhận mới chốt được | | |
| E5 | Công nhân thử Lưu số cho ngày D sau khi chốt | Bị từ chối "đã được chốt" | | |
| E6 | **Đối chiếu sổ tay:** so tổng sản lượng ngày D trên Bảng với sổ tay của tổ trưởng | Lệch = 0, hoặc giải thích được từng ô lệch | | |

### F. HR / quản lý — báo cáo & khóa sổ (F5, F10)
| # | Việc | Mong đợi | Kết quả | Ghi chú |
|---|---|---|---|---|
| F1 | Báo cáo theo công nhân, ngày D, 2 chuyền | Số khớp Bảng sản lượng ngày; % hiệu suất hợp lý | | |
| F2 | Xuất Excel cùng bộ lọc | Tổng trong Excel = tổng màn hình | | |
| F3 | Báo cáo của 1 công nhân = *Của tôi* của chính người đó | Khớp 100% | | |
| F4 | Khóa sổ thử 1 mã hàng × tháng có ngày chưa chốt | Bị chặn, hiện danh sách ngày chưa chốt | | |
| F5 | (Trên dữ liệu thử đã chốt đủ) Khóa → Mở khóa (lý do) → tổ trưởng sửa → Khóa lại | Đúng trình tự; tổ trưởng không sửa được khi đang khóa | | |

---

## Tổng kết & quyết định

| Chỉ tiêu (để so với pilot tuần 1 — PRD ⑧) | Kết quả UAT |
|---|---|
| Công nhân tự đăng nhập + nhập được lần đầu (mục tiêu pilot ≥ 90%; ≥ 80% không cần hỗ trợ) | ___ / ___ |
| Lưu < 2 giây trên 4G | ✅ / ❌ |
| Lệch so với sổ tay (E6) | ___ ô |
| Lỗi ❌ còn mở | ___ |

**Danh sách lỗi / góp ý** (đánh số, mức: *Chặn pilot* / *Sửa trong pilot* / *Giai đoạn 2*):

| # | Mục | Mô tả | Mức | Người nhận | Xong |
|---|---|---|---|---|---|
| | | | | | |

**Quyết định:** ☐ Đủ điều kiện pilot tuần 14 · ☐ Pilot sau khi sửa các mục *Chặn pilot* · ☐ Chưa đủ — lý do: ______

| | Họ tên | Ký | Ngày |
|---|---|---|---|
| Tổ trưởng chuyền A | | | |
| Tổ trưởng chuyền B | | | |
| HR | | | |
| Quản lý sản xuất | | | |
| IT (Duy) | | | |

**Trong pilot (tuần 14–15):** tổ trưởng **vẫn ghi sổ tay song song** để đối chiếu hằng ngày (PRD ⑧: 0 lần mất / sai lệch dữ liệu).
Đề xuất quy định "Lưu trước giờ nghỉ trưa" để dashboard không trống cả ngày và giảm rủi ro mất số — **quyết định của quản lý sản xuất** `[TDD 21 #14]`.
