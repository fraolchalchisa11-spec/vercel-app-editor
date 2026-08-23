UPDATE public.app_state
SET data = jsonb_set(
  data,
  '{students}',
  (
    SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
    FROM jsonb_array_elements(data->'students') AS value
    WHERE NOT (
      value->>'email' LIKE '%@test.com'
      OR value->>'name' = 'Meseret Test'
    )
  )
)
WHERE id = 'main';