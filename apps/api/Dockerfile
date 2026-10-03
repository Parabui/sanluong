# Image vsn-api (Node 24 LTS) [TDD 2.1]
# Build từ gốc repo: docker build -f apps/api/Dockerfile -t vsn-api:<tag> .
# Migration chạy ở bước deploy (infra/deploy.sh), KHÔNG chạy lúc khởi động:
#   docker compose run --rm -e MIGRATE_DATABASE_URL api node_modules/.bin/prisma migrate deploy
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
# Seed perf / e2e chỉ dành cho DB thử (ghi SQL trực tiếp) — xóa khỏi bản production
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @vsn/shared build \
 && pnpm --filter @vsn/api build \
 && pnpm --filter @vsn/api deploy --prod /out \
 && rm -f /out/dist/seed/perf.* /out/dist/seed/e2e.*

FROM node:24-slim
# OpenSSL cho schema engine của `prisma migrate deploy` (bước deploy)
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
