# RUNBOOK — VSN Sản Lượng (production)

Tài liệu vận hành **bắt buộc có trước go-live** `[R 4.11]` `[TDD 18]`. Mọi lệnh dưới đây đã được chạy thử trên bản diễn tập
production ngày 03/10/2026 (cài lần đầu, cập nhật, tự quay về, rollback, khôi phục 3 kiểu, đặt lại mật khẩu Superadmin).
In ra giấy 1 bản để cạnh server.

---

## 0. Tổng quan — đọc trước

```
Công nhân / Web ──HTTPS──▶ Cloudflare ──Tunnel (chiều ra)──▶ cloudflared ─▶ caddy :80 ─┬─▶ /api/*   api :4000 ─▶ postgres
                                                                                       ├─▶ /quanly/* web (file tĩnh)
                                                                                       └─▶ /*        app công nhân (PWA)
backup (cron 02:00, mã hóa GPG → /srv/vsn/backups + cloud)   dozzle (xem log, chỉ 127.0.0.1:9999 qua SSH)
```

| Thứ | Ở đâu |
|---|---|
| Server | **Tạm thời:** laptop IT, distro WSL2 riêng `VSN-SanLuong` (Docker Engine riêng, tách khỏi Docker Desktop dev). **Sau này:** server thật — VM Hyper-V Ubuntu 24.04 (ưu tiên) hoặc WSL2 `[D1b]`, chuyển sang bằng mục 6 |
| Thư mục cài đặt | `/srv/vsn/app` — `.env` (quyền 600) + `infra/` (giải nén từ gói `vsn-trien-khai-<tag>.tar.gz`) |
| Dữ liệu ngoài container | `/srv/vsn/backups` (backup mã hóa, `truoc-deploy/`, `truoc-khoi-phuc/`, `bien-ban/`) · `/srv/vsn/rclone` · `/srv/vsn/dozzle` · `/srv/vsn/deploy.log` |
| Dữ liệu DB | Docker volume `vsn-sanluong_pgdata` |
| Tài khoản Linux | `vsn` (nhóm `docker`) — không dùng root để vận hành |
| Domain | `https://sanluong.vsn-dn.com` (Web quản lý: `/quanly`, TV: `/tv`) |

**Lệnh tắt** — mọi mục dưới đây giả định đã chạy 2 dòng này:

```bash
cd /srv/vsn/app
alias dc='docker compose -f infra/compose.prod.yml --env-file .env'
```

| Muốn | Lệnh |
|---|---|
| Xem trạng thái | `dc ps` |
| Xem log | `dc logs api --since 1h` · `dc logs -f api` · Dozzle: `ssh -L 9999:127.0.0.1:9999 vsn@<server>` → http://localhost:9999 |
| Health chi tiết | `curl -s -H "X-Uptime-Token: $(grep ^UPTIME_TOKEN= .env \| cut -d= -f2)" http://127.0.0.1:8088/api/health/chi-tiet` |
| Khởi động lại 1 dịch vụ | `dc restart api` (caddy, cloudflared, backup tương tự) |
| Vào DB (chỉ xem) | `dc exec postgres psql -U postgres -d vsn_sanluong` |

⚠ **Không** sửa dữ liệu bằng SQL tay. Mọi `INSERT/UPDATE/DELETE` trên `san_luong`, `gio_lam` không qua ứng dụng đều bị trigger ghi audit
`DB_TRUC_TIEP`. Cần sửa số → tổ trưởng sửa trên Bảng sản lượng ngày (có lý do).

---

## 1. Cài đặt lần đầu (server mới)

1. **Máy ảo / WSL** `[TDD 3.2]`
   - Hyper-V: `infra/server/tao-vm-hyperv.ps1 -Iso <ubuntu-24.04.iso> -Switch "<virtual switch External>"` (4 vCPU, 8 GB cố định,
     120 GB, tự khởi động cùng server) → cài Ubuntu Server 24.04, bật OpenSSH.
   - WSL2 (máy tạm hiện tại, hoặc Windows Server không có Hyper-V): `infra/server/tao-wsl-vsn.ps1 [-GiuMayThuc]` — tạo distro
     **riêng** `VSN-SanLuong` + làm luôn bước 2 + chép `infra/` vào `/srv/vsn/app` → `infra/server/wsl-tu-khoi-dong.ps1` (tự chạy cùng Windows).
     Laptop: cắm sạc thường trực (pin = UPS mini), `-GiuMayThuc` tắt ngủ / gập nắp không tắt; máy có Docker Desktop thì tắt WSL integration cho `VSN-SanLuong`.
   - Cả hai: UPS, Windows Update chỉ khởi động lại 23:00–05:00 (*Settings → Windows Update → Active hours* 05:00–23:00).
