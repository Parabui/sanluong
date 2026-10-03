# Khóa GPG cho backup [D24] [TDD 15.1]

Thư mục này chỉ chứa **public key** `backup.pub.asc` (đặt trên server khi cài, không commit vào repo).

- Tạo cặp khóa trên **máy IT** (không phải server), private key cất trong sổ mật khẩu IT + một bản in niêm phong:
  ```bash
  gpg --quick-gen-key "VSN backup <backup@vsn-dn>" default default never
  gpg --armor --export backup@vsn-dn > backup.pub.asc            # → chép lên server, thư mục này
  gpg --armor --export-secret-keys backup@vsn-dn > backup.priv.asc # → KHÔNG BAO GIỜ đưa lên server
  ```
- Server chỉ mã hóa → kẻ chiếm được server không giải mã được backup trên cloud; mất server vẫn khôi phục được.
- Diễn tập khôi phục: IT mang `backup.priv.asc` vào container tạm (`restore-test.sh`), xong thì container tự xóa.
