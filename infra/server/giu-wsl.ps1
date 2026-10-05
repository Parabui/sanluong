<#
  Giữ distro production luôn chạy — được Scheduled Task "VSN-WSL" gọi (xem wsl-tu-khoi-dong.ps1), không chạy tay.
  WSL tắt distro khi không còn tiến trình wsl.exe nào bám vào, và cả máy ảo WSL có thể bị tắt bất cứ lúc nào
  (Docker Desktop khởi động / cập nhật / thoát, wsl --shutdown, WSL tự cập nhật). Vòng lặp: bám vào distro;
  bị ngắt → ghi nhật ký → 10 giây sau bám lại (systemd trong distro tự bật Docker, container tự lên).
  Nhật ký: %LOCALAPPDATA%\VSN\giu-wsl.log (mỗi dòng = 1 lần distro bị tắt rồi được bật lại).
#>
param([string] $Distro = 'VSN-SanLuong')

$nhatKy = Join-Path $env:LOCALAPPDATA 'VSN\giu-wsl.log'
New-Item -ItemType Directory -Force (Split-Path $nhatKy) | Out-Null
function Ghi([string] $s) {
  if ((Test-Path $nhatKy) -and (Get-Item $nhatKy).Length -gt 1MB) { Move-Item $nhatKy "$nhatKy.1" -Force }
  Add-Content -Path $nhatKy -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $s) -Encoding UTF8
}

Ghi "Bắt đầu giữ distro $Distro"
while ($true) {
  $bd = Get-Date
  wsl.exe -d $Distro --exec /bin/sh -c 'exec sleep infinity'
  Ghi ("Distro bị ngắt sau {0:N0} phút (mã thoát 0x{1:X}) — bật lại sau 10 giây" -f ((Get-Date) - $bd).TotalMinutes, $LASTEXITCODE)
  Start-Sleep -Seconds 10
}
