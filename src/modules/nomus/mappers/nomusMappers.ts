import type {
  Customer,
  PaymentCondition,
  Proposal,
  ProposalItem,
  TaxSummary,
} from "@/modules/nomus/types/domain";
import type {
  NomusCustomerRaw,
  NomusJson,
  NomusProposalItemMapped,
  NomusProposalMapped,
  NomusPaymentConditionRaw,
  NomusProposalItemRaw,
  NomusProposalRaw,
  NomusTaxRaw,
} from "@/modules/nomus/types";
import {
  extractTotalTributacao,
  parseNomusNumber,
  pickDate,
  pickDateTime,
  pickInt,
  pickNumBR,
  pickStr,
} from "@/modules/nomus/mappers/parseHelpers";

function asJson(raw: NomusJson | null | undefined): NomusJson {
  return raw ?? {};
}

function pickRef(
  raw: NomusJson,
  nestedKey: string,
  idKeys: string[],
  nameKeys: string[],
): { id: string | null; name: string | null } {
  const nested = raw[nestedKey];
  if (nested && typeof nested === "object") {
    const obj = nested as NomusJson;
    return {
      id: pickStr(obj, "id", "codigo", ...idKeys),
      name: pickStr(obj, "nome", "descricao", "razaoSocial", ...nameKeys),
    };
  }

  return {
    id: pickStr(raw, ...idKeys),
    name: pickStr(raw, ...nameKeys),
  };
}

function amount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function firstTaxObject(raw: NomusProposalRaw | NomusTaxRaw | null | undefined): NomusJson | null {
  if (!raw) return null;
  const obj = raw as NomusJson;
  const extracted = extractTotalTributacao(obj);
  if (extracted) return extracted;
  return obj;
}

export function mapNomusCustomerToCustomer(
  raw: NomusCustomerRaw | null | undefined,
): Customer | null {
  if (!raw) return null;
  const obj = asJson(raw);
  const nomusId = pickStr(obj, "id", "codigo", "idCliente", "clienteId");
  const name = pickStr(obj, "nome", "razaoSocial", "nomeCliente", "clienteNome");
  if (!nomusId && !name) return null;

  return {
    id: null,
    nomusId,
    name,
    tradeName: pickStr(obj, "nomeFantasia", "apelido"),
    document: pickStr(obj, "cnpj", "cpf", "documento"),
    city: pickStr(obj, "cidade", "municipio"),
    state: pickStr(obj, "uf", "estado"),
    email: pickStr(obj, "email", "emailPrincipal"),
    phone: pickStr(obj, "telefone", "fone", "telefonePrincipal", "celular"),
    raw,
  };
}

export function mapNomusPaymentToPaymentCondition(
  raw: NomusPaymentConditionRaw | null | undefined,
): PaymentCondition | null {
  if (!raw) return null;
  const obj = asJson(raw);
  const installmentsRaw = obj.parcelas ?? obj.installments ?? obj.itens ?? [];
  const installments = Array.isArray(installmentsRaw)
    ? installmentsRaw.map((item, index) => {
        const row = (item ?? {}) as NomusJson;
        return {
          label: pickStr(row, "descricao", "parcela", "nome") ?? `Parcela ${index + 1}`,
          percentage: pickNumBR(row, "percentual", "porcentagem"),
          value: pickNumBR(row, "valor", "valorParcela"),
          dueInDays: pickInt(row, "dias", "prazoDias", "vencimentoDias"),
          dueDate: pickDate(row, "dataVencimento", "vencimento"),
        };
      })
    : [];

  return {
    id: null,
    nomusId: pickStr(obj, "id", "codigo", "idCondicaoPagamento", "condicaoPagamentoId"),
    name: pickStr(obj, "nome", "descricao", "nomeCondicaoPagamento", "descricaoCondicaoPagamento"),
    description: pickStr(obj, "observacao", "observacoes", "detalhes"),
    installments,
    raw,
  };
}

