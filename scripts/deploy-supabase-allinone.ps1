#Requires -RunAsAdministrator
<#
.SYNOPSIS
    狄邦单词通 - 一体化自托管 Supabase 部署脚本 (ISE 友好版)
    直接在 PowerShell ISE 中复制粘贴运行，无需额外文件。

.NOTES
    服务器要求: Win Server 2022, 16GB+ RAM, 需要开启虚拟化
    预计耗时: 15-30 分钟（取决于网络速度）

.USAGE
    以管理员身份运行 PowerShell ISE，粘贴此脚本，按 F5 执行
#>

$ErrorActionPreference = "Stop"
$INSTALL_DIR = "C:\supabase"
$LOG_FILE = "$INSTALL_DIR\deploy.log"

# ============================================================
# 辅助函数
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

function Stop-Script {
    param(
        [int]$Code = 0,
        [string]$PauseMessage = "按回车键关闭窗口..."
    )
    Write-Host ""
    if ($Code -eq 0) {
        Write-Host "脚本执行结束。" -ForegroundColor Green
    } else {
        Write-Host "脚本已停止，退出码: $Code" -ForegroundColor Red
    }
    Write-Host $PauseMessage -ForegroundColor Yellow
    try { [void](Read-Host) } catch {}
    exit $Code
}

trap {
    $errorMessage = $_.Exception.Message
    $positionMessage = $_.InvocationInfo.PositionMessage
    Write-Err "脚本发生未处理异常: $errorMessage"
    if ($positionMessage) { Write-Host $positionMessage -ForegroundColor DarkYellow }
    try {
        Log "未处理异常: $errorMessage"
        if ($positionMessage) { Log $positionMessage }
    } catch {}
    Stop-Script -Code 1 -PauseMessage "脚本异常退出，请先查看上方报错，按回车键关闭窗口..."
}

# ============================================================
# 0. 初始化
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  狄邦单词通 - Supabase 一体化部署脚本"  -ForegroundColor Magenta
Write-Host "  Windows Server 2022 + WSL2 方案"       -ForegroundColor Magenta
Write-Host "  (ISE 友好版 - 无需外部文件)"            -ForegroundColor Magenta
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

$wslFeature = dism.exe /online /get-featureinfo /featurename:Microsoft-Windows-Subsystem-Linux 2>$null
if ($wslFeature -match "State : Disabled") {
    Write-Warn "正在启用 Windows Subsystem for Linux..."
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    $needReboot = $true
}

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
        return
    }
    Write-Err "请手动重启服务器后重新运行此脚本"
    Stop-Script -Code 1 -PauseMessage "请手动重启服务器后重新运行此脚本，按回车键关闭窗口..."
}

Write-OK "WSL2 所需 Windows 功能已就绪"

# ============================================================
# 2. 配置 WSL2
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

$hasUbuntu = $false

$testRun = wsl -d Ubuntu -- echo "UBUNTU_EXISTS" 2>$null
if ($testRun -match "UBUNTU_EXISTS") {
    $hasUbuntu = $true
}

if (-not $hasUbuntu -and (Test-Path "C:\WSL\Ubuntu\ext4.vhdx")) {
    $hasUbuntu = $true
}

if (-not $hasUbuntu) {
    $wslRaw = (wsl -l 2>$null | Out-String) -replace '\x00', ''
    if ($wslRaw -match "Ubuntu") {
        $hasUbuntu = $true
    }
}

if (-not $hasUbuntu) {
    Write-Warn "正在安装 Ubuntu 发行版..."
    
    $ubuntuRootfsUrl = "https://mirrors.tuna.tsinghua.edu.cn/ubuntu-cloud-images/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz"
    $ubuntuRootfs = "$env:TEMP\ubuntu-wsl.tar.gz"
    $ubuntuInstallDir = "C:\WSL\Ubuntu"
    
    Write-Host "  使用清华大学镜像下载 Ubuntu rootfs..." -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    try {
        Invoke-WebRequest -Uri $ubuntuRootfsUrl -OutFile $ubuntuRootfs -UseBasicParsing
        
        if (-not (Test-Path $ubuntuInstallDir)) {
            New-Item -ItemType Directory -Path $ubuntuInstallDir -Force | Out-Null
        }
        
        wsl --import Ubuntu $ubuntuInstallDir $ubuntuRootfs
        Write-OK "Ubuntu 已通过 rootfs 导入安装"
        Remove-Item $ubuntuRootfs -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warn "清华镜像下载失败，回退到 wsl --install..."
        wsl --install -d Ubuntu --no-launch 2>$null
    }
    
    Write-OK "Ubuntu 发行版已安装"
    
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
# 6. 配置 WSL2 端口转发
# ============================================================
Write-Step "配置 WSL2 端口转发..."

$portProxyReady = $true

try {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        throw "当前 PowerShell 不是管理员权限"
    }

    $ipHelper = Get-Service -Name "iphlpsvc" -ErrorAction Stop
    if ($ipHelper.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Running) {
        Write-Warn "IP Helper 服务未运行，正在尝试启动..."
        Start-Service -Name "iphlpsvc" -ErrorAction Stop
        $ipHelper = Get-Service -Name "iphlpsvc" -ErrorAction Stop
    }

    if ($ipHelper.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Running) {
        throw "IP Helper 服务未成功启动"
    }
} catch {
    $portProxyReady = $false
    Write-Warn "端口转发前置检查失败: $($_.Exception.Message)"
    Log "端口转发前置检查失败: $($_.Exception.Message)"
}

