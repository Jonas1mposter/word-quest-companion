-- Read-only randomized regression: division by zero fails if any excluded catalog entry is selected.
WITH samples AS MATERIALIZED (
  SELECT public.random_bot_cosmetics() outfit FROM generate_series(1, 500)
), checks AS (
  SELECT
    (SELECT count(*) FROM samples WHERE outfit->'name_card' IS NULL OR outfit->'name_card'='null'::jsonb) missing_card,
    (SELECT count(*) FROM samples s JOIN public.name_cards n ON n.id=(s.outfit->'name_card'->>'id')::uuid WHERE n.category NOT IN ('achievement','battle','learning','rank_tier','ranked')) excluded_cards,
    (SELECT count(*) FROM samples s CROSS JOIN LATERAL jsonb_array_elements(s.outfit->'badges') b JOIN public.badges c ON c.id=(b->>'id')::uuid WHERE c.category IN ('special','hidden') OR c.name IN ('狄邦单词通开发团队','社区贡献者','GOAT')) excluded_titles,
    (SELECT count(*) FROM samples WHERE jsonb_array_length(outfit->'badges')<>3 OR (SELECT count(DISTINCT b->>'id') FROM jsonb_array_elements(outfit->'badges') b)<>3) invalid_slots
)
SELECT 1 / CASE WHEN missing_card=0 THEN 1 ELSE 0 END AS has_name_card,
       1 / CASE WHEN excluded_cards=0 THEN 1 ELSE 0 END AS excludes_limited_cards,
       1 / CASE WHEN excluded_titles=0 THEN 1 ELSE 0 END AS excludes_special_titles,
       1 / CASE WHEN invalid_slots=0 THEN 1 ELSE 0 END AS three_distinct_titles
FROM checks;