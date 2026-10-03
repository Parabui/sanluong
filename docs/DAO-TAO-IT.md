# Đào tạo người IT thứ hai — VSN Sản Lượng

Mục tiêu `[TDD 21 — rủi ro #7 "một người vận hành"]`: khi Duy vắng mặt, người IT thứ hai **tự xử lý được** mọi mục trong
[RUNBOOK.md](RUNBOOK.md) mà không cần gọi hỏi. Học bằng tay trên **môi trường staging**, không học trên production.

| | |
|---|---|
| Người hướng dẫn | Duy |
| Người học | *(điền)* |
| Thời lượng | 2 buổi × 3 giờ + 1 buổi diễn tập sự cố không báo trước |
| Môi trường | VM staging riêng (Hyper-V hoặc WSL2 trên máy bất kỳ), tag phát hành thử `v0.1.0-rc.N` trên GHCR, domain thử (vd. `thu-sanluong.vsn-dn.com`, tunnel riêng) |
| Kết quả | Bảng ký xác nhận cuối tài liệu · người học có tài khoản Superadmin production + biết nơi cất bí mật (RUNBOOK mục 5) |

Staging dựng xong ở bài 1 dùng tiếp cho **UAT với tổ trưởng pilot** ([UAT-PILOT.md](UAT-PILOT.md)).

---

## Buổi 1 — Hiểu hệ thống & cài đặt

### Bài 0 · Bức tranh chung (30 phút, nghe + hỏi)
- Ai dùng gì: công nhân (app điện thoại, `/`), tổ trưởng / quản lý / HR (Web `/quanly`), TV xưởng (`/tv`).
- Luồng dữ liệu một ngày: công nhân Lưu → tổ trưởng rà Bảng sản lượng ngày, sửa / nhập hộ → **Chốt ngày** (từ 08:00 hôm sau) → cuối
  tháng HR **Khóa sổ** mã hàng × tháng → dữ liệu tính lương.
- Sơ đồ RUNBOOK mục 0: 6 container, cái nào hỏng thì ai bị ảnh hưởng (cloudflared hỏng = cả nhà máy mất; backup hỏng = không ai thấy ngay → Uptime Kuma).
- 3 tài khoản DB tách quyền (`vsn_migrate`, `vsn_app`, `vsn_backup`) và vì sao **không sửa dữ liệu bằng SQL tay** (trigger ghi `DB_TRUC_TIEP`).

### Bài 1 · Dựng staging từ số 0 (2 giờ, người học tự làm, người hướng dẫn chỉ nhìn)
Làm đúng RUNBOOK mục 1, bước 1 → 12 trên VM staging. Người hướng dẫn chuẩn bị trước: tag `v0.1.0-rc.N`, PAT GHCR `read:packages`,
tunnel thử, Turnstile thử, cặp khóa GPG **thử** (không dùng khóa production).

Đạt khi:
- [ ] `dc ps` đủ dịch vụ, health chi tiết `"db":"ok"` đúng phiên bản
- [ ] Mở domain thử từ điện thoại 4G: app công nhân + `/quanly` đăng nhập Superadmin, đã đổi mật khẩu tạm
- [ ] `restore-test.sh` → `KẾT QUẢ: ĐẠT`
- [ ] Người học tự giải thích được: `.env` cất ở đâu, private key ở đâu, vì sao private key không nằm trên server

### Bài 2 · Việc hằng ngày trên Web (30 phút)
- Tạo tài khoản tổ trưởng, gán chuyền; đặt lại mật khẩu; thu hồi phiên TV (RUNBOOK 4.6).
- *Hệ thống → Audit log*: lọc theo người, theo hành động, xem Trace ID.
- *Hệ thống → Cài đặt*: giờ mở chốt ngày, giờ mặc định theo xưởng × thứ.

---

## Buổi 2 — Deploy, rollback, khôi phục

### Bài 3 · Phát hành và deploy (45 phút)
1. Xem quy trình RUNBOOK mục 2 trên GitHub: tag → Actions `release` → GitHub Release (gói triển khai, ghi chú).
2. Trên staging: `./infra/deploy.sh v0.1.0-rc.(N+1)` → đọc từng bước trong `/srv/vsn/deploy.log`, tìm file dump trước deploy.
3. Ngoài khung 23:00–05:00: chạy không có `--gap` → thấy câu hỏi xác nhận, gõ sai → script dừng.

