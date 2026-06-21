import type { ProposalTemplate } from "./template.types";
import { normalizeDadosBancarios } from "./template.types";

export type ProposalDocumentContext = {
  proposal: {
    number: string | null;
    title: string | null;
    created_at: string | null;
    data_emissao: string | null;
    valid_until: string | null;
    total_value: number | null;
    payment_terms: string | null;
    delivery_term: string | null;
  };
  client: {
    name: string | null;
    trade_name: string | null;
    document: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
  };
  seller: { name: string | null; role: string | null; phone: string | null; email: string | null };
  company: {
    name: string | null;
    phone: string | null;
    email: string | null;
    site: string | null;
    city: string | null;
    document: string | null;
  };
  bank: {
    bank_name: string | null;
    agency: string | null;
    account: string | null;
    document: string | null;
    company_name: string | null;
    pix: string | null;
  };
  financial: {
    total_value: number | null;
    product_value: number | null;
    discount_value: number | null;
    discount_percent: number | null;
    net_value: number | null;
    monthly_value: number | null;
    contract_term_months: number | null;
  };
  payment: {
    terms: string | null;
    installments: number | null;
    installment_value: number | null;
    avg_receipt_term_days: number | null;
    financial_rate_value: number | null;
  };
  tax: {
    icms: number | null;
    ipi: number | null;
    pis: number | null;
    cofins: number | null;
    iss: number | null;
    cbs: number | null;
    ibs: number | null;
  };
  items: Array<{
    description: string | null;
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    total: number | null;
  }>;
  coldpro: {
    totalLoadKcalH: number | null;
    totalLoadKW: number | null;
    selectedEquipment: string | null;
    equipmentQuantity: number | null;
    internalTemperature: number | null;
    externalTemperature: number | null;
    product: string | null;
    airflow: number | null;
    internalVolume: number | null;
  };
  legacy: {
    proposal_number: string | null;
    proposal_title: string | null;
    client_name: string | null;
    data_emissao: string | null;
    validade: string | null;
    vendedor: string | null;
    empresa_telefone: string | null;
    empresa_site: string | null;
    empresa_email: string | null;
  };
};

export type ProposalDynamicContext = ProposalDocumentContext["legacy"] & {
  documentContext?: ProposalDocumentContext;
};

const MISSING_VALUE = "—";

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function valueAtPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (typeof current === "object") return (current as Record<string, unknown>)[part];
    return undefined;
  }, source);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return MISSING_VALUE;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : MISSING_VALUE;
  return String(value);
}

function warnMissing(key: string) {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return;
  if (typeof console !== "undefined")
    console.warn(`[proposal-editor] variável não resolvida: ${key}`);
}

export function resolveProposalVariable(
  key: string,
  context: ProposalDocumentContext | ProposalDynamicContext | null | undefined,
  options: { fallback?: string } = {},
): string {
  const fallback = options.fallback ?? MISSING_VALUE;
  if (!key) return fallback;
  const docContext =
    (context as ProposalDynamicContext | null | undefined)?.documentContext ?? context;
  const aliases: Record<string, string> = {
    proposal_number: "proposal.number",
    proposal_title: "proposal.title",
    client_name: "client.name",
    data_emissao: "proposal.data_emissao",
    data: "proposal.data_emissao",
    validade: "proposal.valid_until",
    vendedor: "seller.name",
    empresa_nome: "company.name",
    empresa_telefone: "company.phone",
    empresa_email: "company.email",
    empresa_site: "company.site",
    empresa_cidade: "company.city",
  };
  const value = valueAtPath(docContext, aliases[key] ?? key);
  const formatted = formatValue(value);
  if (formatted === MISSING_VALUE) {
    warnMissing(key);
    return fallback;
  }
  return formatted;
}

export function resolveProposalVariablesInText(
  text: string,
  context: ProposalDocumentContext | ProposalDynamicContext | null | undefined,
): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) =>
    resolveProposalVariable(key.trim(), context),
  );
}

