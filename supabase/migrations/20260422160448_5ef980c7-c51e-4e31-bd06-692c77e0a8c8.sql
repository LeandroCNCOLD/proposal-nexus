-- Campos detalhados retornados por GET /propostas/{id}
ALTER TABLE public.nomus_proposals
  ADD COLUMN IF NOT EXISTS empresa_nomus_id text,
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS contato_nomus_id text,
  ADD COLUMN IF NOT EXISTS contato_nome text,
  ADD COLUMN IF NOT EXISTS tabela_preco_nomus_id text,
  ADD COLUMN IF NOT EXISTS tabela_preco_nome text,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_nomus_id text,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_nome text,
  ADD COLUMN IF NOT EXISTS tipo_movimentacao text,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer,
  ADD COLUMN IF NOT EXISTS pedido_compra_cliente text,
  ADD COLUMN IF NOT EXISTS layout_pdf text,
  ADD COLUMN IF NOT EXISTS vendedor_nome text,
  ADD COLUMN IF NOT EXISTS representante_nome text,
  ADD COLUMN IF NOT EXISTS cliente_nome text,

  -- Totais
  ADD COLUMN IF NOT EXISTS valor_produtos numeric,
  ADD COLUMN IF NOT EXISTS valor_descontos numeric,
  ADD COLUMN IF NOT EXISTS valor_total_com_desconto numeric,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric,

  -- Tributos a recolher
  ADD COLUMN IF NOT EXISTS icms_recolher numeric,
  ADD COLUMN IF NOT EXISTS icms_st_recolher numeric,
  ADD COLUMN IF NOT EXISTS ipi_recolher numeric,
  ADD COLUMN IF NOT EXISTS pis_recolher numeric,
  ADD COLUMN IF NOT EXISTS cofins_recolher numeric,
  ADD COLUMN IF NOT EXISTS issqn_recolher numeric,
  ADD COLUMN IF NOT EXISTS simples_nacional_recolher numeric,

  -- Comissões / Frete / Seguros / Despesas
  ADD COLUMN IF NOT EXISTS comissoes_venda numeric,
  ADD COLUMN IF NOT EXISTS frete_valor numeric,
  ADD COLUMN IF NOT EXISTS frete_percentual numeric,
  ADD COLUMN IF NOT EXISTS seguros_valor numeric,
  ADD COLUMN IF NOT EXISTS despesas_acessorias numeric,

  -- Custos de produção
  ADD COLUMN IF NOT EXISTS custos_producao numeric,
  ADD COLUMN IF NOT EXISTS custos_materiais numeric,
  ADD COLUMN IF NOT EXISTS custos_mod numeric,
  ADD COLUMN IF NOT EXISTS custos_cif numeric,
  ADD COLUMN IF NOT EXISTS custos_administrativos numeric,
  ADD COLUMN IF NOT EXISTS custos_incidentes_lucro numeric,

  -- Resultado
  ADD COLUMN IF NOT EXISTS lucro_bruto numeric,
  ADD COLUMN IF NOT EXISTS margem_bruta_pct numeric,
  ADD COLUMN IF NOT EXISTS lucro_antes_impostos numeric,
  ADD COLUMN IF NOT EXISTS lucro_liquido numeric,
  ADD COLUMN IF NOT EXISTS margem_liquida_pct numeric,

  -- Quem criou no Nomus
  ADD COLUMN IF NOT EXISTS criada_por_nomus text,
  ADD COLUMN IF NOT EXISTS criada_em_nomus timestamp with time zone,

  -- Marca de quando o detalhe foi puxado (vs. só listagem)
  ADD COLUMN IF NOT EXISTS detail_synced_at timestamp with time zone;

-- Itens: enriquece com tributos por linha, valor com desconto e prazo
ALTER TABLE public.nomus_proposal_items
  ADD COLUMN IF NOT EXISTS unit_value_with_unit text,
  ADD COLUMN IF NOT EXISTS total_with_discount numeric,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias integer,
  ADD COLUMN IF NOT EXISTS additional_info text,
  ADD COLUMN IF NOT EXISTS item_status text;

-- Reflete alguns desses no espelho local proposals para UI rápida
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS nomus_payment_term_name text,
  ADD COLUMN IF NOT EXISTS nomus_price_table_name text,
  ADD COLUMN IF NOT EXISTS nomus_seller_name text;