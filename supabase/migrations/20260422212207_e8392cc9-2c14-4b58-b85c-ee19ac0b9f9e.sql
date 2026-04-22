-- 1) Adicionar colunas de custo/margem em nomus_price_table_items
ALTER TABLE public.nomus_price_table_items
  ADD COLUMN IF NOT EXISTS custo_materiais numeric,
  ADD COLUMN IF NOT EXISTS custo_mod numeric,
  ADD COLUMN IF NOT EXISTS custo_cif numeric,
  ADD COLUMN IF NOT EXISTS custos_adm numeric,
  ADD COLUMN IF NOT EXISTS custo_producao_total numeric,
  ADD COLUMN IF NOT EXISTS custos_venda numeric,
  ADD COLUMN IF NOT EXISTS preco_calculado numeric,
  ADD COLUMN IF NOT EXISTS preco_liquido numeric,
  ADD COLUMN IF NOT EXISTS margem_desejada_pct numeric,
  ADD COLUMN IF NOT EXISTS lucro_bruto numeric,
  ADD COLUMN IF NOT EXISTS lucro_liquido numeric,
  ADD COLUMN IF NOT EXISTS margem_contribuicao numeric,
  ADD COLUMN IF NOT EXISTS unidade_medida text,
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_cost_data boolean NOT NULL DEFAULT false;

-- Index para o lookup do componente de análise (price_table_id + nomus_product_id já é a chave natural, mas garantimos performance)
CREATE INDEX IF NOT EXISTS idx_nomus_price_table_items_lookup
  ON public.nomus_price_table_items (price_table_id, nomus_product_id);

-- 2) RLS de write em nomus_price_table_items (hoje só tem SELECT)
DROP POLICY IF EXISTS "nomus_pti_modify" ON public.nomus_price_table_items;
CREATE POLICY "nomus_pti_modify"
  ON public.nomus_price_table_items
  FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role, 'engenharia'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role, 'engenharia'::app_role]));

-- 3) Tabela de auditoria de importações
CREATE TABLE IF NOT EXISTS public.nomus_cost_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id uuid NOT NULL REFERENCES public.nomus_price_tables(id) ON DELETE CASCADE,
  filename text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  with_cost_count integer NOT NULL DEFAULT 0,
  notes text,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nomus_cost_imports_table_date
  ON public.nomus_cost_imports (price_table_id, imported_at DESC);

ALTER TABLE public.nomus_cost_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cost_imports_select" ON public.nomus_cost_imports;
CREATE POLICY "cost_imports_select"
  ON public.nomus_cost_imports
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cost_imports_insert" ON public.nomus_cost_imports;
CREATE POLICY "cost_imports_insert"
  ON public.nomus_cost_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role, 'engenharia'::app_role]));