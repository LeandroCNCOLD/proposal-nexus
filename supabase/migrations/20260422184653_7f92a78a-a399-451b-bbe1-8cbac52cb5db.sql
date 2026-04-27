-- Adiciona campos da reforma tributária (CBS/IBS) e JSONB com totalTributacao bruto
ALTER TABLE public.nomus_proposals
  ADD COLUMN IF NOT EXISTS total_tributacao JSONB,
  ADD COLUMN IF NOT EXISTS cbs_recolher NUMERIC,
  ADD COLUMN IF NOT EXISTS ibs_recolher NUMERIC,
  ADD COLUMN IF NOT EXISTS ibs_estadual_recolher NUMERIC;

CREATE INDEX IF NOT EXISTS idx_nomus_proposals_total_tributacao
  ON public.nomus_proposals USING GIN (total_tributacao);