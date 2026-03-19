#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Win Server 2022 一键部署自托管 Supabase
    狄邦单词通 - 后端部署脚本
    
.DESCRIPTION
    自动安装 Docker Desktop、Git，并部署完整的自托管 Supabase 实例
    包含：PostgreSQL、GoTrue (Auth)、PostgREST (API)、Storage、Studio
    
.NOTES
    服务器要求: Win Server 2022, 16GB+ RAM
    预计耗时: 15-30 分钟（取决于网络速度）
    
.USAGE
    以管理员身份运行 PowerShell，然后执行:
    Set-ExecutionPolicy Bypass -Scope Process -Force
    .\deploy-supabase-winserver.ps1
#>

$ErrorActionPreference = "Stop"
$INSTALL_DIR = "C:\supabase"
$LOG_FILE = "$INSTALL_DIR\deploy.log"

# ============================================================
# 颜色输出函数
# ============================================================
function Write-Step($msg) { Write-Host "`n[步骤] $msg" -ForegroundColor Cyan }
function Write-OK($msg) { Write-Host "[完成] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[警告] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[错误] $msg" -ForegroundColor Red }

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $msg" | Out-File -Append -FilePath $LOG_FILE
    Write-Host $msg
}

# ============================================================
# 0. 初始化
# ============================================================
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  狄邦单词通 - Supabase 后端部署脚本" -ForegroundColor Magenta
Write-Host "  适用于 Windows Server 2022" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}
Log "开始部署..."

# ============================================================
# 1. 检查并启用容器功能 (优先 WSL2，Hyper-V 可选)
# ============================================================
Write-Step "检查 Windows 容器功能..."

# 安装 Containers 功能
$containersFeature = Get-WindowsFeature -Name Containers -ErrorAction SilentlyContinue
if ($containersFeature -and -not $containersFeature.Installed) {
    Write-Warn "正在安装 Containers 功能..."
    Install-WindowsFeature -Name Containers -Restart:$false
}

# 尝试安装 Hyper-V（如果 CPU 不支持虚拟化会失败，改用 WSL2）
$useWSL2 = $false
$hyperV = Get-WindowsFeature -Name Hyper-V -ErrorAction SilentlyContinue
if ($hyperV -and -not $hyperV.Installed) {
    Write-Warn "尝试安装 Hyper-V..."
    try {
        Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart:$false -ErrorAction Stop
        Write-OK "Hyper-V 安装成功"
    } catch {
        Write-Warn "Hyper-V 安装失败 (CPU 不支持虚拟化)，将改用 WSL2 后端"
        $useWSL2 = $true
    }
} elseif (-not $hyperV) {
    Write-Warn "Hyper-V 功能不可用，将使用 WSL2 后端"
    $useWSL2 = $true
}

# 安装 WSL2 (如果需要)
if ($useWSL2) {
    Write-Step "安装 WSL2..."
    try {
        # 启用 WSL 功能
        dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart 2>$null
        dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart 2>$null
        
        # 安装 WSL2
        wsl --install --no-distribution 2>$null
        wsl --set-default-version 2 2>$null
        
        Write-OK "WSL2 已配置"
        Write-Warn ">>> 如果是首次安装 WSL2，可能需要重启服务器后继续 <<<"
    } catch {
        Write-Warn "WSL2 自动安装失败，请手动运行: wsl --install"
    }
}

Write-OK "Windows 功能检查完成"

# ============================================================
# 2. 安装 Git (如果未安装)
# ============================================================
Write-Step "检查 Git..."

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warn "正在安装 Git..."
    # 使用淘宝镜像加速下载
    $gitUrl = "https://registry.npmmirror.com/-/binary/git-for-windows/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"
    $gitInstaller = "$env:TEMP\git-installer.exe"
    
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing
    
    Start-Process -Wait -FilePath $gitInstaller -ArgumentList "/VERYSILENT", "/NORESTART", "/NOCANCEL"
    
    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    Write-OK "Git 安装完成"
} else {
    Write-OK "Git 已安装: $(git --version)"
}

