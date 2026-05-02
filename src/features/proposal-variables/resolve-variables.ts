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

/**
 * Variante "omit-empty": remove parágrafos/linhas inteiras quando TODAS as
 * variáveis dentro deles resolvem para vazio. Usado para boxes pré-prontos
 * onde uma linha sem dado não deve aparecer (ex.: "Validade: {{...}}").
 *
 * Regras:
 *   - Trabalha por blocos delimitados por <p>...</p>, <li>...</li> ou <br/>.
 *   - Um bloco é descartado se contém ≥1 variável e TODAS resolvem para vazio
 *     E o restante do texto (fora as variáveis) é apenas separadores/labels
 *     curtos sem conteúdo informativo significativo (heurística: vira vazio
 *     ao remover variáveis e pontuação).
 *   - Blocos sem variáveis são preservados.
 *   - Variáveis parcialmente preenchidas → bloco mantido, vazias viram "".
 */
export function resolveVariablesHtmlOmitEmpty(
  html: string | null | undefined,
  ctx: ProposalDocumentContext | null | undefined,
): string {
  if (!html) return "";
  // Quebra em blocos preservando os delimitadores
  const blockRe = /(<p[^>]*>[\s\S]*?<\/p>|<li[^>]*>[\s\S]*?<\/li>|<br\s*\/?>)/gi;
  const parts = html.split(blockRe).filter((p) => p !== "");
  return parts
    .map((part) => {
      const isBlock = /^<(p|li|br)/i.test(part);
      if (!isBlock) return resolveBlockOrDrop(part, ctx, false);
      return resolveBlockOrDrop(part, ctx, true);
    })
    .filter((s) => s !== null)
    .join("");
}

/** Versão texto-puro (sem HTML) que descarta linhas com variáveis vazias. */
export function resolveVariablesOmitEmpty(
  text: string | null | undefined,
  ctx: ProposalDocumentContext | null | undefined,
): string {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .map((line) => resolveBlockOrDrop(line, ctx, true))
    .filter((s) => s !== null)
    .join("\n");
}

function resolveBlockOrDrop(
  block: string,
  ctx: ProposalDocumentContext | null | undefined,
  canDrop: boolean,
): string | null {
  let varCount = 0;
  let emptyCount = 0;
  const replaced = block.replace(VAR_RE, (raw, key: string) => {
    varCount++;
    const known = VARIABLE_KEYS.has(key);
    if (!known) {
      emptyCount++;
      return "";
    }
    const v = getVariableValue(key, ctx);
    if (v == null || v === "") {
      emptyCount++;
      return "";
    }
    return v;
  });
  if (canDrop && varCount > 0 && emptyCount === varCount) {
    // Descarta o bloco se sobrou apenas estrutura/separadores sem texto útil.
    const stripped = replaced
      .replace(/<[^>]+>/g, "")
      .replace(/[\s:·\-—|,.;]+/g, "")
      .trim();
    if (stripped === "") return null;
  }
  return replaced;
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
