#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Win Server 2022 一键部署自托管 Supabase (WSL2 + Docker Engine 方案)
    狄邦单词通 - 后端部署脚本
    
.DESCRIPTION
    自动启用 WSL2、安装 Ubuntu 发行版，然后在 WSL2 Ubuntu 内安装 Docker Engine
    并部署完整的自托管 Supabase 实例。
    注意：Docker Desktop 官方不支持 Windows Server，本脚本使用 WSL2 方案。
    
.NOTES
    服务器要求: Win Server 2022, 16GB+ RAM, 需要开启虚拟化
    预计耗时: 15-30 分钟（取决于网络速度）
    
.USAGE
    以管理员身份运行 PowerShell，然后执行:
    Set-ExecutionPolicy Bypass -Scope Process -Force
    .\deploy-supabase-winserver.ps1
#>

$ErrorActionPreference = "Stop"
$INSTALL_DIR = "C:\supabase"
$LOG_FILE = "$INSTALL_DIR\deploy.log"
$BASH_SCRIPT_NAME = "deploy-supabase-wsl.sh"
$BASH_SCRIPT_WIN_PATH = "$PSScriptRoot\$BASH_SCRIPT_NAME"

# ============================================================
# 颜色输出函数
# ============================================================
function Write-Step($msg) { Write-Host "`n[步骤] $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "[完成] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[警告] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[错误] $msg" -ForegroundColor Red }

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $msg" | Out-File -Append -FilePath $LOG_FILE
    Write-Host $msg
}

# ============================================================
# 0. 初始化
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  狄邦单词通 - Supabase 后端部署脚本"   -ForegroundColor Magenta
Write-Host "  Windows Server 2022 + WSL2 方案"       -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

try { $OSCaption = (Get-CimInstance Win32_OperatingSystem).Caption } catch { $OSCaption = "Windows" }
Log "开始部署... 当前系统: $OSCaption"

# ============================================================
# 1. 启用 WSL2 所需的 Windows 功能
# ============================================================
Write-Step "检查并启用 WSL2 所需的 Windows 功能..."

$needReboot = $false

# 启用 WSL 功能
$wslFeature = dism.exe /online /get-featureinfo /featurename:Microsoft-Windows-Subsystem-Linux 2>$null
if ($wslFeature -match "State : Disabled") {
    Write-Warn "正在启用 Windows Subsystem for Linux..."
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    $needReboot = $true
}

# 启用虚拟机平台
$vmpFeature = dism.exe /online /get-featureinfo /featurename:VirtualMachinePlatform 2>$null
if ($vmpFeature -match "State : Disabled") {
    Write-Warn "正在启用 Virtual Machine Platform..."
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    $needReboot = $true
}

if ($needReboot) {
    Write-Warn ">>> Windows 功能已启用，需要重启服务器后才能继续 <<<"
    Write-Warn ">>> 重启后请重新运行此脚本 <<<"
    $restart = Read-Host "是否现在重启服务器？(Y/N)"
    if ($restart -eq "Y" -or $restart -eq "y") {
        Restart-Computer -Force
        exit
    }
    Write-Err "请手动重启服务器后重新运行此脚本"
    exit 1
}

Write-OK "WSL2 所需 Windows 功能已就绪"

# ============================================================
# 2. 安装 WSL2 并设置默认版本
# ============================================================
Write-Step "配置 WSL2..."

try {
    wsl --set-default-version 2 2>$null
    Write-OK "WSL2 已设置为默认版本"
} catch {
    Write-Warn "设置 WSL2 默认版本失败，尝试更新 WSL..."
    wsl --update 2>$null
    wsl --set-default-version 2 2>$null
}

# ============================================================
# 3. 安装 Ubuntu 发行版 (如果未安装)
# ============================================================
Write-Step "检查 Ubuntu 发行版..."

$wslList = wsl -l -q 2>$null
$hasUbuntu = $false
if ($wslList) {
    foreach ($distro in $wslList) {
        $clean = $distro.Trim() -replace '\x00', ''
        if ($clean -match "Ubuntu") {
            $hasUbuntu = $true
            break
        }
    }
}

