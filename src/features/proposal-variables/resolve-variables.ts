/**
 * Substitui ocorrências de `{{key}}` em um texto/HTML pelo valor resolvido
 * a partir do `ProposalDocumentContext`. Se a chave não existir no catálogo,
 * marca como variável inválida (PDF: literal; editor: span de aviso).
 */
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";
import { VARIABLE_KEYS, getVariableValue } from "./variables-catalog";

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export interface VariableMatch {
  key: string;
  raw: string; // ex: "{{client.name}}"
  start: number;
  end: number;
  known: boolean;
  value: string | null;
}

export function findVariables(text: string): VariableMatch[] {
  const out: VariableMatch[] = [];
  if (!text) return out;
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(text)) !== null) {
    out.push({
      key: m[1],
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      known: VARIABLE_KEYS.has(m[1]),
      value: null,
    });
  }
  return out;
}

/** Substituição final usada no PDF (sem marcação visual). */
export function resolveVariables(
  text: string | null | undefined,
  ctx: ProposalDocumentContext | null | undefined,
  options?: { fallback?: (key: string, known: boolean) => string },
): string {
  if (!text) return "";
  return text.replace(VAR_RE, (raw, key: string) => {
    const known = VARIABLE_KEYS.has(key);
    if (!known) {
      return options?.fallback?.(key, false) ?? raw;
    }
    const v = getVariableValue(key, ctx);
    if (v == null || v === "") {
      return options?.fallback?.(key, true) ?? "—";
    }
    return v;
  });
}

/** Substituição visual usada no editor: envolve em <span> para destacar. */
export function resolveVariablesHtml(
  html: string | null | undefined,
  ctx: ProposalDocumentContext | null | undefined,
): string {
  if (!html) return "";
  return html.replace(VAR_RE, (raw, key: string) => {
    const known = VARIABLE_KEYS.has(key);
    if (!known) {
      return `<span data-variable="${escapeAttr(key)}" data-variable-status="unknown" style="background:#fee2e2;color:#991b1b;border-radius:3px;padding:0 3px;font-weight:500;" title="Variável desconhecida: ${escapeAttr(key)}">${escapeHtml(raw)}</span>`;
    }
    const v = getVariableValue(key, ctx);
    if (v == null || v === "") {
      return `<span data-variable="${escapeAttr(key)}" data-variable-status="empty" style="background:#fef3c7;color:#92400e;border-radius:3px;padding:0 3px;font-weight:500;" title="Sem valor para ${escapeAttr(key)}">{{${escapeHtml(key)}}}</span>`;
    }
    return `<span data-variable="${escapeAttr(key)}" data-variable-status="ok" style="background:#dbeafe;color:#1e40af;border-radius:3px;padding:0 3px;" title="${escapeAttr(key)}">${escapeHtml(v)}</span>`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
