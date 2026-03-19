#!/usr/bin/env bash
# ============================================================
# 狄邦单词通 - WSL2 Ubuntu 内 Supabase 部署脚本
# 由 deploy-supabase-winserver.ps1 自动调用
# 也可以手动在 WSL2 Ubuntu 内执行:
#   export SERVER_IP=你的服务器IP
#   chmod +x deploy-supabase-wsl.sh && sudo ./deploy-supabase-wsl.sh
# ============================================================

set -euo pipefail

INSTALL_DIR="/opt/supabase"
LOG_FILE="$INSTALL_DIR/deploy.log"
SERVER_IP="${SERVER_IP:-localhost}"

# ============================================================
# 颜色输出
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;37m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}[步骤] $1${NC}"; }
ok()    { echo -e "${GREEN}[完成] $1${NC}"; }
warn()  { echo -e "${YELLOW}[警告] $1${NC}"; }
err()   { echo -e "${RED}[错误] $1${NC}"; }

log() {
    local msg="$(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo "$msg" >> "$LOG_FILE"
    echo -e "$1"
}

# ============================================================
# 生成随机密钥
# ============================================================
gen_key() {
    local length=${1:-64}
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$length" 2>/dev/null || \
    openssl rand -base64 "$length" | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

# ============================================================
# 0. 初始化
# ============================================================
echo -e "\n${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  狄邦单词通 - Supabase WSL2 部署${NC}"
echo -e "${MAGENTA}========================================${NC}"

sudo mkdir -p "$INSTALL_DIR"
sudo chown "$(whoami):$(whoami)" "$INSTALL_DIR"
log "开始部署... SERVER_IP=$SERVER_IP"

# ============================================================
# 1. 安装 Docker Engine
# ============================================================
step "安装 Docker Engine..."

if command -v docker &> /dev/null && docker info &> /dev/null; then
    ok "Docker Engine 已安装并运行: $(docker --version)"
else
    warn "正在安装 Docker Engine..."

    # 卸载旧版本
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    # 安装依赖
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    # 添加 Docker 官方 GPG key (使用阿里云镜像)
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # 添加 Docker apt 源 (使用阿里云镜像)
    UBUNTU_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $UBUNTU_CODENAME stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # 安装 Docker Engine
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # 将当前用户加入 docker 组
    sudo usermod -aG docker "$(whoami)" 2>/dev/null || true

    ok "Docker Engine 安装完成"
fi

# 启动 Docker 服务 (WSL2 不使用 systemd，用 service 命令)
step "启动 Docker 服务..."
sudo service docker start 2>/dev/null || sudo dockerd &>/dev/null &

# 等待 Docker 就绪
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker info &>/dev/null; then
        break
    fi
    sleep 3
    WAITED=$((WAITED + 3))
    echo -e "${GRAY}  等待 Docker 启动... (${WAITED}秒)${NC}"
done

if ! docker info &>/dev/null; then
    err "Docker 启动失败"
    echo "  请检查: sudo service docker status"
    echo "  或尝试: sudo dockerd"
    exit 1
fi

ok "Docker 已就绪: $(docker --version)"

# ============================================================
# 2. 配置 Docker 镜像加速器 (国内)
# ============================================================
step "配置 Docker 镜像加速器..."

sudo mkdir -p /etc/docker
cat <<'DAEMON_JSON' | sudo tee /etc/docker/daemon.json > /dev/null
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
DAEMON_JSON

sudo service docker restart 2>/dev/null || true

# 再次等待
WAITED=0
while [ $WAITED -lt 30 ]; do
    if docker info &>/dev/null; then break; fi
    sleep 2
    WAITED=$((WAITED + 2))
done

ok "Docker 镜像加速器已配置"

# ============================================================
# 3. 安装 Git 并克隆 Supabase
# ============================================================
step "下载 Supabase Docker 配置..."

sudo apt-get install -y git 2>/dev/null || true

SUPABASE_DIR="$INSTALL_DIR/supabase-docker"

if [ -d "$SUPABASE_DIR" ]; then
    warn "已存在 supabase-docker 目录，跳过克隆"
else
    # 使用 GitHub 代理加速
    REPO_URL="https://ghproxy.net/https://github.com/supabase/supabase.git"
    
    # 如果代理失败，回退到直连
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR/supabase-repo" 2>/dev/null || \
    git clone --depth 1 "https://github.com/supabase/supabase.git" "$INSTALL_DIR/supabase-repo"
    
    cp -r "$INSTALL_DIR/supabase-repo/docker" "$SUPABASE_DIR"
    rm -rf "$INSTALL_DIR/supabase-repo"
fi

ok "Supabase Docker 配置已就绪"

# ============================================================
# 4. 生成安全密钥并创建 .env
# ============================================================
step "生成安全密钥..."

JWT_SECRET=$(gen_key 40)
POSTGRES_PASSWORD=$(gen_key 32)
DASHBOARD_PASSWORD=$(gen_key 24)

ok "密钥生成完成"

step "创建环境配置文件..."

cd "$SUPABASE_DIR"

# 如果有示例配置先复制
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

# Microsoft SSO / Azure AD 配置
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

# ============================================================
# 5. 启动 Supabase
# ============================================================
step "拉取 Supabase Docker 镜像 (首次需要下载，约 5-15 分钟)..."

docker compose pull 2>&1 || warn "部分镜像拉取失败，将在启动时重试"

step "启动 Supabase 容器..."
docker compose up -d

ok "Supabase 容器启动中..."

# 等待服务就绪
step "等待服务就绪..."
MAX_WAIT=180
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8000/rest/v1/" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
        break
    fi
    sleep 10
    WAITED=$((WAITED + 10))
    echo -e "${GRAY}  等待中... (${WAITED}秒) [HTTP: ${HTTP_CODE}]${NC}"
done

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "401" ]; then
    warn "服务可能还在启动中，请稍后手动检查"
    echo "  检查命令: docker compose ps"
    echo "  查看日志: docker compose logs -f"
