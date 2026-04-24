// Tipos do Page Builder com Blocos Inteligentes (CN Cold v2)
// Schema: ProposalDocument { pages: DocumentPage[] }, cada DocumentPage { blocks: DocumentBlock[] }

export type PageType =
  | "cover"
  | "about"
  | "cases"
  | "clientes"
  | "context"
  | "solution"
  | "scope"
  | "caracteristicas"
  | "equipamento"
  | "investimento"
  | "impostos"
  | "pagamento"
  | "warranty"
  | "prazo-garantia"
  | "contracapa"
  | "differentials"
  | "impact"
  | "nota"
  | "custom-rich"
  | "custom-block"
  | "attached-pdf";

export type BlockType =
  | "heading"
  | "rich_text"
  | "image"
  | "key_value_list"
  | "included_items"
  | "excluded_items"
  | "technical_table"
  | "investment_table"
  | "tax_table"
  | "payment_table"
  | "characteristics_table"
  | "equipments_table"
  | "bank_data"
  | "signature"
  | "attached_pdf"
  | "cover_identity"
  | "client_info"
  | "project_info"
  | "responsible_info";

export type BlockSource = "manual" | "nomus" | "template";

export interface DocumentBlock {
  id: string;
  type: BlockType;
  title?: string;
  data: Record<string, unknown>;
  source?: BlockSource;
  locked?: boolean;
  order: number;
}

export interface DocumentPage {
  id: string;
  type: PageType;
  title: string;
  visible: boolean;
  order: number;
  blocks: DocumentBlock[];
}

export interface ProposalDocument {
  id: string;
  proposal_id: string;
  template_id: string | null;
  template_version: string;
  pages: DocumentPage[];
  attached_pdf_paths: string[];
  auto_filled_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string;
  created_at: string;
  updated_at: string;
}

// ============= Tabelas estruturadas (mantidas para compat) =============

export type ProposalTableType =
  | "caracteristicas"
  | "equipamentos"
  | "investimento"
  | "impostos"
  | "pagamento"
  | "itens";

export interface TableColumn {
  key: string;
  label: string;
  type?: "text" | "number" | "currency" | "date";
  width?: number;
  align?: "left" | "right" | "center";
  computed?: boolean;
}

export interface ProposalTableRow {
  [key: string]: string | number | null | undefined;
}

export type ProposalTableSettingsValue =
  | string
  | number
  | boolean
  | null
  | TableColumn[]
  | string[]
  | undefined;

export interface ProposalTableSettings {
  columns?: TableColumn[];
  show_header?: boolean;
  repeat_header?: boolean;
  show_grand_total?: boolean;
  grand_total_label?: string;
  currency_columns?: string[];
  sum_columns?: string[];
  [key: string]: ProposalTableSettingsValue;
}

