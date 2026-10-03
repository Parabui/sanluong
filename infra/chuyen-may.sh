#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# chuyen-may.sh — chuyển production sang máy khác (laptop WSL2 tạm → server thật, server cũ → server mới) [D1b].
# Không đổi IP / DNS: Cloudflare Tunnel đi chiều ra, máy nào chạy cloudflared với TUNNEL_TOKEN thì máy đó phục vụ.
#
#   Máy CŨ:  ./infra/chuyen-may.sh xuat
#            → DỪNG ghi (api, caddy, cloudflared, backup) → pg_dump toàn bộ (giữ owner + quyền) + .env + infra/ + rclone/dozzle
#            → 1 file mã hóa AES-256 bằng mật khẩu bạn đặt: <VSN_DU_LIEU>/chuyen-may/vsn-chuyen-may-<giờ>.tar.gz.gpg
#            → đánh dấu máy cũ ĐÃ CHUYỂN (deploy.sh / khoi-tao.sh từ chối chạy) để không bao giờ có 2 máy cùng phục vụ.
#   Máy MỚI (đã chạy infra/server/cai-dat-ubuntu.sh + docker login ghcr.io):
#            bash chuyen-may.sh nhap <file>     (chép riêng file script này cùng file gói, hoặc từ gói triển khai)
#            → giải mã vào /srv/vsn/app → khôi phục DB vào volume TRỐNG → khởi động → so số dòng với lúc xuất.
#
# Biến: VSN_THU_MUC (nơi cài trên máy mới, mặc định /srv/vsn/app) · VSN_DU_LIEU (ghi đè thư mục dữ liệu trong .env cũ)
#       VSN_CHUYEN_MAT_KHAU (mật khẩu gói — để trống thì hỏi) · --khong-pull (dùng image có sẵn) · --co (không hỏi xác nhận)
# Quay lại máy cũ nếu máy mới lỗi: trên máy cũ xóa <VSN_DU_LIEU>/DA-CHUYEN-MAY.txt → docker compose … up -d (dữ liệu nguyên vẹn).
# ════════════════════════════════════════════════════════════════
set -Eeuo pipefail

LENH="${1:-}"; shift || true
FILE_GOI="" PULL=1 CO=0
for a in "$@"; do
  case "$a" in
    --khong-pull) PULL=0 ;;
    --co) CO=1 ;;
    -*) echo "Tham số lạ: $a" >&2; exit 2 ;;
    *) FILE_GOI="$a" ;;
  esac
done

