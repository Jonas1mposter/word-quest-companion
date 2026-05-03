import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Trash2 } from "lucide-react";
import { ParsedWord, WordStat } from "./types";

interface Props {
  wordStats: WordStat[];
  refresh: () => void;
}

export const WordsTab = ({ wordStats, refresh }: Props) => {
  const [rawText, setRawText] = useState("");
  const [grade, setGrade] = useState("8");
  const [unit, setUnit] = useState("1");
  const [difficulty, setDifficulty] = useState("1");
  const [parsedWords, setParsedWords] = useState<ParsedWord[]>([]);
  const [importing, setImporting] = useState(false);

  const parseText = () => {
    const lines = rawText.split("\n").filter((l) => l.trim());
    const words: ParsedWord[] = [];
    for (const line of lines) {
      const m = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
      if (m) {
        words.push({ word: m[1].trim(), meaning: m[2].trim() });
      } else if (line.includes("\t")) {
        const parts = line.split("\t");
        if (parts.length >= 2) words.push({ word: parts[0].trim(), meaning: parts[1].trim() });
      } else if (line.includes("-")) {
        const parts = line.split("-");
        if (parts.length >= 2) words.push({ word: parts[0].trim(), meaning: parts.slice(1).join("-").trim() });
      }
    }
    setParsedWords(words);
    if (words.length > 0) toast.success(`成功解析 ${words.length} 个单词`);
    else toast.error("未能解析任何单词，请检查格式");
  };

  const importWords = async () => {
    if (parsedWords.length === 0) { toast.error("请先解析单词"); return; }
    setImporting(true);
    try {
      const wordsToInsert = parsedWords.map((w) => ({
        word: w.word, meaning: w.meaning,
        grade: parseInt(grade), unit: parseInt(unit), difficulty: parseInt(difficulty),
      }));
      const batchSize = 100;
      let successCount = 0;
      for (let i = 0; i < wordsToInsert.length; i += batchSize) {
        const batch = wordsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("words").insert(batch);
        if (error) toast.error(`批次 ${Math.floor(i / batchSize) + 1} 导入失败: ${error.message}`);
        else successCount += batch.length;
      }
      toast.success(`成功导入 ${successCount} 个单词`);
      setRawText(""); setParsedWords([]); refresh();
    } catch { toast.error("导入失败"); }
    finally { setImporting(false); }
  };

  return (
    <>
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />批量导入单词</CardTitle>
          <CardDescription>每行一个单词，格式：word - 释义</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">年级</label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {wordStats.map((s) => (
                    <SelectItem key={s.grade} value={s.grade.toString()}>{s.grade}年级</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">单元</label>
              <Input type="number" min="1" max="20" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">难度</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">简单</SelectItem>
                  <SelectItem value="2">中等</SelectItem>
                  <SelectItem value="3">困难</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            placeholder={`粘贴单词列表，每行一个，格式如下：\nability - 能力\nabove - 在……上方\nabstract - 抽象的`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />

          <div className="flex gap-2">
            <Button onClick={parseText} disabled={!rawText.trim()}>
              <FileText className="w-4 h-4 mr-2" />解析文本
            </Button>
            {parsedWords.length > 0 && (
              <>
                <Button onClick={importWords} disabled={importing} className="bg-success hover:bg-success/90">
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? "导入中..." : `导入 ${parsedWords.length} 个单词`}
                </Button>
                <Button variant="outline" onClick={() => setParsedWords([])}>
                  <Trash2 className="w-4 h-4 mr-2" />清空
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {parsedWords.length > 0 && (
        <Card className="card-glow mt-6">
          <CardHeader><CardTitle>预览 ({parsedWords.length} 个单词)</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {parsedWords.map((w, i) => (
                <div key={i} className="flex justify-between items-center py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary">
                  <span className="font-medium text-foreground">{w.word}</span>
                  <span className="text-muted-foreground">{w.meaning}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