2. **Chuẩn bị Ubuntu:** `sudo bash infra/server/cai-dat-ubuntu.sh` (Docker, NTP, múi giờ, tài khoản `vsn`, `/srv/vsn`, tường lửa, cập nhật bảo mật 04:15).
3. **Đăng nhập GHCR** (bằng tài khoản `vsn`): `docker login ghcr.io -u <github user>` — mật khẩu là Personal access token **chỉ quyền `read:packages`**.
4. **Gói triển khai:** tải `vsn-trien-khai-<tag>.tar.gz` ở GitHub Release → `tar -xzf … -C /srv/vsn/app`.
5. **Public key backup:** chép `backup.pub.asc` vào `/srv/vsn/app/infra/backup/khoa/` (private key KHÔNG lên server — xem `infra/backup/khoa/README.md`).
6. `./infra/khoi-tao.sh <tag>` lần 1 → tạo `.env` với mật khẩu DB + `UPTIME_TOKEN` ngẫu nhiên. **Cất ngay 1 bản `.env`** vào nơi giữ mật khẩu (mục 5).
7. Điền `.env`:
   - `TUNNEL_TOKEN` — Cloudflare Zero Trust → Tunnels → tạo tunnel **mới** `vsn-sanluong` → Public hostname `sanluong.vsn-dn.com` → `http://caddy:80`.
     SSL Full, Always Use HTTPS. Rate limiting rule cho `/api/cn/phien-tram` theo IP, ngưỡng cao (4G CGNAT) `[TDD 3.3]`.
   - `TURNSTILE_SECRET` — Cloudflare Turnstile, chế độ Invisible, domain `sanluong.vsn-dn.com`. Site key đặt ở GitHub → Settings →
     Variables `VITE_TURNSTILE_SITE_KEY` (nhúng lúc build — phải có TRƯỚC khi tạo tag).
   - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (kết quả deploy) · `SENTRY_DSN` · `RCLONE_DICH` + `/srv/vsn/rclone/rclone.conf`
     (`rclone config` trên máy IT rồi chép, quyền 600) · `UPTIME_BACKUP_PUSH_URL`, `UPTIME_DISK_PUSH_URL`.
8. Dozzle: tạo `/srv/vsn/dozzle/users.yml` theo `infra/dozzle/users.example.yml` (thiếu file này Dozzle không chạy — các dịch vụ khác không ảnh hưởng).
9. `./infra/khoi-tao.sh <tag>` lần 2 → hỏi tên + mật khẩu **tạm** Superadmin → tạo DB (3 tài khoản tách quyền) → migration → seed → khởi động.
10. **Uptime Kuma (đặt ngoài server):** HTTP `https://sanluong.vsn-dn.com/api/health/chi-tiet`, header `X-Uptime-Token`, mỗi 1 phút, có chữ
    `"db":"ok"` · 2 push monitor (backup — hạn 26 giờ; ổ đĩa — hạn 15 phút) · thông báo Telegram.
11. Đăng nhập `/quanly` bằng Superadmin → đổi mật khẩu → *Hệ thống → Cài đặt* kiểm tra giờ mở chốt ngày, giờ mặc định.
12. **Diễn tập backup ngay hôm đầu:** mục 4.4 ③ (`restore-test.sh`) — phải ra `KẾT QUẢ: ĐẠT`.

---

## 2. Phát hành & deploy

**Máy dev:**
1. Sửa `CHANGELOG.md` (mục `## [x.y.z] – ngày`), tăng `version` trong `package.json` gốc (và các `apps/*`, `packages/*`).
2. Merge vào `main` (CI xanh, gồm E2E) → `git tag vx.y.z && git push origin vx.y.z`.
3. GitHub Actions `release`: chạy lại CI + E2E → build `vsn-api`, `vsn-web`, `vsn-backup` → GHCR → GitHub Release kèm gói triển khai.