if (-not $hasUbuntu) {
    Write-Warn "正在安装 Ubuntu 发行版..."
    
    # 优先使用清华大学镜像下载 Ubuntu WSL rootfs (约 80MB，比微软源快很多)
    $ubuntuRootfsUrl = "https://mirrors.tuna.tsinghua.edu.cn/ubuntu-cloud-images/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz"
    $ubuntuRootfs = "$env:TEMP\ubuntu-wsl.tar.gz"
    $ubuntuInstallDir = "C:\WSL\Ubuntu"
    
    Write-Host "  使用清华大学镜像下载 Ubuntu rootfs..." -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    try {
        Invoke-WebRequest -Uri $ubuntuRootfsUrl -OutFile $ubuntuRootfs -UseBasicParsing
        
        # 创建安装目录
        if (-not (Test-Path $ubuntuInstallDir)) {
            New-Item -ItemType Directory -Path $ubuntuInstallDir -Force | Out-Null
        }
        
        # 使用 wsl --import 导入 rootfs
        wsl --import Ubuntu $ubuntuInstallDir $ubuntuRootfs
        
        Write-OK "Ubuntu 已通过 rootfs 导入安装"
        
        # 清理下载文件
        Remove-Item $ubuntuRootfs -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warn "清华镜像下载失败，回退到 wsl --install..."
        wsl --install -d Ubuntu --no-launch 2>$null
    }
    
    Write-OK "Ubuntu 发行版已安装"
    
    # wsl --import 导入的发行版默认以 root 运行，无需手动设置用户
    # 验证 Ubuntu 可以启动
    Write-Step "验证 Ubuntu WSL 可用..."
    $testResult = wsl -d Ubuntu echo "ok" 2>$null
    if ($testResult -match "ok") {
        Write-OK "Ubuntu WSL 启动正常"
    } else {
        Write-Warn "Ubuntu WSL 启动测试未通过，可能需要重启服务器后重试"
    }
} else {
    Write-OK "Ubuntu 已安装"
}

# 确认 Ubuntu 在 WSL2 模式下运行
$wslStatus = wsl -l -v 2>$null
Write-Host "  WSL 发行版状态:" -ForegroundColor Gray
Write-Host $wslStatus -ForegroundColor Gray

# ============================================================
# 4. 获取服务器 IP
# ============================================================
$SERVER_IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch "Loopback" -and 
    $_.InterfaceAlias -notmatch "vEthernet" -and 
    $_.PrefixOrigin -ne "WellKnown" 
} | Select-Object -First 1).IPAddress
if (-not $SERVER_IP) { $SERVER_IP = "localhost" }

Write-OK "服务器 IP: $SERVER_IP"

# ============================================================
# 5. 配置 Windows 防火墙
# ============================================================
Write-Step "配置 Windows 防火墙规则..."

$ports = @(
    @{Name="Supabase API";    Port=8000},
    @{Name="Supabase Studio"; Port=3000},
    @{Name="PostgreSQL";      Port=5432}
)

foreach ($p in $ports) {
    $existing = Get-NetFirewallRule -DisplayName $p.Name -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-NetFirewallRule -DisplayName $p.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p.Port | Out-Null
        Write-Host "  已开放端口: $($p.Port) ($($p.Name))" -ForegroundColor Gray
    }
}

Write-OK "防火墙规则已配置"

# ============================================================
# 6. 配置 WSL2 端口转发 (让外部可以访问 WSL 内的服务)
# ============================================================
Write-Step "配置 WSL2 端口转发..."

# 获取 WSL2 内部 IP
$wslIP = (wsl hostname -I 2>$null).Trim().Split(" ")[0]

if ($wslIP) {
    Write-Host "  WSL2 内部 IP: $wslIP" -ForegroundColor Gray
    
    foreach ($p in $ports) {
        # 删除旧规则
        netsh interface portproxy delete v4tov4 listenport=$($p.Port) listenaddress=0.0.0.0 2>$null | Out-Null
        # 添加新规则
        netsh interface portproxy add v4tov4 listenport=$($p.Port) listenaddress=0.0.0.0 connectport=$($p.Port) connectaddress=$wslIP
        Write-Host "  端口转发: 0.0.0.0:$($p.Port) -> ${wslIP}:$($p.Port)" -ForegroundColor Gray
    }
    
    Write-OK "端口转发已配置"
} else {
    Write-Warn "无法获取 WSL2 IP，端口转发需要在部署完成后手动配置"
    Write-Host "  手动配置命令示例:" -ForegroundColor Gray
    Write-Host "  netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=<WSL_IP>" -ForegroundColor Gray
}

# ============================================================
# 7. 将 bash 部署脚本复制到 WSL 并执行
# ============================================================
Write-Step "准备在 WSL2 Ubuntu 内执行部署..."