$wslIP = ""
if ($portProxyReady) {
    try {
        $wslIPRaw = wsl -d Ubuntu -- hostname -I 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "无法从 Ubuntu 获取 WSL IP"
        }
        $wslIP = ((($wslIPRaw | Out-String).Trim() -split '\s+') | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1)
        if (-not $wslIP) {
            throw "Ubuntu 已启动，但未获取到有效 IPv4 地址"
        }
    } catch {
        $portProxyReady = $false
        Write-Warn "获取 WSL IP 失败: $($_.Exception.Message)"
        Log "获取 WSL IP 失败: $($_.Exception.Message)"
    }
}

if ($portProxyReady -and $wslIP) {
    Write-Host "  WSL2 内部 IP: $wslIP" -ForegroundColor Gray

    $successCount = 0
    foreach ($p in $ports) {
        try {
            netsh interface portproxy delete v4tov4 listenport=$($p.Port) listenaddress=0.0.0.0 2>$null | Out-Null
            $null = netsh interface portproxy add v4tov4 listenport=$($p.Port) listenaddress=0.0.0.0 connectport=$($p.Port) connectaddress=$wslIP 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "netsh 返回退出码 $LASTEXITCODE"
            }
            $successCount++
            Write-Host "  端口转发: 0.0.0.0:$($p.Port) -> ${wslIP}:$($p.Port)" -ForegroundColor Gray
        } catch {
            Write-Warn "端口 $($p.Port) 转发失败: $($_.Exception.Message)"
            Log "端口 $($p.Port) 转发失败: $($_.Exception.Message)"
        }
    }

    if ($successCount -gt 0) {
        Write-OK "端口转发已配置（成功 $successCount/$($ports.Count)）"
    } else {
        Write-Warn "端口转发未成功配置，后续将继续执行部署"
    }
} else {
    Write-Warn "已跳过自动端口转发，后续将继续执行部署"
    Write-Host "  手动配置命令示例:" -ForegroundColor Gray
    Write-Host "  netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=<WSL_IP>" -ForegroundColor Gray
}

# ============================================================
# 7. 将 bash 部署脚本写入 WSL 并执行 (内嵌，无需外部文件)
# ============================================================
Write-Step "准备在 WSL2 Ubuntu 内执行部署..."

# ---- 内嵌 bash 脚本内容 ----
$bashScript = @'
#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/supabase"
LOG_FILE="$INSTALL_DIR/deploy.log"
SERVER_IP="${SERVER_IP:-localhost}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; GRAY='\033[0;37m'; NC='\033[0m'

step()  { echo -e "\n${CYAN}[步骤] $1${NC}"; }
ok()    { echo -e "${GREEN}[完成] $1${NC}"; }
warn()  { echo -e "${YELLOW}[警告] $1${NC}"; }
err()   { echo -e "${RED}[错误] $1${NC}"; }

run_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"
  elif command -v sudo >/dev/null 2>&1; then sudo "$@"
  else err "当前不是 root，且系统未安装 sudo：$*"; exit 1; fi
}

log() {
    local msg="$(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo "$msg" >> "$LOG_FILE"
    echo -e "$1"
}

