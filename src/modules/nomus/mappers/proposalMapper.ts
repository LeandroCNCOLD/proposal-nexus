import type {
  CommissionSummary,
  Customer,
  PaymentCondition,
  Proposal,
  ProposalItem,
  TaxSummary,
} from "@/modules/proposals/types";
import type {
  NomusCustomerRaw,
  NomusPaymentConditionRaw,
  NomusProposalItemRaw,
  NomusProposalRaw,
  NomusRepresentativeRaw,
  NomusTaxRaw,
} from "@/modules/nomus/types";
import {
  extractTotalTributacao,
  parseNomusNumber,
  pickDate,
  pickInt,
  pickNumBR,
  pickStr,
} from "@/integrations/nomus/parse";

type Json = Record<string, unknown>;

const emptyTaxSummary = (): TaxSummary => ({
  icms: null,
  icmsSt: null,
  ipi: null,
  iss: null,
  pis: null,
  cofins: null,
  simplesNacional: null,
  cbs: null,
  ibs: null,
  ibsEstadual: null,
  total: 0,
});

function pickRef(raw: Json, nestedKey: string, idKeys: string[], nameKeys: string[]) {
  const nested = raw[nestedKey];
  if (nested && typeof nested === "object") {
    const obj = nested as Json;
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

function finiteOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function mapNomusCustomerToCustomer(
  raw: NomusCustomerRaw | null | undefined,
): Customer | null {
  if (!raw) return null;
  const obj = raw as Json;
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
    phone: pickStr(obj, "telefone", "fone", "celular"),
  };
}

export function mapNomusPaymentToPaymentCondition(
  raw: NomusPaymentConditionRaw | null | undefined,
): PaymentCondition | null {
  if (!raw) return null;
  const obj = raw as Json;
  const installmentsRaw = (obj.parcelas ?? obj.installments ?? obj.itens ?? []) as unknown;
  const installments = Array.isArray(installmentsRaw)
    ? installmentsRaw.map((item, index) => {
        const row = (item ?? {}) as Json;
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
  };
}

export function mapNomusTaxesToTaxSummary(raw: NomusTaxRaw | null | undefined): TaxSummary {
  if (!raw) return emptyTaxSummary();
  const obj = raw as Json;
  const summary: TaxSummary = {
    icms: pickNumBR(obj, "valorIcms", "valorIcmsRecolher", "icmsRecolher"),
    icmsSt: pickNumBR(obj, "valorIcmsSt", "valorIcmsStRecolher", "icmsStRecolher"),
    ipi: pickNumBR(obj, "valorIpi", "valorIpiRecolher", "ipiRecolher"),
    iss: pickNumBR(obj, "valorIss", "valorIssqn", "valorIssqnRecolher", "issqnRecolher"),
    pis: pickNumBR(obj, "valorPis", "valorPisRecolher", "pisRecolher"),
    cofins: pickNumBR(obj, "valorCofins", "valorCofinsRecolher", "cofinsRecolher"),
    simplesNacional: pickNumBR(obj, "valorSimplesNacional", "valorSimplesNacionalRecolher"),
    cbs: pickNumBR(obj, "valorCbs"),
    ibs: pickNumBR(obj, "valorIbs"),
    ibsEstadual: pickNumBR(obj, "valorIbsEstadual"),
    total: 0,
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
  ].reduce<number>((sum, value) => sum + finiteOrZero(value), 0);
  return summary;
}

export function mapNomusItemsToProposalItems(
  rawItems: NomusProposalItemRaw[] | null | undefined,
): ProposalItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((item) => {
    const obj = item as Json;
    const product = obj.produto && typeof obj.produto === "object" ? (obj.produto as Json) : null;
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
      discount: pickNumBR(obj, "desconto", "valorDesconto"),
      total,
      totalWithDiscount: pickNumBR(obj, "valorTotalComDesconto") ?? total,
      deliveryDays: pickInt(obj, "prazoEntrega", "diasEntrega"),
      status: pickStr(obj, "status", "situacao"),
    };
  });
}

export function mapNomusRepresentativeToCommissionSummary(
  raw: NomusRepresentativeRaw | null | undefined,
  baseValue: number,
  commissionAmount?: number | null,
): CommissionSummary | null {
  const obj = (raw ?? {}) as Json;
  const amount = finiteOrZero(commissionAmount);
  const rate = baseValue > 0 && amount > 0 ? (amount / baseValue) * 100 : null;
  if (!raw && amount === 0) return null;

  return {
    representativeId: pickStr(obj, "id", "codigo", "idRepresentante"),
    representativeName: pickStr(obj, "nome", "razaoSocial", "nomeRepresentante"),
    sellerId: pickStr(obj, "idVendedor", "vendedorId"),
    sellerName: pickStr(obj, "nomeVendedor"),
    baseValue,
    rate,
    amount,
  };
}

export function mapNomusProposalToProposal(raw: NomusProposalRaw): Proposal {
  const obj = raw as Json;
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
  const sellerRef = pickRef(obj, "vendedor", ["idVendedor", "vendedorId"], ["nomeVendedor"]);
  const representativeRef = pickRef(
    obj,
    "representante",
    ["idRepresentante", "representanteId"],
    ["nomeRepresentante"],
  );
  const rawItems = (obj.itensProposta ?? obj.itens ?? obj.items) as
    | NomusProposalItemRaw[]
    | undefined;
  const totalTributacao = extractTotalTributacao(obj) ?? obj.totalTributacao ?? obj;
  const total = pickNumBR(obj, "valorTotal", "valor", "total");
  const discountTotal = pickNumBR(obj, "valorDescontos", "descontosIncondicionais", "desconto");
  const commissionAmount = pickNumBR(obj, "valorComissoesVenda", "comissoesVenda");

  return {
    id: null,
    number: pickStr(obj, "proposta", "numero", "numeroProposta"),
    title: pickStr(obj, "titulo", "descricao"),
    source: "nomus",
    nomusId: pickStr(obj, "id", "idProposta", "codigo"),
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
    taxSummary: mapNomusTaxesToTaxSummary(totalTributacao as NomusTaxRaw),
    commissionSummary: mapNomusRepresentativeToCommissionSummary(
      {
        id: representativeRef.id,
        nome: representativeRef.name,
        idVendedor: sellerRef.id,
        nomeVendedor: sellerRef.name,
      },
      finiteOrZero(total),
      commissionAmount,
    ),
    financialSummary: null,
    issuedAt: pickDate(obj, "dataEmissao", "data", "dataHoraAbertura"),
    expiresAt: pickDate(obj, "validade", "dataValidade"),
    total,
    discountTotal,
    observations: pickStr(obj, "observacoes", "obs"),
    raw,
  };
}
