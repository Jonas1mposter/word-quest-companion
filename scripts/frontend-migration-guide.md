# 狄邦单词通 - 前端迁移指南

## 从 localStorage 模拟迁移到真实 Supabase

部署完 Win Server 上的 Supabase 后，需要修改前端代码连接真实后端。

### 步骤 1: 替换 Supabase Client

将 `src/integrations/supabase/client.ts` 替换为真实的 Supabase Client:

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://你的服务器IP:8000';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### 步骤 2: 安装 Supabase JS SDK

```bash
npm install @supabase/supabase-js
```

### 步骤 3: 更新 Auth Hook

`src/hooks/useAuth.tsx` 中的 `fetchProfile` 改为从数据库读取:

```typescript
const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (data) {
    setProfile(data);
  }
};
```

### 步骤 4: 配置微软 SSO

1. 在 Azure Portal 注册应用
2. 在 `.env` 中配置 Azure 参数
3. 前端添加 SSO 按钮:

```typescript
const signInWithMicrosoft = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile',
      redirectTo: window.location.origin
    }
  });
};
```

### 步骤 5: 数据迁移

如需迁移 localStorage 中的现有数据，可在首次连接时运行迁移脚本，
将 localStorage 数据批量插入到 Supabase 数据库中。

---

**注意**: 替换为真实 Supabase 后，所有 localStorage 模拟代码可以删除。
数据库表已在部署脚本中自动创建（包含 RLS 安全策略）。
