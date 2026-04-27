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
  | "custom-bg"
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
  | "responsible_info"
  | "client_info_box"
  | "project_info_box"
  | "responsible_info_box"
  | "proposal_number_box"
  | "proposal_summary_box"
  | "dynamic_field"
  | "differentials_list"
  | "cases_list"
  | "container";

export type BlockSource = "manual" | "nomus" | "template";

/** Posicionamento absoluto no papel A4 (816 x 1056 px). */
export interface BlockLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  fontScale?: number;
  align?: "left" | "center" | "right";
  /** Estilo legado do "card" do bloco. Usado como fallback quando bgMode não está definido. */
  background?: "white" | "transparent" | "primary" | "muted";
  /** Cor explícita do texto. */
  color?: string;
  // ===== Editor de caixa avançado (refletido no editor e no PDF) =====
  /** Tipo de fundo: nenhum (transparente), cor sólida ou gradiente linear. */
  bgMode?: "none" | "solid" | "gradient";
  /** Cor de fundo sólida (hex). */
  bgColor?: string;
  /** Cor inicial do gradiente. */
  bgGradientFrom?: string;
  /** Cor final do gradiente. */
  bgGradientTo?: string;
  /** Ângulo do gradiente (graus). */
  bgGradientAngle?: number;
  /** Opacidade do fundo (0-100). */
  bgOpacity?: number;
  /** Raio das bordas em px. */
  borderRadius?: number;
  /** Espessura da borda em px (0 = sem borda). */
  borderWidth?: number;
  /** Cor da borda. */
  borderColor?: string;
  /** Estilo da borda. */
  borderStyle?: "solid" | "dashed" | "dotted";
}

