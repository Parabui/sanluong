# Giám sát & backup — VSN Sản Lượng

Tài liệu vận hành cho TDD §15 (backup), §18 (giám sát). Runbook đầy đủ (`docs/RUNBOOK.md`) làm ở tuần 13 và trỏ về đây.

## 1. Backup (container `backup`)

| Việc | Lịch | Chi tiết |
|---|---|---|
| Backup | 02:00 hằng ngày | `backup.sh`: `pg_dump -Fc` (tài khoản `vsn_backup`, chỉ đọc) → `gpg --encrypt` bằng **public key** → `/srv/vsn/backups/vsn-<thời điểm>.dump.gpg` (giữ 30 bản) → `rclone copy` lên cloud (giữ 30 ngày) → ping Uptime Kuma |
| Số dòng đối chiếu | cùng lúc backup | `vsn-<thời điểm>.so-dong.txt`: số dòng 15 bảng chính, đếm **cùng snapshot** với bản dump (`pg_export_snapshot` + `pg_dump --snapshot`) |
| Ổ đĩa | 5 phút / lần | `kiem-tra-dia.sh`: `/` hoặc `/backups` ≥ 80% → push monitor báo down |
| Diễn tập khôi phục | mỗi quý | `restore-test.sh` (mục 3) — ghi biên bản `[R 2.9]` |

**Khóa GPG** `[D24]`: cặp khóa tạo trên máy IT (xem `infra/backup/khoa/README.md`). Server chỉ có `backup.pub.asc`; private key cất trong sổ mật khẩu IT + một bản in niêm phong.

**Cài lần đầu trên server**

```bash
sudo mkdir -p /srv/vsn/backups /srv/vsn/rclone /srv/vsn/dozzle && sudo chmod 700 /srv/vsn/*
cp backup.pub.asc infra/backup/khoa/backup.pub.asc         # chỉ public key
docker run --rm -it -v /srv/vsn/rclone:/config/rclone rclone/rclone config   # tạo remote "onedrive" (hoặc gdrive)
# .env: RCLONE_DICH=onedrive:vsn-backup · UPTIME_BACKUP_PUSH_URL=… · UPTIME_DISK_PUSH_URL=…
docker compose -f infra/compose.prod.yml --env-file .env up -d backup
docker compose -f infra/compose.prod.yml exec backup backup.sh   # chạy thử ngay 1 lần
```

## 2. Uptime Kuma (đặt NGOÀI server chính) `[TDD 18]`

Cài trên một máy khác (VPS nhỏ / máy IT luôn bật): `docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data louislam/uptime-kuma:1`.
Thông báo: **Telegram** cho nhóm IT.

| Monitor | Loại | Cấu hình |
|---|---|---|
| API sống | HTTP(s) – Keyword | `https://sanluong.vsn-dn.com/api/health/chi-tiet` · 1 phút · header `X-Uptime-Token: <UPTIME_TOKEN trong .env>` · keyword `"db":"ok"` |
| Backup | Push | Heartbeat interval 26 giờ (93600 s) → URL dán vào `UPTIME_BACKUP_PUSH_URL` |
| Ổ đĩa | Push | Heartbeat 10 phút → URL dán vào `UPTIME_DISK_PUSH_URL` (≥ 80% script gửi `status=down`) |
| Trang công nhân | HTTP(s) | `https://sanluong.vsn-dn.com/` · 5 phút |

Báo cáo uptime hằng tháng: trang Status của Uptime Kuma `[R 2.5]`.

`/api/health` công khai chỉ trả `{ ok }`; `/api/health/chi-tiet` trả `{ phienBan, db, migration, gioServer }` khi có token đúng hoặc Superadmin đã đăng nhập `[D24]`.

## 3. Diễn tập khôi phục (mỗi quý)

IT mang private key (USB / máy IT), chạy trên server hoặc máy có Docker:

```bash
docker compose -f infra/compose.prod.yml run --rm \
  -v /duong/dan/chua/khoa:/khoa:ro -e NGUOI_THUC_HIEN="Tên IT" \
  backup restore-test.sh moi-nhat /khoa/backup.priv.asc          # hoặc: cloud | /backups/vsn-….dump.gpg
```

Script: giải mã (GNUPGHOME tạm) → khôi phục vào PostgreSQL **tạm trong container** → so số dòng với `.so-dong.txt` → ghi `/srv/vsn/backups/bien-ban/khoi-phuc-<thời điểm>.txt` → container tự xóa (`--rm`), private key không còn trên máy.
Kết quả `ĐẠT` khi mọi bảng khớp; `KHÔNG ĐẠT` → báo IT kiểm tra ngay (lệnh trả mã lỗi ≠ 0).

**Đã diễn tập trên máy dev (02/10/2026, khóa thử)**: backup dữ liệu dev → khôi phục → 15/15 bảng khớp, migration cuối `20261002055123_gio_lam_hieu_luc` → ĐẠT.

## 4. Lỗi & log

- **Sentry** (API, web, app công nhân): bật khi có `SENTRY_DSN` (API) / `VITE_SENTRY_DSN` (lúc build web + worker). `beforeSend` xóa họ tên, request body, cookie, query; chỉ giữ id nội bộ, route, mã lỗi, `traceId`, stack. App công nhân nạp Sentry lười (không tính vào 180 KB tải lần đầu).
- **Kiểm tra toàn vẹn 03:30** (API): thiếu `smv_snapshot`, bản ghi không có lịch sử, lệch số với lịch sử, NV × ngày thiếu chuyền gốc → log `error` + Sentry.
- **Dọn dẹp 03:00** (API): `request_da_xu_ly` > 7 ngày, `import_tam` hết hạn, phiên Web quá 12 giờ.
- **Dozzle** (xem log container): chỉ bind `127.0.0.1:9999`, có đăng nhập (`/srv/vsn/dozzle/users.yml`, mẫu `infra/dozzle/users.example.yml`); truy cập qua `ssh -L 9999:127.0.0.1:9999 <server>`.
- Tra lỗi công nhân báo: lấy `traceId` trên màn hình lỗi → `docker compose logs api | grep <traceId>` hoặc tìm tag `traceId` trong Sentry.
