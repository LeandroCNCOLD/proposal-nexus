// Tipos compartilhados do editor de propostas (CN Cold)

export type PageType =
  | "cover"
  | "about"
  | "cases"
  | "solution"
  | "context"
  | "scope"
  | "warranty"
  | "custom-rich"
  | "custom-block"
  | "attached-pdf";

export interface DocumentPage {
  id: string;
  type: PageType;
  title: string;
  visible: boolean;
  order: number;
  // conteúdo específico do tipo (para custom-rich, custom-block, attached-pdf)
  content?: Record<string, unknown>;
}

export interface CoverData {
  cliente?: string;
  projeto?: string;
  numero?: string;
  data?: string;
  responsavel?: string;
  foto_capa_url?: string;
}

export interface SolutionData {
  intro?: string;
  contempla?: string[];
  diferenciais?: string[];
  impacto?: string[];
  conclusao?: string;
}

export interface ContextContact {
  nome?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
}

export interface ContextData {
  cliente_razao?: string;
  fantasia?: string;
  cnpj?: string;
  endereco?: string;
  caracteristicas?: string[];
  contatos?: ContextContact[];
  texto_apresentacao?: string;
  prazo_validade?: string;
}

export interface ScopeItem {
  id: string;
  titulo: string;
  descricao?: string;
  quantidade?: number;
  unidade?: string;
  valor_unitario?: number;
  valor_total?: number;
}

export interface CustomBlock {
  id: string;
  kind: "datasheet" | "gallery" | "schedule" | "tech-table" | "memorial" | "rich-text";
  title?: string;
  data: Record<string, unknown>;
}

export interface ProposalDocument {
  id: string;
  proposal_id: string;
  template_version: string;
  pages: DocumentPage[];
  cover_data: CoverData;
  solution_data: SolutionData;
  context_data: ContextData;
  scope_items: ScopeItem[];
  warranty_text: { html?: string; text?: string };
  custom_blocks: CustomBlock[];
  attached_pdf_paths: string[];
  manually_edited_fields: string[];
  auto_filled_at: string | null;
  last_edited_by: string | null;
  last_edited_at: string;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_PAGES: DocumentPage[] = [
  { id: "cover", type: "cover", title: "Capa", visible: true, order: 0 },
  { id: "about", type: "about", title: "Sobre a CN Cold", visible: true, order: 1 },
  { id: "cases", type: "cases", title: "Cases de sucesso", visible: true, order: 2 },
  { id: "solution", type: "solution", title: "Nossa solução", visible: true, order: 3 },
  { id: "context", type: "context", title: "Contextualização", visible: true, order: 4 },
  { id: "scope", type: "scope", title: "Escopo de fornecimento", visible: true, order: 5 },
  { id: "warranty", type: "warranty", title: "Garantia", visible: true, order: 6 },
];