export interface DocumentBlock {
  id: string;
  type: BlockType;
  title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> & { layout?: BlockLayout };
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
  /** Caminho no Storage (proposal-files) da imagem de fundo da página. */
  backgroundImagePath?: string;
  /** URL assinada/pública para renderizar a imagem de fundo no canvas. */
  backgroundImageUrl?: string;
  /** Como a imagem de fundo deve preencher o A4. Default: "cover". */
  backgroundImageFit?: "cover" | "contain";
  /** Oculta o cabeçalho padrão (logo + curva) na renderização. */
  hideHeader?: boolean;
  /** Oculta o rodapé padrão (faixa azul com site + paginação). */
  hideFooter?: boolean;
  /** Texto customizado para o rodapé (sobrescreve site/email do template). */
  footerText?: string;
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

/** Dimensões do papel A4 no canvas (96dpi). */
export const A4_W = 816;
export const A4_H = 1056;

let _uid = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(_uid++).toString(36)}`;

export function makeBlock(
  type: BlockType,
  data: Record<string, unknown> = {},
  opts: { title?: string; source?: BlockSource; locked?: boolean; order?: number; layout?: BlockLayout } = {},
): DocumentBlock {
  const dataWithLayout = opts.layout ? { ...data, layout: opts.layout } : data;
  return {
    id: uid("blk"),
    type,
    title: opts.title,
    data: dataWithLayout,
    source: opts.source ?? "manual",
    locked: opts.locked ?? false,
    order: opts.order ?? 0,
  };
}

/** Layout default centralizado para blocos novos adicionados à mão. */
export function defaultLayoutFor(type: BlockType, index = 0): BlockLayout {
  const baseY = 120 + index * 80;
  switch (type) {
    case "heading":
      return { x: 60, y: baseY, w: 696, h: 60 };
    case "rich_text":
      return { x: 60, y: baseY, w: 696, h: 180 };
    case "image":
      return { x: 60, y: baseY, w: 400, h: 260 };
    case "client_info_box":
    case "project_info_box":
    case "responsible_info_box":
      return { x: 60, y: baseY, w: 696, h: 160, background: "white" };
    case "proposal_number_box":
      return { x: 540, y: 960, w: 220, h: 56, background: "white", align: "right" };
    case "proposal_summary_box":
      return { x: 60, y: baseY, w: 696, h: 220, background: "white" };
    case "dynamic_field":
      return { x: 60, y: baseY, w: 320, h: 40, background: "transparent" };
    case "bank_data":
      return { x: 60, y: baseY, w: 696, h: 220, background: "white" };
    case "signature":
      return { x: 60, y: baseY, w: 360, h: 100 };
    case "attached_pdf":
      return { x: 60, y: baseY, w: 696, h: 80, background: "muted" };
    case "investment_table":
    case "tax_table":
    case "payment_table":
    case "characteristics_table":
    case "equipments_table":
    case "technical_table":
      return { x: 60, y: baseY, w: 696, h: 280 };
    case "differentials_list":
    case "cases_list":
      return { x: 60, y: baseY, w: 696, h: 320 };
    case "included_items":
    case "excluded_items":
      return { x: 60, y: baseY, w: 696, h: 200 };
    case "key_value_list":
      return { x: 60, y: baseY, w: 696, h: 180 };
    case "cover_identity":
      return { x: 0, y: 0, w: A4_W, h: A4_H };
    case "container":
      return { x: 60, y: baseY, w: 696, h: 240, background: "white" };
    default:
      return { x: 60, y: baseY, w: 696, h: 160 };
  }
}

export function makeDefaultBlocksForPage(type: PageType): DocumentBlock[] {
  const orderedFromList = (list: DocumentBlock[]): DocumentBlock[] =>
    list.map((b, i) => ({ ...b, order: i }));

  switch (type) {
    case "cover":
      return orderedFromList([
        makeBlock(
          "cover_identity",
          {},
          { source: "template", locked: true, layout: { x: 0, y: 0, w: A4_W, h: A4_H } },
        ),
        makeBlock(
          "dynamic_field",
          { fieldKey: "client_name", label: "Cliente" },
          { source: "nomus", layout: { x: 60, y: 360, w: 696, h: 60, background: "transparent", color: "#ffffff", fontScale: 1.4, align: "left" } },
        ),
        makeBlock(
          "dynamic_field",
          { fieldKey: "proposal_title", label: "Projeto" },
          { source: "nomus", layout: { x: 60, y: 430, w: 696, h: 60, background: "transparent", color: "#ffffff", fontScale: 1.2, align: "left" } },
        ),
        makeBlock(
          "proposal_number_box",
          {},
          { source: "nomus", layout: { x: 540, y: 960, w: 220, h: 60, background: "white", align: "right" } },
        ),
      ]);

    case "about":
      return orderedFromList([
        makeBlock("heading", { text: "Sobre a CN Cold", level: 1 }, { source: "template", layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("rich_text", { html: "" }, { source: "template", layout: { x: 60, y: 200, w: 696, h: 360 } }),
        makeBlock("differentials_list", { items: [] }, { source: "template", layout: { x: 60, y: 580, w: 696, h: 360 } }),
      ]);

    case "cases":
      return orderedFromList([
        makeBlock("heading", { text: "Cases de sucesso", level: 1 }, { source: "template", layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("cases_list", { items: [] }, { source: "template", layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "clientes":
      return orderedFromList([
        makeBlock("heading", { text: "Nossos clientes", level: 1 }, { source: "template", layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("included_items", { items: [] }, { source: "template", layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "context":
      return orderedFromList([
        makeBlock("heading", { text: "Contextualização", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock(
          "client_info_box",
          { cliente: "", cnpj: "", endereco: "", contato: "" },
          { source: "nomus", layout: { x: 60, y: 200, w: 696, h: 200, background: "white" } },
        ),
        makeBlock(
          "project_info_box",
          { projeto: "", numero: "", data: "", revisao: "" },
          { source: "nomus", layout: { x: 60, y: 420, w: 696, h: 180, background: "white" } },
        ),
        makeBlock(
          "responsible_info_box",
          { responsavel: "", cargo: "", email: "", telefone: "" },
          { source: "nomus", layout: { x: 60, y: 620, w: 696, h: 180, background: "white" } },
        ),
      ]);

    case "solution":
      return orderedFromList([
        makeBlock("heading", { text: "Nossa solução", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("rich_text", { html: "" }, { title: "Introdução", layout: { x: 60, y: 200, w: 696, h: 220 } }),
        makeBlock("included_items", { items: [] }, { title: "O que está incluído", layout: { x: 60, y: 440, w: 340, h: 460 } }),
        makeBlock("excluded_items", { items: [] }, { title: "O que NÃO está incluído", layout: { x: 416, y: 440, w: 340, h: 460 } }),
      ]);

    case "scope":
      return orderedFromList([
        makeBlock("heading", { text: "Escopo de fornecimento", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("included_items", { items: [] }, { source: "nomus", title: "Itens", layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "caracteristicas":
      return orderedFromList([
        makeBlock("heading", { text: "Características técnicas", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("characteristics_table", { rows: [] }, { layout: { x: 60, y: 200, w: 696, h: 540 } }),
        makeBlock("rich_text", { html: "" }, { title: "Observações", layout: { x: 60, y: 760, w: 696, h: 200 } }),
      ]);

    case "equipamento":
      return orderedFromList([
        makeBlock("heading", { text: "Equipamentos", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("equipments_table", { rows: [] }, { source: "nomus", layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "investimento":
      return orderedFromList([
        makeBlock("heading", { text: "Investimento", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("investment_table", { rows: [] }, { source: "nomus", layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "impostos":
      return orderedFromList([
        makeBlock("heading", { text: "Base de cálculo dos impostos", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("tax_table", { rows: [] }, { source: "nomus", layout: { x: 60, y: 200, w: 696, h: 220 } }),
        makeBlock("rich_text", { html: "" }, { title: "Observação fiscal", layout: { x: 60, y: 440, w: 696, h: 360 } }),
      ]);

    case "pagamento":
      return orderedFromList([
        makeBlock("heading", { text: "Condições de pagamento", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("payment_table", { rows: [] }, { source: "nomus", layout: { x: 60, y: 200, w: 696, h: 220 } }),
        makeBlock("bank_data", {}, { source: "template", title: "Dados bancários", layout: { x: 60, y: 440, w: 696, h: 280, background: "white" } }),
        makeBlock("rich_text", { html: "" }, { title: "Observação financeira", layout: { x: 60, y: 740, w: 696, h: 220 } }),
      ]);

    case "warranty":
    case "prazo-garantia":
      return orderedFromList([
        makeBlock("heading", { text: "Garantia", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("rich_text", { html: "" }, { source: "template", layout: { x: 60, y: 200, w: 696, h: 360 } }),
        makeBlock("key_value_list", { items: [] }, { source: "template", layout: { x: 60, y: 580, w: 696, h: 360 } }),
      ]);

    case "contracapa":
      return orderedFromList([
        makeBlock("heading", { text: "Obrigado!", level: 1 }, { source: "template", layout: { x: 60, y: 360, w: 696, h: 80, align: "center", color: "#ffffff" } }),
        makeBlock("dynamic_field", { fieldKey: "empresa_telefone", label: "Telefone" }, { source: "template", layout: { x: 60, y: 600, w: 696, h: 60, align: "center", color: "#ffffff" } }),
        makeBlock("dynamic_field", { fieldKey: "empresa_site", label: "Site" }, { source: "template", layout: { x: 60, y: 660, w: 696, h: 60, align: "center", color: "#ffffff" } }),
      ]);

    case "differentials":
      return orderedFromList([
        makeBlock("heading", { text: "Nossos diferenciais", level: 1 }, { source: "template", layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("differentials_list", { items: [] }, { source: "template", layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "impact":
      return orderedFromList([
        makeBlock("heading", { text: "Impacto esperado", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("rich_text", { html: "" }, { layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "nota":
      return orderedFromList([
        makeBlock("heading", { text: "Nota", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("rich_text", { html: "" }, { layout: { x: 60, y: 200, w: 696, h: 760 } }),
      ]);

    case "attached-pdf":
      return orderedFromList([
        makeBlock("heading", { text: "Anexos da proposta", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("attached_pdf", { paths: [] as string[] }, { layout: { x: 60, y: 200, w: 696, h: 220 } }),
      ]);

    case "custom-rich":
    case "custom-block":
    default:
      return orderedFromList([
        makeBlock("heading", { text: "Página livre", level: 1 }, { layout: { x: 60, y: 120, w: 696, h: 60 } }),
        makeBlock("rich_text", { html: "" }, { layout: { x: 60, y: 200, w: 696, h: 760 } }),
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
  "custom-bg": "Página com imagem de fundo",
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
  { type: "custom-bg", label: "Página com imagem de fundo" },
  { type: "attached-pdf", label: "PDF anexado" },
];
