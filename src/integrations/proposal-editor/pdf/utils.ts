// Utilitários do renderer PDF: HTML → texto plano, formatadores.

const BR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtCurrency = (v: unknown): string => {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "R$ 0,00";
  return BR.format(n);
};

export const fmtNumber = (v: unknown, frac = 0): string => {
  const n = Number(v ?? 0);
  if (!isFinite(n)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(n);
};

export const fmtDateBR = (d: unknown): string => {
  if (!d) return "—";
  const date = typeof d === "string" || d instanceof Date ? new Date(d) : null;
  if (!date || isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
};

/** Converte HTML do editor (TipTap) em parágrafos de texto plano. */
export function htmlToPlainParagraphs(html: string | null | undefined): string[] {
  if (!html) return [];
  const cleaned = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*\/li\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return cleaned
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
