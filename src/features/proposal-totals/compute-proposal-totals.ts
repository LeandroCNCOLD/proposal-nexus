/**
 * Cálculo agregado de totais da proposta.
 *
 * Função pura — recebe itens + snapshots de custo + (futuro) totais oficiais
 * do Nomus e devolve o objeto consumido pela UI da "Análise de lucro".
 *
 * Quando a integração futura com o Nomus trouxer os totais oficiais, basta
 * popular `nomusOfficial` aqui que a UI passa a refletir esses valores sem
 * precisar mudar nada no componente.
 */

export type ItemForTotals = {
  quantity: number | null;
  unit_price: number | null; // preço de VENDA unitário (o que o cliente paga)
  discount: number | null; // desconto absoluto já aplicado no item
  total: number | null;
  total_with_discount: number | null;
  nomus_item_id: string | null;
};

export type ItemCostSnapshot = {
  price_table_unit_price: number | null; // preço unitário de TABELA
  price_table_custo_materiais: number | null;
  price_table_custo_mod: number | null;
  price_table_custo_cif: number | null;
  price_table_custo_producao_total: number | null;
  price_table_custos_adm: number | null;
};

export type NomusProposalTotals = {
  valor_produtos: number | null;
  valor_descontos: number | null;
  valor_total_com_desconto: number | null;
  valor_total: number | null;
  valor_liquido: number | null;
  custos_producao: number | null;
  custos_materiais: number | null;
  custos_mod: number | null;
  custos_cif: number | null;
  custos_administrativos: number | null;
  custos_incidentes_lucro: number | null;
  lucro_bruto: number | null;
  margem_bruta_pct: number | null;
  lucro_antes_impostos: number | null;
  lucro_liquido: number | null;
  margem_liquida_pct: number | null;
  // taxas / despesas
  icms_recolher: number | null;
  icms_st_recolher: number | null;
  ipi_recolher: number | null;
  pis_recolher: number | null;
  cofins_recolher: number | null;
  issqn_recolher: number | null;
  simples_nacional_recolher: number | null;
  comissoes_venda: number | null;
  frete_valor: number | null;
  seguros_valor: number | null;
  despesas_acessorias: number | null;
};

export type ProposalTotalsSource = "snapshot_local" | "nomus" | "fallback";

export type ProposalTotalsResult = {
  source: ProposalTotalsSource;
  hasSnapshots: boolean;

  // Totais principais
  valor_produtos: number | null; // Σ Tabela total (preço de tabela × qtd)
  valor_descontos: number | null; // desconto LÍQUIDO (concedido − ágio)
  desconto_concedido: number; // Σ max(0, tabela − venda)
  agio_sobre_tabela: number; // Σ max(0, venda − tabela)
  valor_total_com_desconto: number | null; // Σ venda total

  // Custos / lucro
  valor_liquido: number | null;
  custos_producao: number | null;
  custos_materiais: number | null;
  custos_mod: number | null;
  custos_cif: number | null;
  custos_administrativos: number | null;
  lucro_bruto: number | null;
  lucro_antes_impostos: number | null;
  lucro_liquido: number | null;
  margem_bruta_pct: number | null;
  margem_liquida_pct: number | null;

  impostos_total: number;
  /** Custo adicional da taxa financeira (vindo da simulação salva). */
  custo_taxa_financeira: number;
  /** Soma de outras despesas (comissões + frete + seguros + acessórias + taxa financeira). */
  outras_despesas_total: number;
};

export type ComputeProposalTotalsInput = {
  items: ItemForTotals[];
  /** Map nomus_item_id → snapshot de custos do item local. */
  snapshots: Map<string, ItemCostSnapshot>;
  /** Campos de totais vindos do Nomus (fallback). */
  nomus: Partial<NomusProposalTotals> | null;
  /**
   * Quando o backend passar a entregar totais oficiais já calculados pelo
   * Nomus, popular esse campo. Se presente, ele tem prioridade absoluta.
   */
  nomusOfficial?: Partial<NomusProposalTotals> | null;
  /**
   * Custo adicional vindo da simulação da taxa financeira salva na proposta
   * (proposals.financial_additional_cost). É somado às "Outras despesas
   * acessórias" e, portanto, deduzido do valor líquido / lucro.
   */
  financialAdditionalCost?: number | null;
};

