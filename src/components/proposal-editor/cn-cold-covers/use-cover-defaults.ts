/**
 * Helpers para resolver valores de capa CN Cold a partir do
 * ProposalDocumentContext (modo híbrido: block.data sempre vence).
 */
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";

export interface CoverFooter {
  telefone: string | null;
  site: string | null;
  email: string | null;
  cidade: string | null;
}

const pick = (a: unknown, b: string | null | undefined): string | null => {
  const s = typeof a === "string" ? a.trim() : "";
  if (s) return s;
  const t = (b ?? "").trim();
  return t || null;
};

export function resolveCoverFooter(
  data: Record<string, unknown>,
  ctx: ProposalDocumentContext | null | undefined,
): CoverFooter {
  const f = (data.footer as Record<string, unknown> | undefined) ?? {};
  return {
    telefone: pick(f.telefone, ctx?.empresa.telefone ?? null),
    site: pick(f.site, ctx?.empresa.site ?? null),
    email: pick(f.email, ctx?.empresa.email ?? null),
    cidade: pick(f.cidade, ctx?.empresa.cidade ?? null),
  };
}

export interface CoverIdentity {
  client_name: string | null;
  proposal_title: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  vendedor: string | null;
}

const fmtDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

export function resolveCoverIdentity(
  data: Record<string, unknown>,
  ctx: ProposalDocumentContext | null | undefined,
): CoverIdentity {
  return {
    client_name: pick(
      data.client_name,
      ctx?.cliente.fantasia ?? ctx?.cliente.nome ?? null,
    ),
    proposal_title: pick(data.proposal_title, ctx?.proposal.titulo ?? null),
    proposal_number: pick(data.proposal_number, ctx?.proposal.numero ?? null),
    proposal_date: pick(data.proposal_date, fmtDate(ctx?.proposal.data_emissao ?? null)),
    vendedor: pick(data.vendedor, ctx?.vendedor.nome ?? null),
  };
}

export const CN_COLD_PRIMARY = "#0c2340";
export const CN_COLD_PRIMARY_DARK = "#081a30";
export const CN_COLD_ACCENT = "#1e90ff";
