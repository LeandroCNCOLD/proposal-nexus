// Helpers de parsing dos payloads do Nomus.
// O Nomus devolve números como string em formato BR ("139.103,505674"),
// e os campos da proposta vêm com nomes específicos (proposta, nomeCliente,
// dataHoraAbertura, valorTotal, itensProposta, etc.).

type Json = Record<string, unknown>;

/** Converte "139.103,505674" → 139103.505674. Aceita number puro também. */
export function parseNomusNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  // "3.747,3484 por UN" → pega só "3.747,3484"
  const cleaned = s.replace(/\s+por\s+\w+/i, "").trim();
  const hasComma = cleaned.includes(",");
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Pega o primeiro campo presente (string não vazia). */
export function pickStr(o: Json, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
}

/** Pega o primeiro campo presente e parseia como número (suporta BR). */
export function pickNumBR(o: Json, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    const n = parseNomusNumber(v);
    if (n !== null) return n;
  }
  return null;
}

/** Pega int (para dias, parcelas etc.). */
export function pickInt(o: Json, ...keys: string[]): number | null {
  const n = pickNumBR(o, ...keys);
  return n === null ? null : Math.round(n);
}

/** Extrai a data ISO de "dataHoraAbertura" tipo "2024-05-12 09:30:00" ou ISO. */
export function pickDate(o: Json, ...keys: string[]): string | null {
  const raw = pickStr(o, ...keys);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return raw;
}

/** Data/hora completa preservando timezone se possível. "2024-05-12 09:30:00" → ISO */
export function pickDateTime(o: Json, ...keys: string[]): string | null {
  const raw = pickStr(o, ...keys);
  if (!raw) return null;
  // ISO já válido
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw;
  // "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DDTHH:mm:ss"
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}`;
  // "DD/MM/YYYY HH:mm:ss"
  const m2 = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}T${m2[4]}`;
  return null;
}

/**
 * Pega um sub-objeto aninhado e extrai id/nome dele.
 * Cobre: {id, nome} | {idCliente, nomeCliente} no nível raiz.
 */
function pickRefIdName(
  raw: Json,
  nestedKey: string | null,
  idKeys: string[],
  nameKeys: string[],
): { id: string | null; name: string | null } {
  // Caso 1: objeto aninhado
  if (nestedKey && typeof raw[nestedKey] === "object" && raw[nestedKey] !== null) {
    const sub = raw[nestedKey] as Json;
    return {
      id: pickStr(sub, "id", "codigo", ...idKeys),
      name: pickStr(sub, "nome", "descricao", "razaoSocial", ...nameKeys),
    };
  }
  // Caso 2: campos planos
  return {
    id: pickStr(raw, ...idKeys),
    name: pickStr(raw, ...nameKeys),
  };
}

/**
 * Mapeia uma proposta do Nomus para o shape do nosso espelho `nomus_proposals`.
 * Funciona tanto para o objeto de listagem (mínimo: só id) quanto para o detalhe
 * completo retornado por GET /propostas/{id}.
 */
export type NomusProposalMapped = {
  nomus_id: string;
  numero: string | null;
  // Cliente
  nome_cliente: string | null;
  cliente_nomus_id: string | null;
  // Empresa
  empresa_nomus_id: string | null;
  empresa_nome: string | null;
  // Pessoas
  vendedor_nomus_id: string | null;
  vendedor_nome: string | null;
  representante_nomus_id: string | null;
  representante_nome: string | null;
  contato_nomus_id: string | null;
  contato_nome: string | null;
  // Comercial
  tabela_preco_nomus_id: string | null;
  tabela_preco_nome: string | null;
  condicao_pagamento_nomus_id: string | null;
  condicao_pagamento_nome: string | null;
  tipo_movimentacao: string | null;
  prazo_entrega_dias: number | null;
  pedido_compra_cliente: string | null;
  layout_pdf: string | null;
  // Datas
  validade: string | null;
  data_emissao: string | null;
  criada_em_nomus: string | null;
  criada_por_nomus: string | null;
  // Totais
  valor_total: number | null;
  valor_produtos: number | null;
  valor_descontos: number | null;
  valor_total_com_desconto: number | null;
  valor_liquido: number | null;
  // Tributos
  icms_recolher: number | null;
  icms_st_recolher: number | null;
  ipi_recolher: number | null;
  pis_recolher: number | null;
  cofins_recolher: number | null;
  issqn_recolher: number | null;
  simples_nacional_recolher: number | null;
  // Reforma tributária
  cbs_recolher: number | null;
  ibs_recolher: number | null;
  ibs_estadual_recolher: number | null;
  // JSON bruto do bloco totalTributacao[0] do Nomus
  total_tributacao: Json | null;
  // Comissões / frete
  comissoes_venda: number | null;
  frete_valor: number | null;
  frete_percentual: number | null;
  seguros_valor: number | null;
  despesas_acessorias: number | null;
  // Custos
  custos_producao: number | null;
  custos_materiais: number | null;
  custos_mod: number | null;
  custos_cif: number | null;
  custos_administrativos: number | null;
  custos_incidentes_lucro: number | null;
  // Resultado
  lucro_bruto: number | null;
  margem_bruta_pct: number | null;
  lucro_antes_impostos: number | null;
  lucro_liquido: number | null;
  margem_liquida_pct: number | null;
  // Outros
  status_nomus: string | null;
  observacoes: string | null;
};

