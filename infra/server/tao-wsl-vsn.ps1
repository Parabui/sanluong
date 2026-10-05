<#
  Tạo distro WSL2 RIÊNG cho production VSN Sản Lượng [TDD 3.2 phương án 2] [D1b] — dùng cho cả máy tạm (laptop) lẫn
  Windows Server sau này. Tách khỏi distro dev và khỏi Docker Desktop: distro này có Docker Engine của riêng nó,
  dữ liệu nằm gọn trong 1 file ổ đĩa ảo ở -ThuMuc → dễ sao lưu / chuyển máy (xem docs/RUNBOOK.md mục 6).
  Chạy bằng PowerShell (Administrator), trong thư mục repo hoặc thư mục giải nén gói triển khai:
    .\infra\server\tao-wsl-vsn.ps1                               # D:\WSL\VSN-SanLuong
    .\infra\server\tao-wsl-vsn.ps1 -ThuMuc E:\WSL\VSN-SanLuong -GiuMayThuc
  Việc làm:
    1. wsl --install Ubuntu-24.04 --name VSN-SanLuong --location <ThuMuc> (tải Ubuntu từ Microsoft — cần mạng)
    2. Chạy infra/server/cai-dat-ubuntu.sh trong distro (2 lượt: bật systemd → khởi động lại distro → cài Docker …)
    3. Chép infra/ vào /srv/vsn/app/infra (để chạy khoi-tao.sh / deploy.sh / chuyen-may.sh trong distro)
    4. -GiuMayThuc: máy cắm điện không ngủ / không ngủ đông, gập nắp không làm gì (máy tạm là laptop)
  Sau đó: .\infra\server\wsl-tu-khoi-dong.ps1 (tự chạy cùng Windows) → wsl -d VSN-SanLuong → RUNBOOK mục 1 bước 3.
  Docker Desktop (nếu có): Settings → Resources → WSL integration → TẮT cho VSN-SanLuong (mặc định đã tắt với distro mới).
#>
param(
  [string] $Ten = 'VSN-SanLuong',
  [string] $ThuMuc = 'D:\WSL\VSN-SanLuong',
  [switch] $GiuMayThuc
)
$ErrorActionPreference = 'Stop'
$goc = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$caiDat = Join-Path $goc 'infra\server\cai-dat-ubuntu.sh'
if (-not (Test-Path $caiDat)) { throw "Không thấy $caiDat — chạy script từ repo hoặc gói triển khai đã giải nén" }

$ds = (wsl.exe -l -q) -replace "`0", '' | Where-Object { $_ -and $_.Trim() }
if ($ds -contains $Ten) {
  Write-Host "Distro '$Ten' đã có — bỏ qua bước tạo" -ForegroundColor Yellow
} else {
  New-Item -ItemType Directory -Force $ThuMuc | Out-Null
  Write-Host "1/3 Tạo distro $Ten tại $ThuMuc (tải Ubuntu 24.04)…"
  wsl.exe --install Ubuntu-24.04 --name $Ten --location $ThuMuc --no-launch
  if ($LASTEXITCODE -ne 0) { throw 'wsl --install lỗi (cần WSL ≥ 2.4: wsl --update)' }
}

# Đường dẫn Windows → /mnt/<ổ>/… trong WSL
function ToWsl([string] $p) { $f = (Resolve-Path $p).Path; '/mnt/' + $f.Substring(0, 1).ToLower() + ($f.Substring(2) -replace '\\', '/') }
$shWsl = ToWsl $caiDat
# Từ đây gọi lệnh ngoài (wsl/apt in cảnh báo ra stderr): PowerShell 5.1 + 'Stop' coi mỗi dòng stderr là lỗi và dừng
# script giữa chừng → chuyển sang tự kiểm tra $LASTEXITCODE
$ErrorActionPreference = 'Continue'

Write-Host '2/3 Chuẩn bị Ubuntu (lượt 1: systemd, không ghép PATH Windows)…'
wsl.exe -d $Ten -u root -- bash $shWsl
if ($LASTEXITCODE -ne 0) { throw 'cai-dat-ubuntu.sh (lượt 1) lỗi — xem output phía trên' }
wsl.exe --terminate $Ten
Write-Host '    lượt 2: Docker Engine, NTP, tài khoản vsn, /srv/vsn…'
wsl.exe -d $Ten -u root -- bash $shWsl
if ($LASTEXITCODE -ne 0) { throw 'cai-dat-ubuntu.sh lỗi — xem output phía trên' }

Write-Host '3/3 Chép infra/ vào /srv/vsn/app'
$infraWsl = ToWsl (Join-Path $goc 'infra')
wsl.exe -d $Ten -u root -- bash -c "mkdir -p /srv/vsn/app && cp -r '$infraWsl' /srv/vsn/app/ && cp '$(ToWsl (Join-Path $goc '.env.example'))' /srv/vsn/app/ 2>/dev/null; find /srv/vsn/app -name '*.sh' -exec sed -i 's/\r$//' {} + -exec chmod +x {} +; chown -R vsn:vsn /srv/vsn/app"
wsl.exe --terminate $Ten   # áp dụng user mặc định vsn

if ($GiuMayThuc) {
  Write-Host 'Giữ máy thức khi cắm điện (máy tạm là laptop)…'
  powercfg /change standby-timeout-ac 0
  powercfg /change hibernate-timeout-ac 0
  powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0   # gập nắp: không làm gì
  powercfg /setactive SCHEME_CURRENT
}

wsl.exe -l -v
Write-Host @"

Xong. Tiếp theo:
  1. .\infra\server\wsl-tu-khoi-dong.ps1 -Distro $Ten       (tự chạy cùng Windows, kể cả chưa đăng nhập)
  2. wsl -d $Ten    → docker login ghcr.io → cd /srv/vsn/app → ./infra/khoi-tao.sh <tag>   (RUNBOOK mục 1 bước 3–12)
  Chuyển sang server thật sau này: RUNBOOK mục 6.
"@ -ForegroundColor Green
