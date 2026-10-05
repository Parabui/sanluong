# Image vsn-web: Caddy 2 + file build của worker và web [TDD 2.1]
# Build từ gốc repo: docker build -f infra/caddy/Dockerfile -t vsn-web:<tag> .
FROM node:26-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
# Biến VITE_* được NHÚNG vào bundle lúc build (release.yml truyền --build-arg từ Actions Variables).
# Không phải bí mật: site key Turnstile, DSN Sentry ai mở trang cũng thấy. Thiếu site key → app công nhân gửi token
# Turnstile rỗng → server production từ chối mọi lần đăng nhập trạm ("Không xác minh được thiết bị").
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_SENTRY_DSN=""
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY VITE_SENTRY_DSN=$VITE_SENTRY_DSN
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @vsn/shared build \
 && pnpm --filter @vsn/worker --filter @vsn/web build

FROM caddy:2-alpine
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/worker/dist /srv/worker
COPY --from=build /repo/apps/web/dist /srv/web