gen_key() {
    local length=${1:-64}
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$length" 2>/dev/null || \
    openssl rand -base64 "$length" | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

echo -e "\n${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  狄邦单词通 - Supabase WSL2 部署${NC}"
echo -e "${MAGENTA}========================================${NC}"

run_root mkdir -p "$INSTALL_DIR"
CURRENT_USER="$(id -un)"
if [ "$CURRENT_USER" != "root" ]; then
  run_root chown "$CURRENT_USER:$CURRENT_USER" "$INSTALL_DIR"
fi
log "开始部署... SERVER_IP=$SERVER_IP USER=$CURRENT_USER"

step "预检查 Ubuntu 环境..."
if ! command -v apt-get >/dev/null 2>&1; then
  err "当前发行版不是 Ubuntu/Debian，无法继续"; exit 1
fi

step "安装 Docker Engine..."
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    ok "Docker Engine 已安装并运行: $(docker --version)"
else
    warn "正在安装 Docker Engine..."
    run_root apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    run_root apt-get update -y
    run_root apt-get install -y ca-certificates curl gnupg lsb-release
    run_root install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | run_root gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    run_root chmod a+r /etc/apt/keyrings/docker.gpg
    UBUNTU_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $UBUNTU_CODENAME stable" | run_root tee /etc/apt/sources.list.d/docker.list >/dev/null
    run_root apt-get update -y
    run_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    if [ "$CURRENT_USER" != "root" ]; then
      run_root usermod -aG docker "$CURRENT_USER" 2>/dev/null || true
    fi
    ok "Docker Engine 安装完成"
fi

step "启动 Docker 服务..."
run_root service docker start 2>/dev/null || run_root bash -lc 'nohup dockerd >/var/log/dockerd.log 2>&1 &'
MAX_WAIT=60; WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 3; WAITED=$((WAITED + 3))
    echo -e "${GRAY}  等待 Docker 启动... (${WAITED}秒)${NC}"
done
if ! docker info >/dev/null 2>&1; then
    err "Docker 启动失败"; echo "  请检查: service docker status"; exit 1
fi
ok "Docker 已就绪: $(docker --version)"

step "配置 Docker 镜像加速器..."
run_root mkdir -p /etc/docker
cat <<'DAEMON_JSON' | run_root tee /etc/docker/daemon.json >/dev/null
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
DAEMON_JSON
run_root service docker restart 2>/dev/null || true
WAITED=0
while [ $WAITED -lt 30 ]; do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 2; WAITED=$((WAITED + 2))
done
ok "Docker 镜像加速器已配置"

step "下载 Supabase Docker 配置..."
run_root apt-get install -y git 2>/dev/null || true
SUPABASE_DIR="$INSTALL_DIR/supabase-docker"
if [ -d "$SUPABASE_DIR" ]; then
    warn "已存在 supabase-docker 目录，跳过克隆"
else
    REPO_URL="https://ghproxy.net/https://github.com/supabase/supabase.git"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR/supabase-repo" 2>/dev/null || \
    git clone --depth 1 "https://github.com/supabase/supabase.git" "$INSTALL_DIR/supabase-repo"
    cp -r "$INSTALL_DIR/supabase-repo/docker" "$SUPABASE_DIR"
    rm -rf "$INSTALL_DIR/supabase-repo"
fi
ok "Supabase Docker 配置已就绪"

step "生成安全密钥..."
JWT_SECRET=$(gen_key 40)
POSTGRES_PASSWORD=$(gen_key 32)
DASHBOARD_PASSWORD=$(gen_key 24)
ok "密钥生成完成"

step "创建环境配置文件..."
cd "$SUPABASE_DIR"
[ -f ".env.example" ] && cp .env.example .env 2>/dev/null || true

cat > .env << ENVEOF
############
# Secrets
############
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API
############
SITE_URL=http://${SERVER_IP}:3000
ADDITIONAL_REDIRECT_URLS=
API_EXTERNAL_URL=http://${SERVER_IP}:8000

############
# Auth - GoTrue
############
GOTRUE_SITE_URL=http://${SERVER_IP}:3000
GOTRUE_EXTERNAL_GOTRUE_URL=http://${SERVER_IP}:8000/auth/v1

# Microsoft SSO / Azure AD
GOTRUE_EXTERNAL_AZURE_ENABLED=false
GOTRUE_EXTERNAL_AZURE_CLIENT_ID=your-azure-client-id
GOTRUE_EXTERNAL_AZURE_SECRET=your-azure-client-secret
GOTRUE_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=狄邦单词通
STUDIO_DEFAULT_PROJECT=WordQuest
STUDIO_PORT=3000

############
# Storage
############
STORAGE_BACKEND=file
FILE_SIZE_LIMIT=52428800

############
# Misc
############
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENVEOF
ok "环境配置文件已创建"

step "拉取 Supabase Docker 镜像 (首次需要下载，约 5-15 分钟)..."
docker compose pull 2>&1 || warn "部分镜像拉取失败，将在启动时重试"

step "启动 Supabase 容器..."
docker compose up -d
ok "Supabase 容器启动中..."

step "等待服务就绪..."
MAX_WAIT=180; WAITED=0; HTTP_CODE="000"
while [ $WAITED -lt $MAX_WAIT ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8000/rest/v1/" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then break; fi
    sleep 10; WAITED=$((WAITED + 10))
    echo -e "${GRAY}  等待中... (${WAITED}秒) [HTTP: ${HTTP_CODE}]${NC}"
done
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "401" ]; then
    warn "服务可能还在启动中，请稍后手动检查"
else
    ok "Supabase API 已就绪"
fi

step "创建应用数据库表..."
cat > "$SUPABASE_DIR/init.sql" << 'SQLEOF'
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username TEXT NOT NULL,
    grade INTEGER DEFAULT 7, level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0, xp_to_next_level INTEGER DEFAULT 100,
    coins INTEGER DEFAULT 100, energy INTEGER DEFAULT 10, max_energy INTEGER DEFAULT 10,
    streak INTEGER DEFAULT 0,
    rank_tier TEXT DEFAULT 'bronze', rank_stars INTEGER DEFAULT 0, rank_points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
    avatar_url TEXT, class TEXT,
    elo_rating INTEGER DEFAULT 1000, elo_free INTEGER DEFAULT 1000,
    free_match_wins INTEGER DEFAULT 0, free_match_losses INTEGER DEFAULT 0,
    last_energy_restore TEXT, total_xp INTEGER DEFAULT 0, max_combo INTEGER DEFAULT 0,
    background_type TEXT, background_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()=user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid()=user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid()=user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Public profiles are viewable') THEN
        CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (true);
    END IF;
END $$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, username)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin','moderator','user','teacher');
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE TABLE IF NOT EXISTS public.wrong_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    word TEXT NOT NULL, meaning TEXT, subject TEXT DEFAULT 'english',
    wrong_count INTEGER DEFAULT 1, last_wrong_at TIMESTAMPTZ DEFAULT NOW(),
    mastered BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.wrong_words ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wrong_words' AND policyname='Users manage own wrong words') THEN
        CREATE POLICY "Users manage own wrong words" ON public.wrong_words FOR ALL USING (auth.uid()=user_id);
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.match_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES auth.users(id), player2_id UUID REFERENCES auth.users(id),
    winner_id UUID REFERENCES auth.users(id), match_type TEXT DEFAULT 'ranked',
    player1_score INTEGER DEFAULT 0, player2_score INTEGER DEFAULT 0,
    subject TEXT DEFAULT 'english', duration INTEGER, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='match_history' AND policyname='Users can view own matches') THEN
        CREATE POLICY "Users can view own matches" ON public.match_history FOR SELECT USING (auth.uid()=player1_id OR auth.uid()=player2_id);
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    badge_id TEXT NOT NULL, badge_name TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_badges' AND policyname='Users can view own badges') THEN
        CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid()=user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_badges' AND policyname='Users can insert own badges') THEN
        CREATE POLICY "Users can insert own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid()=user_id);
    END IF;
