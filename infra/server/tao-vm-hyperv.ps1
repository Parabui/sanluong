<#
  Phương án 1 [TDD 3.2] [D1b]: tạo VM Hyper-V chạy Ubuntu Server 24.04 cho VSN Sản Lượng.
  Chạy trên Windows Server (PowerShell quyền Administrator, đã bật role Hyper-V):
    .\tao-vm-hyperv.ps1 -Iso D:\iso\ubuntu-24.04-live-server-amd64.iso -Switch "Mang LAN"
  Cấu hình theo TDD: 4 vCPU · 8 GB RAM CỐ ĐỊNH (không Dynamic Memory — PostgreSQL cần RAM ổn định) · đĩa 120 GB ·
  Automatic Start Action = luôn khởi động cùng server · checkpoint kiểu Production.
  Sau khi cài Ubuntu xong (bật OpenSSH server trong trình cài): tháo ISO, đăng nhập SSH, chạy infra/server/cai-dat-ubuntu.sh.
  Checkpoint trước mỗi lần deploy lớn:  Checkpoint-VM -Name vsn-sanluong -SnapshotName "truoc-deploy-v0.2.0"
#>
param(
  [Parameter(Mandatory)] [string] $Iso,
  [Parameter(Mandatory)] [string] $Switch,          # Virtual switch kiểu External (Get-VMSwitch)
  [string] $Ten = 'vsn-sanluong',
  [string] $ThuMuc = 'D:\Hyper-V',
  [int] $Cpu = 4,
  [long] $RamGB = 8,
  [long] $DiaGB = 120
)
$ErrorActionPreference = 'Stop'

if (-not (Get-Command New-VM -ErrorAction SilentlyContinue)) { throw 'Chưa bật Hyper-V (Install-WindowsFeature Hyper-V -IncludeManagementTools -Restart)' }
if (Get-VM -Name $Ten -ErrorAction SilentlyContinue) { throw "VM '$Ten' đã tồn tại" }
if (-not (Test-Path $Iso)) { throw "Không thấy ISO: $Iso" }
if (-not (Get-VMSwitch -Name $Switch -ErrorAction SilentlyContinue)) { throw "Không thấy virtual switch '$Switch' (Get-VMSwitch)" }

$vhd = Join-Path $ThuMuc "$Ten\$Ten.vhdx"
New-Item -ItemType Directory -Force (Split-Path $vhd) | Out-Null

New-VM -Name $Ten -Generation 2 -MemoryStartupBytes ($RamGB * 1GB) -NewVHDPath $vhd -NewVHDSizeBytes ($DiaGB * 1GB) `
  -SwitchName $Switch -Path $ThuMuc | Out-Null
Set-VM -Name $Ten -ProcessorCount $Cpu -StaticMemory `
  -AutomaticStartAction Start -AutomaticStartDelay 30 -AutomaticStopAction ShutDown `
  -CheckpointType Production
# Ubuntu cần mẫu Secure Boot của Microsoft UEFI CA (không phải mẫu Windows)
Set-VMFirmware -VMName $Ten -SecureBootTemplate MicrosoftUEFICertificateAuthority
Add-VMDvdDrive -VMName $Ten -Path $Iso
Set-VMFirmware -VMName $Ten -FirstBootDevice (Get-VMDvdDrive -VMName $Ten)
# Đồng bộ giờ: Ubuntu dùng chrony (NTP) — tắt đồng bộ giờ của Hyper-V để không giành nhau
Disable-VMIntegrationService -VMName $Ten -Name 'Time Synchronization'

Get-VM -Name $Ten | Format-List Name, State, ProcessorCount, MemoryStartup, AutomaticStartAction, CheckpointType
Write-Host "Đã tạo VM '$Ten'. Start-VM -Name $Ten rồi mở Hyper-V Manager → Connect để cài Ubuntu (bật OpenSSH server)." -ForegroundColor Green
