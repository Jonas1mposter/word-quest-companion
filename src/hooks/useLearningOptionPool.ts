import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LearningOptionWord } from "@/lib/learningOptions";

export function useLearningOptionPool(table: "words" | "hs_words" | "math_words" | "science_words", grade?: number, subject?: string) {
  return useQuery({
    queryKey: ["learning-option-pool", table, grade, subject],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<LearningOptionWord[]> => {
      const load = async () => {
        if (table === "words") {
          let query = supabase.from("words").select("word, meaning").order("word").limit(1000);
          if (grade !== undefined) query = query.eq("grade", grade);
          return await query;
        }
        if (table === "hs_words") {
          let query = supabase.from("hs_words").select("word, meaning").order("word").limit(1000);
          if (grade !== undefined) query = query.eq("grade", grade >= 9 ? 9 : grade);
          if (subject) query = query.eq("subject", subject);
          return await query;
        }
        if (table === "science_words") {
          let query = supabase.from("science_words").select("word, meaning").order("word").limit(1000);
          if (subject) query = query.eq("subject", subject);
          return await query;
        }
        return await supabase.from("math_words").select("word, meaning").order("word").limit(1000);
      };
      const { data, error } = await load();
      if (error) throw error;
      if (!data || data.length < 4) throw new Error("Insufficient vocabulary");
      return data;
    },
  });
}