export function mapNomusTaxesToTaxSummary(
  raw: NomusTaxRaw | NomusProposalRaw | null | undefined,
): TaxSummary {
  const tax = firstTaxObject(raw);
  const summary: TaxSummary = {
    icms: tax ? pickNumBR(tax, "valorIcms", "valorIcmsRecolher", "icmsRecolher") : null,
    icmsSt: tax ? pickNumBR(tax, "valorIcmsSt", "valorIcmsStRecolher", "icmsStRecolher") : null,
    ipi: tax ? pickNumBR(tax, "valorIpi", "valorIpiRecolher", "ipiRecolher") : null,
    iss: tax
      ? pickNumBR(tax, "valorIss", "valorIssqn", "valorIssqnRecolher", "issqnRecolher")
      : null,
    pis: tax ? pickNumBR(tax, "valorPis", "valorPisRecolher", "pisRecolher") : null,
    cofins: tax ? pickNumBR(tax, "valorCofins", "valorCofinsRecolher", "cofinsRecolher") : null,
    simplesNacional: tax
      ? pickNumBR(tax, "valorSimplesNacional", "valorSimplesNacionalRecolher")
      : null,
    cbs: tax ? pickNumBR(tax, "valorCbs") : null,
    ibs: tax ? pickNumBR(tax, "valorIbs") : null,
    ibsEstadual: tax ? pickNumBR(tax, "valorIbsEstadual") : null,
    total: 0,
    raw: tax,
  };

  summary.total = [
    summary.icms,
    summary.icmsSt,
    summary.ipi,
    summary.iss,
    summary.pis,
    summary.cofins,
    summary.simplesNacional,
    summary.cbs,
    summary.ibs,
    summary.ibsEstadual,
  ].reduce<number>((sum, value) => sum + amount(value), 0);

  return summary;
}

export function mapNomusItemsToProposalItems(
  rawItems: NomusProposalItemRaw[] | null | undefined,
): ProposalItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((item) => {
    const obj = asJson(item);
    const product =
      obj.produto && typeof obj.produto === "object" ? (obj.produto as NomusJson) : null;
    const quantity = pickNumBR(obj, "qtde", "quantidade", "qtd");
    const unitPrice = parseNomusNumber(obj.valorUnitario ?? obj.preco);
    const total =
      pickNumBR(obj, "valorTotal", "valorTotalProdutos", "total") ??
      (quantity !== null && unitPrice !== null ? quantity * unitPrice : null);

    return {
      id: null,
      nomusItemId: pickStr(obj, "id", "idItem"),
      nomusProductId: product
        ? pickStr(product, "id", "codigo")
        : pickStr(obj, "idProduto", "produtoId"),
      productCode: product ? pickStr(product, "codigo") : pickStr(obj, "codigoProduto", "codigo"),
      description:
        (product ? pickStr(product, "descricao", "nome") : null) ??
        pickStr(obj, "descricaoProduto", "descricao", "nome") ??
        "",
      additionalInfo: pickStr(obj, "informacoesAdicionaisProduto", "informacoesAdicionais"),
      quantity,
      unitPrice,
      unitValueWithUnit: pickStr(obj, "valorUnitario"),
      discount: pickNumBR(obj, "desconto", "valorDesconto"),
      total,
      totalWithDiscount: pickNumBR(obj, "valorTotalComDesconto") ?? total,
      deliveryDays: pickInt(obj, "prazoEntrega", "diasEntrega"),
      status: pickStr(obj, "status", "situacao"),
      raw: item,
    };
  });
}