export function mapNomusProposal(raw: Json): NomusProposalMapped | null {
  const nomus_id = pickStr(raw, "id", "idProposta", "codigo");
  if (!nomus_id) return null;

  const cliente = pickRefIdName(raw, "cliente",
    ["idCliente", "clienteId"],
    ["nomeCliente", "clienteNome"]);
  const empresa = pickRefIdName(raw, "empresa",
    ["idEmpresa"], ["nomeEmpresa"]);
  const vendedor = pickRefIdName(raw, "vendedor",
    ["idVendedor", "vendedorId"], ["nomeVendedor"]);
  const representante = pickRefIdName(raw, "representante",
    ["idRepresentante", "representanteId"], ["nomeRepresentante"]);
  const contato = pickRefIdName(raw, "contato",
    ["idContato", "contatoId"], ["nomeContato"]);
  const tabelaPreco = pickRefIdName(raw, "tabelaPreco",
    ["idTabelaPreco", "tabelaPrecoId"], ["nomeTabelaPreco", "descricaoTabelaPreco"]);
  const condPag = pickRefIdName(raw, "condicaoPagamento",
    ["idCondicaoPagamento", "condicaoPagamentoId"],
    ["nomeCondicaoPagamento", "descricaoCondicaoPagamento"]);

  return {
    nomus_id,
    numero: pickStr(raw, "proposta", "numero", "numeroProposta"),

    nome_cliente: cliente.name,
    cliente_nomus_id: cliente.id,
    empresa_nomus_id: empresa.id,
    empresa_nome: empresa.name,
    vendedor_nomus_id: vendedor.id,
    vendedor_nome: vendedor.name,
    representante_nomus_id: representante.id,
    representante_nome: representante.name,
    contato_nomus_id: contato.id,
    contato_nome: contato.name,
    tabela_preco_nomus_id: tabelaPreco.id,
    tabela_preco_nome: tabelaPreco.name,
    condicao_pagamento_nomus_id: condPag.id,
    condicao_pagamento_nome: condPag.name,

    tipo_movimentacao: pickStr(raw, "tipoMovimentacao", "movimentacao"),
    prazo_entrega_dias: pickInt(raw, "prazoEntrega", "prazoEntregaDias", "diasEntrega"),
    pedido_compra_cliente: pickStr(raw, "pedidoCompraCliente", "numeroPedidoCliente"),
    layout_pdf: pickStr(raw, "layoutPdf", "layoutEspecificoPdf"),

    validade: pickDate(raw, "validade", "dataValidade"),
    data_emissao: pickDate(raw, "dataEmissao", "data", "dataHoraAbertura"),
    criada_em_nomus: pickDateTime(raw, "dataHoraAbertura", "dataHoraCriacao", "dataCriacao"),
    criada_por_nomus: pickStr(raw, "criadoPor", "usuarioCriacao", "usuario"),

    // ===== Totais =====
    valor_total: pickNumBR(raw, "valorTotal", "valor", "total"),
    valor_produtos: pickNumBR(raw, "valorTotalProdutos", "valorProdutos"),
    valor_descontos: pickNumBR(raw, "valorDescontos", "descontosIncondicionais", "desconto"),
    valor_total_com_desconto: pickNumBR(raw, "valorTotalComDesconto"),
    valor_liquido: pickNumBR(raw, "valorLiquido", "valorLiquidoItem"),

    // ===== Tributos =====
    // O Nomus retorna o resumo de impostos em `totalTributacao` (array com 1
    // objeto). Usamos esse bloco como fallback quando o campo plano não vier.
    icms_recolher: pickNumBR(raw, "valorIcmsRecolher", "icmsRecolher", "valorIcms")
      ?? pickFromTotalTrib(raw, "valorIcms"),
    icms_st_recolher: pickNumBR(raw, "valorIcmsStRecolher", "icmsStRecolher", "valorIcmsSt"),
    ipi_recolher: pickNumBR(raw, "valorIpiRecolher", "ipiRecolher", "valorIpi"),
    pis_recolher: pickNumBR(raw, "valorPisRecolher", "pisRecolher", "valorPis")
      ?? pickFromTotalTrib(raw, "valorPis"),
    cofins_recolher: pickNumBR(raw, "valorCofinsRecolher", "cofinsRecolher", "valorCofins")
      ?? pickFromTotalTrib(raw, "valorCofins"),
    issqn_recolher: pickNumBR(raw, "valorIssqnRecolher", "issqnRecolher", "valorIssqn")
      ?? pickFromTotalTrib(raw, "valorIss"),
    simples_nacional_recolher: pickNumBR(raw, "valorSimplesNacionalRecolher", "simplesNacionalRecolher"),
    // Reforma tributária — vem apenas em totalTributacao[0]
    cbs_recolher: pickFromTotalTrib(raw, "valorCbs"),
    ibs_recolher: pickFromTotalTrib(raw, "valorIbs"),
    ibs_estadual_recolher: pickFromTotalTrib(raw, "valorIbsEstadual"),
    // Bloco bruto preservado para auditoria e UI
    total_tributacao: extractTotalTributacao(raw),

    // ===== Comissões / frete =====
    comissoes_venda: pickNumBR(raw, "valorComissoesVenda", "comissoesVenda"),
    frete_valor: pickNumBR(raw, "valorFrete", "frete"),
    frete_percentual: pickNumBR(raw, "percentualFrete", "freteCalculo"),
    seguros_valor: pickNumBR(raw, "valorSeguros", "seguros"),
    despesas_acessorias: pickNumBR(raw, "valorOutrasDespesasAcessorias", "outrasDespesasAcessorias"),

    // ===== Custos =====
    custos_producao: pickNumBR(raw, "custosProducao", "valorCustosProducao"),
    custos_materiais: pickNumBR(raw, "custosMateriais", "valorCustosMateriais"),
    custos_mod: pickNumBR(raw, "custosMaoObraDireta", "custosMOD"),
    custos_cif: pickNumBR(raw, "custosIndiretosFabricacao", "custosCIF"),
    custos_administrativos: pickNumBR(raw, "custosAdministrativos"),
    custos_incidentes_lucro: pickNumBR(raw, "custosIncidentesSobreLucro", "custosIncidentesLucro"),

    // ===== Resultado =====
    lucro_bruto: pickNumBR(raw, "lucroBruto", "valorLucroBruto"),
    margem_bruta_pct: pickNumBR(raw, "margemLucroBruto", "margemBruta", "percentualMargemBruta"),
    lucro_antes_impostos: pickNumBR(raw, "lucroAntesImpostos"),
    lucro_liquido: pickNumBR(raw, "lucroLiquido", "valorLucroLiquido"),
    margem_liquida_pct: pickNumBR(raw, "margemLucroLiquido", "margemLiquida", "percentualMargemLiquida"),

    status_nomus: pickStr(raw, "status", "situacao"),
    observacoes: pickStr(raw, "observacoes", "obs"),
  };
}

