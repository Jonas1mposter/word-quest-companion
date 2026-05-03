import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, MessageSquareText } from "lucide-react";
import { WordStat } from "./types";

interface Props {
  wordStats: WordStat[];
  wordsWithoutExamples: number;
  refresh: () => void;
}

export const ExamplesTab = ({ wordStats, wordsWithoutExamples, refresh }: Props) => {
  const [exampleGrade, setExampleGrade] = useState("8");
  const [generatingExamples, setGeneratingExamples] = useState(false);

  const generateExamples = async (generateAll = false) => {
    setGeneratingExamples(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-examples", {
        body: { batchSize: 20, grade: parseInt(exampleGrade), generateAll },
      });
      if (error) throw error;
      if (data.error) {
        if (data.error.includes("Rate limit")) toast.error("请求过于频繁，请稍后再试");
        else if (data.error.includes("credits")) toast.error("AI额度不足，请联系管理员");
        else toast.error(data.error);
      } else {
        toast.success(data.message || `成功生成 ${data.updated} 个例句`);
        if (!generateAll) refresh();
      }
    } catch { toast.error("生成例句失败"); }
    finally { setGeneratingExamples(false); }
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquareText className="w-5 h-5 text-accent" />AI生成例句</CardTitle>
        <CardDescription>使用AI为没有例句的单词自动生成例句</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
          <div>
            <div className="text-lg font-medium">待生成例句</div>
            <div className="text-sm text-muted-foreground">数据库中没有例句的单词数量</div>
          </div>
          <Badge variant="destructive" className="text-lg px-4 py-2">{wordsWithoutExamples} 个</Badge>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">选择年级</label>
          <Select value={exampleGrade} onValueChange={setExampleGrade}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {wordStats.map((s) => (
                <SelectItem key={s.grade} value={s.grade.toString()}>{s.grade}年级</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium text-primary">AI生成说明</div>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• 每次生成最多20个单词的例句</li>
                <li>• 例句适合初高中学生学习</li>
                <li>• 例句简洁清晰，不超过15个单词</li>
                <li>• 可以多次点击生成更多例句</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => generateExamples(false)} disabled={generatingExamples || wordsWithoutExamples === 0}
            className="flex-1" size="lg">
            <Sparkles className={`w-4 h-4 mr-2 ${generatingExamples ? "animate-spin" : ""}`} />
            {generatingExamples ? "生成中..." : "生成20个例句"}
          </Button>
          <Button onClick={() => generateExamples(true)} disabled={generatingExamples || wordsWithoutExamples === 0}
            className="flex-1 bg-gradient-to-r from-primary to-neon-pink hover:opacity-90" size="lg">
            <Sparkles className={`w-4 h-4 mr-2 ${generatingExamples ? "animate-spin" : ""}`} />
            {generatingExamples ? "启动中..." : `生成全部 (${wordsWithoutExamples}个)`}
          </Button>
        </div>

        {wordsWithoutExamples === 0 && (
          <p className="text-sm text-green-500 text-center">所有单词都已有例句！</p>
        )}
      </CardContent>
    </Card>
  );
};