END $$;
CREATE OR REPLACE VIEW public.leaderboard_ranked AS
    SELECT username, elo_rating, wins, losses, rank_tier, avatar_url FROM public.profiles ORDER BY elo_rating DESC LIMIT 100;
CREATE OR REPLACE VIEW public.leaderboard_free AS
    SELECT username, elo_free, free_match_wins, free_match_losses, avatar_url FROM public.profiles ORDER BY elo_free DESC LIMIT 100;
SQLEOF

DB_CONTAINER=$(docker compose ps -q db 2>/dev/null || echo "")
if [ -n "$DB_CONTAINER" ]; then
    for i in $(seq 1 30); do
        if docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
        sleep 2
    done
    if docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
        docker cp "$SUPABASE_DIR/init.sql" "$DB_CONTAINER:/tmp/init.sql"
        docker exec "$DB_CONTAINER" psql -U postgres -d postgres -f /tmp/init.sql 2>&1 || warn "部分 SQL 语句执行失败（可能表已存在），这通常正常"
        ok "数据库表初始化完成"
    else
        warn "数据库尚未就绪，请稍后手动执行 SQL 初始化"
    fi
else
    warn "未找到数据库容器，请确认容器已启动后手动执行 SQL 初始化"
fi

cat > "$INSTALL_DIR/deployment-info.txt" << INFOEOF
====== 狄邦单词通 - Supabase 部署信息 ======
部署时间: $(date '+%Y-%m-%d %H:%M:%S')
服务器 IP: $SERVER_IP

