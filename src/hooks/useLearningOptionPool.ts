import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LearningOptionWord } from "@/lib/learningOptions";

export function useLearningOptionPool(table: "words" | "hs_words" | "math_words" | "science_words", grade?: number, subject?: string) {
  return useQuery({
    queryKey: ["learning-option-pool", table, grade, subject],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<LearningOptionWord[]> => {
      let query = supabase.from(table).select("word, meaning").order("word").limit(1000);
      if (table === "words" && grade !== undefined) query = query.eq("grade", grade);
      if (table === "hs_words" && grade !== undefined) query = query.eq("grade", grade >= 9 ? 9 : grade);
      if ((table === "hs_words" || table === "science_words") && subject) query = query.eq("subject", subject);
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length < 4) throw new Error("Insufficient vocabulary");
      return data;
    },
  });
}