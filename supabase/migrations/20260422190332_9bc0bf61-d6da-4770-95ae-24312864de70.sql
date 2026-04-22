ALTER TABLE public.nomus_proposal_items
  ADD COLUMN IF NOT EXISTS analise_lucro JSONB,
  ADD COLUMN IF NOT EXISTS impostos JSONB;

CREATE INDEX IF NOT EXISTS idx_nomus_proposal_items_analise_lucro
  ON public.nomus_proposal_items USING GIN (analise_lucro);