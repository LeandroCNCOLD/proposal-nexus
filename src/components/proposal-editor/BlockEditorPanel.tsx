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

export interface DocumentEditState {
  cover_data: CoverData;
  solution_data: SolutionData;
  context_data: ContextData;
  scope_items: ScopeItem[];
  warranty_text: { html?: string; text?: string };
  manually_edited_fields: string[];
}

interface Props {
  page: DocumentPage;
  state: DocumentEditState;
  onChange: (patch: Partial<DocumentEditState>, editedKeys?: string[]) => void;
  onPageContentChange: (pageId: string, patch: Partial<DocumentPage>) => void;
}

export function BlockEditorPanel({ page, state, onChange, onPageContentChange }: Props) {
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
      return (
        <WarrantyBlockEditor
          value={state.warranty_text}
          onChange={(next) => onChange({ warranty_text: next }, ["warranty_text"])}
        />
      );
    case "custom-rich":
      return (
        <CustomRichBlockEditor
          title={page.title}
          content={(page.content ?? {}) as { html?: string }}
          onTitleChange={(t) => onPageContentChange(page.id, { title: t })}
          onContentChange={(c) => onPageContentChange(page.id, { content: c })}
        />
      );
    case "about":
      return (
        <StaticBlockNotice
          title="Sobre a CN Cold"
          description="Conteúdo institucional fixo do template. Edição de logotipo, fotos e texto será disponibilizada nas próximas etapas."
        />
      );
    case "cases":
      return (
        <StaticBlockNotice
          title="Cases de sucesso"
          description="Galeria fixa de cases. Edição da seleção de cases por proposta virá em uma etapa futura."
        />
      );
    case "custom-block":
      return (
        <StaticBlockNotice
          title={page.title}
          description="Bloco do catálogo. Os campos editáveis (datasheet, galeria, cronograma) serão habilitados na próxima etapa."
        />
      );
    case "attached-pdf":
      return (
        <StaticBlockNotice
          title="PDF anexado"
          description="O upload e merge do PDF anexo serão disponibilizados na Etapa 5 (geração do PDF final)."
        />
      );
    default:
      return null;
  }
}
