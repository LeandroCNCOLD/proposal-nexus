import type { PlaceholderContext } from "./resolve";
import { fmtCurrency, fmtDate, fmtMesExtenso } from "./format";

/**
 * Inputs brutos para construir o PlaceholderContext.
 * Campos opcionais — qualquer valor ausente vira string vazia (placeholder permanece como `{{...}}`).
 */
export interface PlaceholderInputs {
  proposal?: {
    number?: string | null;
    title?: string | null;
    valid_until?: string | null;
    delivery_term?: string | null;
    total_value?: number | null;
    payment_terms?: string | null;
    nomus_payment_term_name?: string | null;
    nomus_price_table_name?: string | null;
    nomus_seller_name?: string | null;
    created_at?: string | null;
  } | null;
  client?: {
    name?: string | null;
    trade_name?: string | null;
    document?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  contact?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
  seller?: {
    full_name?: string | null;
    job_title?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  nomusProposal?: {
    valor_produtos?: number | null;
    valor_descontos?: number | null;
    valor_total?: number | null;
    condicao_pagamento_nome?: string | null;
    tabela_preco_nome?: string | null;
    vendedor_nome?: string | null;
    data_emissao?: string | null;
    validade?: string | null;
    observacoes?: string | null;
    prazo_entrega_dias?: number | null;
  } | null;
  nomusItems?: Array<{
    description?: string | null;
    quantity?: number | null;
    unit_value_with_unit?: string | null;
  }> | null;
  template?: {
    empresa_nome?: string | null;
    empresa_email?: string | null;
    empresa_telefone?: string | null;
    empresa_site?: string | null;
    empresa_cidade?: string | null;
  } | null;
}

export function buildPlaceholderContext(input: PlaceholderInputs): PlaceholderContext {
  const today = new Date();

  const cliente = {
    razao_social: input.client?.name ?? "",
    nome_fantasia: input.client?.trade_name ?? input.client?.name ?? "",
    cnpj: input.client?.document ?? "",
    cidade: input.client?.city ?? "",
    estado: input.client?.state ?? "",
    endereco: [input.client?.city, input.client?.state].filter(Boolean).join(" / "),
    contato_nome: input.contact?.name ?? "",
    contato_email: input.contact?.email ?? "",
    contato_telefone: input.contact?.phone ?? "",
    contato_cargo: input.contact?.role ?? "",
  };

  const totalValue =
    input.proposal?.total_value ?? input.nomusProposal?.valor_total ?? null;

  const proposta = {
    numero: input.proposal?.number ?? "",
    titulo: input.proposal?.title ?? "",
    valor_total: fmtCurrency(totalValue ?? undefined),
    valor_produtos: fmtCurrency(input.nomusProposal?.valor_produtos ?? undefined),
    valor_descontos: fmtCurrency(input.nomusProposal?.valor_descontos ?? undefined),
    validade: fmtDate(input.proposal?.valid_until ?? input.nomusProposal?.validade),
    prazo_entrega:
      input.proposal?.delivery_term ??
      (input.nomusProposal?.prazo_entrega_dias
        ? `${input.nomusProposal.prazo_entrega_dias} dias`
        : ""),
    data_emissao: fmtDate(
      input.proposal?.created_at ?? input.nomusProposal?.data_emissao,
    ),
    observacoes: input.nomusProposal?.observacoes ?? "",
  };

  const vendedor = {
    nome:
      input.seller?.full_name ??
      input.nomusProposal?.vendedor_nome ??
      input.proposal?.nomus_seller_name ??
      "",
    email: input.seller?.email ?? "",
    telefone: input.seller?.phone ?? "",
    cargo: input.seller?.job_title ?? "",
  };

  const pagamento = {
    condicao:
      input.nomusProposal?.condicao_pagamento_nome ??
      input.proposal?.nomus_payment_term_name ??
      input.proposal?.payment_terms ??
      "",
    tabela_preco:
      input.nomusProposal?.tabela_preco_nome ??
      input.proposal?.nomus_price_table_name ??
      "",
  };

  const items = input.nomusItems ?? [];
  const equipamentos = {
    lista: items
      .map((it) => {
        const qty = it.quantity ? `${it.quantity}× ` : "";
        return `${qty}${it.description ?? ""}`.trim();
      })
      .filter(Boolean)
      .join("; "),
    quantidade_total: items.length ? String(items.length) : "",
    primeiro: items[0]?.description ?? "",
  };

  const empresa = {
    nome: input.template?.empresa_nome ?? "",
    email: input.template?.empresa_email ?? "",
    telefone: input.template?.empresa_telefone ?? "",
    site: input.template?.empresa_site ?? "",
    cidade: input.template?.empresa_cidade ?? "",
  };

  const data = {
    hoje: fmtDate(today),
    ano: String(today.getFullYear()),
    mes: fmtMesExtenso(today),
  };

  return { cliente, proposta, vendedor, pagamento, equipamentos, empresa, data };
}