export function mapNomusProposalToProposal(raw: NomusProposalRaw): Proposal {
  const obj = asJson(raw);
  const customerRef = pickRef(
    obj,
    "cliente",
    ["idCliente", "clienteId"],
    ["nomeCliente", "clienteNome"],
  );
  const paymentRef = pickRef(
    obj,
    "condicaoPagamento",
    ["idCondicaoPagamento", "condicaoPagamentoId"],
    ["nomeCondicaoPagamento", "descricaoCondicaoPagamento"],
  );
  const rawItems = (obj.itensProposta ?? obj.itens ?? obj.items) as
    | NomusProposalItemRaw[]
    | undefined;

  return {
    id: null,
    nomusId: pickStr(obj, "id", "idProposta", "codigo"),
    number: pickStr(obj, "proposta", "numero", "numeroProposta"),
    title: pickStr(obj, "titulo", "descricao"),
    status: pickStr(obj, "status", "situacao"),
    customer: {
      id: null,
      nomusId: customerRef.id,
      name: customerRef.name,
    },
    paymentCondition: {
      id: null,
      nomusId: paymentRef.id,
      name: paymentRef.name,
      installments: [],
    },
    items: mapNomusItemsToProposalItems(rawItems),
    taxSummary: mapNomusTaxesToTaxSummary(raw),
    total: pickNumBR(obj, "valorTotal", "valor", "total"),
    productsTotal: pickNumBR(obj, "valorTotalProdutos", "valorProdutos"),
    discountTotal: pickNumBR(obj, "valorDescontos", "descontosIncondicionais", "desconto"),
    totalWithDiscount: pickNumBR(obj, "valorTotalComDesconto"),
    netValue: pickNumBR(obj, "valorLiquido", "valorLiquidoItem"),
    issuedAt: pickDate(obj, "dataEmissao", "data", "dataHoraAbertura"),
    openedAt: pickDateTime(obj, "dataHoraAbertura", "dataHoraCriacao", "dataCriacao"),
    expiresAt: pickDate(obj, "validade", "dataValidade"),
    observations: pickStr(obj, "observacoes", "obs"),
    raw,
  };
}