doc_env() { local v; v="$(grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-)"; v="${v%\"}"; v="${v#\"}"; printf '%s' "$v"; }
dat_env() { if grep -qE "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi; }
log() { printf '[chuyen-may %s] %s\n' "$(date '+%F %T')" "$*"; }
dung() { log "❌ $*" >&2; exit 1; }
hoi() { # hoi "câu hỏi" "TỪ_PHẢI_GÕ"
  (( CO )) && return 0
  [[ -t 0 ]] || dung "cần xác nhận — chạy trong terminal, hoặc thêm --co"
  local tl; read -rp "$1 Gõ $2 để tiếp tục: " tl; [[ "$tl" == "$2" ]] || { log "Đã hủy — không thay đổi gì."; exit 1; }
}
mat_khau() { # mat_khau <xuat|nhap> → in mật khẩu gói
  if [[ -n "${VSN_CHUYEN_MAT_KHAU:-}" ]]; then printf '%s' "$VSN_CHUYEN_MAT_KHAU"; return; fi
  [[ -t 0 ]] || dung "thiếu mật khẩu gói (VSN_CHUYEN_MAT_KHAU)"
  local m1 m2
  while :; do
    read -rsp "Mật khẩu gói chuyển máy (≥ 12 ký tự): " m1 >&2; echo >&2
    [[ "$1" == nhap ]] && { printf '%s' "$m1"; return; }
    read -rsp "Nhập lại: " m2 >&2; echo >&2
    [[ "$m1" == "$m2" && ${#m1} -ge 12 ]] && { printf '%s' "$m1"; return; }
    echo "Không khớp hoặc quá ngắn." >&2
  done
}
dan_don() { printf "cd %s && docker compose -f infra/compose.prod.yml --env-file .env down -v && cd / && rm -rf %s" "$THU_MUC" "$THU_MUC"; }
dem_bang() { # in "bảng|số dòng" các bảng chính
  local b
  for b in san_luong san_luong_lich_su chot_ngay khoa_thang gio_lam nhan_vien ma_hang tai_khoan audit_log; do
    printf '%s|%s\n' "$b" "$("${COMPOSE[@]}" exec -T postgres psql -U postgres -d vsn_sanluong -tAc "SELECT count(*) FROM $b" | tr -d '[:space:]')"
  done
}

# ══════════════════════════ XUẤT (máy cũ) ══════════════════════════
if [[ "$LENH" == "xuat" ]]; then
  THU_MUC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$THU_MUC"
  ENV_FILE="$THU_MUC/.env"; [[ -f "$ENV_FILE" ]] || dung "không thấy $ENV_FILE — chạy trên máy đang chạy production"
  COMPOSE=(docker compose -f infra/compose.prod.yml --env-file "$ENV_FILE")
  DU_LIEU="$(doc_env VSN_DU_LIEU)"; DU_LIEU="${DU_LIEU:-/srv/vsn}"
  TAG="$(doc_env VSN_TAG)"; [[ -n "$TAG" ]] || dung "VSN_TAG trống — máy này chưa từng chạy production"
  [[ ! -f "$DU_LIEU/DA-CHUYEN-MAY.txt" ]] || dung "máy này đã chuyển đi: $(head -1 "$DU_LIEU/DA-CHUYEN-MAY.txt")"
  # Chặn chạy nhầm trong checkout dev (.env dev trỏ 127.0.0.1) hoặc trên máy chưa có production — không được tạo DB mới
  [[ "$(doc_env DATABASE_URL)" == *"@postgres:5432/"* ]] || dung "$ENV_FILE không phải .env production (DATABASE_URL phải trỏ postgres:5432) — chạy trong /srv/vsn/app"
  [[ -n "$("${COMPOSE[@]}" ps -a -q postgres 2>/dev/null)" ]] || dung "không thấy container postgres production trên máy này — không có gì để xuất"

  hoi "Sẽ DỪNG hệ thống trên máy này (công nhân không Lưu được cho tới khi máy mới chạy, thường 10–20 phút)." CHUYEN
  MK="$(mat_khau xuat)"
  ts="$(date +%Y%m%d-%H%M%S)"
  RA="$DU_LIEU/chuyen-may"; TAM="$RA/tam-$ts"
  mkdir -p "$RA"; ( umask 077; mkdir -p "$TAM/du-lieu" )
  trap 'rm -rf "$TAM"' EXIT

  log "1/4 Dừng ghi: api, caddy, cloudflared, backup (postgres chạy tiếp để dump)"
  "${COMPOSE[@]}" stop api caddy cloudflared backup dozzle >/dev/null 2>&1 || true
  "${COMPOSE[@]}" up -d --wait postgres >/dev/null

  log "2/4 pg_dump toàn bộ (owner + quyền)"
  ( umask 077; "${COMPOSE[@]}" exec -T postgres pg_dump -U postgres -d vsn_sanluong -Fc > "$TAM/db.dump" )
  [[ -s "$TAM/db.dump" ]] || dung "dump rỗng"
  {
    echo "Xuất lúc:   $(date '+%F %T %z')"
    echo "Từ máy:     $(hostname)"
    echo "Phiên bản:  $TAG"
    echo "Migration:  $("${COMPOSE[@]}" exec -T postgres psql -U postgres -d vsn_sanluong -tAc "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1" | tr -d '[:space:]')"
  } > "$TAM/THONG-TIN.txt"
  dem_bang > "$TAM/so-dong.txt"
  cp -p "$ENV_FILE" "$TAM/.env"
  cp -rp infra "$TAM/infra"
  rm -rf "$TAM/infra/backup/khoa/"*.key.asc 2>/dev/null || true # phòng ai lỡ để private key trong repo
  for d in rclone dozzle; do [[ -d "$DU_LIEU/$d" ]] && cp -rp "$DU_LIEU/$d" "$TAM/du-lieu/$d"; done
  [[ -f docs/RUNBOOK.md ]] && { mkdir -p "$TAM/docs"; cp -p docs/RUNBOOK.md "$TAM/docs/"; }

  log "3/4 Đóng gói + mã hóa AES-256"
  GOI="$RA/vsn-chuyen-may-$ts.tar.gz.gpg"
  ( umask 077; tar -czf - -C "$TAM" . | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
      --symmetric --cipher-algo AES256 --output "$GOI" 3<<<"$MK" )
  ( cd "$RA" && sha256sum "$(basename "$GOI")" > "$(basename "$GOI").sha256" )

  log "4/4 Đánh dấu máy này ĐÃ CHUYỂN, dừng nốt postgres"
  printf 'Đã chuyển sang máy khác lúc %s — gói %s. Quay lại máy này: xóa file này rồi docker compose … up -d\n' \
    "$(date '+%F %T')" "$(basename "$GOI")" > "$DU_LIEU/DA-CHUYEN-MAY.txt"
  "${COMPOSE[@]}" stop >/dev/null 2>&1 || true
  log "✅ Gói: $GOI ($(du -h "$GOI" | cut -f1))"
  log "   Kiểm tra toàn vẹn: $(cut -c1-16 "$GOI.sha256")…"
  cat <<EOF

Tiếp theo:
  1. Chép 2 file sang máy mới (USB / mạng nội bộ): $(basename "$GOI") + .sha256, cùng infra/chuyen-may.sh
  2. Máy mới: sudo bash cai-dat-ubuntu.sh (nếu chưa) → docker login ghcr.io → bash chuyen-may.sh nhap $(basename "$GOI")
  3. KHÔNG bật lại máy này khi máy mới đang chạy (2 máy cùng TUNNEL_TOKEN = Cloudflare chia request cho cả hai)
  4. Ghi nhớ mật khẩu gói — mất mật khẩu thì gói không mở được (dữ liệu vẫn còn nguyên trên máy này)
EOF
  exit 0
fi

# ══════════════════════════ NHẬP (máy mới) ══════════════════════════
if [[ "$LENH" == "nhap" ]]; then
  [[ -r "$FILE_GOI" ]] || dung "Dùng: bash chuyen-may.sh nhap <vsn-chuyen-may-….tar.gz.gpg>"
  for lenh in docker gpg tar curl; do command -v "$lenh" >/dev/null || dung "thiếu lệnh $lenh (chạy infra/server/cai-dat-ubuntu.sh)"; done
  if [[ -r "$FILE_GOI.sha256" ]]; then
    ( cd "$(dirname "$FILE_GOI")" && sha256sum -c --quiet "$(basename "$FILE_GOI").sha256" ) || dung "sai mã kiểm tra — file chép bị hỏng"
    log "mã kiểm tra khớp"
  fi
  THU_MUC="${VSN_THU_MUC:-/srv/vsn/app}"
  ENV_FILE="$THU_MUC/.env"
  [[ ! -f "$ENV_FILE" ]] || dung "$ENV_FILE đã có — máy này đã cài. Chuyển vào máy trống, hoặc tự dọn trước (xem RUNBOOK)"
  mkdir -p "$THU_MUC"
  MK="$(mat_khau nhap)"

  log "1/5 Giải mã gói vào $THU_MUC"
  ( umask 077; gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$FILE_GOI" 3<<<"$MK" | tar -xzf - -C "$THU_MUC" ) \
    || dung "không giải mã được — sai mật khẩu hoặc file hỏng"
  chmod 600 "$ENV_FILE"
  cd "$THU_MUC"
  COMPOSE=(docker compose -f infra/compose.prod.yml --env-file "$ENV_FILE")
  [[ -n "${VSN_DU_LIEU:-}" ]] && dat_env VSN_DU_LIEU "$VSN_DU_LIEU"
  DU_LIEU="$(doc_env VSN_DU_LIEU)"; DU_LIEU="${DU_LIEU:-/srv/vsn}"
  TAG="$(doc_env VSN_TAG)"
  sed -n '1,4p' THONG-TIN.txt | sed 's/^/    /'
  mkdir -p "$DU_LIEU/backups/chuyen-may" "$DU_LIEU/backups/truoc-deploy"
  for d in rclone dozzle; do [[ -d "du-lieu/$d" ]] && { mkdir -p "$DU_LIEU/$d"; cp -rp "du-lieu/$d/." "$DU_LIEU/$d/"; }; done
  rm -f "$DU_LIEU/DA-CHUYEN-MAY.txt"
  mv db.dump "$DU_LIEU/backups/chuyen-may/db.dump"; rm -rf du-lieu

  log "2/5 Image $TAG"
  if (( PULL )); then "${COMPOSE[@]}" pull -q || dung "không tải được image (docker login ghcr.io chưa?)"; fi

  log "3/5 PostgreSQL trên volume TRỐNG (tạo 3 tài khoản DB từ .env)"
  "${COMPOSE[@]}" up -d --wait postgres >/dev/null
  co_bang="$("${COMPOSE[@]}" exec -T postgres psql -U postgres -d vsn_sanluong -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" | tr -d '[:space:]')"
  [[ "$co_bang" == "0" ]] || dung "DB trên máy này đã có $co_bang bảng — không ghi đè. Xem RUNBOOK mục 6"

  log "4/5 Khôi phục DB (kiểm phân quyền sau khôi phục)"
  POSTGRES_PASSWORD="$(doc_env POSTGRES_PASSWORD)" XAC_NHAN=KHOI_PHUC NGU_CANH=chuyen-may \
    "${COMPOSE[@]}" run --rm --no-deps -T -e POSTGRES_PASSWORD -e XAC_NHAN -e NGU_CANH backup khoi-phuc.sh /backups/chuyen-may/db.dump \
    || dung "khôi phục lỗi. Gói vẫn còn nguyên — dọn máy này rồi chạy lại: $(dan_don)"

  log "5/5 Khởi động toàn bộ + so số dòng"
  "${COMPOSE[@]}" up -d >/dev/null
  dem_bang > so-dong-moi.txt
  if diff -q so-dong.txt so-dong-moi.txt >/dev/null; then log "số dòng 9 bảng chính KHỚP lúc xuất"; else
    paste -d'|' so-dong.txt so-dong-moi.txt | awk -F'|' '{ printf "    %-20s %10s %10s %s\n", $1, $2, $4, ($2==$4?"":"LỆCH") }'
    dung "số dòng LỆCH so với lúc xuất — KHÔNG dùng máy này, báo IT chính (dọn: $(dan_don))"
  fi
  token="$(doc_env UPTIME_TOKEN)"; cong="$(doc_env VSN_CONG_CADDY)"; het=$((SECONDS + 90)); kq=""
  while (( SECONDS < het )); do
    kq="$(curl -fsS -m 3 -H "X-Uptime-Token: $token" "http://127.0.0.1:${cong:-8088}/api/health/chi-tiet" 2>/dev/null || true)"
    [[ "$kq" == *"\"phienBan\":\"$TAG\""* ]] && break; sleep 2
  done
  [[ "$kq" == *"\"phienBan\":\"$TAG\""* ]] || dung "API chưa lên (health: ${kq:-không phản hồi}) — xem: docker compose … logs api; làm lại từ đầu: $(dan_don)"
  rm -f "$DU_LIEU/backups/chuyen-may/db.dump" so-dong-moi.txt
  log "✅ Máy mới chạy $TAG — health: $kq"
  cat <<EOF

Tiếp theo:
  - Mở https://<domain> từ điện thoại 4G (tunnel tự nối vào máy này) · đăng nhập /quanly kiểm tra Bảng sản lượng ngày
  - WSL2: chạy infra/server/wsl-tu-khoi-dong.ps1 phía Windows · Hyper-V: đặt Automatic Start
  - Uptime Kuma / Telegram không phải đổi gì (cùng domain, cùng token)
  - Giữ máy cũ TẮT ít nhất 1 tuần làm đường lui, rồi mới xóa dữ liệu trên đó
EOF
  exit 0
fi

sed -n '2,19p' "$0"; exit 2