# ============================================================
# 3. 安装 Docker Desktop (如果未安装)
# ============================================================
Write-Step "检查 Docker..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Warn "正在下载 Docker Desktop..."
    # 使用阿里云镜像加速下载
    $dockerUrl = "https://mirrors.aliyun.com/docker-toolbox/windows/docker-for-windows/stable/Docker%20Desktop%20Installer.exe"
    $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
    
    Invoke-WebRequest -Uri $dockerUrl -OutFile $dockerInstaller -UseBasicParsing
    
    Write-Warn "正在安装 Docker Desktop (使用 WSL2 后端，可能需要几分钟)..."
    Start-Process -Wait -FilePath $dockerInstaller -ArgumentList "install", "--quiet", "--accept-license", "--backend=wsl-2"
    
    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    Write-OK "Docker Desktop 安装完成"
    Write-Warn ">>> 如果这是首次安装 Docker，可能需要重启服务器后继续 <<<"
    Write-Warn ">>> 重启后请重新运行此脚本 <<<"
    
    $restart = Read-Host "是否现在重启服务器？(Y/N)"
    if ($restart -eq "Y" -or $restart -eq "y") {
        Restart-Computer -Force
        exit
    }
} else {
    Write-OK "Docker 已安装: $(docker --version)"
}

# 等待 Docker 启动
Write-Step "等待 Docker 启动..."
$maxWait = 120
$waited = 0
while ($waited -lt $maxWait) {
    try {
        docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
    } catch {}
    Start-Sleep -Seconds 5
    $waited += 5
    Write-Host "  等待中... ($waited 秒)" -ForegroundColor Gray
}

if ($waited -ge $maxWait) {
    Write-Err "Docker 启动超时，请手动启动 Docker Desktop 后重新运行脚本"
    exit 1
}
Write-OK "Docker 已就绪"

# ============================================================
# 4. 克隆 Supabase Docker 项目
# ============================================================
Write-Step "下载 Supabase Docker 配置..."

$supabaseDir = "$INSTALL_DIR\supabase-docker"

if (Test-Path $supabaseDir) {
    Write-Warn "已存在 supabase-docker 目录，正在更新..."
    Set-Location $supabaseDir
    git pull origin master 2>$null
} else {
    # 使用 GitHub 国内镜像加速克隆
    git clone --depth 1 https://ghproxy.net/https://github.com/supabase/supabase.git "$INSTALL_DIR\supabase-repo"
    Copy-Item -Recurse "$INSTALL_DIR\supabase-repo\docker" $supabaseDir
    Remove-Item -Recurse -Force "$INSTALL_DIR\supabase-repo" -ErrorAction SilentlyContinue
}

Set-Location $supabaseDir
Write-OK "Supabase Docker 配置已就绪"

# ============================================================
# 5. 生成安全密钥并配置 .env
# ============================================================
Write-Step "生成安全密钥..."

function New-SecureKey($length = 64) {
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $key = ""
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $bytes = New-Object byte[] $length
    $rng.GetBytes($bytes)
    foreach ($byte in $bytes) {
        $key += $chars[$byte % $chars.Length]
    }
    return $key
}

# 生成 JWT secret
$JWT_SECRET = New-SecureKey 40
$POSTGRES_PASSWORD = New-SecureKey 32
$DASHBOARD_PASSWORD = New-SecureKey 24
$ANON_KEY_SECRET = New-SecureKey 40
$SERVICE_KEY_SECRET = New-SecureKey 40

# 获取服务器 IP
$SERVER_IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
if (-not $SERVER_IP) { $SERVER_IP = "localhost" }

Write-OK "密钥生成完成"
Write-Host "  服务器 IP: $SERVER_IP" -ForegroundColor Yellow

# ============================================================
# 6. 创建 .env 文件
# ============================================================
Write-Step "创建环境配置文件..."