const n = (v: number | null | undefined): number => Number(v ?? 0);

export function computeProposalTotals(
  input: ComputeProposalTotalsInput,
): ProposalTotalsResult {
  const { items, snapshots, nomus, nomusOfficial } = input;
  const custoTaxaFinanceira = Math.max(0, n(input.financialAdditionalCost));

  // Impostos / despesas vêm sempre dos campos do Nomus (não dependem de
  // snapshot por item).
  const impostos =
    n(nomus?.icms_recolher) +
    n(nomus?.icms_st_recolher) +
    n(nomus?.ipi_recolher) +
    n(nomus?.pis_recolher) +
    n(nomus?.cofins_recolher) +
    n(nomus?.issqn_recolher) +
    n(nomus?.simples_nacional_recolher);

  const outrasDespesasNomus =
    n(nomus?.comissoes_venda) +
    n(nomus?.frete_valor) +
    n(nomus?.seguros_valor) +
    n(nomus?.despesas_acessorias);
  const outrasDespesas = outrasDespesasNomus + custoTaxaFinanceira;

  // ─── 1) Totais oficiais Nomus (futuro) ───────────────────────────────
  if (nomusOfficial && nomusOfficial.valor_produtos != null) {
    return {
      source: "nomus",
      hasSnapshots: false,
      valor_produtos: nomusOfficial.valor_produtos ?? null,
      valor_descontos: nomusOfficial.valor_descontos ?? null,
      desconto_concedido: n(nomusOfficial.valor_descontos),
      agio_sobre_tabela: 0,
      valor_total_com_desconto:
        nomusOfficial.valor_total_com_desconto ?? nomusOfficial.valor_total ?? null,
      valor_liquido: nomusOfficial.valor_liquido ?? null,
      custos_producao: nomusOfficial.custos_producao ?? null,
      custos_materiais: nomusOfficial.custos_materiais ?? null,
      custos_mod: nomusOfficial.custos_mod ?? null,
      custos_cif: nomusOfficial.custos_cif ?? null,
      custos_administrativos: nomusOfficial.custos_administrativos ?? null,
      lucro_bruto: nomusOfficial.lucro_bruto ?? null,
      lucro_antes_impostos: nomusOfficial.lucro_antes_impostos ?? null,
      lucro_liquido: nomusOfficial.lucro_liquido ?? null,
      margem_bruta_pct: nomusOfficial.margem_bruta_pct ?? null,
      margem_liquida_pct: nomusOfficial.margem_liquida_pct ?? null,
      impostos_total: impostos,
      custo_taxa_financeira: custoTaxaFinanceira,
      outras_despesas_total: outrasDespesas,
    };
  }

  // ─── 2) Cálculo local a partir dos snapshots dos itens ───────────────
  let totalTabela = 0;
  let totalVenda = 0;
  let descontoConcedido = 0;
  let agio = 0;

  let custoMateriais = 0;
  let custoMod = 0;
  let custoCif = 0;
  let custoProducao = 0;
  let custosAdm = 0;
  let snapshotCount = 0;

  for (const it of items) {
    const qty = n(it.quantity);
    const unitVenda = n(it.unit_price);
    const local = it.nomus_item_id ? snapshots.get(it.nomus_item_id) : null;

    // Total de VENDA do item: preferimos o total_with_discount já calculado.
    const totalVendaItem = n(
      it.total_with_discount ?? it.total ?? qty * unitVenda - n(it.discount),
    );

    // Total de TABELA do item: preço de tabela × qtd (snapshot). Se não
    // houver snapshot, cai no total de venda (sem desconto / sem ágio).
    const unitTabela = local?.price_table_unit_price ?? null;
    const totalTabelaItem =
      unitTabela != null ? n(unitTabela) * qty : totalVendaItem;

    totalTabela += totalTabelaItem;
    totalVenda += totalVendaItem;
    const delta = totalTabelaItem - totalVendaItem;
    if (delta > 0) descontoConcedido += delta;
    else if (delta < 0) agio += -delta;

    if (
      local &&
      (local.price_table_custo_materiais != null ||
        local.price_table_custo_mod != null ||
        local.price_table_custo_cif != null ||
        local.price_table_custo_producao_total != null)
    ) {
      snapshotCount++;
      custoMateriais += n(local.price_table_custo_materiais) * qty;
      custoMod += n(local.price_table_custo_mod) * qty;
      custoCif += n(local.price_table_custo_cif) * qty;
      custoProducao += n(local.price_table_custo_producao_total) * qty;
      custosAdm += n(local.price_table_custos_adm) * qty;
    }
  }

  const hasSnapshots = snapshotCount > 0;
  const descontoLiquido = descontoConcedido - agio;

  if (!hasSnapshots) {
    // Sem nenhum snapshot — devolve o que vier do Nomus (modo fallback).
    const valorLiquidoFallback =
      nomus?.valor_liquido != null
        ? n(nomus.valor_liquido) - custoTaxaFinanceira
        : null;
    const lucroBrutoFallback =
      nomus?.lucro_bruto != null
        ? n(nomus.lucro_bruto) - custoTaxaFinanceira
        : null;
    const lucroAntesImpostosFallback =
      nomus?.lucro_antes_impostos != null
        ? n(nomus.lucro_antes_impostos) - custoTaxaFinanceira
        : null;
    const lucroLiquidoFallback =
      nomus?.lucro_liquido != null
        ? n(nomus.lucro_liquido) - custoTaxaFinanceira
        : null;
    return {
      source: "fallback",
      hasSnapshots: false,
      valor_produtos: nomus?.valor_produtos ?? null,
      valor_descontos: nomus?.valor_descontos ?? null,
      desconto_concedido: 0,
      agio_sobre_tabela: 0,
      valor_total_com_desconto:
        nomus?.valor_total_com_desconto ?? nomus?.valor_total ?? null,
      valor_liquido: valorLiquidoFallback,
      custos_producao: nomus?.custos_producao ?? null,
      custos_materiais: nomus?.custos_materiais ?? null,
      custos_mod: nomus?.custos_mod ?? null,
      custos_cif: nomus?.custos_cif ?? null,
      custos_administrativos: nomus?.custos_administrativos ?? null,
      lucro_bruto: lucroBrutoFallback,
      lucro_antes_impostos: lucroAntesImpostosFallback,
      lucro_liquido: lucroLiquidoFallback,
      margem_bruta_pct: nomus?.margem_bruta_pct ?? null,
      margem_liquida_pct: nomus?.margem_liquida_pct ?? null,
      impostos_total: impostos,
      custo_taxa_financeira: custoTaxaFinanceira,
      outras_despesas_total: outrasDespesas,
    };
  }

  const valorComDesconto = totalVenda; // identidade: tabela − descLiq = venda
  const valorLiquido = valorComDesconto - impostos - outrasDespesas;
  const lucroBruto = valorLiquido - custoProducao;
  const lucroAntesImpostos = lucroBruto - custosAdm;
  const custosIncidentes = n(nomus?.custos_incidentes_lucro);
  const lucroLiquido = lucroAntesImpostos - custosIncidentes;

  const margemBrutaPct =
    valorComDesconto > 0 ? (lucroBruto / valorComDesconto) * 100 : null;
  const margemLiquidaPct =
    valorComDesconto > 0 ? (lucroLiquido / valorComDesconto) * 100 : null;

  return {
    source: "snapshot_local",
    hasSnapshots: true,
    valor_produtos: totalTabela,
    valor_descontos: descontoLiquido,
    desconto_concedido: descontoConcedido,
    agio_sobre_tabela: agio,
    valor_total_com_desconto: valorComDesconto,
    valor_liquido: valorLiquido,
    custos_producao: custoProducao,
    custos_materiais: custoMateriais,
    custos_mod: custoMod,
    custos_cif: custoCif,
    custos_administrativos: custosAdm,
    lucro_bruto: lucroBruto,
    lucro_antes_impostos: lucroAntesImpostos,
    lucro_liquido: lucroLiquido,
    margem_bruta_pct: margemBrutaPct,
    margem_liquida_pct: margemLiquidaPct,
    impostos_total: impostos,
    custo_taxa_financeira: custoTaxaFinanceira,
    outras_despesas_total: outrasDespesas,
  };
}
