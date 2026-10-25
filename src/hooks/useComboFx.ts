import { useCallback, useRef, useState } from "react";
import { useMatchSounds } from "@/hooks/useMatchSounds";

/** 娱乐模式共用的连击音效：答对累加并播放当前音效包对应段位，答错清零。 */
export const useComboFx = () => {
  const { playCombo } = useMatchSounds();
  const [combo, setCombo] = useState(0);
  const ref = useRef(0);
  const register = useCallback((correct: boolean) => {
    ref.current = correct ? ref.current + 1 : 0;
    setCombo(ref.current);
    if (correct) void playCombo(ref.current);
  }, [playCombo]);
  const reset = useCallback(() => { ref.current = 0; setCombo(0); }, []);
  return { combo, register, reset };
};
