import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { canReview, reasonLabels, reviewLabels, reviewStats, type ReviewCase, type ReviewDetail } from './dacReview';

type Decision = { id: string; reviewer_id: string; decision: string; note: string; created_at: string };
const date = (value: string) => new Date(value).toLocaleString('zh-CN');
export default function DacReviewPanel() {
  const [rows, setRows] = useState<ReviewCase[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const generation = useRef(0);

  const load = async () => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      const { data, error } = await supabase.rpc('admin_dac_review_list', { p_status: filter, p_search: search, p_offset: offset });
      if (current !== generation.current) return;
      if (error) throw error;
      const result = data as unknown as { cases: ReviewCase[]; total: number };
      setRows(result.cases); setTotal(result.total);
    } catch { if (current === generation.current) setError('复核名单加载失败，请重试。'); }
    finally { if (current === generation.current) setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(load, 250); return () => { clearTimeout(timer); generation.current++; }; }, [filter, search, offset]);
  const open = async (id: string) => {
    setLoading(true); setError(''); setNote('');
    try {
      const [result, audit] = await Promise.all([
        supabase.rpc('admin_dac_review_detail', { p_case_id: id }),
        supabase.from('dac_review_decisions').select('*').eq('case_id', id).order('created_at', { ascending: false }),
      ]);
      if (result.error || audit.error) throw result.error ?? audit.error;
      setDetail(result.data as unknown as ReviewDetail); setHistory(audit.data ?? []);
    } catch { setError('答题痕迹加载失败，请重试。'); }
    finally { setLoading(false); }
  };
  const decide = async (decision: 'released' | 'upheld') => {
    if (!detail || !canReview(detail.case.status, decision, note)) return;
    if (!window.confirm(`确认对 ${detail.case.username} ${reviewLabels[decision]}？不会恢复已作废对局，也不会解除其他封禁。`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('admin_dac_review_decide', { p_case_id: detail.case.id, p_decision: decision, p_note: note.trim() });
      if (error) throw error;
      toast.success(`已${reviewLabels[decision]}，审核记录已保存`);
      await open(detail.case.id);
    } catch { toast.error('审核未成功，请刷新案例状态后重试。'); }
    finally { setBusy(false); }
  };
  const stats = detail ? reviewStats(detail.answers) : null;
  return <section className="space-y-4 py-2" aria-label="DAC 人工复核">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-gaming text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />拦截玩家复核</h2>
      <Button variant="ghost" size="icon" aria-label="刷新复核" disabled={loading || busy} onClick={() => detail ? open(detail.case.id) : load()}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    {error && <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{error}<Button variant="outline" size="sm" onClick={() => detail ? open(detail.case.id) : load()}>重试</Button></div>}
    {loading ? <div className="flex justify-center py-12" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">加载复核记录</span></div> : detail ? <>
      <Button variant="ghost" size="sm" onClick={() => { setDetail(null); load(); }}><ArrowLeft className="h-4 w-4 mr-2" />返回复核名单</Button>
      <div className="border-b border-border pb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3"><h3 className="text-xl font-semibold break-all">{detail.case.username}</h3><Badge variant={detail.case.status === 'released' ? 'outline' : 'destructive'}>{reviewLabels[detail.case.status]}</Badge><span className="text-sm text-muted-foreground">G{detail.case.grade} · {detail.match.mode}</span></div>
        <p className="text-sm">{reasonLabels[detail.case.reason] ?? detail.case.reason} · {date(detail.case.created_at)}</p>
        <p className="text-xs text-muted-foreground break-all">对局 {detail.case.match_id} · {detail.match.rank_voided ? '已作废排位结算' : '未作废'}</p>
        {detail.case.banned_until && new Date(detail.case.banned_until) > new Date() && <p className="text-sm text-destructive">另有账号封禁，复核放行不会解除该封禁。</p>}
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm"><div><dt className="text-muted-foreground">有效作答</dt><dd className="text-xl font-semibold">{stats?.total ?? 0}</dd></div><div><dt className="text-muted-foreground">正确数</dt><dd className="text-xl font-semibold">{stats?.correct ?? 0}</dd></div><div><dt className="text-muted-foreground">平均用时</dt><dd className="text-xl font-semibold">{stats?.meanMs == null ? '—' : `${(stats.meanMs / 1000).toFixed(2)}秒`}</dd></div></dl>
      <div className="space-y-2"><h4 className="font-semibold">拦截与行为证据</h4>
        {detail.flags.length === 0 && <p className="text-sm text-muted-foreground">没有额外行为记录；不能据此认定作弊。</p>}
        {detail.flags.map(flag => <div key={flag.id} className="border-l-2 border-border pl-3 py-2 text-sm space-y-1"><div className="flex flex-wrap gap-2 items-center"><Badge variant="outline">{flag.source.startsWith('client_') || flag.source === 'bot_input' ? '客户端上报 / 待核实' : '服务器记录'}</Badge><span>{flag.reason}</span></div><p className="text-xs text-muted-foreground">{date(flag.created_at)} · {flag.linked_to_match ? '关联本局' : '相邻时段，未关联本局'} · {flag.source}</p><p className="text-xs break-all text-muted-foreground">{Object.entries(flag.metrics).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(' · ')}</p></div>)}
      </div>
      <div className="space-y-2"><h4 className="font-semibold">逐题答题痕迹</h4><div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]"><thead className="text-left text-muted-foreground"><tr>{['题号', '题型', '提交内容', '判定', '服务器用时', '提交时间'].map(label => <th className="py-2 pr-3 font-normal" key={label}>{label}</th>)}</tr></thead><tbody>{detail.answers.map(a => <tr className="border-t border-border" key={a.question_index}><td className="py-2">{a.question_index + 1}</td><td>{a.question_type ?? '未记录'}</td><td className="max-w-48 break-all py-2 pr-3" data-no-translate>{a.answer}</td><td className={a.is_correct ? 'text-success' : 'text-destructive'}>{a.is_correct ? '正确' : '错误'}</td><td>{a.elapsed_ms == null ? '未记录' : `${(a.elapsed_ms / 1000).toFixed(2)}秒`}</td><td className="text-xs">{date(a.answered_at)}</td></tr>)}</tbody></table></div>{detail.answers.length === 0 && <p className="text-sm text-muted-foreground">拦截前没有服务器持久化作答记录。</p>}</div>
      <div className="space-y-3 border-t border-border pt-4"><h4 className="font-semibold">审核决定</h4>
        {detail.case.status !== 'released' && <><label className="text-sm" htmlFor="dac-review-note">审核理由</label><Textarea id="dac-review-note" maxLength={1000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} placeholder="填写依据、核查结果或需补充的证据" /><div className="flex flex-wrap gap-2"><Button disabled={busy || !canReview(detail.case.status, 'released', note)} onClick={() => decide('released')}><ShieldCheck className="h-4 w-4 mr-2" />放行</Button><Button variant="destructive" disabled={busy || !canReview(detail.case.status, 'upheld', note)} onClick={() => decide('upheld')}><ShieldAlert className="h-4 w-4 mr-2" />维持拦截</Button></div></>}
        {history.map(h => <div key={h.id} className="border-l-2 border-border pl-3 text-sm"><p>{h.decision === 'released' ? '放行' : '维持拦截'} · {date(h.created_at)}</p><p className="break-words">{h.note}</p><p className="text-xs text-muted-foreground break-all">审核人 {h.reviewer_id}</p></div>)}
      </div>
    </> : <>
      <div className="flex flex-col sm:flex-row gap-3"><Select value={filter} onValueChange={v => { setFilter(v); setOffset(0); }}><SelectTrigger className="sm:w-40" aria-label="复核状态"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">待复核</SelectItem><SelectItem value="upheld">维持拦截</SelectItem><SelectItem value="released">已放行</SelectItem><SelectItem value="all">全部案例</SelectItem></SelectContent></Select><Input aria-label="搜索复核玩家" placeholder="搜索玩家昵称或资料 ID" value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }} /></div>
      {!error && rows.length === 0 && <p className="text-center text-muted-foreground py-10">暂无{filter === 'all' ? '' : reviewLabels[filter as keyof typeof reviewLabels]}案例</p>}
      <div className="divide-y divide-border">{rows.map(c => <div key={c.id} className="flex flex-wrap items-center gap-3 py-4"><div className="flex-1 min-w-0"><p className="font-semibold break-all">{c.username} <span className="text-xs text-muted-foreground">G{c.grade}</span></p><p className="text-sm text-muted-foreground">{reasonLabels[c.reason] ?? c.reason}</p><p className="text-xs text-muted-foreground">{date(c.created_at)}</p></div><Badge variant={c.status === 'released' ? 'outline' : 'destructive'}>{reviewLabels[c.status]}</Badge><Button variant="outline" size="sm" onClick={() => open(c.id)}>查看痕迹</Button></div>)}</div>
      <div className="flex justify-between items-center text-sm text-muted-foreground"><span>共 {total} 个案例</span><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="上一页" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 30))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="下一页" disabled={offset + 30 >= total} onClick={() => setOffset(offset + 30)}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </>}
  </section>;
}