else
    ok "Supabase API 已就绪"
fi

# ============================================================
# 6. 创建数据库表
# ============================================================
step "创建应用数据库表..."

cat > "$SUPABASE_DIR/init.sql" << 'SQLEOF'
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable') THEN
        CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (true);
    END IF;
END $$;

-- 自动创建 Profile 触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, username)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 用户角色表
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user', 'teacher');
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
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

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
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wrong_words' AND policyname = 'Users manage own wrong words') THEN
        CREATE POLICY "Users manage own wrong words" ON public.wrong_words FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

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
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'match_history' AND policyname = 'Users can view own matches') THEN
        CREATE POLICY "Users can view own matches" ON public.match_history FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);
    END IF;
END $$;

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
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_badges' AND policyname = 'Users can view own badges') THEN
        CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_badges' AND policyname = 'Users can insert own badges') THEN
        CREATE POLICY "Users can insert own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

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
SQLEOF

# 尝试执行 SQL 初始化
DB_CONTAINER=$(docker compose ps -q db 2>/dev/null || echo "")
if [ -n "$DB_CONTAINER" ]; then
    # 等待数据库就绪
    for i in $(seq 1 30); do
        if docker exec "$DB_CONTAINER" pg_isready -U postgres &>/dev/null; then
            break
        fi
        sleep 2
    done

    if docker exec "$DB_CONTAINER" pg_isready -U postgres &>/dev/null; then
        docker cp "$SUPABASE_DIR/init.sql" "$DB_CONTAINER:/tmp/init.sql"
        docker exec "$DB_CONTAINER" psql -U postgres -d postgres -f /tmp/init.sql 2>&1 || \
            warn "部分 SQL 语句执行失败（可能表已存在），这通常是正常的"
        ok "数据库表初始化完成"
    else
        warn "数据库尚未就绪，请稍后手动执行:"
        echo "  docker exec -i \$(docker compose ps -q db) psql -U postgres -d postgres < init.sql"
    fi
else
    warn "未找到数据库容器，请确认容器已启动后手动执行 SQL 初始化"
fi

# ============================================================
# 7. 保存部署信息
# ============================================================
cat > "$INSTALL_DIR/deployment-info.txt" << INFOEOF
====== 狄邦单词通 - Supabase 部署信息 ======
部署时间: $(date '+%Y-%m-%d %H:%M:%S')
部署方式: WSL2 Ubuntu + Docker Engine
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

# 同时复制到 Windows 端方便查看
cp "$INSTALL_DIR/deployment-info.txt" /mnt/c/supabase/deployment-info.txt 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WSL2 内 Supabase 部署完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "部署信息已保存到: ${GRAY}$INSTALL_DIR/deployment-info.txt${NC}"
echo -e "Windows 端也可查看: ${GRAY}C:\\supabase\\deployment-info.txt${NC}"
