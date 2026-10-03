#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# deploy.sh — cập nhật production lên một bản phát hành [TDD 17.2]. Chạy trên server, trong thư mục cài đặt
# (mặc định /srv/vsn/app — chứa .env và infra/, giải nén từ gói vsn-trien-khai-<tag>.tar.gz).
#
#   ./infra/deploy.sh v0.1.1            cập nhật (trong khung 23:00–05:00; ngoài khung sẽ hỏi lại)
#   ./infra/deploy.sh v0.1.1 --gap      sửa gấp ngoài khung giờ, không hỏi
#   ./infra/deploy.sh v0.1.0            ROLLBACK = deploy lại tag cũ (migration chỉ-thêm nên code cũ chạy được trên DB mới)
#   --khong-pull                        dùng image đã có sẵn trên máy (diễn tập trên máy dev)
#
# Các bước: 0 kiểm tra → 1 pull 3 image → 2 pg_dump trước deploy → 3 prisma migrate deploy (vsn_migrate)
#           → 4 seed (chỉ THÊM quyền/cấu hình mới) → 5 đổi VSN_TAG trong .env, up -d → 6 chờ /api/health/chi-tiet đúng phiên bản
#           Lỗi ở bước 5–6 → tự quay về tag trước (.env.bak) và báo Telegram.
# ════════════════════════════════════════════════════════════════
set -Eeuo pipefail

THU_MUC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$THU_MUC"
ENV_FILE="${VSN_ENV_FILE:-$THU_MUC/.env}"
COMPOSE=(docker compose -f infra/compose.prod.yml --env-file "$ENV_FILE")

TAG="" GAP=0 LAN_DAU=0 PULL=1
for a in "$@"; do
  case "$a" in
    --gap) GAP=1 ;;
    --lan-dau) LAN_DAU=1 ;; # gọi từ khoi-tao.sh: chưa có bản cũ để dump / quay về
    --khong-pull) PULL=0 ;;
    -h | --help) sed -n '2,16p' "$0"; exit 0 ;;
    v*) TAG="$a" ;;
    *) echo "Tham số lạ: $a (xem --help)" >&2; exit 2 ;;
  esac
done
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || { echo "Cần tag dạng v1.2.3 — vd. ./infra/deploy.sh v0.1.1" >&2; exit 2; }
[[ -f "$ENV_FILE" ]] || { echo "Không thấy $ENV_FILE — lần đầu cài đặt chạy infra/khoi-tao.sh" >&2; exit 2; }

