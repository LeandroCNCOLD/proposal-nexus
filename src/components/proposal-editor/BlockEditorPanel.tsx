import type {
  CoverData,
  ContextData,
  SolutionData,
  ScopeItem,
  DocumentPage,
} from "@/integrations/proposal-editor/types";
import { CoverBlockEditor } from "./blocks/CoverBlockEditor";
import { ContextBlockEditor } from "./blocks/ContextBlockEditor";
import { SolutionBlockEditor } from "./blocks/SolutionBlockEditor";
import { ScopeBlockEditor } from "./blocks/ScopeBlockEditor";
import { WarrantyBlockEditor } from "./blocks/WarrantyBlockEditor";
import { CustomRichBlockEditor } from "./blocks/CustomRichBlockEditor";
import { StaticBlockNotice } from "./blocks/StaticBlockNotice";
import { TableBlockEditor } from "./blocks/TableBlockEditor";

export interface DocumentEditState {
  cover_data: CoverData;
  solution_data: SolutionData;
  context_data: ContextData;
  scope_items: ScopeItem[];
  warranty_text: { html?: string; text?: string };
  manually_edited_fields: string[];
}

interface Props {
  proposalId: string;
  page: DocumentPage;
  state: DocumentEditState;
  onChange: (patch: Partial<DocumentEditState>, editedKeys?: string[]) => void;
  onPageContentChange: (pageId: string, patch: Partial<DocumentPage>) => void;
}

export function BlockEditorPanel({ proposalId, page, state, onChange, onPageContentChange }: Props) {
  switch (page.type) {
    case "cover":
      return (
        <CoverBlockEditor
          value={state.cover_data}
          onChange={(next, key) =>
            onChange({ cover_data: next }, key ? [`cover_data.${String(key)}`] : undefined)
          }
        />
      );
    case "context":
      return (
        <ContextBlockEditor
          value={state.context_data}
          onChange={(next, key) =>
            onChange({ context_data: next }, key ? [`context_data.${String(key)}`] : undefined)
          }
        />
      );
    case "solution":
      return (
        <SolutionBlockEditor
          value={state.solution_data}
          onChange={(next, key) =>
            onChange({ solution_data: next }, key ? [`solution_data.${String(key)}`] : undefined)
          }
        />
      );
    case "scope":
      return (
        <ScopeBlockEditor
          value={state.scope_items}
          onChange={(next) => onChange({ scope_items: next }, ["scope_items"])}
        />
      );
    case "warranty":
    case "prazo-garantia":
      return (
        <WarrantyBlockEditor
          value={state.warranty_text}
          onChange={(next) => onChange({ warranty_text: next }, ["warranty_text"])}
        />
      );
    case "caracteristicas":
      return (
        <TableBlockEditor
          proposalId={proposalId}
          pageId={page.id}
          type="caracteristicas"
          defaultTitle={page.title || "Características técnicas"}
          helpText="Liste as características técnicas relevantes do equipamento ou solução."
        />
      );
    case "equipamento":
      return (
        <TableBlockEditor
          proposalId={proposalId}
          pageId={page.id}
          type="equipamentos"
          defaultTitle={page.title || "Equipamentos"}
          helpText="Modelos, descrição e quantidades. Cada linha corresponde a um equipamento."
        />
      );
    case "investimento":
      return (
        <TableBlockEditor
          proposalId={proposalId}
          pageId={page.id}
          type="investimento"
          defaultTitle={page.title || "Resumo de investimento"}
          showTotal
          helpText="Total = quantidade × valor unitário. O total geral é calculado automaticamente."
        />
      );
    case "impostos":
      return (
        <TableBlockEditor
          proposalId={proposalId}
          pageId={page.id}
          type="impostos"
          defaultTitle={page.title || "Tributação"}
          helpText="Tributos incidentes sobre a operação. Você pode importar do Nomus pelo botão Sincronizar."
        />
      );
    case "pagamento":
      return (
        <TableBlockEditor
          proposalId={proposalId}
          pageId={page.id}
          type="pagamento"
          defaultTitle={page.title || "Condições de pagamento"}
          helpText="Parcelas, vencimentos e percentuais."
        />
      );
    case "custom-rich":
    case "nota":
      return (
        <CustomRichBlockEditor
          title={page.title}
          content={(page.content ?? {}) as { html?: string }}
          onTitleChange={(t) => onPageContentChange(page.id, { title: t })}
          onContentChange={(c) => onPageContentChange(page.id, { content: c })}
        />
      );
    case "differentials":
      return (
        <StaticBlockNotice
          title="Diferenciais"
          description="Os diferenciais são definidos no template (aba Sobre). Edite o template para alterá-los."
        />
      );
    case "impact":
      return (
        <StaticBlockNotice
          title="Impacto esperado"
          description="Cards de KPI/valor/descrição. Editor dedicado virá na Fase 2 — por enquanto exibe placeholder."
        />
      );
    case "contracapa":
      return (
        <StaticBlockNotice
          title="Contracapa"
          description="Página de fechamento gerada automaticamente com dados do template e responsável da capa."
        />
      );
    case "about":
      return (
        <StaticBlockNotice
          title="Sobre a CN Cold"
          description="Conteúdo institucional do template. Edite no Template (aba Sobre) ou substitua por uma imagem A4 cheia."
        />
      );
    case "cases":
    case "clientes":
      return (
        <StaticBlockNotice
          title="Cases / Clientes"
          description="Galeria definida no template. Edite a lista no Template (aba Cases/Clientes)."
        />
      );
    case "custom-block":
      return (
        <StaticBlockNotice
          title={page.title}
          description="Bloco do catálogo. Os campos editáveis (datasheet, galeria, cronograma) virão na Fase 2."
        />
      );
    case "attached-pdf":
      return (
        <StaticBlockNotice
          title="PDF anexado"
          description="O upload e merge do PDF anexo serão disponibilizados na Fase 2."
        />
      );
    default:
      return null;
  }
}
