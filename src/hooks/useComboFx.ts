import { useCallback, useState } from "react";
import { useMatchSounds } from "@/hooks/useMatchSounds";

/** 娱乐模式共用的连击音效：答对累加并播放当前音效包对应段位，答错清零。 */
export const useComboFx = () => {
  const { playCombo } = useMatchSounds();
  const [combo, setCombo] = useState(0);
  const register = useCallback((correct: boolean) => {
    setCombo((c) => {
      const next = correct ? c + 1 : 0;
      if (correct) void playCombo(next);
      return next;
    });
  }, [playCombo]);
  const reset = useCallback(() => setCombo(0), []);
  return { combo, register, reset };
};
