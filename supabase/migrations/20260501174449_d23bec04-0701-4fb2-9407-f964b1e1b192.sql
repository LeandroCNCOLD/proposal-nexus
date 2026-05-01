ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS price_table_custo_materiais numeric,
  ADD COLUMN IF NOT EXISTS price_table_custo_mod numeric,
  ADD COLUMN IF NOT EXISTS price_table_custo_cif numeric,
  ADD COLUMN IF NOT EXISTS price_table_custos_adm numeric,
  ADD COLUMN IF NOT EXISTS price_table_custos_venda numeric,
  ADD COLUMN IF NOT EXISTS price_table_custo_producao_total numeric,
  ADD COLUMN IF NOT EXISTS price_table_preco_calculado numeric,
  ADD COLUMN IF NOT EXISTS price_table_preco_liquido numeric,
  ADD COLUMN IF NOT EXISTS price_table_margem_desejada_pct numeric,
  ADD COLUMN IF NOT EXISTS price_table_lucro_bruto numeric,
  ADD COLUMN IF NOT EXISTS price_table_lucro_liquido numeric,
  ADD COLUMN IF NOT EXISTS price_table_margem_contribuicao numeric;