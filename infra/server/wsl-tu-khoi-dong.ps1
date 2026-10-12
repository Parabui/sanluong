<#
  Phương án 2 [TDD 3.2] [D1b] — không có Hyper-V, Windows Server 2022+: Ubuntu 24.04 trên WSL2 phải chạy liên tục
  và tự khởi động cùng server (kể cả khi chưa ai đăng nhập Windows).
  Chạy bằng PowerShell quyền Administrator, BẰNG tài khoản Windows sở hữu distro WSL:
    .\wsl-tu-khoi-dong.ps1                  # distro VSN-SanLuong (tạo bằng tao-wsl-vsn.ps1)
  Việc làm:
    1. %UserProfile%\.wslconfig: vmIdleTimeout=-1 (không tự tắt VM WSL khi rảnh), 4 CPU, 8 GB RAM.
       Lưu ý: MỌI distro WSL2 (kể cả docker-desktop của máy dev) dùng chung 1 VM → giới hạn RAM/CPU này là chung;
       máy tạm vừa dev vừa chạy production thì tăng -RamGB (vd. 12). Script gọi wsl --shutdown (Docker Desktop tự bật lại).
    2. Scheduled Task "VSN-WSL" lúc khởi động máy: giữ distro chạy (Docker trong distro tự lên nhờ systemd)
  Windows hỏi mật khẩu tài khoản này một lần để task chạy được khi chưa đăng nhập — bạn tự nhập, script không lưu.
  Tài khoản MICROSOFT (đăng nhập Windows bằng email): tên phải là email, mật khẩu là mật khẩu tài khoản Microsoft (không phải PIN):
    .\wsl-tu-khoi-dong.ps1 -TenDangNhap 'ten@outlook.com'
  Không muốn / không dùng được mật khẩu: -KhiDangNhap → task chạy khi BẠN ĐĂNG NHẬP Windows (không lưu mật khẩu);
    đổi lại: sau khi máy khởi động lại phải có người đăng nhập (PIN cũng được) thì hệ thống mới chạy.
  Trước đó trong Ubuntu đã chạy: sudo bash infra/server/cai-dat-ubuntu.sh (bật systemd + Docker).
#>
param(
  [string] $Distro = 'VSN-SanLuong',
  [int] $Cpu = 4,
  [int] $RamGB = 8,
  [string] $TenDangNhap = "$env:USERDOMAIN\$env:USERNAME",
  [switch] $KhiDangNhap
)
$ErrorActionPreference = 'Stop'

$ds = (wsl.exe -l -q) -replace "`0", '' | Where-Object { $_ -and $_.Trim() }
if ($ds -notcontains $Distro) { throw "Không thấy distro '$Distro'. Có: $($ds -join ', ')" }

# 1. .wslconfig
$cfg = Join-Path $env:USERPROFILE '.wslconfig'
if (Test-Path $cfg) { Copy-Item $cfg "$cfg.bak" -Force }
@"
[wsl2]
processors=$Cpu
memory=${RamGB}GB
vmIdleTimeout=-1
"@ | Set-Content -Encoding ascii $cfg
Write-Host "Đã ghi $cfg (bản cũ: .wslconfig.bak)"

# 2. Scheduled Task giữ distro chạy (WSL tắt distro khi không còn tiến trình wsl.exe nào bám vào)
# Vòng lặp giu-wsl.ps1 (chép vào ProgramData — không phụ thuộc chỗ để repo): WSL bị tắt vì bất cứ lý do gì
# (Docker Desktop khởi động lại, wsl --shutdown, cập nhật WSL) → 10 giây sau tự bật lại distro
$giu = Join-Path $env:ProgramData 'VSN\giu-wsl.ps1'
New-Item -ItemType Directory -Force (Split-Path $giu) | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'giu-wsl.ps1') $giu -Force
# conhost --headless: chạy KHÔNG có cửa sổ. Windows 11 mặc định mở console bằng Windows Terminal, mà -WindowStyle Hidden
# không ẩn được → lúc đăng nhập hiện 1 cửa sổ terminal đen, người dùng tưởng thừa đóng đi = distro tắt theo (tunnel 1033)
$action = New-ScheduledTaskAction -Execute 'conhost.exe' `
  -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$giu`" -Distro $Distro"
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
if ($KhiDangNhap) {
  # Chạy trong phiên đăng nhập của bạn, cửa sổ ẩn
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName 'VSN-WSL' -Action $action -Trigger $trigger -Settings $set -Principal $principal -Force | Out-Null
  Write-Host "Đã tạo task 'VSN-WSL' (chạy khi đăng nhập). Sau khi khởi động lại máy: đăng nhập Windows → 1–2 phút sau hệ thống chạy." -ForegroundColor Green
} else {
  $cred = Get-Credential -UserName $TenDangNhap -Message 'Tài khoản Windows (tài khoản Microsoft: email + mật khẩu Microsoft, KHÔNG phải PIN) — để task chạy khi chưa đăng nhập'
  $trigger = New-ScheduledTaskTrigger -AtStartup
  try {
    Register-ScheduledTask -TaskName 'VSN-WSL' -Action $action -Trigger $trigger -Settings $set -RunLevel Highest `
      -User $cred.UserName -Password $cred.GetNetworkCredential().Password -Force -ErrorAction Stop | Out-Null
  } catch {
    Write-Host @"
Không tạo được task: $($_.Exception.Message)
  - Tài khoản Microsoft: chạy lại với tên là EMAIL:   -TenDangNhap 'ten@outlook.com'   (mật khẩu Microsoft, không phải PIN)
  - Hoặc không dùng mật khẩu (chạy khi đăng nhập):  -KhiDangNhap
"@ -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Đã tạo task 'VSN-WSL'. Kiểm tra: khởi động lại máy, chưa đăng nhập, đợi 2–3 phút rồi mở https://sanluong.vsn-dn.com" -ForegroundColor Green
}

wsl.exe --shutdown
Start-ScheduledTask -TaskName 'VSN-WSL'
Start-Sleep 5
wsl.exe -l -v