export interface ProposalTable {
  id: string;
  proposal_id: string;
  page_id: string | null;
  table_type: ProposalTableType | string;
  title: string | null;
  subtitle: string | null;
  rows: ProposalTableRow[];
  settings: ProposalTableSettings | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export const DEFAULT_TABLE_COLUMNS: Record<string, TableColumn[]> = {
  caracteristicas: [
    { key: "descricao", label: "Característica", type: "text", width: 3 },
    { key: "valor", label: "Valor", type: "text", width: 2 },
    { key: "unidade", label: "Unidade", type: "text", width: 1 },
  ],
  equipamentos: [
    { key: "modelo", label: "Modelo", type: "text", width: 2 },
    { key: "descricao", label: "Descrição", type: "text", width: 3 },
    { key: "quantidade", label: "Qtd", type: "number", width: 1, align: "right" },
    { key: "unidade", label: "Un", type: "text", width: 1 },
  ],
  investimento: [
    { key: "descricao", label: "Descrição", type: "text", width: 4 },
    { key: "quantidade", label: "Qtd", type: "number", width: 1, align: "right" },
    { key: "unidade", label: "Un", type: "text", width: 1 },
    { key: "valor_unitario", label: "Valor Unitário", type: "currency", width: 2, align: "right" },
    { key: "valor_total", label: "Total", type: "currency", width: 2, align: "right", computed: true },
  ],
  impostos: [
    { key: "tributo", label: "Tributo", type: "text", width: 2 },
    { key: "aliquota", label: "Alíquota (%)", type: "number", width: 1, align: "right" },
    { key: "base_calculo", label: "Base de cálculo", type: "currency", width: 2, align: "right" },
    { key: "valor", label: "Valor", type: "currency", width: 2, align: "right" },
  ],
  pagamento: [
    { key: "parcela", label: "Parcela", type: "text", width: 1 },
    { key: "vencimento", label: "Vencimento", type: "text", width: 2 },
    { key: "percentual", label: "%", type: "number", width: 1, align: "right" },
    { key: "valor", label: "Valor", type: "currency", width: 2, align: "right" },
    { key: "observacao", label: "Observação", type: "text", width: 3 },
  ],
  itens: [
    { key: "descricao", label: "Descrição", type: "text", width: 4 },
    { key: "quantidade", label: "Qtd", type: "number", width: 1, align: "right" },
    { key: "valor", label: "Valor", type: "currency", width: 2, align: "right" },
  ],
};

// ============= Defaults de páginas e blocos =============

let _uid = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(_uid++).toString(36)}`;

export function makeBlock(
  type: BlockType,
  data: Record<string, unknown> = {},
  opts: { title?: string; source?: BlockSource; locked?: boolean; order?: number } = {},
): DocumentBlock {
  return {
    id: uid("blk"),
    type,
    title: opts.title,
    data,
    source: opts.source ?? "manual",
    locked: opts.locked ?? false,
    order: opts.order ?? 0,
  };
}

export function makeDefaultBlocksForPage(type: PageType): DocumentBlock[] {
  const orderedFromList = (list: DocumentBlock[]): DocumentBlock[] =>
    list.map((b, i) => ({ ...b, order: i }));

  switch (type) {
    case "cover":
      return orderedFromList([
        makeBlock("cover_identity", {}, { source: "template", locked: true }),
        makeBlock("client_info", { cliente: "" }, { source: "nomus" }),
        makeBlock("project_info", { projeto: "", numero: "", data: "", revisao: "" }, { source: "nomus" }),
        makeBlock("responsible_info", { responsavel: "", cargo: "", email: "", telefone: "" }, { source: "nomus" }),
        makeBlock("image", { kind: "cover", url: null }, { title: "Imagem de capa" }),
      ]);

    case "about":
      return orderedFromList([
        makeBlock("heading", { text: "Sobre a CN Cold", level: 1 }, { source: "template" }),
        makeBlock("rich_text", { html: "" }, { source: "template" }),
      ]);

    case "cases":
    case "clientes":
      return orderedFromList([
        makeBlock("heading", { text: "Cases / Clientes", level: 1 }, { source: "template" }),
        makeBlock("rich_text", { html: "Conteúdo definido no template." }, { source: "template", locked: true }),
      ]);

    case "context":
      return orderedFromList([
        makeBlock("heading", { text: "Contextualização", level: 1 }),
        makeBlock("key_value_list", {
          items: [
            { label: "Cliente", value: "" },
            { label: "CNPJ", value: "" },
            { label: "Endereço", value: "" },
            { label: "Contato", value: "" },
          ],
        }, { source: "nomus" }),
        makeBlock("rich_text", { html: "" }, { title: "Texto de apresentação" }),
      ]);

    case "solution":
      return orderedFromList([
        makeBlock("heading", { text: "Nossa solução", level: 1 }),
        makeBlock("rich_text", { html: "" }, { title: "Introdução" }),
        makeBlock("included_items", { items: [] as string[] }, { title: "O que está incluído" }),
        makeBlock("excluded_items", { items: [] as string[] }, { title: "O que NÃO está incluído" }),
      ]);

    case "scope":
      return orderedFromList([
        makeBlock("heading", { text: "Escopo de fornecimento", level: 1 }),
        makeBlock("included_items", { items: [] as string[] }, { source: "nomus", title: "Itens" }),
      ]);

    case "caracteristicas":
      return orderedFromList([
        makeBlock("heading", { text: "Características técnicas", level: 1 }),
        makeBlock("characteristics_table", { rows: [] }),
        makeBlock("rich_text", { html: "" }, { title: "Observações" }),
      ]);

    case "equipamento":
      return orderedFromList([
        makeBlock("heading", { text: "Equipamentos", level: 1 }),
        makeBlock("equipments_table", { rows: [] }, { source: "nomus" }),
      ]);

    case "investimento":
      return orderedFromList([
        makeBlock("heading", { text: "Investimento", level: 1 }),
        makeBlock("investment_table", { rows: [] }, { source: "nomus" }),
      ]);

    case "impostos":
      return orderedFromList([
        makeBlock("heading", { text: "Base de cálculo dos impostos", level: 1 }),
        makeBlock("tax_table", { rows: [] }, { source: "nomus" }),
        makeBlock("rich_text", { html: "" }, { title: "Observação fiscal" }),
      ]);

    case "pagamento":
      return orderedFromList([
        makeBlock("heading", { text: "Condições de pagamento", level: 1 }),
        makeBlock("payment_table", { rows: [] }, { source: "nomus" }),
        makeBlock("bank_data", {}, { source: "template", title: "Dados bancários" }),
        makeBlock("rich_text", { html: "" }, { title: "Observação financeira" }),
      ]);

    case "warranty":
    case "prazo-garantia":
      return orderedFromList([
        makeBlock("heading", { text: "Garantia", level: 1 }),
        makeBlock("rich_text", { html: "" }, { source: "template" }),
      ]);

    case "contracapa":
      return orderedFromList([
        makeBlock("heading", { text: "Informações finais", level: 1 }, { source: "template" }),
        makeBlock("rich_text", { html: "" }, { title: "Prazo de entrega" }),
        makeBlock("rich_text", { html: "" }, { title: "Garantia" }),
        makeBlock("signature", {}, { source: "template" }),
      ]);

    case "differentials":
      return orderedFromList([
        makeBlock("heading", { text: "Nossos diferenciais", level: 1 }, { source: "template" }),
        makeBlock("rich_text", { html: "" }, { source: "template", locked: true }),
      ]);

    case "impact":
      return orderedFromList([
        makeBlock("heading", { text: "Impacto esperado", level: 1 }),
        makeBlock("rich_text", { html: "" }),
      ]);

    case "nota":
      return orderedFromList([
        makeBlock("heading", { text: "Nota", level: 1 }),
        makeBlock("rich_text", { html: "" }),
      ]);

    case "attached-pdf":
      return orderedFromList([
        makeBlock("heading", { text: "Anexos da proposta", level: 1 }),
        makeBlock("attached_pdf", { paths: [] as string[] }),
      ]);

    case "custom-rich":
    case "custom-block":
    default:
      return orderedFromList([
        makeBlock("heading", { text: "Página livre", level: 1 }),
        makeBlock("rich_text", { html: "" }),
      ]);
  }
}

export function makeDefaultPage(type: PageType, title: string, order: number): DocumentPage {
  return {
    id: uid("page"),
    type,
    title,
    visible: true,
    order,
    blocks: makeDefaultBlocksForPage(type),
  };
}

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  cover: "Capa",
  about: "Sobre",
  cases: "Cases de sucesso",
  clientes: "Clientes",
  context: "Contextualização",
  solution: "Nossa solução",
  scope: "Escopo de fornecimento",
  caracteristicas: "Características técnicas",
  equipamento: "Equipamentos",
  investimento: "Investimento",
  impostos: "Impostos",
  pagamento: "Pagamento",
  warranty: "Garantia",
  "prazo-garantia": "Prazo & garantia",
  contracapa: "Contracapa",
  differentials: "Diferenciais",
  impact: "Impacto esperado",
  nota: "Nota",
  "custom-rich": "Página livre",
  "custom-block": "Bloco do catálogo",
  "attached-pdf": "PDF anexado",
};

export const DEFAULT_PAGES: DocumentPage[] = [
  makeDefaultPage("cover", "Capa", 0),
  makeDefaultPage("about", "Sobre a CN Cold", 1),
  makeDefaultPage("context", "Contextualização", 2),
  makeDefaultPage("solution", "Nossa solução", 3),
  makeDefaultPage("scope", "Escopo de fornecimento", 4),
  makeDefaultPage("investimento", "Investimento", 5),
  makeDefaultPage("impostos", "Impostos", 6),
  makeDefaultPage("pagamento", "Condições de pagamento", 7),
  makeDefaultPage("warranty", "Garantia", 8),
  makeDefaultPage("contracapa", "Contracapa", 9),
];

export const ADDABLE_PAGE_TYPES: { type: PageType; label: string }[] = [
  { type: "cover", label: "Capa" },
  { type: "about", label: "Sobre a CN Cold" },
  { type: "context", label: "Contextualização" },
  { type: "solution", label: "Nossa solução" },
  { type: "scope", label: "Escopo de fornecimento" },
  { type: "caracteristicas", label: "Características técnicas" },
  { type: "equipamento", label: "Equipamentos" },
  { type: "investimento", label: "Investimento" },
  { type: "impostos", label: "Impostos" },
  { type: "pagamento", label: "Condições de pagamento" },
  { type: "warranty", label: "Garantia" },
  { type: "contracapa", label: "Contracapa" },
  { type: "differentials", label: "Diferenciais" },
  { type: "impact", label: "Impacto esperado" },
  { type: "nota", label: "Nota" },
  { type: "custom-rich", label: "Página livre" },
  { type: "attached-pdf", label: "PDF anexado" },
];