Supabase Studio: http://${SERVER_IP}:3000
API 端点: http://${SERVER_IP}:8000
Auth 端点: http://${SERVER_IP}:8000/auth/v1

Studio 用户名: supabase
Studio 密码: $DASHBOARD_PASSWORD
数据库密码: $POSTGRES_PASSWORD
JWT Secret: $JWT_SECRET

前端配置:
VITE_SUPABASE_URL=http://${SERVER_IP}:8000
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
INFOEOF

cp "$INSTALL_DIR/deployment-info.txt" /mnt/c/supabase/deployment-info.txt 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WSL2 内 Supabase 部署完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "部署信息已保存到: ${GRAY}$INSTALL_DIR/deployment-info.txt${NC}"
echo -e "Windows 端也可查看: ${GRAY}C:\\supabase\\deployment-info.txt${NC}"
'@

# ---- 将 bash 脚本以 UTF-8 无 BOM 写入 Windows 临时文件，再复制到 WSL ----
$tempScriptPath = "$INSTALL_DIR\deploy-wsl.sh"

# 强制以 UTF-8 无 BOM 编码写入文件（避免 PowerShell 管道编码损坏中文）
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempScriptPath, $bashScript, $utf8NoBom)

# 转换 Windows 路径为 WSL 路径
$wslTempPath = $tempScriptPath -replace '\\', '/'
$wslTempPath = $wslTempPath -replace '^([A-Za-z]):', { '/mnt/' + $_.Groups[1].Value.ToLower() }

$wslScriptDir = "/tmp/supabase-deploy"
wsl -d Ubuntu -- bash -lc "mkdir -p '$wslScriptDir'"
wsl -d Ubuntu -- bash -lc "cp '$wslTempPath' '$wslScriptDir/deploy.sh' && chmod +x '$wslScriptDir/deploy.sh'"

# 修复可能的 Windows 换行符 (CRLF -> LF)
wsl -d Ubuntu -- bash -lc "sed -i 's/\r$//' '$wslScriptDir/deploy.sh'"

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  正在 WSL2 Ubuntu 内执行部署..."        -ForegroundColor Yellow
Write-Host "  这需要 10-20 分钟，请耐心等待"         -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

wsl -d Ubuntu -- bash -lc "export SERVER_IP='$SERVER_IP'; export DEBIAN_FRONTEND=noninteractive; '$wslScriptDir/deploy.sh'"

if ($LASTEXITCODE -ne 0) {
    Write-Err "WSL2 内部署失败，请检查上方日志"
    Write-Host "  可以手动进入 Ubuntu 排查: wsl -d Ubuntu" -ForegroundColor Gray
    Write-Host "  查看日志: wsl -d Ubuntu -- bash -lc 'cat /opt/supabase/deploy.log'" -ForegroundColor Gray
    Stop-Script -Code 1 -PauseMessage "WSL2 内部署失败，请查看上方日志后按回车键关闭窗口..."
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
Write-Host "  请查看: C:\supabase\deployment-info.txt" -ForegroundColor White
Write-Host "  或 WSL 内: wsl -d Ubuntu -- bash -lc 'cat /opt/supabase/deployment-info.txt'" -ForegroundColor Yellow
Write-Host ""
Write-Host "常用命令 (在 PowerShell 中执行):" -ForegroundColor Cyan
Write-Host "  查看状态:    wsl -d Ubuntu -- bash -lc 'cd /opt/supabase/supabase-docker && docker compose ps'" -ForegroundColor White
Write-Host "  查看日志:    wsl -d Ubuntu -- bash -lc 'cd /opt/supabase/supabase-docker && docker compose logs -f'" -ForegroundColor White
Write-Host "  重启服务:    wsl -d Ubuntu -- bash -lc 'cd /opt/supabase/supabase-docker && docker compose restart'" -ForegroundColor White
Write-Host "  停止服务:    wsl -d Ubuntu -- bash -lc 'cd /opt/supabase/supabase-docker && docker compose down'" -ForegroundColor White
Write-Host "  启动服务:    wsl -d Ubuntu -- bash -lc 'cd /opt/supabase/supabase-docker && service docker start && docker compose up -d'" -ForegroundColor White
Write-Host ""
Write-Host "注意: WSL2 重启后 Docker 不会自动启动，需手动执行:" -ForegroundColor Red
Write-Host "  wsl -d Ubuntu -- bash -lc 'service docker start'" -ForegroundColor Yellow
Write-Host ""
Stop-Script -Code 0 -PauseMessage "部署完成，请记录以上信息后按回车键关闭窗口..."