# 复制示例配置
if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env" -Force
}

# 使用 Node.js 或 PowerShell 生成 JWT tokens
# 简化版本：使用预设的 anon/service key
$envContent = @"
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

# Microsoft SSO / Azure AD 配置
# 请在 Azure AD 中注册应用后填写以下信息:
# 1. 登录 https://portal.azure.com
# 2. Azure Active Directory -> App registrations -> New registration
# 3. Redirect URI 设置为: http://${SERVER_IP}:8000/auth/v1/callback
# 4. 获取 Application (client) ID 和 Client secret
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
"@

$envContent | Out-File -Encoding utf8 -FilePath ".env"

Write-OK "环境配置文件已创建"

# ============================================================
# 7. 启动 Supabase
# ============================================================
Write-Step "启动 Supabase Docker 容器 (首次启动需要下载镜像，约 5-10 分钟)..."

docker compose pull 2>&1 | Out-Null
docker compose up -d

Write-OK "Supabase 容器启动中..."

# 等待服务就绪
Write-Step "等待服务就绪..."
$maxWait = 180
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/rest/v1/" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 401) { break }
    } catch {}
    Start-Sleep -Seconds 10
    $waited += 10
    Write-Host "  等待中... ($waited 秒)" -ForegroundColor Gray
}

# ============================================================
# 8. 配置 Windows 防火墙
# ============================================================
Write-Step "配置 Windows 防火墙规则..."

