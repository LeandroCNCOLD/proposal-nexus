/**
 * Catálogo central de variáveis dinâmicas usadas em textos livres do editor
 * de propostas. Toda variável é resolvida a partir do `ProposalDocumentContext`
 * (camada central única). Sintaxe: `{{namespace.field}}`.
 *
 * Para adicionar uma nova variável basta:
 *   1) Definir aqui em VARIABLES com `key`, `label`, `category`, `example`.
 *   2) Adicionar o getter correspondente em `getVariableValue` (resolver).
 */
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";

export type VariableCategory =
  | "Cliente"
  | "Proposta"
  | "Comercial"
  | "Financeiro"
  | "Pagamento"
  | "Técnico"
  | "Empresa";

export interface VariableDefinition {
  key: string; // ex: "client.name"
  label: string; // ex: "Nome do cliente"
  category: VariableCategory;
  example: string; // ex: "Frigorífico ABC LTDA"
  description?: string;
}

export const VARIABLES: VariableDefinition[] = [
  // ─── Cliente ──────────────────────────────────────────────────────────
  { key: "client.name", label: "Nome do cliente", category: "Cliente", example: "Frigorífico ABC LTDA" },
  { key: "client.fantasia", label: "Nome fantasia", category: "Cliente", example: "ABC Foods" },
  { key: "client.document", label: "CNPJ/CPF", category: "Cliente", example: "12.345.678/0001-90" },
  { key: "client.address", label: "Endereço completo", category: "Cliente", example: "Av. Brasil, 1000 · Centro · SP" },
  { key: "client.city", label: "Cidade", category: "Cliente", example: "São Paulo" },
  { key: "client.uf", label: "UF", category: "Cliente", example: "SP" },
  { key: "client.email", label: "E-mail", category: "Cliente", example: "contato@abc.com" },
  { key: "client.phone", label: "Telefone", category: "Cliente", example: "(11) 99999-0000" },
  { key: "client.segment", label: "Segmento", category: "Cliente", example: "Frigorífico" },
  { key: "contact.name", label: "Contato — nome", category: "Cliente", example: "João Silva" },
  { key: "contact.role", label: "Contato — cargo", category: "Cliente", example: "Gerente de Manutenção" },
  { key: "contact.email", label: "Contato — e-mail", category: "Cliente", example: "joao@abc.com" },
  { key: "contact.phone", label: "Contato — telefone", category: "Cliente", example: "(11) 98888-0000" },

  // ─── Proposta ─────────────────────────────────────────────────────────
  { key: "proposal.number", label: "Número da proposta", category: "Proposta", example: "CN12345" },
  { key: "proposal.title", label: "Título da proposta", category: "Proposta", example: "Câmara fria 50m³" },
  { key: "proposal.revision", label: "Revisão", category: "Proposta", example: "Rev. 2" },
  { key: "proposal.date", label: "Data de emissão", category: "Proposta", example: "01/05/2026" },
  { key: "proposal.validity", label: "Validade", category: "Proposta", example: "30/05/2026" },
  { key: "proposal.delivery", label: "Prazo de entrega", category: "Proposta", example: "45 dias" },
  { key: "proposal.status", label: "Status", category: "Proposta", example: "Em elaboração" },

  // ─── Comercial ────────────────────────────────────────────────────────
  { key: "seller.name", label: "Vendedor", category: "Comercial", example: "Carlos Mendes" },
  { key: "seller.representative", label: "Representante", category: "Comercial", example: "Norte Refrigeração" },

  // ─── Financeiro ───────────────────────────────────────────────────────
  { key: "totals.products", label: "Total de produtos", category: "Financeiro", example: "R$ 120.000,00" },
  { key: "totals.sold", label: "Total vendido", category: "Financeiro", example: "R$ 110.000,00" },
  { key: "totals.discount", label: "Desconto líquido", category: "Financeiro", example: "R$ 10.000,00" },
  { key: "totals.net", label: "Valor líquido", category: "Financeiro", example: "R$ 100.000,00" },
  { key: "totals.gross_profit", label: "Lucro bruto", category: "Financeiro", example: "R$ 30.000,00" },
  { key: "totals.net_profit", label: "Lucro líquido", category: "Financeiro", example: "R$ 22.000,00" },
  { key: "totals.gross_margin_pct", label: "Margem bruta (%)", category: "Financeiro", example: "27,3%" },
  { key: "tax.ipi", label: "IPI", category: "Financeiro", example: "5%" },
  { key: "tax.icms", label: "ICMS", category: "Financeiro", example: "18%" },
  { key: "tax.pis", label: "PIS", category: "Financeiro", example: "0,65%" },
  { key: "tax.cofins", label: "COFINS", category: "Financeiro", example: "3%" },

  // ─── Pagamento ────────────────────────────────────────────────────────
  { key: "payment.terms", label: "Condições (texto)", category: "Pagamento", example: "30/60/90 dias" },
  { key: "payment.condition", label: "Condição (preset)", category: "Pagamento", example: "Parcelado 3x" },
  { key: "payment.installments_count", label: "Qtd. parcelas", category: "Pagamento", example: "3" },
  { key: "finance.rate", label: "Taxa financeira mensal", category: "Pagamento", example: "1,5%" },
  { key: "finance.cost", label: "Custo financeiro", category: "Pagamento", example: "R$ 1.200,00" },

  // ─── Técnico ──────────────────────────────────────────────────────────
  { key: "coldpro.project_name", label: "Projeto ColdPro", category: "Técnico", example: "Câmara Resfriados 1" },
  { key: "coldpro.application", label: "Aplicação", category: "Técnico", example: "Resfriado" },
  { key: "coldpro.total_kw", label: "Carga total (kW)", category: "Técnico", example: "12,4 kW" },
  { key: "coldpro.total_tr", label: "Carga total (TR)", category: "Técnico", example: "3,5 TR" },
  { key: "coldpro.total_kcal", label: "Carga total (kcal/h)", category: "Técnico", example: "10.660 kcal/h" },
  { key: "coldpro.environments_count", label: "Qtd. ambientes", category: "Técnico", example: "3" },

  // ─── Empresa ──────────────────────────────────────────────────────────
  { key: "company.name", label: "Empresa — nome", category: "Empresa", example: "CN Cold" },
  { key: "company.phone", label: "Empresa — telefone", category: "Empresa", example: "(48) 3333-0000" },
  { key: "company.email", label: "Empresa — e-mail", category: "Empresa", example: "contato@cncold.com.br" },
  { key: "company.site", label: "Empresa — site", category: "Empresa", example: "cncold.com.br" },
  { key: "company.city", label: "Empresa — cidade", category: "Empresa", example: "Itajaí · SC" },
];

