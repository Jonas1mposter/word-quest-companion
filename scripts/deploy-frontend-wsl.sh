#!/usr/bin/env bash
# ============================================================
# 狄邦单词通 - 前端部署脚本 (WSL2 Ubuntu 内执行)
# 在 WSL2 内构建前端并用 Nginx Docker 容器托管
#
# 使用方法:
#   export SERVER_IP=10.20.2.100
#   chmod +x deploy-frontend-wsl.sh && ./deploy-frontend-wsl.sh
#
# 或从 PowerShell 调用:
#   wsl -d Ubuntu -- bash -lc 'export SERVER_IP=10.20.2.100; /path/to/deploy-frontend-wsl.sh'
# ============================================================

set -euo pipefail

SERVER_IP="${SERVER_IP:-10.20.2.100}"
FRONTEND_DIR="/opt/supabase/frontend"
NGINX_PORT=80

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}[步骤] $1${NC}"; }
ok()    { echo -e "${GREEN}[完成] $1${NC}"; }
warn()  { echo -e "${YELLOW}[警告] $1${NC}"; }
err()   { echo -e "${RED}[错误] $1${NC}"; exit 1; }

echo -e "\n${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  狄邦单词通 - 前端部署${NC}"
echo -e "${MAGENTA}========================================${NC}"

# ---- 安装 Node.js ----
step "检查 Node.js 环境..."
if command -v node >/dev/null 2>&1; then
    ok "Node.js 已安装: $(node --version)"
else
    warn "正在安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null || \
    curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/nodesource/setup_20.x | bash - 2>/dev/null || true
    apt-get install -y nodejs 2>/dev/null || {
        # 备选: 使用 nvm
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install 20
    }
    ok "Node.js 已安装: $(node --version)"
fi

# 配置 npm 镜像
step "配置 npm 国内镜像..."
npm config set registry https://registry.npmmirror.com
ok "npm 镜像已配置"

# ---- 准备前端源码 ----
step "准备前端源码..."
mkdir -p "$FRONTEND_DIR"

# 检查源码是否已存在
if [ -f "$FRONTEND_DIR/package.json" ]; then
    ok "前端源码已存在"
else
    # 检查 Windows 侧是否有源码
    WIN_SOURCE="/mnt/c/supabase/frontend"
    if [ -d "$WIN_SOURCE" ] && [ -f "$WIN_SOURCE/package.json" ]; then
        cp -r "$WIN_SOURCE/"* "$FRONTEND_DIR/"
        ok "已从 Windows 侧复制前端源码"
    else
        err "未找到前端源码！请将项目文件放到以下任一位置:
  方法1: 将项目文件夹放到 C:\\supabase\\frontend\\
  方法2: 将项目文件夹放到 WSL 内 $FRONTEND_DIR/

需要的文件: package.json, src/, index.html, vite.config.ts 等"
    fi
fi

# ---- 安装依赖并构建 ----
step "安装前端依赖 (首次可能需要 3-5 分钟)..."
cd "$FRONTEND_DIR"
npm install --production=false 2>&1
ok "依赖安装完成"

step "构建前端生产版本..."
npm run build 2>&1
ok "前端构建完成"

if [ ! -d "$FRONTEND_DIR/dist" ]; then
    err "构建输出目录 dist 不存在，请检查构建日志"
fi

# ---- 创建 Nginx 配置 ----
step "创建 Nginx 配置..."
mkdir -p "$FRONTEND_DIR/nginx"

cat > "$FRONTEND_DIR/nginx/default.conf" << 'NGINXCONF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;
    gzip_vary on;

    # 静态资源长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 路由 - 所有路径回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到 Supabase
    location /rest/ {
        proxy_pass http://host.docker.internal:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/ {
        proxy_pass http://host.docker.internal:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /storage/ {
        proxy_pass http://host.docker.internal:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /realtime/ {
        proxy_pass http://host.docker.internal:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINXCONF
ok "Nginx 配置已创建"

# ---- 启动 Nginx 容器 ----
step "启动 Nginx 容器..."

# 停止旧容器（如果存在）
docker rm -f wordquest-frontend 2>/dev/null || true

docker run -d \
    --name wordquest-frontend \
    --restart unless-stopped \
    -p ${NGINX_PORT}:80 \
    -v "$FRONTEND_DIR/dist:/usr/share/nginx/html:ro" \
    -v "$FRONTEND_DIR/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
    --add-host=host.docker.internal:host-gateway \
    nginx:alpine

# 等待容器启动
sleep 3
if docker ps --filter "name=wordquest-frontend" --filter "status=running" -q | grep -q .; then
    ok "Nginx 容器已启动"
else
    warn "Nginx 容器可能启动失败，查看日志:"
    docker logs wordquest-frontend 2>&1 | tail -20
fi

# ---- 配置 Windows 端口转发 (如果需要) ----
step "检查端口转发..."
echo -e "${YELLOW}  如果从外部无法访问，请在 PowerShell (管理员) 中执行:${NC}"
echo -e "  netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=80 connectaddress=\$(wsl -d Ubuntu hostname -I | ForEach-Object { \$_.Trim() })"
echo -e "  netsh advfirewall firewall add rule name=\"WordQuest-HTTP\" dir=in action=allow protocol=TCP localport=80"

# ---- 完成 ----
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  前端部署完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "访问地址: ${CYAN}http://${SERVER_IP}${NC}"
echo -e "Supabase Studio: ${CYAN}http://${SERVER_IP}:3000${NC}"
echo -e "Supabase API: ${CYAN}http://${SERVER_IP}:8000${NC}"
echo ""
echo -e "常用命令:"
echo -e "  查看状态:  docker ps --filter name=wordquest-frontend"
echo -e "  查看日志:  docker logs -f wordquest-frontend"
echo -e "  重启前端:  docker restart wordquest-frontend"
echo -e "  更新前端:  cd $FRONTEND_DIR && npm run build && docker restart wordquest-frontend"
echo ""
