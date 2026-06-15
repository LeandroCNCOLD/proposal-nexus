
-- sdr_leads
ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS loss_reason text
    CHECK (loss_reason IN (
      'preco','prazo','concorrente','sem_budget',
      'projeto_cancelado','tecnico','nao_respondeu','outro'
    )),
  ADD COLUMN IF NOT EXISTS loss_competitor text,
  ADD COLUMN IF NOT EXISTS loss_price_diff_pct numeric(5,1),
  ADD COLUMN IF NOT EXISTS loss_notes text;

-- proposals (loss_reason já existe como texto livre — não adiciona CHECK)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS loss_competitor text,
  ADD COLUMN IF NOT EXISTS loss_price_diff_pct numeric(5,1),
  ADD COLUMN IF NOT EXISTS loss_notes text;

-- View análise de perdas
CREATE OR REPLACE VIEW public.crm_analise_perdas AS
SELECT
  loss_reason,
  COUNT(*) AS total,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER() * 100, 1) AS pct,
  ROUND(AVG(value), 0) AS ticket_medio,
  SUM(value) AS valor_total_perdido,
  COUNT(*) FILTER (
    WHERE DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW())
  ) AS perdas_mes_atual,
  loss_competitor,
  COUNT(*) FILTER (WHERE loss_competitor IS NOT NULL) AS com_concorrente
FROM public.sdr_leads
WHERE sdr_status = 'Perdido (com motivo)'
  AND loss_reason IS NOT NULL
GROUP BY loss_reason, loss_competitor
ORDER BY total DESC;

GRANT SELECT ON public.crm_analise_perdas TO authenticated;
GRANT ALL ON public.crm_analise_perdas TO service_role;
