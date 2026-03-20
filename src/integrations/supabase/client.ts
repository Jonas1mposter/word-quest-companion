import { createClient } from '@supabase/supabase-js';

// 自托管 Supabase 配置
// 生产环境: 前端 Nginx 反向代理 /rest/ /auth/ /storage/ /realtime/ 到 Supabase
// 开发环境: 直接连接服务器 IP
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://10.20.2.100:8000";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