export function buildProposalDocumentContextFromRecords(args: {
  proposal: Record<string, unknown> | null;
  client?: Record<string, unknown> | null;
  contact?: Record<string, unknown> | null;
  nomusProposal?: Record<string, unknown> | null;
  nomusItems?: Array<Record<string, unknown>> | null;
  template?: ProposalTemplate | null;
}): ProposalDocumentContext {
  const { proposal, client, contact, nomusProposal, nomusItems, template } = args;
  const bank = normalizeDadosBancarios(template?.dados_bancarios)[0] ?? null;
  const proposalNumber = String(proposal?.number ?? nomusProposal?.numero ?? "");
  const proposalTitle = String(proposal?.title ?? "");
  const createdAt = String(proposal?.created_at ?? nomusProposal?.data_emissao ?? "");
  const validUntil = String(proposal?.valid_until ?? nomusProposal?.validade ?? "");
  const clientName = String(
    client?.trade_name ?? client?.name ?? nomusProposal?.cliente_nome ?? "",
  );
  const sellerName = String(proposal?.nomus_seller_name ?? nomusProposal?.vendedor_nome ?? "");
  const totalValue = firstNumber(proposal?.total_value, nomusProposal?.valor_total);
  const productValue = firstNumber(nomusProposal?.valor_produtos);
  const discountValue = firstNumber(nomusProposal?.valor_descontos);
  const netValue = firstNumber(
    nomusProposal?.valor_liquido,
    nomusProposal?.valor_total_com_desconto,
    totalValue,
  );
  const installments = firstNumber(
    (proposal?.payment_terms as string | undefined)?.match(/\d+/)?.[0],
  );
  const items = (nomusItems ?? []).map((item) => ({
    description: String(item.description ?? item.descricao ?? ""),
    quantity: firstNumber(item.quantity),
    unit: String(item.unit_value_with_unit ?? ""),
    unit_price: firstNumber(item.unit_price),
    total: firstNumber(item.total_with_discount, item.total),
  }));

  return {
    proposal: {
      number: proposalNumber || null,
      title: proposalTitle || null,
      created_at: createdAt || null,
      data_emissao: createdAt || null,
      valid_until: validUntil || null,
      total_value: totalValue,
      payment_terms:
        String(proposal?.payment_terms ?? nomusProposal?.condicao_pagamento_nome ?? "") || null,
      delivery_term: String(proposal?.delivery_term ?? "") || null,
    },
    client: {
      name: clientName || null,
      trade_name: String(client?.trade_name ?? "") || null,
      document: String(client?.document ?? "") || null,
      address:
        [client?.address, client?.address_number, client?.district].filter(Boolean).join(", ") ||
        null,
      city: String(client?.city ?? "") || null,
      state: String(client?.state ?? "") || null,
      phone: String(client?.phone ?? "") || null,
      email: String(client?.email ?? "") || null,
      contact_name: String(contact?.name ?? "") || null,
      contact_phone: String(contact?.phone ?? "") || null,
      contact_email: String(contact?.email ?? "") || null,
    },
    seller: { name: sellerName || null, role: null, phone: null, email: null },
    company: {
      name: template?.empresa_nome ?? null,
      phone: template?.empresa_telefone ?? null,
      email: template?.empresa_email ?? null,
      site: template?.empresa_site ?? null,
      city: template?.empresa_cidade ?? null,
      document: null,
    },
    bank: {
      bank_name: bank?.banco ?? null,
      agency: bank?.agencia ?? null,
      account: bank?.conta ?? null,
      document: null,
      company_name: bank?.titular ?? template?.empresa_nome ?? null,
      pix: bank?.pix ?? null,
    },
    financial: {
      total_value: totalValue,
      product_value: productValue,
      discount_value: discountValue,
      discount_percent: productValue && discountValue ? (discountValue / productValue) * 100 : null,
      net_value: netValue,
      monthly_value: installments && totalValue ? totalValue / installments : null,
      contract_term_months: installments,
    },
    payment: {
      terms:
        String(proposal?.payment_terms ?? nomusProposal?.condicao_pagamento_nome ?? "") || null,
      installments,
      installment_value: installments && totalValue ? totalValue / installments : null,
      avg_receipt_term_days: null,
      financial_rate_value: null,
    },
    tax: {
      icms: firstNumber(nomusProposal?.icms_recolher),
      ipi: firstNumber(nomusProposal?.ipi_recolher),
      pis: firstNumber(nomusProposal?.pis_recolher),
      cofins: firstNumber(nomusProposal?.cofins_recolher),
      iss: firstNumber(nomusProposal?.issqn_recolher),
      cbs: firstNumber(nomusProposal?.cbs_recolher),
      ibs: firstNumber(nomusProposal?.ibs_recolher),
    },
    items,
    coldpro: {
      totalLoadKcalH: null,
      totalLoadKW: null,
      selectedEquipment: null,
      equipmentQuantity: null,
      internalTemperature: null,
      externalTemperature: null,
      product: null,
      airflow: null,
      internalVolume: null,
    },
    legacy: {
      proposal_number: proposalNumber || null,
      proposal_title: proposalTitle || null,
      client_name: clientName || null,
      data_emissao: createdAt || null,
      validade: validUntil || null,
      vendedor: sellerName || null,
      empresa_telefone: template?.empresa_telefone ?? null,
      empresa_site: template?.empresa_site ?? null,
      empresa_email: template?.empresa_email ?? null,
    },
  };
}