**Server** (khung **23:00–05:00**; ngoài khung script hỏi lại, sửa gấp thì thêm `--gap`):

```bash
cd /srv/vsn/app
# Hyper-V, bản lớn (có migration): phía Windows tạo checkpoint trước
#   Checkpoint-VM -Name vsn-sanluong -SnapshotName "truoc-deploy-vx.y.z"
./infra/deploy.sh vx.y.z
```

Script tự làm: kiểm tra `.env` → tải image → **pg_dump trước deploy** (`/srv/vsn/backups/truoc-deploy/`, giữ 3 bản) → `prisma migrate deploy`
(tài khoản `vsn_migrate`) → seed (chỉ thêm quyền/cấu hình mới) → đổi `VSN_TAG` → `up -d` → chờ `/api/health/chi-tiet` đúng phiên bản ≤ 60 s.
Lỗi ở bước cuối → **tự quay về tag trước** và báo Telegram. Nhật ký: `/srv/vsn/deploy.log`.

Gói triển khai mới có thay đổi `infra/` (compose, script) → giải nén đè vào `/srv/vsn/app` **trước** khi chạy `deploy.sh` (không đè `.env`).

---

## 3. Kiểm tra định kỳ

| Khi nào | Việc |
|---|---|
| Hằng ngày 08:00 | Telegram/Uptime Kuma không có cảnh báo · backup đêm qua có trong `ls -lt /srv/vsn/backups \| head -3` |
| Hằng tuần | `df -h /` < 70% · `dc ps` đủ 6 dịch vụ `Up` · xem *Hệ thống → Audit log* lọc `DB_TRUC_TIEP` (phải trống) |
| Hằng tháng | Diễn tập khôi phục (mục 4.4 ③), lưu biên bản `/srv/vsn/backups/bien-ban/` · báo cáo uptime `[R 2.5]` · `docker image prune` (mục 4.3) |
| Hằng quý | Đổi `UPTIME_TOKEN`, PAT GHCR · rà danh sách tài khoản Superadmin / IT_HR |

---

## 4. Sự cố

### 4.1 Server khởi động lại (mất điện, Windows Update)

Kiểm tra **theo thứ tự**, dừng ở bước đầu tiên hỏng:

1. Windows lên chưa → Hyper-V Manager: VM `vsn-sanluong` *Running* (WSL: `wsl -l -v` → `VSN-SanLuong` *Running*; không chạy →
   `Start-ScheduledTask VSN-WSL`). Task chạy vòng lặp `giu-wsl.ps1`: WSL bị tắt (Docker Desktop khởi động lại, `wsl --shutdown`,
   cập nhật) thì ~20 giây sau tự bật lại; mỗi lần ghi 1 dòng vào `%LOCALAPPDATA%\VSN\giu-wsl.log` — nhiều dòng/ngày = có thứ
   liên tục tắt WSL (thường là Docker Desktop trên máy dev) → nên chuyển sang server riêng (mục 6).
   Task kiểu "khi đăng nhập" (`-KhiDangNhap`): sau khi khởi động lại phải có người đăng nhập Windows thì hệ thống mới chạy.
2. SSH vào được → `timedatectl` (giờ đúng, *NTP synchronized: yes* — sai giờ làm sai "ngày làm việc").
3. `systemctl is-active docker` → `active`.
4. `dc ps` — 6 dịch vụ `Up`, postgres `(healthy)`. Thiếu → `dc up -d`.
5. Health chi tiết (bảng mục 0) → `"db":"ok"`, đúng phiên bản.
6. Từ điện thoại 4G mở `https://sanluong.vsn-dn.com` → không vào được mà bước 5 OK → mục 4.2.
7. Báo nhóm tổ trưởng: hệ thống đã chạy lại; số đã Lưu trước sự cố không mất. Ai bấm Lưu đúng lúc sập → mở app kiểm tra, Lưu lại.

### 4.2 Tunnel mất kết nối (ngoài mạng không vào được, trong server vẫn chạy)

