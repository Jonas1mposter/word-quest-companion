# ============================================================
# 狄邦单词通 - 前端部署脚本 (PowerShell ISE 兼容)
# 在 Windows Server 上执行，通过 WSL2 构建并部署前端
#
# 使用方法: 在 PowerShell ISE 中打开并按 F5 运行
# 前提: 1) 已完成 Supabase 部署 (allinone.ps1)
#        2) 将前端项目文件放到 C:\supabase\frontend\
# ============================================================

$ErrorActionPreference = "Stop"
$SERVER_IP = "10.20.2.100"
$INSTALL_DIR = "C:\supabase"
$FRONTEND_WIN = "$INSTALL_DIR\frontend"

function Write-Step  { param($msg) Write-Host "`n[步骤] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "[完成] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "[警告] $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "[错误] $msg" -ForegroundColor Red }

function Stop-Script {
    param($Code = 0, $PauseMessage = "按回车键关闭窗口...")
    Write-Host ""
    Write-Host $PauseMessage -ForegroundColor Gray
    Read-Host | Out-Null
    exit $Code
}

function Invoke-WslBash {
    param([string]$Command)
    $result = wsl -d Ubuntu -- bash -lc $Command 2>&1
    $exitCode = $LASTEXITCODE
    if ($result) { Write-Host $result }
    return $exitCode
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  狄邦单词通 - 前端部署" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# ---- 检查前端源码 ----
Write-Step "检查前端源码..."
if (-not (Test-Path "$FRONTEND_WIN\package.json")) {
    Write-Err "未找到前端源码！"
    Write-Host "  请将项目的所有文件复制到: $FRONTEND_WIN\" -ForegroundColor Yellow
    Write-Host "  需要包含: package.json, src/, index.html, vite.config.ts 等" -ForegroundColor Yellow
    Stop-Script -Code 1 -PauseMessage "请先复制前端文件后重试..."
}
Write-Ok "前端源码已就绪"

# ---- 检查 WSL ----
Write-Step "检查 WSL2 Ubuntu..."
$wslCheck = wsl -d Ubuntu -- echo ok 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "WSL2 Ubuntu 未就绪，请先运行 deploy-supabase-allinone.ps1"
    Stop-Script -Code 1
}
Write-Ok "WSL2 Ubuntu 已就绪"

# ---- 转换路径 ----
$FRONTEND_WSL = $FRONTEND_WIN -replace '\\', '/'
if ($FRONTEND_WSL -match '^([A-Za-z]):(.*)') {
    $driveLetter = $Matches[1].ToLower()
    $restPath = $Matches[2]
    $FRONTEND_WSL = "/mnt/$driveLetter$restPath"
}

# ---- 在 WSL 内安装 Node.js ----
Write-Step "在 WSL 内安装 Node.js..."
$bashScript = @"
set -e
export DEBIAN_FRONTEND=noninteractive

if command -v node >/dev/null 2>&1; then
    echo "[完成] Node.js 已安装: `$(node --version)"
else
    echo "[步骤] 安装 Node.js 20.x..."
    apt-get update -y >/dev/null 2>&1
    apt-get install -y curl >/dev/null 2>&1
    curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1 || true
    apt-get install -y nodejs >/dev/null 2>&1
    echo "[完成] Node.js 已安装: `$(node --version)"
fi

npm config set registry https://registry.npmmirror.com 2>/dev/null || true
echo "[完成] npm 镜像已配置"

echo "[步骤] 安装前端依赖..."
cd '$FRONTEND_WSL'
npm install --legacy-peer-deps 2>&1
echo "[完成] 依赖安装完成"

echo "[步骤] 构建前端..."
npm run build 2>&1
echo "[完成] 前端构建完成"

if [ ! -d '$FRONTEND_WSL/dist' ]; then
    echo "[错误] 构建输出 dist 目录不存在"
    exit 1
fi

echo "[步骤] 创建 Nginx 配置..."
mkdir -p '$FRONTEND_WSL/nginx'
cat > '$FRONTEND_WSL/nginx/default.conf' << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;
    gzip_vary on;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files `$uri `$uri/ /index.html;
    }
}
NGINXEOF
echo "[完成] Nginx 配置已创建"

echo "[步骤] 启动 Nginx 容器..."
docker rm -f wordquest-frontend 2>/dev/null || true

docker run -d \
    --name wordquest-frontend \
    --restart unless-stopped \
    -p 80:80 \
    -v '$FRONTEND_WSL/dist:/usr/share/nginx/html:ro' \
    -v '$FRONTEND_WSL/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro' \
    nginx:alpine

sleep 3
if docker ps --filter "name=wordquest-frontend" --filter "status=running" -q | grep -q .; then
    echo "[完成] Nginx 容器已启动"
else
    echo "[错误] Nginx 容器启动失败"
    docker logs wordquest-frontend 2>&1 | tail -20
    exit 1
fi

echo "[完成] 前端部署成功"
"@

# 写入临时 bash 脚本
$tempBash = "$INSTALL_DIR\deploy-frontend.sh"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempBash, $bashScript, $utf8NoBom)

# 转换临时脚本路径
$tempBashWsl = $tempBash -replace '\\', '/'
if ($tempBashWsl -match '^([A-Za-z]):(.*)') {
    $driveLetter2 = $Matches[1].ToLower()
    $restPath2 = $Matches[2]
    $tempBashWsl = "/mnt/$driveLetter2$restPath2"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  正在构建并部署前端..." -ForegroundColor Yellow
Write-Host "  首次需要 5-10 分钟，请耐心等待" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

wsl -d Ubuntu -- bash -lc "chmod 755 '$tempBashWsl' && sed -i 's/\r$//' '$tempBashWsl' && '$tempBashWsl'"
$deployExitCode = $LASTEXITCODE

if ($deployExitCode -ne 0) {
    Write-Err "前端部署失败，退出码: $deployExitCode"
    Stop-Script -Code 1 -PauseMessage "部署失败，请查看上方日志后按回车键关闭窗口..."
}

# ---- 端口转发 ----
Write-Step "配置端口转发 (端口 80)..."
try {
    $wslIp = (wsl -d Ubuntu -- hostname -I 2>&1).Trim().Split(' ')[0]
    if ($wslIp -match '^\d+\.\d+\.\d+\.\d+$') {
        netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0 2>$null
        netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=$wslIp
        netsh advfirewall firewall delete rule name="WordQuest-HTTP" 2>$null
        netsh advfirewall firewall add rule name="WordQuest-HTTP" dir=in action=allow protocol=TCP localport=80
        Write-Ok "端口转发已配置 (80 -> WSL $wslIp:80)"
    } else {
        Write-Warn "无法获取 WSL IP，请手动配置端口转发"
    }
} catch {
    Write-Warn "端口转发配置失败: $($_.Exception.Message)"
}

# ---- 完成 ----
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  前端部署完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  访问地址:  http://${SERVER_IP}" -ForegroundColor Cyan
Write-Host "  Studio:    http://${SERVER_IP}:3000" -ForegroundColor Cyan
Write-Host "  API:       http://${SERVER_IP}:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  更新前端:" -ForegroundColor Yellow
Write-Host "    1. 更新 C:\supabase\frontend\ 中的文件" -ForegroundColor Gray
Write-Host "    2. 重新运行此脚本" -ForegroundColor Gray
Write-Host ""

Stop-Script -Code 0 -PauseMessage "部署完成，按回车键关闭窗口..."
