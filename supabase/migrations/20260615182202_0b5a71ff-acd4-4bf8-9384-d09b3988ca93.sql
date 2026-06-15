
-- Campo data prevista de fechamento
ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS expected_closing_date date;

-- Função de probabilidade
CREATE OR REPLACE FUNCTION public.calcular_probabilidade_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.probability_pct IS NULL
     OR (TG_OP = 'UPDATE' AND OLD.sdr_status IS DISTINCT FROM NEW.sdr_status)
  THEN
    NEW.probability_pct := CASE NEW.sdr_status
      WHEN 'Não Contatado' THEN 10
      WHEN 'Contatado - Aguardando Retorno' THEN 20
      WHEN 'Reunião Agendada' THEN 40
      WHEN 'Reunião Realizada' THEN 50
      WHEN 'Em Negociação com Closer' THEN 60
      WHEN 'Proposta em Revisão' THEN 70
      WHEN 'Quente - Alta Chance de Fechamento' THEN 90
      WHEN 'Fechado' THEN 100
      WHEN 'Perdido (com motivo)' THEN 0
      WHEN 'Kill / Arquivar' THEN 0
      ELSE COALESCE(NEW.probability_pct, 10)
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sdr_leads_probabilidade_auto ON public.sdr_leads;
CREATE TRIGGER sdr_leads_probabilidade_auto
BEFORE INSERT OR UPDATE ON public.sdr_leads
FOR EACH ROW
EXECUTE FUNCTION public.calcular_probabilidade_lead();

-- Backfill (dispara o trigger via UPDATE)
UPDATE public.sdr_leads
SET updated_at = NOW()
WHERE probability_pct IS NULL;

-- View Pipeline Ponderado
CREATE OR REPLACE VIEW public.crm_pipeline_ponderado AS
SELECT
  COUNT(*) AS total_leads,
  SUM(value) AS pipeline_bruto,
  SUM(value * probability_pct / 100.0) AS pipeline_ponderado,
  ROUND(
    SUM(value * probability_pct / 100.0) / NULLIF(SUM(value), 0) * 100, 1
  ) AS pct_realizacao,
  SUM(value) FILTER (WHERE temperature = 'Muito Quente') AS valor_muito_quente,
  SUM(value) FILTER (WHERE temperature = 'Quente') AS valor_quente,
  SUM(value) FILTER (WHERE temperature = 'Morno') AS valor_morno,
  SUM(value) FILTER (WHERE temperature = 'Frio') AS valor_frio,
  ROUND(AVG(probability_pct), 1) AS probabilidade_media,
  closer_name,
  COUNT(*) FILTER (WHERE closer_name IS NOT NULL) AS leads_com_closer
FROM public.sdr_leads
WHERE sdr_status NOT IN ('Kill / Arquivar','Fechado','Perdido (com motivo)')
GROUP BY ROLLUP(closer_name);

GRANT SELECT ON public.crm_pipeline_ponderado TO authenticated;
GRANT ALL ON public.crm_pipeline_ponderado TO service_role;

-- View Forecast Mensal
CREATE OR REPLACE VIEW public.crm_forecast_mensal AS
SELECT
  DATE_TRUNC('month', expected_closing_date) AS mes,
  COUNT(*) AS propostas,
  SUM(value) AS valor_previsto,
  ROUND(AVG(probability_pct), 1) AS probabilidade_media,
  SUM(value * probability_pct / 100.0) AS valor_ponderado,
  closer_name
FROM public.sdr_leads
WHERE expected_closing_date IS NOT NULL
  AND sdr_status NOT IN ('Kill / Arquivar','Perdido (com motivo)')
GROUP BY DATE_TRUNC('month', expected_closing_date), closer_name
ORDER BY mes, closer_name;

GRANT SELECT ON public.crm_forecast_mensal TO authenticated;
GRANT ALL ON public.crm_forecast_mensal TO service_role;