```bash
dc logs cloudflared --since 30m | tail -30
dc restart cloudflared
```
- Log báo token sai / tunnel bị xóa → Cloudflare Zero Trust → Tunnels → `vsn-sanluong` → lấy token mới → sửa `TUNNEL_TOKEN` trong `.env` → `dc up -d cloudflared`.
- Tunnel *Healthy* nhưng vẫn lỗi → kiểm tra Public hostname trỏ `http://caddy:80`, DNS `sanluong` là CNAME của tunnel, Cloudflare không bật "Under Attack".
- Mạng công ty mất Internet → chờ; công nhân Lưu lỗi sẽ thấy "Chưa lưu được – kiểm tra mạng" và số vẫn giữ trên màn hình, có mạng thì bấm **Thử lại**.

### 4.3 Ổ đĩa đầy (cảnh báo ≥ 80%)

```bash
df -h /
docker system df
du -sh /srv/vsn/backups/* | sort -h | tail
```
Dọn theo thứ tự (an toàn → cần cân nhắc):
1. Image cũ: `docker image prune -a` — xóa image không còn container dùng. **Trước đó** ghi lại tag đang chạy và tag trước (để rollback còn tải lại được từ GHCR).
2. `/srv/vsn/backups/truoc-khoi-phuc/` — dump tạo khi khôi phục, xóa khi đã chắc chắn không cần.
3. Backup đêm: giữ 30 bản (`BACKUP_GIU`); giảm tạm xuống 14 nếu cần (bản cloud vẫn giữ 30 ngày).
4. Log Docker đã giới hạn 20 MB × 5 file/dịch vụ — không cần dọn.
5. Vẫn thiếu → **nới đĩa**: Hyper-V `Resize-VHD -Path <vhdx> -SizeBytes 200GB` (VM tắt hoặc VHDX hỗ trợ online) → trong Ubuntu `sudo growpart /dev/sda 3 && sudo resize2fs /dev/sda3` (kiểm tên phân vùng bằng `lsblk`; LVM thì `pvresize` + `lvextend -r`).

PostgreSQL đã dừng vì đầy đĩa → giải phóng chỗ trước, rồi `dc restart postgres` → `dc restart api` → mục 4.1 bước 5.

### 4.4 Khôi phục từ backup

Chọn nguồn **gần nhất với thời điểm sự cố** còn dùng được:

| Nguồn | Khi nào | Cần private key? |
|---|---|---|
| ① Dump trước deploy `truoc-deploy/*.dump` | Deploy làm hỏng dữ liệu | Không |
| ② Backup đêm trên server `vsn-*.dump.gpg` | DB hỏng / xóa nhầm, server còn | Có |
| ③ Backup trên cloud | Mất cả server | Có |

Private key `backup.priv.asc` + passphrase: USB trong két + bản của IT trưởng (mục 5, cách tạo: `infra/backup/khoa/README.md`). Chép vào thư mục tạm trên server, **xóa ngay sau khi xong**.

```bash
dc stop api                                                   # dừng ghi; Web/app báo lỗi tạm thời
export POSTGRES_PASSWORD="$(grep ^POSTGRES_PASSWORD= .env | cut -d= -f2-)"
read -rsp "Passphrase private key backup: " GPG_PASSPHRASE; echo; export GPG_PASSPHRASE   # bỏ qua với ①

# ① dump trước deploy (không cần key)
dc run --rm --no-deps -e POSTGRES_PASSWORD backup khoi-phuc.sh /backups/truoc-deploy/truoc-deploy-vX.Y.Z-YYYYMMDD-HHMMSS.dump
# ② bản đêm mới nhất trên server        (hoặc thay moi-nhat bằng /backups/vsn-YYYYMMDD-HHMMSS.dump.gpg)
dc run --rm --no-deps -e POSTGRES_PASSWORD -e GPG_PASSPHRASE -v /tmp/khoa:/khoa:ro backup khoi-phuc.sh moi-nhat /khoa/backup.priv.asc
# ③ bản mới nhất trên cloud
dc run --rm --no-deps -e POSTGRES_PASSWORD -e GPG_PASSPHRASE -v /tmp/khoa:/khoa:ro backup khoi-phuc.sh cloud /khoa/backup.priv.asc

dc up -d api
shred -u /tmp/khoa/*; unset POSTGRES_PASSWORD GPG_PASSPHRASE
```
`khoi-phuc.sh` từ chối chạy khi api còn kết nối, **tự dump bản hiện tại** vào `/backups/truoc-khoi-phuc/` (khôi phục nhầm vẫn quay lại được),
hỏi gõ `KHOI PHUC`, rồi khôi phục trong 1 transaction (lỗi giữa chừng = không đổi gì), giữ nguyên phân quyền 3 tài khoản DB.