### Bài 4 · Bản lỗi tự quay về + rollback tay (30 phút)
Người hướng dẫn phát hành sẵn một tag **cố ý hỏng** (API thoát ngay khi khởi động), vd. `v0.1.0-rc.99`.
- [ ] `./infra/deploy.sh v0.1.0-rc.99 --gap` → sau ~60 s script báo *ĐÃ QUAY VỀ …*, `.env` về tag cũ, web vẫn chạy
- [ ] Rollback tay về tag cũ hơn: `./infra/deploy.sh v0.1.0-rc.N --gap`
- [ ] Giải thích vì sao rollback **không cần** khôi phục DB (migration chỉ-thêm)

### Bài 5 · Khôi phục dữ liệu (1 giờ) — quan trọng nhất
Trên staging, tạo vài dữ liệu (chuyền, trạm, NV, vài lần Lưu từ điện thoại), rồi lần lượt:
- [ ] ① Khôi phục từ dump trước deploy (RUNBOOK 4.4) — dữ liệu tạo sau dump phải biến mất
- [ ] ② Chạy `backup.sh` bằng tay (`dc exec backup backup.sh`) → khôi phục bản đêm bằng private key thử → **xóa key khỏi server** sau đó
- [ ] Thử khôi phục khi **chưa dừng api** → script từ chối; giải thích vì sao
- [ ] Khôi phục nhầm → quay lại bằng bản trong `/srv/vsn/backups/truoc-khoi-phuc/`
- [ ] "Mất cả server": `dc down -v` (xóa sạch DB staging) → làm theo RUNBOOK 4.4 đoạn *Mất cả server* → đăng nhập lại được, dữ liệu còn

### Bài 5b · Chuyển máy (30 phút) — chuẩn bị cho lúc chuyển từ laptop sang server thật
- [ ] Dựng VM / distro WSL2 thứ hai (chỉ RUNBOOK mục 1 bước 1–3), staging cũ: `./infra/chuyen-may.sh xuat`
- [ ] Máy thứ hai: `bash chuyen-may.sh nhap <gói>` → `KHỚP` + `✅`; staging cũ: `deploy.sh` bị từ chối (đã chuyển)
- [ ] Quay về máy cũ (RUNBOOK mục 6 "Máy mới lỗi") rồi chuyển lại — giải thích vì sao **không được** để 2 máy cùng chạy tunnel

### Bài 6 · Tài khoản khẩn cấp (15 phút)
- [ ] Đăng nhập sai 5 lần → bị khóa → mở bằng **Đặt lại mật khẩu** trên Web
- [ ] Giả lập "Superadmin duy nhất quên mật khẩu": `dat-lai-superadmin.js` (RUNBOOK 4.6) → thấy dòng audit `DAT_LAI_MAT_KHAU` (HE_THONG)

---

## Buổi 3 — Diễn tập sự cố không báo trước (1–2 giờ)

Người hướng dẫn gây ra **3 sự cố** trên staging mà không nói trước là gì; người học chỉ có RUNBOOK + điện thoại. Gợi ý kịch bản:

| Sự cố gây ra | Người học phải tìm ra | Mục RUNBOOK |
|---|---|---|
| `dc stop cloudflared` (hoặc đổi `TUNNEL_TOKEN` sai) | "Ngoài không vào được, trong server vẫn chạy" | 4.2 |
| Tắt VM đột ngột rồi bật lại | Kiểm tra đúng thứ tự, báo nhóm tổ trưởng | 4.1 |
| Tạo file lớn cho đĩa ≥ 80% (`fallocate -l 40G /srv/vsn/rac`) | Cảnh báo ổ đĩa → tìm thủ phạm, dọn đúng thứ tự | 4.3 |
| Đọc cho người học một "mã lỗi" = 8 ký tự đầu `traceId` của một request lấy trong log | `grep -i <mã>` ra route, người thực hiện, giờ | 4.7 |
| Đổi `TURNSTILE_SECRET` sai | Công nhân không đăng nhập trạm được hàng loạt | 4.8 |

Đạt khi xử lý xong cả 3 trong thời gian hợp lý và **ghi lại** được: đã thấy gì, đã làm gì, mất bao lâu. Chỗ nào RUNBOOK thiếu / khó hiểu →
sửa RUNBOOK ngay sau buổi diễn tập (đó cũng là mục đích của buổi này).

---

## Ký xác nhận

| Nội dung | Người học | Người hướng dẫn | Ngày |
|---|---|---|---|
| Buổi 1 — dựng staging, đổi mật khẩu, restore-test ĐẠT | | | |
| Buổi 2 — deploy, tự quay về, rollback, khôi phục ①②, mất cả server | | | |
| Buổi 3 — 3 sự cố không báo trước | | | |
| Đã nhận tài khoản Superadmin production + biết nơi cất `.env`, private key | | | |