export type NomusProposalItemMapped = {
  nomus_item_id: string | null;
  nomus_product_id: string | null;
  product_code: string | null;
  description: string;
  additional_info: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit_value_with_unit: string | null;
  discount: number | null;
  total: number | null;
  total_with_discount: number | null;
  prazo_entrega_dias: number | null;
  item_status: string | null;
};

/** Extrai itens da proposta (`itensProposta` no payload do Nomus). */
export function extractProposalItems(raw: Json): NomusProposalItemMapped[] {
  const arr = (raw["itensProposta"] ?? raw["itens"] ?? raw["items"]) as Json[] | undefined;
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => {
    // produto pode vir aninhado
    const produto = (typeof it["produto"] === "object" && it["produto"] !== null)
      ? (it["produto"] as Json) : null;
    return {
      nomus_item_id: pickStr(it, "id", "idItem"),
      nomus_product_id: produto ? pickStr(produto, "id") : pickStr(it, "idProduto", "produtoId"),
      product_code: produto ? pickStr(produto, "codigo") : pickStr(it, "codigoProduto", "codigo"),
      description: (produto ? pickStr(produto, "descricao", "nome") : null)
        ?? pickStr(it, "descricaoProduto", "descricao", "nome") ?? "",
      additional_info: pickStr(it, "informacoesAdicionaisProduto", "informacoesAdicionais"),
      quantity: pickNumBR(it, "qtde", "quantidade", "qtd"),
      unit_price: pickNumBR(it, "valorUnitario", "preco"),
      unit_value_with_unit: pickStr(it, "valorUnitario"), // preserva "3.747,3484 por UN"
      discount: pickNumBR(it, "desconto", "valorDesconto"),
      total: pickNumBR(it, "valorTotal", "valorTotalProdutos", "total"),
      total_with_discount: pickNumBR(it, "valorTotalComDesconto"),
      prazo_entrega_dias: pickInt(it, "prazoEntrega", "diasEntrega"),
      item_status: pickStr(it, "status"),
    };
  });
}

// =================== Helpers de totalTributacao ===================

/**
 * O Nomus retorna o resumo de impostos calculados no campo `totalTributacao`,
 * que é um array com (geralmente) 1 objeto contendo: valorIcms, valorIss,
 * valorPis, valorCofins, valorCbs, valorIbs, valorIbsEstadual.
 * Esta função devolve o primeiro item do array como objeto cru, ou null.
 */
export function extractTotalTributacao(raw: Json): Json | null {
  const arr = raw["totalTributacao"];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0];
  return (typeof first === "object" && first !== null) ? first as Json : null;
}

/** Pega um campo numérico do bloco totalTributacao[0] (formato BR). */
function pickFromTotalTrib(raw: Json, key: string): number | null {
  const tt = extractTotalTributacao(raw);
  if (!tt) return null;
  return pickNumBR(tt, key);
}
