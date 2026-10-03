# Rà checklist bảo mật — TDD §19 (tuần 11, 02/10/2026)

✅ đã có và có kiểm chứng · 🟡 có trong cấu hình, cần làm/kiểm khi dựng production (tuần 13) · ❌ chưa có

| # | Mục | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | HTTPS toàn trình (Cloudflare), không mở cổng vào server | 🟡 | `compose.prod.yml`: chỉ `cloudflared` ra ngoài; Caddy/ Dozzle bind `127.0.0.1`. Kiểm khi dựng server (tuần 13): firewall chặn mọi cổng vào |
| 2 | Cookie `HttpOnly; Secure; SameSite=Strict`, token lưu dạng hash | ✅ | `phien-web.service.ts`, `thiet-bi.service.ts` (SHA-256); test `cong-nhan.test.ts` kiểm cờ cookie `vsn_tb` |
| 3 | Header `X-VSN-Client` bắt buộc cho request ghi | ✅ | `client-header.guard.ts` (POST/PUT/PATCH/DELETE) |
| 4 | Caddy: CSP (self + Sentry), nosniff, Referrer-Policy, Permissions-Policy (camera chỉ worker) | ✅ | `infra/caddy/Caddyfile`; đã chạy thử bản build qua Caddy: 2 app hiển thị bình thường, không vi phạm CSP. Thêm `X-Frame-Options DENY`, CSP riêng cho `/api` (`default-src 'none'`) |
| 5 | Guard mặc định từ chối, test ma trận quyền xanh | ✅ | `quyen.guard.ts`; `test/quyen/ma-tran.test.ts` (mọi route × 8 vai trò; route mới chưa khai báo → đỏ) |
| 6 | SQL tay dùng tham số, không nối chuỗi | ✅ | Không có `$queryRawUnsafe` / `$executeRawUnsafe` / `Prisma.raw` trong `apps/api/src`; mọi `$queryRaw` là tagged template |
| 7 | Upload: `.xlsx`, ≤ 10 MB, ≤ 5.000 dòng, magic bytes, không lưu đĩa | ✅ | `import/kiem-tra-file.ts`, `doc-xlsx.ts` (đọc trong bộ nhớ); test import trong `nhan-vien.test.ts` |
| 8 | Chống zip bomb: thư mục trung tâm ≤ 50 MB · dừng ở dòng 5.001 · `mem_limit` api | 🟡 | 50 MB: `kiem-tra-file.ts` (kiểm trước khi giải nén). **Lệch TDD**: không dùng `WorkbookReader` stream (lỗi ExcelJS, đổi sang `xlsx.load()` trong bộ nhớ ở tuần 3) — chặn khi vượt 5.000 dòng sau khi đọc; bộ nhớ đã được giới hạn bởi mốc 50 MB + `mem_limit: 2g` |
| 9 | Giới hạn sai: Web 5 lần / 15 phút / tài khoản · trạm 10 lần / 10 phút / thiết bị | ✅ | `auth.service.ts`, `gioi-han-sai.service.ts`; test `auth.test.ts`, `cong-nhan.test.ts` |
| 10 | Turnstile · rate rule Cloudflare `/api/cn/phien-tram` · ≤ 3 lần chuyển thiết bị · cờ "nhiều thiết bị" | 🟡 | Turnstile + 3 lần + cờ: ✅ (test). **Sửa tuần 11**: `compose.prod.yml` trước đây KHÔNG truyền `TURNSTILE_SECRET` vào api → production sẽ từ chối mọi đăng nhập trạm. Rate rule Cloudflare: cấu hình trên dashboard khi dựng production |
| 11 | Phiên Web tối đa 12 giờ, polling không gia hạn · TV chỉ từ IP nhà máy | ✅ | `phien-web.service.ts`; **tuần 11**: hook `useDuLieuTrucTiep` và pill "ngày chưa chốt" gửi `X-VSN-Polling: 1`; IP nhà máy sửa ở Cài đặt → Phiên TV |
| 12 | Dozzle bind `127.0.0.1`, có xác thực, qua SSH tunnel | 🟡 | `compose.prod.yml` (`DOZZLE_AUTH_PROVIDER=simple`); tạo `users.yml` khi dựng server |
| 13 | `/api/health` công khai chỉ trả `{ ok }` | ✅ | `health.controller.ts`; test `he-thong.test.ts`. `/api/health/chi-tiet` cần `X-Uptime-Token` hoặc Superadmin |
| 14 | 4 tài khoản DB tách quyền, mật khẩu `postgres` không nằm trên server | 🟡 | `postgres/init/01-tai-khoan.sh` + REVOKE trong migration; test ràng buộc DB. **Khi dựng server**: `POSTGRES_PASSWORD` chỉ cần lúc khởi tạo volume lần đầu → xóa khỏi `.env` sau đó, cất vào sổ mật khẩu |
| 15 | Secret trong `.env` quyền 600, không commit; repo có `.env.example` | ✅ | `.gitignore` (`.env`, `.env.*`, `!.env.example`); khóa backup `infra/backup/khoa/*.asc` cũng bị bỏ qua. `chmod 600 .env` ghi trong RUNBOOK (tuần 13) |
| 16 | Dependabot · `pnpm audit` trong CI (chỉ cảnh báo) | ✅ | `.github/dependabot.yml` (tuần 11); `ci.yml` bước `pnpm audit --prod` `continue-on-error` |
| 17 | Backup mã hóa bằng public key GPG; private key không trên server | ✅ | `infra/backup/backup.sh` (`--recipient-file` public key), `restore-test.sh` (private key chỉ trong container tạm); đã diễn tập trên dev → ĐẠT |

**Phát hiện thêm khi rà (đã sửa trong tuần 11)**
- `compose.prod.yml` thiếu `TURNSTILE_SECRET`, `SENTRY_DSN`, `UPTIME_TOKEN` cho api (mục 10).
- Polling sơ đồ trạm (5 giây) trước đây gia hạn phiên Web → phiên tổ trưởng để mở màn hình không bao giờ hết hạn khi không thao tác (mục 11).

**Còn lại cho tuần 13 (dựng production)**: firewall, rate rule Cloudflare, `users.yml` Dozzle, xóa `POSTGRES_PASSWORD` khỏi `.env`, `chmod 600 .env`, tạo cặp khóa GPG thật trên máy IT.
