# VSN Sản Lượng

Hệ thống ghi sản lượng công nhân để tính lương — PWA công nhân + Web quản lý + TV xưởng.

- Nghiệp vụ: [docs/PRD.md](docs/PRD.md) · Kỹ thuật: [docs/TDD.md](docs/TDD.md) · Giao diện mẫu: [ui-demo/](ui-demo/)

## Cấu trúc (TDD mục 4)

```
apps/
  api/        NestJS 11 + Prisma 7 (PostgreSQL 17)        → /api
  worker/     PWA công nhân — React 19 + Vite 8           → /
  web/        Web quản lý + TV — React 19 + Vite 8        → /quanly
packages/
  shared/     Zod schema, mã lỗi, ChucNang, PhamVi, ngày làm việc, format VN, fetch client
  ui/         Design token (từ ui-demo) + preset Tailwind 3.4 + component dùng chung
infra/        compose.yml (dev) · compose.prod.yml · Caddyfile · khởi tạo tài khoản DB
ui-demo/      Prototype Next.js (không thuộc workspace) — nguồn giao diện để chuyển sang
```

## Chạy dev

Yêu cầu: Node 24, pnpm (qua corepack), Docker Engine.

```bash
corepack enable
pnpm install
cp .env.example .env        # đổi mật khẩu
pnpm db:up                  # PostgreSQL 17 trong Docker (127.0.0.1:5432)
pnpm dev                    # shared (watch) + api :4000 + web :5173 + worker :5174
```

- Web quản lý: http://localhost:5173/quanly/ · App công nhân: http://localhost:5174/
- Vite proxy `/api` → `localhost:4000`.
- Cổng 5432 đã bị chiếm → đặt `VSN_PG_PORT` trong `.env` (vd. `5433`) và sửa cổng trong `DATABASE_URL`, `MIGRATE_DATABASE_URL`.
- Lần đầu: `pnpm --filter @vsn/api db:migrate` để tạo bảng.

## Cơ sở dữ liệu

- Schema: [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma). Ràng buộc nâng cao (partial unique, CHECK, EXCLUDE, trigger, view công thức, phân quyền DB) viết bằng SQL tay **trong file migration** — xem phần 2 của [migration khởi tạo](apps/api/prisma/migrations/).
- Thêm thay đổi: sửa `schema.prisma` → `pnpm --filter @vsn/api exec prisma migrate dev --create-only --name <ten>` → bổ sung SQL tay nếu cần → `pnpm --filter @vsn/api db:migrate`.
- `pnpm test:int` cần Docker đang chạy: dựng PostgreSQL 17 riêng (Testcontainers), chạy migration thật và **dừng nếu `schema.prisma` lệch với migration**.

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Chạy cả 3 app + build watch `shared` |
| `pnpm lint` · `pnpm typecheck` | ESLint (có luật riêng D5, giới hạn import worker) · tsc |
| `pnpm test` | Unit test (Vitest) |
| `pnpm test:int` | Test tích hợp với PostgreSQL thật (Testcontainers) |
| `pnpm build` | Build mọi app |
| `pnpm --filter @vsn/worker check:bundle` | Kiểm tra app công nhân ≤ 180 KB gzip |
| `pnpm --filter @vsn/api db:migrate` | `prisma migrate dev` (tài khoản `vsn_migrate`) |