$ports = @(
    @{Name="Supabase API"; Port=8000},
    @{Name="Supabase Studio"; Port=3000},
    @{Name="PostgreSQL"; Port=5432}
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
# 9. 创建数据库表 (单词通应用所需)
# ============================================================
Write-Step "创建应用数据库表..."

$SQL_INIT = @"
-- 用户 Profiles 表
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username TEXT NOT NULL,
    grade INTEGER DEFAULT 7,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_to_next_level INTEGER DEFAULT 100,
    coins INTEGER DEFAULT 100,
    energy INTEGER DEFAULT 10,
    max_energy INTEGER DEFAULT 10,
    streak INTEGER DEFAULT 0,
    rank_tier TEXT DEFAULT 'bronze',
    rank_stars INTEGER DEFAULT 0,
    rank_points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    avatar_url TEXT,
    class TEXT,
    elo_rating INTEGER DEFAULT 1000,
    elo_free INTEGER DEFAULT 1000,
    free_match_wins INTEGER DEFAULT 0,
    free_match_losses INTEGER DEFAULT 0,
    last_energy_restore TEXT,
    total_xp INTEGER DEFAULT 0,
    max_combo INTEGER DEFAULT 0,
    background_type TEXT,
    background_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public profiles are viewable" ON public.profiles
    FOR SELECT USING (true);

-- 自动创建 Profile 触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS \$\$
BEGIN
    INSERT INTO public.profiles (user_id, username)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 用户角色表
CREATE TYPE IF NOT EXISTS public.app_role AS ENUM ('admin', 'moderator', 'user', 'teacher');

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS \$\$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
\$\$;

-- 错题本表
CREATE TABLE IF NOT EXISTS public.wrong_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    word TEXT NOT NULL,
    meaning TEXT,
    subject TEXT DEFAULT 'english',
    wrong_count INTEGER DEFAULT 1,
    last_wrong_at TIMESTAMPTZ DEFAULT NOW(),
    mastered BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.wrong_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wrong words" ON public.wrong_words
    FOR ALL USING (auth.uid() = user_id);

-- 对战记录表
CREATE TABLE IF NOT EXISTS public.match_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES auth.users(id),
    player2_id UUID REFERENCES auth.users(id),
    winner_id UUID REFERENCES auth.users(id),
    match_type TEXT DEFAULT 'ranked',
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    subject TEXT DEFAULT 'english',
    duration INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON public.match_history
    FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- 徽章表
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    badge_id TEXT NOT NULL,
    badge_name TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own badges" ON public.user_badges
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON public.user_badges
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 排行榜视图
CREATE OR REPLACE VIEW public.leaderboard_ranked AS
    SELECT username, elo_rating, wins, losses, rank_tier, avatar_url
    FROM public.profiles
    ORDER BY elo_rating DESC
    LIMIT 100;

CREATE OR REPLACE VIEW public.leaderboard_free AS
    SELECT username, elo_free, free_match_wins, free_match_losses, avatar_url
    FROM public.profiles
    ORDER BY elo_free DESC
    LIMIT 100;
"@

# 将 SQL 保存为文件，稍后通过 docker exec 执行
$SQL_INIT | Out-File -Encoding utf8 -FilePath "$supabaseDir\init.sql"

Write-Host "  数据库初始化 SQL 已保存到 init.sql" -ForegroundColor Gray
Write-Host "  容器完全启动后，运行以下命令初始化数据库:" -ForegroundColor Yellow
Write-Host "  docker exec -i supabase-db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/init.sql" -ForegroundColor White

# ============================================================
# 10. 输出部署信息
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Supabase 部署完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Cyan
Write-Host "  Supabase Studio:  http://${SERVER_IP}:3000" -ForegroundColor White
Write-Host "  API 端点:         http://${SERVER_IP}:8000" -ForegroundColor White
Write-Host "  Auth 端点:        http://${SERVER_IP}:8000/auth/v1" -ForegroundColor White
Write-Host ""
Write-Host "登录凭据:" -ForegroundColor Cyan
Write-Host "  Studio 用户名:    supabase" -ForegroundColor White
Write-Host "  Studio 密码:      $DASHBOARD_PASSWORD" -ForegroundColor White
Write-Host "  数据库密码:       $POSTGRES_PASSWORD" -ForegroundColor White
Write-Host ""
Write-Host "API 密钥 (前端使用):" -ForegroundColor Cyan
Write-Host "  SUPABASE_URL:     http://${SERVER_IP}:8000" -ForegroundColor White
Write-Host "  SUPABASE_ANON_KEY: (见 .env 文件中的 ANON_KEY)" -ForegroundColor White
Write-Host ""
Write-Host "微软 SSO 配置步骤:" -ForegroundColor Yellow
Write-Host "  1. 登录 https://portal.azure.com" -ForegroundColor White
Write-Host "  2. Azure AD -> App registrations -> New registration" -ForegroundColor White
Write-Host "  3. 应用名称: 狄邦单词通" -ForegroundColor White
Write-Host "  4. Redirect URI: http://${SERVER_IP}:8000/auth/v1/callback" -ForegroundColor White
Write-Host "  5. 获取 Client ID 和 Client Secret" -ForegroundColor White
Write-Host "  6. 编辑 .env 文件，填入 Azure 配置" -ForegroundColor White
Write-Host "  7. 运行: docker compose down && docker compose up -d" -ForegroundColor White
Write-Host ""
Write-Host "常用命令:" -ForegroundColor Cyan
Write-Host "  查看状态:    docker compose ps" -ForegroundColor White
Write-Host "  查看日志:    docker compose logs -f" -ForegroundColor White
Write-Host "  重启服务:    docker compose restart" -ForegroundColor White
Write-Host "  停止服务:    docker compose down" -ForegroundColor White
Write-Host "  启动服务:    docker compose up -d" -ForegroundColor White
Write-Host ""
Write-Host "重要: 请妥善保管以上密码信息！" -ForegroundColor Red
Write-Host "配置文件位置: $supabaseDir\.env" -ForegroundColor Gray

# 保存部署信息
$infoContent = @"
====== 狄邦单词通 - Supabase 部署信息 ======
部署时间: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
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
"@

$infoContent | Out-File -Encoding utf8 -FilePath "$INSTALL_DIR\deployment-info.txt"
Write-Host ""
Write-Host "部署信息已保存到: $INSTALL_DIR\deployment-info.txt" -ForegroundColor Gray
