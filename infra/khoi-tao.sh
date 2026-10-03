#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# khoi-tao.sh — cài production LẦN ĐẦU trên server đã chạy infra/server/cai-dat-ubuntu.sh [TDD 17.2] [D1b].
#   cd /srv/vsn/app && tar -xzf vsn-trien-khai-v0.1.0.tar.gz && ./infra/khoi-tao.sh v0.1.0
#
# Lần chạy 1: chưa có .env → tạo .env (quyền 600) với mật khẩu DB / UPTIME_TOKEN ngẫu nhiên, rồi DỪNG để bạn điền
#             TUNNEL_TOKEN, TURNSTILE_SECRET, TELEGRAM_*, RCLONE_DICH, SENTRY_DSN, UPTIME_*_PUSH_URL.
# Lần chạy 2: kiểm tra → hỏi tên + mật khẩu TẠM của Superadmin (không ghi ra file) → deploy.sh <tag> --lan-dau
#             (PostgreSQL tạo 3 tài khoản tách quyền → migration → seed → khởi động toàn bộ).
# Từ chối chạy nếu DB đã có dữ liệu — lần sau dùng infra/deploy.sh.
# ════════════════════════════════════════════════════════════════
set -Eeuo pipefail

THU_MUC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$THU_MUC"
ENV_FILE="${VSN_ENV_FILE:-$THU_MUC/.env}"
TAG="${1:-}"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "Dùng: ./infra/khoi-tao.sh v0.1.0" >&2; exit 2; }
shift

for lenh in docker curl openssl; do command -v "$lenh" >/dev/null || { echo "Thiếu lệnh: $lenh (chạy infra/server/cai-dat-ubuntu.sh trước)" >&2; exit 1; }; done
docker compose version >/dev/null 2>&1 || { echo "Thiếu docker compose v2" >&2; exit 1; }

ngau_nhien() { openssl rand -hex "${1:-24}"; } # chỉ [0-9a-f] → đặt thẳng vào URL kết nối không cần mã hóa
dat_env() { # dat_env KHOA GIA_TRI — thay dòng cũ hoặc thêm cuối file
  if grep -qE "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}
doc_env() { local v; v="$(grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-)"; v="${v%\"}"; v="${v#\"}"; printf '%s' "$v"; }

# ── Lần 1: tạo .env ──
if [[ ! -f "$ENV_FILE" ]]; then
  [[ -f .env.example ]] || { echo "Không thấy .env.example — giải nén đủ gói triển khai vào $THU_MUC" >&2; exit 1; }
  ( umask 077; cp .env.example "$ENV_FILE" )
  app="$(ngau_nhien)" mig="$(ngau_nhien)"
  dat_env POSTGRES_PASSWORD "$(ngau_nhien)"
  dat_env VSN_APP_PASSWORD "$app"
  dat_env VSN_MIGRATE_PASSWORD "$mig"
  dat_env VSN_BACKUP_PASSWORD "$(ngau_nhien)"
  dat_env DATABASE_URL "postgresql://vsn_app:$app@postgres:5432/vsn_sanluong"
  dat_env MIGRATE_DATABASE_URL "postgresql://vsn_migrate:$mig@postgres:5432/vsn_sanluong"
  dat_env UPTIME_TOKEN "$(ngau_nhien 32)"
  dat_env VSN_TAG ""
  dat_env VSN_REGISTRY "${VSN_REGISTRY:-ghcr.io/parabui}"
  dat_env LOG_LEVEL info
  # Mật khẩu Superadmin KHÔNG để trong .env — khoi-tao.sh hỏi lúc chạy
  sed -i '/^VSN_SUPERADMIN_/d; /^VSN_PG_PORT=/d; /^API_PORT=/d; /^APP_VERSION=/d; /^VITE_/d' "$ENV_FILE"
  cat >> "$ENV_FILE" <<'EOF'

# ── Vận hành (deploy.sh) ──
# Thư mục dữ liệu ngoài container (backups, rclone, dozzle, deploy.log) · cổng Caddy chỉ nghe 127.0.0.1
VSN_DU_LIEU=/srv/vsn
VSN_CONG_CADDY=8088
# Telegram báo kết quả deploy cho IT (trống = không báo)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
# rclone đích backup cloud (vd. onedrive:vsn-backup) · push monitor Uptime Kuma
RCLONE_DICH=
UPTIME_BACKUP_PUSH_URL=
UPTIME_DISK_PUSH_URL=
EOF
  chmod 600 "$ENV_FILE"
  echo "Đã tạo $ENV_FILE (mật khẩu DB + UPTIME_TOKEN ngẫu nhiên)."
  echo "→ Điền TUNNEL_TOKEN, TURNSTILE_SECRET (bắt buộc), TELEGRAM_*, RCLONE_DICH, SENTRY_DSN, UPTIME_*_PUSH_URL rồi chạy lại:"
  echo "   ./infra/khoi-tao.sh $TAG"
  echo "→ Cất bản sao .env vào nơi giữ mật khẩu (RUNBOOK mục 'Danh bạ & nơi cất mật khẩu')."
  exit 0
fi

# ── Lần 2: kiểm tra DB còn trống ──
COMPOSE=(docker compose -f infra/compose.prod.yml --env-file "$ENV_FILE")
[[ -z "$(doc_env VSN_TAG)" ]] || { echo "Đã cài (VSN_TAG=$(doc_env VSN_TAG)). Cập nhật bằng: ./infra/deploy.sh <tag>" >&2; exit 1; }
VSN_TAG="$TAG" "${COMPOSE[@]}" up -d --wait postgres >/dev/null
co_bang="$(VSN_TAG="$TAG" "${COMPOSE[@]}" exec -T postgres psql -U postgres -d vsn_sanluong -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
[[ "${co_bang// /}" == "0" ]] || { echo "DB đã có $co_bang bảng — không khởi tạo lại. Cập nhật bằng ./infra/deploy.sh" >&2; exit 1; }

# ── Superadmin đầu tiên (mật khẩu TẠM, bắt buộc đổi ở lần đăng nhập đầu) ──
if [[ -z "${VSN_SUPERADMIN_TEN:-}" || -z "${VSN_SUPERADMIN_MAT_KHAU_TAM:-}" ]]; then
  read -rp "Tên đăng nhập Superadmin [admin]: " VSN_SUPERADMIN_TEN
  VSN_SUPERADMIN_TEN="${VSN_SUPERADMIN_TEN:-admin}"
  read -rp "Họ tên Superadmin [Superadmin]: " VSN_SUPERADMIN_HO_TEN
  while :; do
    read -rsp "Mật khẩu TẠM (≥ 8 ký tự, có chữ và số): " m1; echo
    read -rsp "Nhập lại: " m2; echo
    [[ "$m1" == "$m2" && ${#m1} -ge 8 && "$m1" =~ [A-Za-z] && "$m1" =~ [0-9] ]] && break
    echo "Không khớp hoặc chưa đủ mạnh — nhập lại."
  done
  VSN_SUPERADMIN_MAT_KHAU_TAM="$m1"
fi
export VSN_SUPERADMIN_TEN VSN_SUPERADMIN_HO_TEN="${VSN_SUPERADMIN_HO_TEN:-Superadmin}" VSN_SUPERADMIN_MAT_KHAU_TAM

exec "$THU_MUC/infra/deploy.sh" "$TAG" --gap --lan-dau "$@"
