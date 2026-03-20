# ============================================================
# 狄邦单词通 - HTTPS 反向代理部署脚本 (PowerShell ISE 兼容)
# 使用 Caddy 自动申请 Let's Encrypt SSL 证书
#
# 前提:
#   1) 已完成 Supabase 部署 (allinone.ps1)
#   2) 域名 DNS 已添加 A 记录指向服务器公网 IP
#   3) 服务器 80 和 443 端口已开放
#
# 使用方法: 在 PowerShell ISE 中打开并按 F5 运行
# ============================================================

$ErrorActionPreference = "Stop"
$DOMAIN = "dsas-jonas-wordmaster.cn"
$INSTALL_DIR = "C:\supabase"

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

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  狄邦单词通 - HTTPS 反向代理部署" -ForegroundColor Magenta
Write-Host "  域名: $DOMAIN" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# ---- 检查 WSL ----
Write-Step "检查 WSL2 Ubuntu..."
$wslCheck = wsl -d Ubuntu -- echo ok 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "WSL2 Ubuntu 未就绪，请先运行 deploy-supabase-allinone.ps1"
    Stop-Script -Code 1
}
Write-Ok "WSL2 Ubuntu 已就绪"

# ---- 部署 Caddy ----
$bashScript = @"
set -e
export DEBIAN_FRONTEND=noninteractive

DOMAIN='$DOMAIN'

echo "[步骤] 启动 Docker 守护进程..."
sudo service docker start || true
sleep 3

echo "[步骤] 停止旧的前端容器 (如果存在)..."
docker rm -f wordquest-frontend 2>/dev/null || true
docker rm -f caddy-proxy 2>/dev/null || true

echo "[步骤] 创建 Caddy 配置..."
mkdir -p /opt/supabase/caddy/data
mkdir -p /opt/supabase/caddy/config

cat > /opt/supabase/caddy/Caddyfile << CADDYEOF
# API 子域名 - Supabase 后端
api.\$DOMAIN {
    reverse_proxy localhost:8000
}

# Studio 子域名
studio.\$DOMAIN {
    reverse_proxy localhost:3000
}
CADDYEOF

echo "[完成] Caddy 配置已创建"

echo "[步骤] 启动 Caddy 容器 (自动申请 SSL 证书)..."
docker run -d \
    --name caddy-proxy \
    --restart unless-stopped \
    --network host \
    -v /opt/supabase/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
    -v /opt/supabase/caddy/data:/data \
    -v /opt/supabase/caddy/config:/config \
    caddy:alpine

sleep 5
if docker ps --filter "name=caddy-proxy" --filter "status=running" -q | grep -q .; then
    echo "[完成] Caddy 已启动，正在申请 SSL 证书..."
else
    echo "[错误] Caddy 启动失败"
    docker logs caddy-proxy 2>&1 | tail -30
    exit 1
fi

# 如果有前端构建产物，启动 nginx 在 3080 端口
FRONTEND_DIST="/opt/supabase/frontend/dist"
if [ -d "\$FRONTEND_DIST" ]; then
    echo "[步骤] 检测到前端构建产物，启动 Nginx 容器..."
    
    mkdir -p /opt/supabase/frontend/nginx
    cat > /opt/supabase/frontend/nginx/default.conf << 'NGINXEOF'
server {
    listen 3080;
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
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXEOF

    docker rm -f wordquest-frontend 2>/dev/null || true
    docker run -d \
        --name wordquest-frontend \
        --restart unless-stopped \
        --network host \
        -v /opt/supabase/frontend/dist:/usr/share/nginx/html:ro \
        -v /opt/supabase/frontend/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro \
        nginx:alpine
    
    # nginx 默认监听 80，我们需要改为 3080
    # 由于用了自定义 conf 已经设置了 listen 3080，直接用 --network host
    echo "[完成] 前端 Nginx 已启动 (端口 3080)"
else
    echo "[警告] 未检测到前端构建产物，请先运行 deploy-frontend.ps1"
    echo "  Caddy 会将请求转发到 Supabase Studio (端口 3000)"
fi

echo ""
echo "[完成] HTTPS 反向代理部署成功!"
echo "  等待 SSL 证书申请完成 (通常 1-2 分钟)..."
sleep 10
docker logs caddy-proxy 2>&1 | tail -10
"@

$tempBash = "$INSTALL_DIR\deploy-https.sh"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempBash, $bashScript, $utf8NoBom)

$tempBashWsl = $tempBash -replace '\\', '/'
if ($tempBashWsl -match '^([A-Za-z]):(.*)') {
    $driveLetter = $Matches[1].ToLower()
    $restPath = $Matches[2]
    $tempBashWsl = "/mnt/$driveLetter$restPath"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  正在部署 HTTPS 反向代理..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

wsl -d Ubuntu -- bash -lc "chmod 755 '$tempBashWsl' && sed -i 's/\r$//' '$tempBashWsl' && '$tempBashWsl'"
$deployExitCode = $LASTEXITCODE

if ($deployExitCode -ne 0) {
    Write-Err "HTTPS 部署失败，退出码: $deployExitCode"
    Stop-Script -Code 1 -PauseMessage "部署失败，请查看上方日志后按回车键关闭窗口..."
}

# ---- 端口转发 ----
Write-Step "配置端口转发 (80, 443)..."
try {
    $wslIp = (wsl -d Ubuntu -- hostname -I 2>&1).Trim().Split(' ')[0]
    if ($wslIp -match '^\d+\.\d+\.\d+\.\d+$') {
        foreach ($port in @(80, 443)) {
            netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null
            netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp
        }
        netsh advfirewall firewall delete rule name="WordQuest-HTTPS" 2>$null
        netsh advfirewall firewall add rule name="WordQuest-HTTPS" dir=in action=allow protocol=TCP localport=80,443
        Write-Ok "端口转发已配置 (80,443 -> WSL $wslIp)"
    }
} catch {
    Write-Warn "端口转发配置失败: $($_.Exception.Message)"
}

# ---- 完成 ----
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  HTTPS 反向代理部署完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  前端:      https://$DOMAIN" -ForegroundColor Cyan
Write-Host "  Studio:    https://studio.$DOMAIN" -ForegroundColor Cyan
Write-Host "  API:       https://$DOMAIN/rest/v1/" -ForegroundColor Cyan
Write-Host "  Auth:      https://$DOMAIN/auth/v1/" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Azure AD 回调地址:" -ForegroundColor Yellow
Write-Host "  https://$DOMAIN/auth/v1/callback" -ForegroundColor White
Write-Host ""
Write-Host "  常用命令:" -ForegroundColor Yellow
Write-Host "    查看证书状态:  wsl -d Ubuntu -- bash -lc 'docker logs caddy-proxy 2>&1 | tail -20'" -ForegroundColor Gray
Write-Host "    重启代理:      wsl -d Ubuntu -- bash -lc 'docker restart caddy-proxy'" -ForegroundColor Gray
Write-Host ""

Stop-Script -Code 0 -PauseMessage "部署完成，按回车键关闭窗口..."