Sau khôi phục: đăng nhập kiểm tra Bảng sản lượng ngày → báo tổ trưởng **khoảng thời gian bị mất** (từ giờ của bản backup đến lúc sự cố):
công nhân mở app Lưu lại (số là tổng tích lũy nên Lưu lại là đủ), ngày đã qua thì tổ trưởng nhập hộ.

**Mất cả server** (đã diễn tập trên volume trống): dựng server mới theo mục 1 bước 1–8, dùng `.env` đã cất ở mục 5 (KHÔNG chạy
`khoi-tao.sh` — nó tạo mật khẩu mới) → `docker login ghcr.io` → `dc pull` → `dc up -d --wait postgres` (tạo 3 tài khoản DB từ `.env`)
→ khôi phục ③ (bản dump chứa cả schema + phân quyền, không cần migrate trước) → `dc up -d` → mục 4.1 bước 5–7.
`khoi-phuc.sh` kiểm tra lại phân quyền sau khi khôi phục; báo `PHÂN QUYỀN … KHÔNG ĐÚNG` thì **không** mở api, gọi IT chính.

**Diễn tập (không đụng DB thật)** — hằng tháng:
```bash
read -rsp "Passphrase private key backup: " GPG_PASSPHRASE; echo; export GPG_PASSPHRASE
dc run --rm --no-deps -e GPG_PASSPHRASE -v /tmp/khoa:/khoa:ro backup restore-test.sh moi-nhat /khoa/backup.priv.asc   # → KẾT QUẢ: ĐẠT
unset GPG_PASSPHRASE; shred -u /tmp/khoa/*
```

### 4.5 Rollback bản deploy

```bash
./infra/deploy.sh v<tag trước> --gap
```
Migration chỉ-thêm `[TDD 17.3]` nên code cũ chạy được trên DB mới — **không** cần khôi phục DB khi rollback. Tag cũ xem ở `grep 'Đã deploy' /srv/vsn/deploy.log | tail`.

**Migration lỗi** (deploy dừng ở bước 3, bản cũ vẫn chạy bình thường):
```bash
dc run --rm --no-deps -e MIGRATE_DATABASE_URL="postgresql://vsn_migrate:$(grep ^VSN_MIGRATE_PASSWORD= .env | cut -d= -f2-)@postgres:5432/vsn_sanluong" \
  api node_modules/.bin/prisma migrate status
```
Mỗi migration chạy trong transaction nên phần lỗi đã được hoàn tác; Prisma đánh dấu nó *failed*. Báo dev sửa → phát hành tag mới. Trước khi
deploy tag mới: `… prisma migrate resolve --rolled-back <tên migration>` (cùng lệnh trên, thay `migrate status`). Không chắc chắn → khôi phục ① rồi mới làm.

### 4.6 Tài khoản: thu hồi phiên TV · mở khóa · đặt lại mật khẩu

| Việc | Ai làm, ở đâu |
|---|---|
| Thu hồi phiên TV (TV mất / lộ) | Superadmin → *Hệ thống → Tài khoản* → dòng TV → ⋯ → **Thu hồi phiên TV** (hoặc *Cài đặt → Phiên TV*) |
| Tài khoản bị khóa (sai mật khẩu 5 lần) | Tự mở sau 15 phút; cần ngay → Superadmin **Đặt lại mật khẩu** (mở khóa luôn) |
| Quên mật khẩu | Superadmin → ⋯ → **Đặt lại mật khẩu** → mật khẩu tạm, bắt buộc đổi ở lần đăng nhập sau, mọi phiên cũ bị thu hồi |
| Công nhân đăng nhập nhầm trạm / giữ trạm | Tổ trưởng → *Sơ đồ trạm trực tiếp* → trạm → **Đăng xuất hộ** (có lý do) |
| **Superadmin duy nhất** quên mật khẩu / bị khóa | Lệnh trên server (dưới) — có audit `DAT_LAI_MAT_KHAU` (HE_THONG) |