if (-not (Test-Path $BASH_SCRIPT_WIN_PATH)) {
    Write-Err "找不到 bash 部署脚本: $BASH_SCRIPT_WIN_PATH"
    Write-Host "  请确保 $BASH_SCRIPT_NAME 与此脚本在同一目录下" -ForegroundColor Yellow
    exit 1
}

# 将 Windows 路径转为 WSL 路径并复制
$wslScriptDir = "/tmp/supabase-deploy"
wsl bash -c "mkdir -p $wslScriptDir"

# 转换路径并复制脚本
$winPathForWSL = $BASH_SCRIPT_WIN_PATH -replace '\\', '/'
$driveLetter = $winPathForWSL.Substring(0, 1).ToLower()
$wslWinPath = "/mnt/$driveLetter$($winPathForWSL.Substring(2))"

wsl bash -c "cp '$wslWinPath' '$wslScriptDir/deploy.sh' && chmod +x '$wslScriptDir/deploy.sh'"

# 传递服务器 IP 并执行
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  正在 WSL2 Ubuntu 内执行部署..."        -ForegroundColor Yellow
Write-Host "  这需要 10-20 分钟，请耐心等待"         -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

wsl bash -c "export SERVER_IP='$SERVER_IP' && $wslScriptDir/deploy.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Err "WSL2 内部署失败，请检查上方日志"
    Write-Host "  可以手动进入 WSL 排查: wsl" -ForegroundColor Gray
    Write-Host "  日志文件: wsl bash -c 'cat /opt/supabase/deploy.log'" -ForegroundColor Gray
    exit 1
}

# ============================================================
# 8. 输出部署信息
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Supabase 部署完成!"                     -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Cyan
Write-Host "  Supabase Studio:  http://${SERVER_IP}:3000" -ForegroundColor White
Write-Host "  API 端点:         http://${SERVER_IP}:8000" -ForegroundColor White
Write-Host "  Auth 端点:        http://${SERVER_IP}:8000/auth/v1" -ForegroundColor White
Write-Host ""
Write-Host "登录凭据和密钥:" -ForegroundColor Cyan
Write-Host "  请查看 WSL 内的配置文件:" -ForegroundColor White
Write-Host "  wsl bash -c 'cat /opt/supabase/deployment-info.txt'" -ForegroundColor Yellow
Write-Host ""
Write-Host "微软 SSO 配置步骤:" -ForegroundColor Yellow
Write-Host "  1. 登录 https://portal.azure.com" -ForegroundColor White
Write-Host "  2. Azure AD -> App registrations -> New registration" -ForegroundColor White
Write-Host "  3. 应用名称: 狄邦单词通" -ForegroundColor White
Write-Host "  4. Redirect URI: http://${SERVER_IP}:8000/auth/v1/callback" -ForegroundColor White
Write-Host "  5. 获取 Client ID 和 Client Secret" -ForegroundColor White
Write-Host "  6. 编辑 WSL 内 .env 文件: wsl bash -c 'nano /opt/supabase/supabase-docker/.env'" -ForegroundColor White
Write-Host "  7. 重启: wsl bash -c 'cd /opt/supabase/supabase-docker && docker compose down && docker compose up -d'" -ForegroundColor White
Write-Host ""
Write-Host "常用命令 (在 PowerShell 中执行):" -ForegroundColor Cyan
Write-Host "  查看状态:    wsl bash -c 'cd /opt/supabase/supabase-docker && docker compose ps'" -ForegroundColor White
Write-Host "  查看日志:    wsl bash -c 'cd /opt/supabase/supabase-docker && docker compose logs -f'" -ForegroundColor White
Write-Host "  重启服务:    wsl bash -c 'cd /opt/supabase/supabase-docker && docker compose restart'" -ForegroundColor White
Write-Host "  停止服务:    wsl bash -c 'cd /opt/supabase/supabase-docker && docker compose down'" -ForegroundColor White
Write-Host "  启动服务:    wsl bash -c 'cd /opt/supabase/supabase-docker && sudo service docker start && docker compose up -d'" -ForegroundColor White
Write-Host ""
Write-Host "注意: WSL2 重启后 Docker 不会自动启动，需手动执行:" -ForegroundColor Red
Write-Host "  wsl bash -c 'sudo service docker start'" -ForegroundColor Yellow
Write-Host ""
Write-Host "重要: 请妥善保管部署信息中的密码！" -ForegroundColor Red
