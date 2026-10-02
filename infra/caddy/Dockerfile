# Image vsn-web: Caddy 2 + file build của worker và web [TDD 2.1]
# Build từ gốc repo: docker build -f infra/caddy/Dockerfile -t vsn-web:<tag> .
FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @vsn/shared build \
 && pnpm --filter @vsn/worker --filter @vsn/web build

FROM caddy:2-alpine
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/worker/dist /srv/worker
COPY --from=build /repo/apps/web/dist /srv/web
