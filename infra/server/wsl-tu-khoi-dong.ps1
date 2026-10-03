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
  Trước đó trong Ubuntu đã chạy: sudo bash infra/server/cai-dat-ubuntu.sh (bật systemd + Docker).
#>
param(
  [string] $Distro = 'VSN-SanLuong',
  [int] $Cpu = 4,
  [int] $RamGB = 8
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

# 2. Scheduled Task giữ distro chạy từ lúc boot
$cred = Get-Credential -UserName "$env:USERDOMAIN\$env:USERNAME" -Message 'Mật khẩu Windows của tài khoản này (để task chạy khi chưa đăng nhập)'
$action = New-ScheduledTaskAction -Execute 'wsl.exe' -Argument "-d $Distro --exec /bin/sh -c `"exec sleep infinity`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'VSN-WSL' -Action $action -Trigger $trigger -Settings $set -RunLevel Highest `
  -User $cred.UserName -Password $cred.GetNetworkCredential().Password -Force | Out-Null
Write-Host "Đã tạo task 'VSN-WSL'. Kiểm tra: khởi động lại server, chưa đăng nhập, đợi 2 phút rồi mở https://sanluong.vsn-dn.com" -ForegroundColor Green

wsl.exe --shutdown
Start-ScheduledTask -TaskName 'VSN-WSL'
Start-Sleep 5
wsl.exe -l -v
