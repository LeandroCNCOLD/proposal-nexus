
ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS bant_budget text
    CHECK (bant_budget IN ('sim','nao','parcial')),
  ADD COLUMN IF NOT EXISTS bant_authority text,
  ADD COLUMN IF NOT EXISTS bant_need text,
  ADD COLUMN IF NOT EXISTS bant_timeline text
    CHECK (bant_timeline IN (
      'este_mes','1_3_meses','3_6_meses','6_meses_mais','indefinido'
    )),
  ADD COLUMN IF NOT EXISTS bant_score integer
    GENERATED ALWAYS AS (
      (CASE WHEN bant_budget IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN bant_authority IS NOT NULL AND bant_authority <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN bant_need IS NOT NULL AND bant_need <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN bant_timeline IS NOT NULL THEN 1 ELSE 0 END)
    ) STORED;