export function mapNomusProposal(raw: NomusProposalRaw): NomusProposalMapped | null {
  const obj = asJson(raw);
  const nomusId = pickStr(obj, "id", "idProposta", "codigo");
  if (!nomusId) return null;

  const cliente = pickRef(
    obj,
    "cliente",
    ["idCliente", "clienteId"],
    ["nomeCliente", "clienteNome"],
  );
  const empresa = pickRef(obj, "empresa", ["idEmpresa"], ["nomeEmpresa"]);
  const vendedor = pickRef(obj, "vendedor", ["idVendedor", "vendedorId"], ["nomeVendedor"]);
  const representante = pickRef(
    obj,
    "representante",
    ["idRepresentante", "representanteId"],
    ["nomeRepresentante"],
  );
  const contato = pickRef(obj, "contato", ["idContato", "contatoId"], ["nomeContato"]);
  const tabelaPreco = pickRef(
    obj,
    "tabelaPreco",
    ["idTabelaPreco", "tabelaPrecoId"],
    ["nomeTabelaPreco", "descricaoTabelaPreco"],
  );
  const condPag = pickRef(
    obj,
    "condicaoPagamento",
    ["idCondicaoPagamento", "condicaoPagamentoId"],
    ["nomeCondicaoPagamento", "descricaoCondicaoPagamento"],
  );
  const taxSummary = mapNomusTaxesToTaxSummary(raw);

  return {
    nomus_id: nomusId,
    numero: pickStr(obj, "proposta", "numero", "numeroProposta"),
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
    tipo_movimentacao: pickStr(obj, "tipoMovimentacao", "movimentacao"),
    prazo_entrega_dias: pickInt(obj, "prazoEntrega", "prazoEntregaDias", "diasEntrega"),
    pedido_compra_cliente: pickStr(obj, "pedidoCompraCliente", "numeroPedidoCliente"),
    layout_pdf: pickStr(obj, "layoutPdf", "layoutEspecificoPdf"),
    validade: pickDate(obj, "validade", "dataValidade"),
    data_emissao: pickDate(obj, "dataEmissao", "data", "dataHoraAbertura"),
    criada_em_nomus: pickDateTime(obj, "dataHoraAbertura", "dataHoraCriacao", "dataCriacao"),
    criada_por_nomus: pickStr(obj, "criadoPor", "usuarioCriacao", "usuario"),
    valor_total: pickNumBR(obj, "valorTotal", "valor", "total"),
    valor_produtos: pickNumBR(obj, "valorTotalProdutos", "valorProdutos"),
    valor_descontos: pickNumBR(obj, "valorDescontos", "descontosIncondicionais", "desconto"),
    valor_total_com_desconto: pickNumBR(obj, "valorTotalComDesconto"),
    valor_liquido: pickNumBR(obj, "valorLiquido", "valorLiquidoItem"),
    icms_recolher: taxSummary.icms,
    icms_st_recolher: taxSummary.icmsSt,
    ipi_recolher: taxSummary.ipi,
    pis_recolher: taxSummary.pis,
    cofins_recolher: taxSummary.cofins,
    issqn_recolher: taxSummary.iss,
    simples_nacional_recolher: taxSummary.simplesNacional,
    cbs_recolher: taxSummary.cbs,
    ibs_recolher: taxSummary.ibs,
    ibs_estadual_recolher: taxSummary.ibsEstadual,
    total_tributacao: (taxSummary.raw as NomusJson | null | undefined) ?? null,
    comissoes_venda: pickNumBR(obj, "valorComissoesVenda", "comissoesVenda"),
    frete_valor: pickNumBR(obj, "valorFrete", "frete"),
    frete_percentual: pickNumBR(obj, "percentualFrete", "freteCalculo"),
    seguros_valor: pickNumBR(obj, "valorSeguros", "seguros"),
    despesas_acessorias: pickNumBR(
      obj,
      "valorOutrasDespesasAcessorias",
      "outrasDespesasAcessorias",
    ),
    custos_producao: pickNumBR(obj, "custosProducao", "valorCustosProducao"),
    custos_materiais: pickNumBR(obj, "custosMateriais", "valorCustosMateriais"),
    custos_mod: pickNumBR(obj, "custosMaoObraDireta", "custosMOD"),
    custos_cif: pickNumBR(obj, "custosIndiretosFabricacao", "custosCIF"),
    custos_administrativos: pickNumBR(obj, "custosAdministrativos"),
    custos_incidentes_lucro: pickNumBR(obj, "custosIncidentesSobreLucro", "custosIncidentesLucro"),
    lucro_bruto: pickNumBR(obj, "lucroBruto", "valorLucroBruto"),
    margem_bruta_pct: pickNumBR(obj, "margemLucroBruto", "margemBruta", "percentualMargemBruta"),
    lucro_antes_impostos: pickNumBR(obj, "lucroAntesImpostos"),
    lucro_liquido: pickNumBR(obj, "lucroLiquido", "valorLucroLiquido"),
    margem_liquida_pct: pickNumBR(
      obj,
      "margemLucroLiquido",
      "margemLiquida",
      "percentualMargemLiquida",
    ),
    status_nomus: pickStr(obj, "status", "situacao"),
    observacoes: pickStr(obj, "observacoes", "obs"),
  };
}

export function extractProposalItems(raw: NomusProposalRaw | NomusJson): NomusProposalItemMapped[] {
  const obj = asJson(raw);
  const rawItems = (obj.itensProposta ?? obj.itens ?? obj.items) as
    | NomusProposalItemRaw[]
    | undefined;
  return mapNomusItemsToProposalItems(rawItems).map((item) => ({
    nomus_item_id: item.nomusItemId ?? null,
    nomus_product_id: item.nomusProductId ?? null,
    product_code: item.productCode ?? null,
    description: item.description,
    additional_info: item.additionalInfo ?? null,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    unit_value_with_unit: item.unitValueWithUnit ?? null,
    discount: item.discount,
    total: item.total,
    total_with_discount: item.totalWithDiscount,
    prazo_entrega_dias: item.deliveryDays ?? null,
    item_status: item.status ?? null,
  }));
}
