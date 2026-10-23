export interface LearningOptionWord { word: string; meaning: string }

export function learningOptions(correct: LearningOptionWord, pool: LearningOptionWord[], field: "word" | "meaning" = "meaning") {
  const answer = correct[field];
  const alternatives = [...new Set(pool
    .filter(w => w.word.trim().toLowerCase() !== correct.word.trim().toLowerCase() && w.meaning.trim() !== correct.meaning.trim())
    .map(w => w[field].trim()).filter(value => value && value !== answer.trim()))];
  for (let i = alternatives.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alternatives[i], alternatives[j]] = [alternatives[j], alternatives[i]];
  }
  if (alternatives.length < 3) return [];
  const options = [answer, ...alternatives.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}