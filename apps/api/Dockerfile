# Image vsn-api (Node 24 LTS) [TDD 2.1]
# Build từ gốc repo: docker build -f apps/api/Dockerfile -t vsn-api:<tag> .
# Migration chạy ở bước deploy, KHÔNG chạy lúc khởi động:
#   docker run --rm -e MIGRATE_DATABASE_URL=... vsn-api:<tag> npx prisma migrate deploy
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @vsn/shared build \
 && pnpm --filter @vsn/api build \
 && pnpm --filter @vsn/api deploy --prod /out

FROM node:24-slim
ENV NODE_ENV=production TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