```bash
read -rsp 'Mật khẩu tạm (≥ 8 ký tự, có chữ và số): ' VSN_MAT_KHAU_TAM; echo; export VSN_MAT_KHAU_TAM
dc run --rm --no-deps -T -e VSN_MAT_KHAU_TAM api node dist/seed/dat-lai-superadmin.js <tên đăng nhập>
unset VSN_MAT_KHAU_TAM
```
Luôn duy trì **ít nhất 2 tài khoản Superadmin** (IT chính + IT thứ hai) để không phải dùng lệnh này.

### 4.7 Tra lỗi theo mã lỗi người dùng báo

Lỗi hệ thống hiện kèm **mã lỗi 8 ký tự**, vd. *"Có lỗi xảy ra, vui lòng thử lại. (mã lỗi 5344F879)"*. Xin người báo: mã lỗi, giờ, màn hình, mã NV / tên đăng nhập.

```bash
dc logs api --since 24h | grep -i 5344f879
```
Dòng log có `route`, `nguoiThucHienId` / `thietBiId`, `status`, `responseTime`; lỗi 500 có thêm dòng `"Lỗi hệ thống"` với stack. Cùng mã đó
tìm được trong Sentry (tag `traceId`) và trong *Hệ thống → Audit log* (Trace ID) nếu thao tác có ghi audit.
Lỗi nghiệp vụ (ngày đã chốt, sai mã NV…) không có mã — câu báo tiếng Việt đã nói rõ cách xử lý.

### 4.8 Công nhân không đăng nhập trạm được hàng loạt

- *"Không xác minh được thiết bị"* / lỗi Turnstile → `TURNSTILE_SECRET` sai hoặc site key trong bản build không khớp domain → Cloudflare Turnstile kiểm tra.
- Bị chặn 429 ngay cả lần đầu → rule rate limit Cloudflare cho `/api/cn/phien-tram` đặt quá thấp (nhiều người chung IP 4G).
- *"Ngày đã chốt"* sáng sớm → tổ trưởng chốt nhầm ngày hôm nay? Không có bỏ chốt — tổ trưởng nhập hộ phần còn lại.

### 4.9 Lưu chậm / lỗi giờ tan ca

`dc logs api --since 30m | grep -c '"status":5'` và Sentry. `P2028` (hết chờ kết nối pool) → báo dev; tạm thời tăng `DB_POOL_MAX` lên 30 trong
`.env` → `dc up -d api`. Kết quả đo tuần 12: [HIEU-NANG.md](HIEU-NANG.md).

---

## 5. Danh bạ & nơi cất mật khẩu

| Vai trò | Tên | Điện thoại / Zalo | Ghi chú |
|---|---|---|---|
| IT chính | Duy | | Superadmin, giữ private key backup |
| IT thứ hai | *(điền sau buổi đào tạo)* | | Superadmin, xem [DAO-TAO-IT.md](DAO-TAO-IT.md) |
| Quản lý sản xuất | | | Quyết định giờ deploy, thông báo tổ trưởng |
| HR | | | Khóa sổ / xuất lương |
| Nhà mạng Internet công ty | | | Mất Internet |
| Tài khoản Cloudflare (chủ) | | | Tunnel, Turnstile |
| Tài khoản GitHub (chủ repo) | Parabui | | Release, GHCR |

| Bí mật | Cất ở đâu (≥ 2 nơi, không cùng chỗ với server) |
|---|---|
| Bản sao `.env` (mật khẩu `postgres`, 3 tài khoản DB, `UPTIME_TOKEN`, `TUNNEL_TOKEN`, `TURNSTILE_SECRET`) | Trình quản lý mật khẩu của IT + phong bì niêm phong trong két |
| **Private key backup** `backup.priv.asc` + passphrase | USB mã hóa trong két + bản của IT trưởng. Mất key = **mọi backup mã hóa không mở được** |
| PAT GHCR `read:packages` | Trình quản lý mật khẩu (tạo lại được) |
| Bot Telegram, Sentry, Cloudflare, rclone | Trình quản lý mật khẩu |
| Mật khẩu Superadmin | Mỗi người tự giữ của mình — không ghi chung |

---

## 6. Chuyển sang máy khác (laptop tạm → server thật, server cũ → mới)