export const VARIABLES_BY_CATEGORY: Record<VariableCategory, VariableDefinition[]> = (() => {
  const out = {} as Record<VariableCategory, VariableDefinition[]>;
  for (const v of VARIABLES) {
    (out[v.category] ??= []).push(v);
  }
  return out;
})();

export const VARIABLE_KEYS = new Set(VARIABLES.map((v) => v.key));

const BRL = (n: number | null | undefined) =>
  n == null
    ? null
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const PCT = (n: number | null | undefined, digits = 1) =>
  n == null ? null : `${n.toFixed(digits).replace(".", ",")}%`;

const DATE = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

/**
 * Lê o valor cru de uma variável a partir do contexto. Retorna `null` quando
 * não houver valor (será exibido como aviso visual no editor).
 */
export function getVariableValue(
  key: string,
  ctx: ProposalDocumentContext | null | undefined,
): string | null {
  if (!ctx) return null;
  switch (key) {
    // Cliente
    case "client.name": return ctx.cliente.fantasia ?? ctx.cliente.nome;
    case "client.fantasia": return ctx.cliente.fantasia;
    case "client.document": return ctx.cliente.documento;
    case "client.address": {
      const parts = [ctx.cliente.endereco, ctx.cliente.bairro, ctx.cliente.cidade, ctx.cliente.uf]
        .filter(Boolean);
      return parts.length ? parts.join(" · ") : null;
    }
    case "client.city": return ctx.cliente.cidade;
    case "client.uf": return ctx.cliente.uf;
    case "client.email": return ctx.cliente.email;
    case "client.phone": return ctx.cliente.telefone;
    case "client.segment": return ctx.cliente.segmento;
    case "contact.name": return ctx.contato?.nome ?? null;
    case "contact.role": return ctx.contato?.cargo ?? null;
    case "contact.email": return ctx.contato?.email ?? null;
    case "contact.phone": return ctx.contato?.telefone ?? null;

    // Proposta
    case "proposal.number": return ctx.proposal.numero;
    case "proposal.title": return ctx.proposal.titulo;
    case "proposal.revision": return `Rev. ${ctx.proposal.revisao ?? 0}`;
    case "proposal.date": return DATE(ctx.proposal.data_emissao);
    case "proposal.validity": return DATE(ctx.proposal.validade);
    case "proposal.delivery": return ctx.proposal.prazo_entrega;
    case "proposal.status": return ctx.proposal.status;

    // Comercial
    case "seller.name": return ctx.vendedor.nome;
    case "seller.representative": return ctx.vendedor.representante;

    // Financeiro
    case "totals.products": return BRL(ctx.totais.valor_produtos);
    case "totals.sold": return BRL(ctx.totais.valor_total_vendido);
    case "totals.discount": return BRL(ctx.totais.valor_descontos);
    case "totals.net": return BRL(ctx.totais.valor_liquido);
    case "totals.gross_profit": return BRL(ctx.totais.lucro_bruto);
    case "totals.net_profit": return BRL(ctx.totais.lucro_liquido);
    case "totals.gross_margin_pct": return PCT(ctx.totais.margem_bruta_pct);
    case "tax.ipi": return ctx.impostos.ipi || null;
    case "tax.icms": return ctx.impostos.icms || null;
    case "tax.pis": return ctx.impostos.pis || null;
    case "tax.cofins": return ctx.impostos.cofins || null;

    // Pagamento
    case "payment.terms": return ctx.proposal.payment_terms;
    case "payment.condition": return ctx.pagamento.condicao_nome;
    case "payment.installments_count": {
      const n = ctx.pagamento.parcelas?.length ?? 0;
      return n > 0 ? String(n) : null;
    }
    case "finance.rate": return PCT(ctx.taxa_financeira.monthly_rate_pct, 2);
    case "finance.cost": return BRL(ctx.taxa_financeira.additional_cost);

    // Técnico (ColdPro)
    case "coldpro.project_name": return ctx.coldpro?.project_name ?? null;
    case "coldpro.application": return ctx.coldpro?.application_type ?? null;
    case "coldpro.total_kw":
      return ctx.coldpro?.total_load_kw != null
        ? `${ctx.coldpro.total_load_kw.toFixed(2).replace(".", ",")} kW`
        : null;
    case "coldpro.total_tr":
      return ctx.coldpro?.total_load_tr != null
        ? `${ctx.coldpro.total_load_tr.toFixed(2).replace(".", ",")} TR`
        : null;
    case "coldpro.total_kcal":
      return ctx.coldpro?.total_load_kcal_h != null
        ? `${new Intl.NumberFormat("pt-BR").format(Math.round(ctx.coldpro.total_load_kcal_h))} kcal/h`
        : null;
    case "coldpro.environments_count":
      return ctx.coldpro?.environments?.length
        ? String(ctx.coldpro.environments.length)
        : null;

    // Empresa
    case "company.name": return ctx.empresa.nome;
    case "company.phone": return ctx.empresa.telefone;
    case "company.email": return ctx.empresa.email;
    case "company.site": return ctx.empresa.site;
    case "company.city": return ctx.empresa.cidade;

    default:
      return null;
  }
}
