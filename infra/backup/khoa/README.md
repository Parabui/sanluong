# Khóa GPG cho backup [D24] [TDD 15.1]

Backup đêm được **mã hóa bằng public key** trước khi ghi ra đĩa / đẩy lên cloud. Chỉ ai có **private key** (+ passphrase) mới mở được.

| File | Ở đâu | Ghi chú |
|---|---|---|
| `backup.pub.asc` | Thư mục này **trên máy production** (`/srv/vsn/app/infra/backup/khoa/`) | Không bí mật. Không commit (đã có trong .gitignore) |
| `backup.priv.asc` | USB cất két + trình quản lý mật khẩu của IT — **không bao giờ** trên máy production | Mất = mọi backup mã hóa không mở được |
| Passphrase | Trình quản lý mật khẩu, **tách** khỏi USB | Nhặt được USB mà không có passphrase thì vô dụng |

Kẻ chiếm được máy production chỉ thấy public key → không giải mã được backup trên cloud; mất máy vẫn khôi phục được bằng private key.

## Tạo cặp khóa (1 lần, ~5 phút)

Windows: mở **Git Bash** (Git for Windows có sẵn `gpg`). Linux/macOS: terminal.

```bash
mkdir -p ~/vsn-khoa && cd ~/vsn-khoa

# 1. Tạo khóa — hỏi passphrase: đặt ≥ 16 ký tự, ghi ngay vào trình quản lý mật khẩu
gpg --pinentry-mode loopback --quick-gen-key "VSN backup <backup@vsn-dn.com>" default default never

# 2. Xuất public key (đưa lên máy production) và private key (cất đi) — bước 2 hỏi lại passphrase
gpg --armor --export backup@vsn-dn.com > backup.pub.asc
gpg --pinentry-mode loopback --armor --export-secret-keys backup@vsn-dn.com > backup.priv.asc

# 3. Thử: mã hóa bằng public key → giải mã bằng private key → phải in ra "thu-ok"
echo thu-ok | gpg --batch --yes --trust-model always --recipient-file backup.pub.asc --encrypt > thu.gpg
gpg --pinentry-mode loopback --decrypt thu.gpg && rm thu.gpg
```

## Cất private key

1. Chép `backup.priv.asc` vào **USB** (nên 2 USB: 1 trong két, 1 do IT trưởng giữ) **và** đính kèm vào trình quản lý mật khẩu (file văn bản nhỏ).
2. Mở lại từ USB thử 1 lần (`gpg --show-keys /đường/dẫn/usb/backup.priv.asc` → thấy `VSN backup`).
3. **Xóa private key khỏi máy tạo khóa** nếu máy đó là / sẽ là máy production (laptop tạm hiện tại):
   ```bash
   gpg --delete-secret-keys backup@vsn-dn.com     # xác nhận 2 lần
   rm ~/vsn-khoa/backup.priv.asc
   ```
   Giữ lại `backup.pub.asc` để chép lên máy production.

## Dùng khi nào

- **Cài đặt** (RUNBOOK mục 1 bước 5): chép `backup.pub.asc` vào thư mục này trên máy production. WSL2:
  `\\wsl$\VSN-SanLuong\srv\vsn\app\infra\backup\khoa\backup.pub.asc`. Thiếu file → `deploy.sh` dừng ngay từ bước kiểm tra.
- **Diễn tập / khôi phục** (RUNBOOK 4.4): cắm USB, chép `backup.priv.asc` vào thư mục tạm (vd. `/tmp/khoa`), chạy kèm
  `-e GPG_PASSPHRASE` (hoặc nhập khi được hỏi) → xong thì `shred -u /tmp/khoa/*`.
- **Đổi khóa** (lộ private key / IT nghỉ việc): tạo cặp mới, thay `backup.pub.asc` trên máy production → `dc restart backup`.
  Bản backup cũ vẫn chỉ mở được bằng private key **cũ** — giữ khóa cũ tới khi các bản cũ hết hạn (30 ngày).
