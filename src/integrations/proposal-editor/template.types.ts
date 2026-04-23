// Tipos do template de proposta (lados client + server compartilháveis)

export interface TemplatePageConfig {
  id: string;
  type: string;
  order: number;
  title: string;
  visible: boolean;
}

export interface TemplateCaseItem {
  titulo: string;
  cliente?: string;
  descricao?: string;
  imagem_path?: string;
}

export interface TemplateGarantiaItem {
  titulo: string;
  descricao?: string;
}

export interface TemplateBancario {
  banco: string;
  agencia?: string;
  conta?: string;
  pix?: string;
  titular?: string;
}

export interface TemplateDiferencial {
  titulo: string;
  descricao?: string;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;

  primary_color: string;
  accent_color: string;
  accent_color_2: string;

  empresa_nome: string;
  empresa_cidade: string;
  empresa_telefone: string;
  empresa_email: string;
  empresa_site: string;

  capa_titulo: string | null;
  capa_subtitulo: string | null;
  capa_tagline: string | null;

  sobre_titulo: string | null;
  sobre_paragrafos: string[];
  sobre_diferenciais: TemplateDiferencial[];

  cases_titulo: string | null;
  cases_subtitulo: string | null;
  cases_itens: TemplateCaseItem[];

  clientes_titulo: string | null;
  clientes_lista: string[];

  escopo_apresentacao_itens: string[];

  garantia_texto: string | null;
  garantia_itens: TemplateGarantiaItem[];

  dados_bancarios: TemplateBancario[];

  prazo_entrega_padrao: string | null;
  validade_padrao_dias: number | null;

  pages_config: TemplatePageConfig[];
}

export interface TemplateAsset {
  id: string;
  template_id: string;
  asset_kind: string;
  label: string | null;
  storage_path: string;
  position: number | null;
  url: string;
}

export interface TemplateBundle {
  template: ProposalTemplate;
  assets: TemplateAsset[];
}
