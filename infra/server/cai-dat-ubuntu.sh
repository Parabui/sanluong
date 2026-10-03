#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# Chuẩn bị Ubuntu Server 24.04 cho VSN Sản Lượng [TDD 3.2] [D1b] — chạy MỘT lần, quyền root:
#   sudo bash infra/server/cai-dat-ubuntu.sh
# Dùng chung cho cả 2 phương án:
#   1. VM Hyper-V (tạo bằng infra/server/tao-vm-hyperv.ps1)
#   2. WSL2 trên Windows Server (sau đó chạy infra/server/wsl-tu-khoi-dong.ps1 phía Windows)
# Việc làm: Docker Engine + compose plugin (repo chính thức download.docker.com) · log Docker giới hạn dung lượng ·
#   múi giờ Asia/Ho_Chi_Minh + đồng bộ NTP (chrony) · tài khoản vận hành `vsn` (nhóm docker) · thư mục /srv/vsn ·
#   tường lửa chỉ mở SSH (không mở 80/443 — vào qua Cloudflare Tunnel) · cập nhật bảo mật tự động, khởi động lại 04:15.
# Chạy lại an toàn (bước nào đã làm thì bỏ qua).
# ════════════════════════════════════════════════════════════════
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "Chạy bằng sudo" >&2; exit 1; }
. /etc/os-release
[[ "$ID" == "ubuntu" ]] || { echo "Chỉ hỗ trợ Ubuntu (đang là $PRETTY_NAME)" >&2; exit 1; }
[[ "$VERSION_ID" == "24.04" ]] || echo "⚠ TDD chọn Ubuntu 24.04 — đang là $VERSION_ID, vẫn tiếp tục"
WSL=0; grep -qi microsoft /proc/version && WSL=1
NGUOI_VH="${NGUOI_VH:-vsn}"

buoc() { printf '\n── %s ──\n' "$*"; }

buoc "Gói cơ bản"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq ca-certificates curl gnupg openssl jq chrony unattended-upgrades ufw

if (( WSL )); then
  buoc "WSL2: bật systemd (Docker, chrony, cron chạy như máy thật)"
  if ! grep -q '^systemd=true' /etc/wsl.conf 2>/dev/null; then
    printf '[boot]\nsystemd=true\n' >> /etc/wsl.conf
    echo "Đã bật systemd trong /etc/wsl.conf → phía Windows chạy: wsl --shutdown, mở lại Ubuntu rồi chạy lại script này."
    exit 0
  fi
fi

buoc "Docker Engine + compose plugin"
# WSL: lệnh docker do Docker Desktop "mượn" vào (WSL integration) KHÔNG phải Docker Engine riêng của distro
if (( WSL )) && command -v docker >/dev/null && readlink -f "$(command -v docker)" | grep -q docker-desktop; then
  echo "Distro này đang dùng docker của Docker Desktop. Docker Desktop → Settings → Resources → WSL integration → TẮT cho distro này, rồi wsl --shutdown và chạy lại." >&2
  exit 1
fi
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
  # Log mặc định giới hạn (compose cũng đặt riêng) · live-restore: container chạy tiếp khi dockerd khởi động lại
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true
}
EOF
  systemctl restart docker
fi
systemctl enable --now docker containerd

buoc "Múi giờ + NTP"
timedatectl set-timezone Asia/Ho_Chi_Minh || ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime
systemctl enable --now chrony
chronyc -n tracking | sed -n '1,4p' || true

buoc "Tài khoản vận hành '$NGUOI_VH' + thư mục /srv/vsn"
id "$NGUOI_VH" >/dev/null 2>&1 || useradd -m -s /bin/bash "$NGUOI_VH"
usermod -aG docker "$NGUOI_VH"
mkdir -p /srv/vsn/app /srv/vsn/backups/truoc-deploy /srv/vsn/rclone /srv/vsn/dozzle
chown -R "$NGUOI_VH:$NGUOI_VH" /srv/vsn
chmod 700 /srv/vsn/backups /srv/vsn/rclone /srv/vsn/app

if (( WSL == 0 )); then
  buoc "Tường lửa: chỉ SSH vào (web đi qua Cloudflare Tunnel — chiều ra)"
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw --force enable
  ufw status verbose | sed -n '1,8p'
else
  echo "(WSL2: tường lửa do Windows quản lý — không mở cổng nào vào WSL)"
fi

buoc "Cập nhật bảo mật tự động — khởi động lại lúc 04:15 nếu cần (sau backup 02:00 và kiểm tra toàn vẹn 03:30)"
cat > /etc/apt/apt.conf.d/52vsn-unattended <<'EOF'
Unattended-Upgrade::Allowed-Origins { "${distro_id}:${distro_codename}-security"; };
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:15";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
EOF
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades

if (( WSL )) && ! grep -q "^default=" /etc/wsl.conf; then
  # Mở distro là vào thẳng tài khoản vận hành (không dùng root hằng ngày)
  printf '[user]\ndefault=%s\n' "$NGUOI_VH" >> /etc/wsl.conf
fi

buoc "Xong"
docker --version
docker compose version
cat <<EOF

Tiếp theo (đăng nhập bằng tài khoản '$NGUOI_VH'):
  1. docker login ghcr.io -u <tài khoản GitHub>   (Personal access token chỉ có quyền read:packages)
  2. Tải gói vsn-trien-khai-<tag>.tar.gz từ GitHub Release, giải nén vào /srv/vsn/app
  3. Chép public key backup vào /srv/vsn/app/infra/backup/khoa/backup.pub.asc
  4. cd /srv/vsn/app && ./infra/khoi-tao.sh <tag>
Chi tiết: docs/RUNBOOK.md mục "Cài đặt lần đầu".
EOF
