function parseFinancialNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export type ProposalAnaliseLucro = {
  valor_produtos: number | null | undefined;
  valor_descontos: number | null | undefined;
  valor_total_com_desconto: number | null | undefined;
  icms_recolher: number | null | undefined;
  icms_st_recolher: number | null | undefined;
  ipi_recolher: number | null | undefined;
  pis_recolher: number | null | undefined;
  cofins_recolher: number | null | undefined;
  issqn_recolher: number | null | undefined;
  simples_nacional_recolher: number | null | undefined;
  comissoes_venda: number | null | undefined;
  frete_valor: number | null | undefined;
  seguros_valor: number | null | undefined;
  despesas_acessorias: number | null | undefined;
  valor_liquido: number | null | undefined;
  custos_producao: number | null | undefined;
  custos_materiais: number | null | undefined;
  custos_mod: number | null | undefined;
  custos_cif: number | null | undefined;
  lucro_bruto: number | null | undefined;
  margem_bruta_pct: number | null | undefined;
  custos_administrativos: number | null | undefined;
  lucro_antes_impostos: number | null | undefined;
  custos_incidentes_lucro: number | null | undefined;
  lucro_liquido: number | null | undefined;
  margem_liquida_pct: number | null | undefined;
};

export type NomusLucroAnalysisValues = {
  valorProdutos: number | null;
  descontos: number | null;
  valorComDesconto: number | null;
  icms: number | null;
  icmsSt: number | null;
  ipi: number | null;
  pis: number | null;
  cofins: number | null;
  issqn: number | null;
  simples: number | null;
  comissoes: number | null;
  frete: number | null;
  seguros: number | null;
  outrasDespesas: number | null;
  valorLiquido: number | null;
  custosProducao: number | null;
  custosMateriais: number | null;
  custosMod: number | null;
  custosCif: number | null;
  lucroBruto: number | null;
  margemBruta: number | null;
  custosAdministrativos: number | null;
  lucroAntesImpostos: number | null;
  custosIncidentes: number | null;
  lucroLiquido: number | null;
  margemLiquida: number | null;
};

export function pickNomusLucroNumber(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const n = parseFinancialNumber(o[key]);
    if (n !== null) return n;
  }
  return null;
}

export function resolveNomusLucroAnalysisValues(input: {
  analiseLucro?: Record<string, unknown> | null;
  proposalAnaliseLucro?: ProposalAnaliseLucro | null;
  ratio?: number;
}): NomusLucroAnalysisValues {
  const useDetail = !!input.analiseLucro;
  const ratio = useDetail ? 1 : (input.ratio ?? 0);

  const value = (detailKeys: string[], proposalKey: keyof ProposalAnaliseLucro): number | null => {
    if (useDetail && input.analiseLucro)
      return pickNomusLucroNumber(input.analiseLucro, ...detailKeys);
    const raw = input.proposalAnaliseLucro?.[proposalKey];
    return raw == null ? null : Number(raw) * ratio;
  };

  const margin = (detailKeys: string[], proposalKey: keyof ProposalAnaliseLucro): number | null => {
    if (useDetail && input.analiseLucro)
      return pickNomusLucroNumber(input.analiseLucro, ...detailKeys);
    const raw = input.proposalAnaliseLucro?.[proposalKey];
    return raw == null ? null : Number(raw);
  };

  return {
    valorProdutos: value(["valorProdutos", "valorTotalProdutos", "valorTotal"], "valor_produtos"),
    descontos: value(["valorDescontos", "descontos", "valorDesconto"], "valor_descontos"),
    valorComDesconto: value(
      ["valorTotalComDesconto", "valorComDesconto"],
      "valor_total_com_desconto",
    ),
    icms: value(["valorIcms", "valorIcmsRecolher"], "icms_recolher"),
    icmsSt: value(["valorIcmsSt", "valorIcmsStRecolher"], "icms_st_recolher"),
    ipi: value(["valorIpi", "valorIpiRecolher"], "ipi_recolher"),
    pis: value(["valorPis", "valorPisRecolher"], "pis_recolher"),
    cofins: value(["valorCofins", "valorCofinsRecolher"], "cofins_recolher"),
    issqn: value(["valorIssqn", "valorIss", "valorIssqnRecolher"], "issqn_recolher"),
    simples: value(
      ["valorSimplesNacional", "valorSimplesNacionalRecolher"],
      "simples_nacional_recolher",
    ),
    comissoes: value(["valorComissoesVenda", "comissoesVenda"], "comissoes_venda"),
    frete: value(["valorFrete", "frete"], "frete_valor"),
    seguros: value(["valorSeguros", "seguros"], "seguros_valor"),
    outrasDespesas: value(
      ["valorOutrasDespesasAcessorias", "despesasAcessorias", "outrasDespesas"],
      "despesas_acessorias",
    ),
    valorLiquido: value(["valorLiquido", "valorLiquidoItem"], "valor_liquido"),
    custosProducao: value(["custosProducao", "valorCustoProducao"], "custos_producao"),
    custosMateriais: value(["custosMateriais", "valorCustoMateriais"], "custos_materiais"),
    custosMod: value(["custosMod", "valorCustoMod", "custosMOD"], "custos_mod"),
    custosCif: value(["custosCif", "valorCustoCif", "custosCIF"], "custos_cif"),
    lucroBruto: value(["lucroBruto", "valorLucroBruto"], "lucro_bruto"),
    margemBruta: margin(
      ["margemBruta", "margemLucroBruto", "margemBrutaPct", "percentualMargemBruta"],
      "margem_bruta_pct",
    ),
    custosAdministrativos: value(["custosAdministrativos"], "custos_administrativos"),
    lucroAntesImpostos: value(["lucroAntesImpostos"], "lucro_antes_impostos"),
    custosIncidentes: value(
      ["custosIncidentesLucro", "custosIncidentesSobreLucro"],
      "custos_incidentes_lucro",
    ),
    lucroLiquido: value(["lucroLiquido", "valorLucroLiquido"], "lucro_liquido"),
    margemLiquida: margin(
      ["margemLiquida", "margemLucroLiquido", "margemLiquidaPct", "percentualMargemLiquida"],
      "margem_liquida_pct",
    ),
  };
}
