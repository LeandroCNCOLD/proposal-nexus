/**
 * Helpers híbridos para os blocos: cada bloco continua a ler de `block.data`
 * quando preenchido, e cai no contexto central como fallback inteligente.
 *
 * Decidido com o usuário: "Híbrido — bloco lê block.data se preenchido,
 * senão cai no contexto central".
 */
import type { ProposalDocumentContext } from "./document-context.types";

const empty = (v: unknown): boolean =>
  v == null || (typeof v === "string" && v.trim() === "");

/**
 * Resolve um valor: usa `manual` se preenchido; senão `fromContext`.
 * Útil para campos string em block.data.
 */
export function resolveField<T>(manual: T | null | undefined, fromContext: T | null | undefined): T | null {
  if (!empty(manual)) return manual as T;
  if (!empty(fromContext)) return fromContext as T;
  return null;
}

/**
 * Resolve "client_info_box" a partir do contexto.
 * Mantém valores manuais salvos no block.data quando existirem.
 */
export function resolveClientBox(
  blockData: Record<string, unknown>,
  ctx: ProposalDocumentContext | null | undefined,
) {
  const c = ctx?.cliente;
  return {
    cliente: resolveField(blockData.cliente as string, c?.fantasia ?? c?.nome ?? null),
    cnpj: resolveField(blockData.cnpj as string, c?.documento ?? null),
    endereco: resolveField(
      blockData.endereco as string,
      [c?.endereco, c?.bairro, c?.cidade, c?.uf].filter(Boolean).join(" · ") || null,
    ),
    contato: resolveField(blockData.contato as string, c?.email ?? c?.telefone ?? null),
  };
}

export function resolveProjectBox(
  blockData: Record<string, unknown>,
  ctx: ProposalDocumentContext | null | undefined,
) {
  const p = ctx?.proposal;
  return {
    projeto: resolveField(blockData.projeto as string, p?.titulo ?? null),
    numero: resolveField(blockData.numero as string, p?.numero ?? null),
    data: resolveField(blockData.data as string, p?.data_emissao ?? null),
    revisao: resolveField(
      blockData.revisao as string,
      p?.revisao != null ? `Rev. ${p.revisao}` : null,
    ),
  };
}

export function resolveResponsibleBox(
  blockData: Record<string, unknown>,
  ctx: ProposalDocumentContext | null | undefined,
) {
  const v = ctx?.vendedor;
  const cont = ctx?.contato;
  return {
    responsavel: resolveField(blockData.responsavel as string, v?.nome ?? null),
    cargo: resolveField(blockData.cargo as string, cont?.cargo ?? null),
    email: resolveField(blockData.email as string, cont?.email ?? null),
    telefone: resolveField(blockData.telefone as string, cont?.telefone ?? null),
  };
}

/** Resolve um campo dinâmico genérico (`dynamic_field` block). */
export function resolveDynamicField(
  fieldKey: string | undefined,
  ctx: ProposalDocumentContext | null | undefined,
): string | null {
  if (!fieldKey || !ctx) return null;
  switch (fieldKey) {
    case "client_name":
      return ctx.cliente.fantasia ?? ctx.cliente.nome;
    case "client_document":
      return ctx.cliente.documento;
    case "proposal_number":
      return ctx.proposal.numero;
    case "proposal_title":
      return ctx.proposal.titulo;
    case "proposal_date":
      return ctx.proposal.data_emissao;
    case "proposal_validity":
      return ctx.proposal.validade;
    case "vendedor":
      return ctx.vendedor.nome;
    case "empresa_telefone":
      return ctx.empresa.telefone;
    case "empresa_site":
      return ctx.empresa.site;
    case "empresa_email":
      return ctx.empresa.email;
    case "empresa_nome":
      return ctx.empresa.nome;
    case "total_value":
      return ctx.totais.valor_total_vendido != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
            ctx.totais.valor_total_vendido,
          )
        : null;
    default:
      return null;
  }
}