Không phải đổi IP / DNS / Uptime Kuma: Cloudflare Tunnel đi **chiều ra**, máy nào chạy `cloudflared` với `TUNNEL_TOKEN` thì máy đó phục vụ.
⚠ **Không bao giờ để 2 máy cùng chạy** — 2 máy cùng token thì Cloudflare chia request cho cả hai, số Lưu rơi vào 2 DB khác nhau.
Làm ngoài giờ (23:00–05:00), báo tổ trưởng trước. Thời gian dừng: 10–20 phút (đã diễn tập: xuất 15 s, nhập 40 s với DB nhỏ — chủ yếu là thời gian chép file).

### Cách A — `chuyen-may.sh` (khuyến nghị, đích nào cũng được: WSL2, VM Hyper-V, Ubuntu thật)

1. **Máy mới** chuẩn bị trước (lúc nào cũng được, không ảnh hưởng máy cũ): mục 1 bước 1–3 (WSL2: `tao-wsl-vsn.ps1`; VM: `tao-vm-hyperv.ps1`
   + `cai-dat-ubuntu.sh`) và `docker login ghcr.io`. Không chạy `khoi-tao.sh`.
2. **Máy cũ:**
   ```bash
   cd /srv/vsn/app && ./infra/chuyen-may.sh xuat
   ```
   Dừng ghi → dump toàn bộ DB (giữ phân quyền) + `.env` + `infra/` + rclone/dozzle → 1 file mã hóa AES-256 bằng **mật khẩu gói** bạn đặt
   (`/srv/vsn/chuyen-may/vsn-chuyen-may-<giờ>.tar.gz.gpg` + `.sha256`) → đánh dấu máy cũ *ĐÃ CHUYỂN* (deploy.sh / khoi-tao.sh từ chối chạy) → dừng hẳn.
   WSL2 → lấy file ra Windows: `\\wsl$\VSN-SanLuong\srv\vsn\chuyen-may\`.
3. Chép **file gói + `.sha256` + `infra/chuyen-may.sh`** sang máy mới (USB, mạng nội bộ). File chứa mật khẩu DB và toàn bộ dữ liệu — đã mã
   hóa, nhưng vẫn xóa khỏi USB sau khi xong.
4. **Máy mới:**
   ```bash
   bash chuyen-may.sh nhap vsn-chuyen-may-<giờ>.tar.gz.gpg
   ```
   Kiểm mã sha256 → giải mã vào `/srv/vsn/app` → tải image đúng tag cũ → PostgreSQL trên volume trống → khôi phục (kiểm phân quyền) →
   khởi động → **so số dòng 9 bảng chính với lúc xuất** → chờ health đúng phiên bản. Báo `KHỚP` + `✅` mới coi là xong.
5. Điện thoại 4G mở domain, đăng nhập `/quanly`, xem Bảng sản lượng ngày hôm nay. WSL2 → `wsl-tu-khoi-dong.ps1`; Hyper-V → Automatic Start.
6. Giữ máy cũ **tắt** ít nhất 1 tuần làm đường lui.

**Máy mới lỗi → quay về máy cũ** (dữ liệu trên máy cũ nguyên vẹn vì đã dừng ghi trước khi xuất): máy mới `dc down` (dừng hẳn) → máy cũ
`rm /srv/vsn/DA-CHUYEN-MAY.txt && dc up -d`. Nhập lỗi giữa chừng → script in sẵn lệnh dọn máy mới để chạy lại.
**Quên mật khẩu gói** → gói vô dụng, nhưng máy cũ còn nguyên: quay về máy cũ như trên rồi xuất lại.

### Cách B — chép nguyên distro WSL2 (chỉ khi máy mới cũng là Windows + WSL2)

Đơn giản nhất về thao tác nhưng file lớn (cả hệ điều hành + image Docker, vài GB) và không kiểm số dòng:
```powershell
# máy cũ (PowerShell Admin)
wsl --terminate VSN-SanLuong
wsl --export VSN-SanLuong E:\vsn-sanluong.tar          # hoặc --format vhd → .vhdx, nhanh hơn
# máy mới
wsl --import VSN-SanLuong D:\WSL\VSN-SanLuong E:\vsn-sanluong.tar
.\infra\server\wsl-tu-khoi-dong.ps1
```
Sau khi import **xóa hoặc tắt hẳn** distro trên máy cũ (`wsl --unregister VSN-SanLuong` — chỉ khi máy mới đã chạy ổn 1 tuần) và
gỡ Scheduled Task `VSN-WSL` trên máy cũ để nó không tự bật lại.
