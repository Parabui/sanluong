# VSN San Luong - kiem tra moi truong may (CHI DOC, khong thay doi gi)
# Chay: powershell -ExecutionPolicy Bypass -File D:\VSN-DN\_kiem-tra-may\kiem-tra-may.ps1
$ErrorActionPreference = 'SilentlyContinue'
$env:WSL_UTF8 = '1'
$out = Join-Path $PSScriptRoot 'ket-qua.txt'
$lines = New-Object System.Collections.Generic.List[string]
function S($t){ $lines.Add(''); $lines.Add("===== $t =====") }
function A($o){ if($null -eq $o){ $lines.Add('(khong co)') } else { ($o | Out-String -Width 220).TrimEnd() -split "`r?`n" | ForEach-Object { $lines.Add($_) } } }
function Cmd($name){ $c = Get-Command $name -ErrorAction SilentlyContinue; if($c){ $c.Source } else { '(khong co)' } }

S 'THOI DIEM'; A (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
A "Chay voi quyen Admin: $isAdmin"

S 'HE DIEU HANH'
A (Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture, LastBootUpTime)
A ("DisplayVersion: " + (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').DisplayVersion)
A ("EditionID: " + (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').EditionID)

S 'PHAN CUNG'
A (Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, @{n='RAM_GB';e={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}, HypervisorPresent)
A (Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, VirtualizationFirmwareEnabled, SecondLevelAddressTranslationExtensions, VMMonitorModeExtensions)
A (Get-CimInstance Win32_OperatingSystem | Select-Object @{n='RAM_Trong_GB';e={[math]::Round($_.FreePhysicalMemory/1MB,1)}})

S 'O DIA'
A (Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, VolumeName, @{n='Tong_GB';e={[math]::Round($_.Size/1GB)}}, @{n='Trong_GB';e={[math]::Round($_.FreeSpace/1GB)}})
A (Get-PhysicalDisk | Select-Object FriendlyName, MediaType, @{n='GB';e={[math]::Round($_.Size/1GB)}})

S 'TINH NANG AO HOA (1=Bat, 2=Tat)'
A (Get-CimInstance Win32_OptionalFeature | Where-Object { $_.Name -match 'Hyper-V|VirtualMachinePlatform|Subsystem-Linux|Containers|HypervisorPlatform' } | Select-Object Name, InstallState | Sort-Object Name)
A (Get-CimInstance -Namespace root\cimv2\mdm\dmmap -ClassName MDM_DeviceGuard_GetVBS -ErrorAction SilentlyContinue | Out-Null)
A ("hypervisorlaunchtype: " + ((bcdedit /enum '{current}' 2>$null | Select-String 'hypervisorlaunchtype') -join ' '))

S 'WSL'
A ("wsl.exe: " + (Cmd 'wsl.exe'))
A (wsl.exe --version 2>&1)
A (wsl.exe --status 2>&1)
A (wsl.exe -l -v 2>&1)

S 'HYPER-V VM (neu co quyen)'
A (Get-VM -ErrorAction SilentlyContinue | Select-Object Name, State, CPUUsage, MemoryAssigned, Uptime)

S 'DOCKER'
A ("docker: " + (Cmd 'docker'))
A (docker version --format '{{.Client.Version}} / server {{.Server.Version}} / {{.Server.Os}}' 2>&1)
A (docker info --format 'Context={{.Name}} OS={{.OperatingSystem}} CPUs={{.NCPU}} Mem={{.MemTotal}} Containers={{.Containers}} Running={{.ContainersRunning}}' 2>&1)
A (docker context ls 2>&1)
A (docker compose version 2>&1)
A (docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>&1)
A (docker volume ls 2>&1)
A ("Docker Desktop cai dat: " + (Test-Path "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"))

S 'AO HOA KHAC (VirtualBox / LDPlayer / VMware)'
A ("VBoxManage: " + (Test-Path "$env:ProgramFiles\Oracle\VirtualBox\VBoxManage.exe"))
A (Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall' | ForEach-Object { Get-ItemProperty $_.PSPath } | Where-Object { $_.DisplayName -match 'VirtualBox|LDPlayer|VMware|BlueStacks|Nox|MEmu|Docker|PostgreSQL|SQL Server \d|Node\.js|Git version|Python 3|cloudflared|Visual Studio Code' } | Select-Object DisplayName, DisplayVersion | Sort-Object DisplayName -Unique)

S 'CONG CU DEV'
foreach($t in 'node','npm','pnpm','yarn','git','python','psql','code','cloudflared','pwsh','k6'){
  $p = Cmd $t
  $v = ''
  if($p -ne '(khong co)'){ $v = (& $t --version 2>&1 | Select-Object -First 1) }
  A ("{0,-12} {1}  {2}" -f $t, $v, $p)
}

S 'DICH VU LIEN QUAN'
A (Get-Service | Where-Object { $_.Name -match 'postgres|MSSQL|SQLAgent|cloudflared|docker|com.docker|W3SVC|vmms|vmcompute|LxssManager|WslService|uptime|nginx|pm2|node' } | Select-Object Name, Status, StartType, DisplayName)

S 'CLOUDFLARED (chi ten file, khong doc noi dung)'
A (Get-ChildItem "$env:USERPROFILE\.cloudflared" -ErrorAction SilentlyContinue | Select-Object Name, Length, LastWriteTime)
A (Get-ChildItem "$env:ProgramData\cloudflared","$env:SystemRoot\System32\config\systemprofile\.cloudflared" -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime)

S 'CONG DANG LANG NGHE'
A (Get-NetTCPConnection -State Listen | Where-Object { $_.LocalAddress -notmatch '^::1$|^127\.' -or $_.LocalPort -in 3000,5173,5432,1433,8080,80,443 } | Select-Object LocalAddress, LocalPort, @{n='Process';e={(Get-Process -Id $_.OwningProcess).ProcessName}} | Sort-Object LocalPort -Unique)

S 'MANG'
A (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^127\.|^169\.254' } | Select-Object InterfaceAlias, IPAddress, PrefixLength)

$lines | Out-File -FilePath $out -Encoding utf8
Write-Host "Da ghi ket qua: $out"
