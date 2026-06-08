
CREATE OR REPLACE VIEW public.crm_cobertura_carteira AS
WITH base AS (
  SELECT
    id, value,
    locked_by_sdr_id,
    locked_by_sdr_name,
    last_contact_at,
    sdr_status,
    priority,
    temperature,
    state,
    CASE
      WHEN locked_by_sdr_id IS NOT NULL
       AND last_contact_at >= CURRENT_DATE - INTERVAL '10 days'
      THEN 'ativa'
      WHEN locked_by_sdr_id IS NOT NULL
       AND (last_contact_at IS NULL
        OR last_contact_at < CURRENT_DATE - INTERVAL '10 days')
      THEN 'fria'
      WHEN locked_by_sdr_id IS NULL
       AND last_contact_at IS NOT NULL
      THEN 'sem_cobertura'
      ELSE 'nunca_contatada'
    END AS situacao,
    CASE
      WHEN last_contact_at IS NOT NULL
      THEN (CURRENT_DATE - last_contact_at)::integer
      ELSE NULL
    END AS dias_sem_contato
  FROM public.sdr_leads
  WHERE sdr_status NOT IN ('Kill / Arquivar','Fechado','Perdido (com motivo)')
)
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE situacao='ativa') AS ativas,
  COUNT(*) FILTER (WHERE situacao='fria') AS frias,
  COUNT(*) FILTER (WHERE situacao='sem_cobertura') AS sem_cobertura,
  COUNT(*) FILTER (WHERE situacao='nunca_contatada') AS nunca_contatadas,
  COALESCE(SUM(value),0) AS valor_total,
  COALESCE(SUM(value) FILTER (WHERE situacao='ativa'),0) AS valor_ativo,
  COALESCE(SUM(value) FILTER (WHERE situacao='fria'),0) AS valor_frio,
  COALESCE(SUM(value) FILTER (WHERE situacao='sem_cobertura'),0) AS valor_sem_cobertura,
  COALESCE(SUM(value) FILTER (WHERE situacao='nunca_contatada'),0) AS valor_nunca_contatado,
  ROUND(COUNT(*) FILTER (WHERE situacao='ativa')::numeric / NULLIF(COUNT(*),0) * 100, 1) AS pct_ativa,
  ROUND(COUNT(*) FILTER (WHERE situacao='fria')::numeric / NULLIF(COUNT(*),0) * 100, 1) AS pct_fria,
  ROUND(COUNT(*) FILTER (WHERE situacao='sem_cobertura')::numeric / NULLIF(COUNT(*),0) * 100, 1) AS pct_sem_cobertura,
  ROUND(COUNT(*) FILTER (WHERE situacao='nunca_contatada')::numeric / NULLIF(COUNT(*),0) * 100, 1) AS pct_nunca_contatada,
  ROUND(AVG(dias_sem_contato) FILTER (WHERE dias_sem_contato IS NOT NULL), 0) AS media_dias_sem_contato,
  MAX(dias_sem_contato) AS max_dias_sem_contato,
  COUNT(*) FILTER (WHERE priority='Alta' AND situacao != 'ativa') AS alta_prioridade_descoberta,
  COALESCE(SUM(value) FILTER (WHERE priority='Alta' AND situacao != 'ativa'),0) AS valor_alta_prioridade_descoberta,
  COUNT(*) FILTER (WHERE temperature IN ('Quente','Muito Quente') AND situacao != 'ativa') AS quentes_descobertos,
  NOW() AS calculado_em
FROM base;

GRANT SELECT ON public.crm_cobertura_carteira TO authenticated;

CREATE OR REPLACE VIEW public.crm_cobertura_por_sdr AS
WITH base AS (
  SELECT
    COALESCE(locked_by_sdr_name, 'Sem SDR') AS sdr,
    locked_by_sdr_id,
    value,
    last_contact_at,
    priority,
    temperature,
    CASE
      WHEN locked_by_sdr_id IS NOT NULL
       AND last_contact_at >= CURRENT_DATE - INTERVAL '10 days'
      THEN 'ativa'
      WHEN locked_by_sdr_id IS NOT NULL
       AND (last_contact_at IS NULL
        OR last_contact_at < CURRENT_DATE - INTERVAL '10 days')
      THEN 'fria'
      ELSE 'sem_cobertura'
    END AS situacao
  FROM public.sdr_leads
  WHERE sdr_status NOT IN ('Kill / Arquivar','Fechado','Perdido (com motivo)')
)
SELECT
  sdr AS sdr_nome,
  locked_by_sdr_id,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE situacao='ativa') AS ativos,
  COUNT(*) FILTER (WHERE situacao='fria') AS frios,
  COUNT(*) FILTER (WHERE situacao='sem_cobertura') AS sem_cobertura,
  COALESCE(SUM(value),0) AS valor_carteira,
  COALESCE(SUM(value) FILTER (WHERE situacao='ativa'),0) AS valor_ativo,
  ROUND(COUNT(*) FILTER (WHERE situacao='ativa')::numeric / NULLIF(COUNT(*),0) * 100, 1) AS pct_cobertura,
  COUNT(*) FILTER (WHERE priority='Alta' AND situacao != 'ativa') AS alta_prioridade_descoberta,
  COUNT(*) FILTER (WHERE temperature IN ('Quente','Muito Quente') AND situacao != 'ativa') AS quentes_descobertos,
  CASE
    WHEN ROUND(COUNT(*) FILTER (WHERE situacao='ativa')::numeric / NULLIF(COUNT(*),0) * 100, 1) >= 80 THEN 'Meta atingida'
    WHEN ROUND(COUNT(*) FILTER (WHERE situacao='ativa')::numeric / NULLIF(COUNT(*),0) * 100, 1) >= 50 THEN 'Em progresso'
    ELSE 'Abaixo da meta'
  END AS status_meta
FROM base
GROUP BY sdr, locked_by_sdr_id
ORDER BY pct_cobertura DESC NULLS LAST;

GRANT SELECT ON public.crm_cobertura_por_sdr TO authenticated;

CREATE TABLE IF NOT EXISTS public.crm_cobertura_historico (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  total integer,
  ativas integer,
  frias integer,
  sem_cobertura integer,
  nunca_contatadas integer,
  pct_ativa numeric(5,1),
  valor_total numeric(14,2),
  valor_ativo numeric(14,2),
  criado_em timestamptz default now(),
  UNIQUE(data)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_cobertura_historico TO authenticated;
GRANT ALL ON public.crm_cobertura_historico TO service_role;

ALTER TABLE public.crm_cobertura_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobertura_hist_all" ON public.crm_cobertura_historico;
CREATE POLICY "cobertura_hist_all"
  ON public.crm_cobertura_historico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.salvar_snapshot_cobertura()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_cobertura_historico
    (data, total, ativas, frias, sem_cobertura,
     nunca_contatadas, pct_ativa, valor_total, valor_ativo)
  SELECT CURRENT_DATE, total, ativas, frias,
    sem_cobertura, nunca_contatadas,
    pct_ativa, valor_total, valor_ativo
  FROM public.crm_cobertura_carteira
  ON CONFLICT (data) DO UPDATE SET
    total = EXCLUDED.total,
    ativas = EXCLUDED.ativas,
    frias = EXCLUDED.frias,
    sem_cobertura = EXCLUDED.sem_cobertura,
    nunca_contatadas = EXCLUDED.nunca_contatadas,
    pct_ativa = EXCLUDED.pct_ativa,
    valor_total = EXCLUDED.valor_total,
    valor_ativo = EXCLUDED.valor_ativo;
END;
$$;