# ── Tiện ích ──
doc_env() { local v; v="$(grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-)"; v="${v%\"}"; v="${v#\"}"; printf '%s' "$v"; }
DU_LIEU="$(doc_env VSN_DU_LIEU)"; DU_LIEU="${DU_LIEU:-/srv/vsn}"
CONG="$(doc_env VSN_CONG_CADDY)"; CONG="${CONG:-8088}"
NHAT_KY="$DU_LIEU/deploy.log"
mkdir -p "$DU_LIEU"
# Máy đã chuyển đi (infra/chuyen-may.sh xuat) — không được chạy lại kẻo 2 máy cùng phục vụ một tunnel
[[ ! -f "$DU_LIEU/DA-CHUYEN-MAY.txt" ]] || { echo "Máy này ĐÃ CHUYỂN sang máy khác: $(head -1 "$DU_LIEU/DA-CHUYEN-MAY.txt")" >&2; exit 1; }
ghi() { printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$NHAT_KY"; }
dung() { ghi "❌ $*"; bao "❌ Deploy $TAG thất bại: $*"; exit 1; }
bao() { # Telegram cho IT (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID trong .env; trống = bỏ qua)
  local tk chat; tk="$(doc_env TELEGRAM_BOT_TOKEN)"; chat="$(doc_env TELEGRAM_CHAT_ID)"
  [[ -n "$tk" && -n "$chat" ]] || return 0
  curl -fsS -m 10 -o /dev/null --data-urlencode "chat_id=$chat" --data-urlencode "text=[VSN Sản Lượng] $1" \
    "https://api.telegram.org/bot$tk/sendMessage" || ghi "(không gửi được Telegram)"
}
# Chạy compose với một tag cụ thể (biến shell ưu tiên hơn --env-file)
compose_tag() { local t="$1"; shift; VSN_TAG="$t" "${COMPOSE[@]}" "$@"; }

cho_dung_phien_ban() { # $1 = tag mong đợi; tối đa 60 s
  local t="$1" token kq het=$((SECONDS + 60)); token="$(doc_env UPTIME_TOKEN)"
  while (( SECONDS < het )); do
    kq="$(curl -fsS -m 3 -H "X-Uptime-Token: $token" "http://127.0.0.1:$CONG/api/health/chi-tiet" 2>/dev/null || true)"
    if [[ "$kq" == *"\"phienBan\":\"$t\""* && "$kq" == *'"db":"ok"'* ]]; then ghi "health: $kq"; return 0; fi
    sleep 2
  done
  ghi "health cuối cùng: ${kq:-<không phản hồi>}"
  return 1
}

# ── 0. Kiểm tra ──
TAG_CU="$(doc_env VSN_TAG)"
ghi "═══ Deploy $TAG (đang chạy: ${TAG_CU:-<chưa có>}) ═══"
gio=$((10#$(TZ=Asia/Ho_Chi_Minh date +%H)))
if (( gio >= 5 && gio < 23 )) && (( GAP == 0 )); then
  [[ -t 0 ]] || dung "ngoài khung 23:00–05:00 — chạy lại với --gap nếu thật sự cần"
  read -rp "Bây giờ $(TZ=Asia/Ho_Chi_Minh date +%H:%M) — ngoài khung 23:00–05:00, công nhân có thể đang Lưu. Gõ CO để tiếp tục: " tl
  [[ "$tl" == "CO" ]] || { ghi "Đã hủy."; exit 1; }
fi
thieu=()
for k in POSTGRES_PASSWORD VSN_APP_PASSWORD VSN_MIGRATE_PASSWORD VSN_BACKUP_PASSWORD DATABASE_URL TUNNEL_TOKEN TURNSTILE_SECRET UPTIME_TOKEN; do
  [[ -n "$(doc_env "$k")" ]] || thieu+=("$k")
done
(( ${#thieu[@]} == 0 )) || dung "thiếu biến trong .env: ${thieu[*]}"
[[ "$(doc_env DATABASE_URL)" == *"@postgres:5432/"* ]] || dung "DATABASE_URL phải trỏ vào host 'postgres:5432' (mạng Docker), không phải 127.0.0.1"
[[ -f infra/backup/khoa/backup.pub.asc ]] || dung "thiếu public key backup: infra/backup/khoa/backup.pub.asc (xem infra/backup/khoa/README.md)"
for k in SENTRY_DSN RCLONE_DICH UPTIME_BACKUP_PUSH_URL TELEGRAM_BOT_TOKEN; do
  [[ -n "$(doc_env "$k")" ]] || ghi "⚠ $k trống — tính năng tương ứng đang tắt"
done
mkdir -p "$DU_LIEU/backups/truoc-deploy" "$DU_LIEU/rclone" "$DU_LIEU/dozzle"
[[ -f "$DU_LIEU/dozzle/users.yml" ]] || ghi "⚠ Chưa có $DU_LIEU/dozzle/users.yml — Dozzle (xem log) sẽ không chạy (mẫu: infra/dozzle/users.example.yml)"
[[ -f "$DU_LIEU/rclone/rclone.conf" || -z "$(doc_env RCLONE_DICH)" ]] || ghi "⚠ RCLONE_DICH có nhưng thiếu $DU_LIEU/rclone/rclone.conf — backup không lên cloud được"

# ── 1. Pull image ──
if (( PULL )); then
  ghi "1/6 Tải image $TAG"
  compose_tag "$TAG" pull -q api caddy backup || dung "không tải được image $TAG (đã docker login ghcr.io chưa? tag có tồn tại không?)"
else
  reg="$(doc_env VSN_REGISTRY)"
  for s in vsn-api vsn-web vsn-backup; do
    docker image inspect "${reg:-ghcr.io/vsn-dn}/$s:$TAG" >/dev/null 2>&1 || dung "không có image ${reg:-ghcr.io/vsn-dn}/$s:$TAG trên máy"
  done
fi

# ── 2. Dump trước deploy ──
compose_tag "${TAG_CU:-$TAG}" up -d --wait postgres >/dev/null || dung "PostgreSQL không khởi động được"
if (( LAN_DAU == 0 )); then
  dump="$DU_LIEU/backups/truoc-deploy/truoc-deploy-$TAG-$(date +%Y%m%d-%H%M%S).dump"
  ghi "2/6 pg_dump → $dump"
  # Không mã hóa (để quay lại nhanh tại chỗ); cùng đĩa với chính DB nên không lộ thêm gì. Chỉ giữ 3 bản, quyền 600.
  ( umask 077; compose_tag "${TAG_CU:-$TAG}" exec -T postgres pg_dump -U postgres -d vsn_sanluong -Fc > "$dump" ) || { rm -f "$dump"; dung "pg_dump lỗi"; }
  ls -1t "$DU_LIEU"/backups/truoc-deploy/truoc-deploy-*.dump 2>/dev/null | tail -n +4 | xargs -r rm -f
else
  ghi "2/6 Lần đầu — bỏ qua dump"
fi

# ── 3. Migration (tài khoản vsn_migrate, chạy bằng image MỚI) ──
ghi "3/6 prisma migrate deploy"
export MIGRATE_DATABASE_URL="postgresql://vsn_migrate:$(doc_env VSN_MIGRATE_PASSWORD)@postgres:5432/vsn_sanluong"
compose_tag "$TAG" run --rm --no-deps -T -e MIGRATE_DATABASE_URL api node_modules/.bin/prisma migrate deploy 2>&1 | tee -a "$NHAT_KY" \
  || dung "migration lỗi — bản đang chạy (${TAG_CU:-không có}) KHÔNG bị đổi. Xem RUNBOOK mục 'Migration lỗi' (dump: ${dump:-không có})"
unset MIGRATE_DATABASE_URL

# ── 4. Seed: thêm quyền / cấu hình mới (không ghi đè chỉnh sửa của Superadmin) ──
ghi "4/6 seed"
compose_tag "$TAG" run --rm --no-deps -T -e VSN_SUPERADMIN_TEN -e VSN_SUPERADMIN_HO_TEN -e VSN_SUPERADMIN_MAT_KHAU_TAM \
  api node dist/seed/main.js 2>&1 | tee -a "$NHAT_KY" || dung "seed lỗi"

# ── 5. Đổi tag và khởi động lại ──
ghi "5/6 VSN_TAG=$TAG, docker compose up -d"
cp -p "$ENV_FILE" "$ENV_FILE.bak"
if grep -qE '^VSN_TAG=' "$ENV_FILE"; then sed -i "s/^VSN_TAG=.*/VSN_TAG=$TAG/" "$ENV_FILE"; else echo "VSN_TAG=$TAG" >> "$ENV_FILE"; fi

quay_ve() {
  ghi "↩ Quay về $TAG_CU"
  cp -p "$ENV_FILE.bak" "$ENV_FILE"
  if "${COMPOSE[@]}" up -d --remove-orphans && cho_dung_phien_ban "$TAG_CU"; then
    dung "$1 — ĐÃ QUAY VỀ $TAG_CU, hệ thống chạy bình thường"
  else
    dung "$1 — quay về $TAG_CU cũng lỗi, CẦN XỬ LÝ NGAY (RUNBOOK: 'Rollback bản deploy')"
  fi
}
"${COMPOSE[@]}" up -d --remove-orphans || { [[ -n "$TAG_CU" && "$TAG_CU" != "$TAG" ]] && quay_ve "docker compose up lỗi"; dung "docker compose up lỗi"; }

# ── 6. Chờ đúng phiên bản ──
ghi "6/6 Chờ /api/health/chi-tiet trả phienBan=$TAG"
if ! cho_dung_phien_ban "$TAG"; then
  [[ -n "$TAG_CU" && "$TAG_CU" != "$TAG" ]] && quay_ve "API $TAG không lên trong 60 s"
  dung "API $TAG không lên trong 60 s (không có bản cũ để quay về)"
fi
ghi "✅ Đã deploy $TAG (trước: ${TAG_CU:-<chưa có>})"
bao "✅ Đã deploy $TAG (trước: ${TAG_CU:-<chưa có>})"
