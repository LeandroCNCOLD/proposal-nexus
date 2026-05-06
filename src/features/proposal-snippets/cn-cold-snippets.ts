/**
 * Boxes ("snippets") pré-montados para propostas CN Cold.
 * Cada snippet expande para 1+ blocos existentes (rich_text / bank_data /
 * signature) com `data.html` já preenchido com variáveis `{{...}}`.
 *
 * Regras de visibilidade:
 *   - Todos os textos são resolvidos via resolveProposalVariablesInText
 *     (omit-empty no PDF) — linhas com variáveis vazias são removidas.
 *   - Apenas variáveis confirmadas no catálogo central são usadas.
 *   - {{seller.name}} é o padrão para vendedor (não usar {{vendedor}}).
 */
import {
  makeBlock,
  defaultLayoutFor,
  type BlockLayout,
  type DocumentBlock,
} from "@/integrations/proposal-editor/types";
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";
import { resolveVariables } from "@/features/proposal-variables/resolve-variables";

export interface CnColdSnippet {
  /** Identificador estável usado no payload de drag. */
  id: string;
  /** Rótulo mostrado na paleta. */
  label: string;
  /** Descrição curta opcional. */
  description?: string;
  /**
   * Função que produz os blocos a inserir, dado um Y inicial e a largura
   * útil do papel. Cada snippet decide a altura de cada bloco.
   * Se `ctx` for fornecido, as variáveis `{{...}}` são pré-resolvidas
   * para os valores reais da proposta.
   */
  build: (
    startY: number,
    pageW: number,
    ctx?: ProposalDocumentContext | null,
  ) => DocumentBlock[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const BOX_PAD_X = 60;

/**
 * Estilos inline padrão dos boxes — garante aparência consistente entre
 * editor (TipTap) e PDF (parser HTML).
 */
const STYLE_TITLE = `font-size:16px;font-weight:700;margin:0 0 8px 0;color:#0f172a;`;
const STYLE_LABEL = `font-weight:600;color:#334155;`;
const STYLE_P = `margin:0 0 4px 0;font-size:12px;line-height:1.5;color:#0f172a;`;

const richBlock = (
  html: string,
  layout: BlockLayout,
  title?: string,
): DocumentBlock =>
  makeBlock(
    "rich_text",
    { html, omitEmpty: true },
    { source: "template", title, layout },
  );

const layoutFull = (y: number, h: number, pageW: number): BlockLayout => ({
  x: BOX_PAD_X,
  y,
  w: pageW - BOX_PAD_X * 2,
  h,
  // Padrão transparente — o usuário pode mudar pela toolbar "Caixa".
  background: "transparent",
  bgMode: "none",
});

/* ------------------------------------------------------------------ */
/* 1) Capa — Informações principais                                    */
/* ------------------------------------------------------------------ */

const cnCoverInfoBox: CnColdSnippet = {
  id: "cn_cover_info_box",
  label: "📇 Capa — Informações da proposta",
  description: "Cliente, número, data, validade e vendedor.",
  build: (y, pageW) => [
    richBlock(
      `<p style="${STYLE_TITLE}">Proposta Comercial</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Cliente:</span> {{client.name}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Nº:</span> {{proposal.number}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Projeto:</span> {{proposal.title}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Data:</span> {{proposal.date}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Validade:</span> {{proposal.validity}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Vendedor:</span> {{seller.name}}</p>`,
      layoutFull(y, 220, pageW),
      "Informações da proposta",
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* 2) Carta de apresentação                                            */
/* ------------------------------------------------------------------ */
//
// A frase com "{{proposal.title}}" fica em parágrafo isolado: se o título
// da proposta estiver vazio, o resolveVariablesHtmlOmitEmpty descarta a
// linha inteira automaticamente — mantendo a carta fluida.

const cnPresentationLetterBox: CnColdSnippet = {
  id: "cn_presentation_letter_box",
  label: "✉️ Carta de apresentação",
  description: "Texto base personalizado com cliente e vendedor.",
  build: (y, pageW) => [
    richBlock(
      `<p style="${STYLE_TITLE}">Carta de apresentação</p>` +
        `<p style="${STYLE_P}">Prezado(a) {{client.name}},</p>` +
        `<p style="${STYLE_P}">É com satisfação que apresentamos nossa proposta comercial, ` +
        `elaborada de forma personalizada para atender às necessidades da sua operação.</p>` +
        `<p style="${STYLE_P}">Esta proposta é referente ao projeto {{proposal.title}}.</p>` +
        `<p style="${STYLE_P}">Colocamo-nos à disposição para quaisquer esclarecimentos ` +
        `e esperamos contar com a sua confiança.</p>` +
        `<p style="${STYLE_P}">Atenciosamente,<br/>{{seller.name}}</p>`,
      layoutFull(y, 280, pageW),
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* 3) Solução proposta                                                 */
/* ------------------------------------------------------------------ */

const cnSolutionBox: CnColdSnippet = {
  id: "cn_solution_box",
  label: "🧊 Solução proposta",
  description: "Resumo da solução técnica com dados ColdPro.",
  build: (y, pageW) => [
    richBlock(
      `<p style="${STYLE_TITLE}">Solução proposta</p>` +
        `<p style="${STYLE_P}">Aplicação: {{coldpro.application}}</p>` +
        `<p style="${STYLE_P}">Carga térmica total: {{coldpro.total_kw}} ({{coldpro.total_kcal}})</p>` +
        `<p style="${STYLE_P}">Quantidade de ambientes: {{coldpro.environments_count}}</p>` +
        `<p style="${STYLE_P}">Projeto: {{coldpro.project_name}}</p>`,
      layoutFull(y, 200, pageW),
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* 4) Escopo / condições comerciais                                    */
/* ------------------------------------------------------------------ */

const cnScopeBox: CnColdSnippet = {
  id: "cn_scope_box",
  label: "📋 Condições comerciais",
  description: "Validade, prazo, pagamento e impostos.",
  build: (y, pageW) => [
    richBlock(
      `<p style="${STYLE_TITLE}">Condições comerciais</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Validade da proposta:</span> {{proposal.validity}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Prazo de entrega:</span> {{proposal.delivery}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Condições de pagamento:</span> {{payment.terms}}</p>` +
        `<p style="${STYLE_P}"><span style="${STYLE_LABEL}">Impostos:</span> IPI {{tax.ipi}} · ICMS {{tax.icms}}</p>`,
      layoutFull(y, 200, pageW),
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* 5) Dados bancários (usa bloco bank_data nativo)                     */
/* ------------------------------------------------------------------ */

const cnBankDataBox: CnColdSnippet = {
  id: "cn_bank_data_box",
  label: "🏦 Dados bancários",
  description: "Banco, agência, conta, PIX (linhas vazias ocultas).",
  build: (y, pageW) => [
    makeBlock(
      "bank_data",
      {},
      {
        source: "template",
        title: "Dados bancários",
        layout: layoutFull(y, 220, pageW),
      },
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* 6) Assinatura                                                       */
/* ------------------------------------------------------------------ */

const cnSignatureBox: CnColdSnippet = {
  id: "cn_signature_box",
  label: "✍️ Assinatura",
  description: "Local, data e nome do vendedor.",
  build: (y, pageW) => [
    richBlock(
      `<p style="${STYLE_P}text-align:center">{{company.city}}, {{proposal.date}}</p>` +
        `<p style="${STYLE_P}text-align:center;margin-top:32px">______________________________</p>` +
        `<p style="${STYLE_P}text-align:center;${STYLE_LABEL}">{{seller.name}}</p>` +
        `<p style="${STYLE_P}text-align:center;color:#64748b">{{company.name}}</p>`,
      { ...layoutFull(y, 180, pageW), align: "center" },
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* 7) Rodapé de contato                                                */
/* ------------------------------------------------------------------ */

const cnFooterBox: CnColdSnippet = {
  id: "cn_footer_box",
  label: "📞 Rodapé — contato",
  description: "Empresa, telefone, e-mail e site.",
  build: (y, pageW) => [
    richBlock(
      `<p style="${STYLE_P};text-align:center;color:#64748b;font-size:11px">` +
        `{{company.name}} · {{company.phone}} · {{company.email}} · {{company.site}}` +
        `</p>`,
      layoutFull(y, 60, pageW),
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

export const CN_COLD_SNIPPETS: CnColdSnippet[] = [
  cnCoverInfoBox,
  cnPresentationLetterBox,
  cnSolutionBox,
  cnScopeBox,
  cnBankDataBox,
  cnSignatureBox,
  cnFooterBox,
];

export const CN_COLD_SNIPPETS_BY_ID = new Map(
  CN_COLD_SNIPPETS.map((s) => [s.id, s] as const),
);

/** MIME usado para drops de snippets vindos da paleta. */
export const SNIPPET_DRAG_MIME = "application/x-proposal-snippet";

export interface SnippetDragPayload {
  snippetId: string;
}

export function serializeSnippet(id: string): string {
  return JSON.stringify({ snippetId: id } satisfies SnippetDragPayload);
}

export function parseSnippetPayload(raw: string): SnippetDragPayload | null {
  try {
    const v = JSON.parse(raw) as SnippetDragPayload;
    if (!v?.snippetId) return null;
    return v;
  } catch {
    return null;
  }
}

/** Suprime warning de import não usado em ambientes onde defaultLayoutFor não é referenciado. */
void defaultLayoutFor;
