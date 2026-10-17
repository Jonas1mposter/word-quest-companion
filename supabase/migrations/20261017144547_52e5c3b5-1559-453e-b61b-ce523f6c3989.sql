UPDATE public.hs_words SET meaning = btrim(regexp_replace(meaning, '\s*([\(\{]\d{2,4}[\)\}]|\|\d{2,4}\.?|\d{3}[A-Z])\s*$', ''))
WHERE meaning ~ '\s*([\(\{]\d{2,4}[\)\}]|\|\d{2,4}\.?|\d{3}[A-Z])\s*$';