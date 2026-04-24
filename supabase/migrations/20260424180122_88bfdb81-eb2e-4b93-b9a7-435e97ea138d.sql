
-- Seed da estrutura oficial do Funil de Vendas conforme Nomus.
-- Usa upsert para não sobrescrever ordem/visibilidade já customizada,
-- mas garante que TODAS as etapas oficiais existam.

INSERT INTO public.crm_funnel_stages (tipo, etapa, display_order, is_won, is_lost, is_hidden)
VALUES
  ('Funil de Vendas', 'Orçamento',                 10,  false, false, false),
  ('Funil de Vendas', 'Pronta para Apresentação',  20,  false, false, false),
  ('Funil de Vendas', 'FRIO',                       30,  false, false, false),
  ('Funil de Vendas', 'Morno',                      40,  false, false, false),
  ('Funil de Vendas', 'Revisão técnica',           50,  false, false, false),
  ('Funil de Vendas', 'QUENTE',                     60,  false, false, false),
  ('Funil de Vendas', 'Negociação',                70,  false, false, false),
  ('Funil de Vendas', 'FERVENDO',                   80,  false, false, false),
  ('Funil de Vendas', 'Venda confirmada',           90,  true,  false, false),
  ('Funil de Vendas', 'Prdida',                    100,  false, true,  false),
  ('Funil de Vendas', 'CANCELADO',                 110,  false, true,  false),
  ('Funil de Vendas', 'PRORROGADO',                120,  false, false, false)
ON CONFLICT (tipo, etapa) DO UPDATE SET
  display_order = EXCLUDED.display_order,
  is_won = EXCLUDED.is_won,
  is_lost = EXCLUDED.is_lost,
  is_hidden = false,
  last_seen_at = now(),
  updated_at = now();

-- Helper: próximo display_order para um tipo (usado pelo sync ao descobrir etapas novas)
CREATE OR REPLACE FUNCTION public.next_funnel_stage_order(_tipo text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(MAX(display_order), 0) + 10
  FROM public.crm_funnel_stages
  WHERE tipo = _tipo;
$$;
