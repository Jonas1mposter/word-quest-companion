import { createClient } from '@supabase/supabase-js';

// 自托管 Supabase 配置
// 部署后请确保这些值与服务器上的 deployment-info.txt 一致
const SUPABASE_URL = "http://10.20.2.100:8000";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
