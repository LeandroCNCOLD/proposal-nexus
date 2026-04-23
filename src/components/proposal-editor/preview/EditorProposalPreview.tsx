import * as React from "react";
import { EditorA4Page } from "./EditorA4Page";
import { EditorPageHeader, EditorPageFooter } from "./EditorPageChrome";
import { buildEditorPreviewPalette } from "./editor-preview.theme";
import { getTablesForPage } from "@/features/proposal-editor/proposal-tables.selectors";
import type { ProposalTable } from "@/features/proposal-editor/proposal-tables.types";
import { EditorCharacteristicsPreview } from "./page-renderers/EditorCharacteristicsPreview";
import { EditorInvestmentPreview } from "./page-renderers/EditorInvestmentPreview";
import { EditorTaxesPreview } from "./page-renderers/EditorTaxesPreview";
import { EditorPaymentPreview } from "./page-renderers/EditorPaymentPreview";
import { EditorBackCoverPreview } from "./page-renderers/EditorBackCoverPreview";
import { EditorAttachedPdfPreview } from "./page-renderers/EditorAttachedPdfPreview";
import { resolveDeep, type PlaceholderContext } from "@/features/proposal-editor/placeholders";

type Props = {
  proposal: any;
  document: any;
  template: any;
  tables: ProposalTable[];
  selectedPageId?: string | null;
  placeholderContext?: PlaceholderContext;
};

function renderPageContent(params: {
  page: any;
  document: any;
  palette: any;
  tables: ProposalTable[];
}) {
  const { page, document, palette, tables } = params;
  const pageTables = getTablesForPage(tables, page.id, page.type);

  switch (page.type) {
    case "caracteristicas":
      return (
        <EditorCharacteristicsPreview
          title={page.title}
          tables={pageTables}
          palette={palette}
        />
      );

    case "equipamento":
    case "equipamentos":
    case "investimento":
      return (
        <EditorInvestmentPreview
          title={page.title}
          tables={pageTables}
          palette={palette}
        />
      );

    case "impostos":
      return (
        <EditorTaxesPreview
          title={page.title}
          tables={pageTables}
          palette={palette}
          note={document?.custom_blocks?.impostos_nota ?? null}
        />
      );

    case "pagamento":
      return (
        <EditorPaymentPreview
          title={page.title}
          tables={pageTables}
          palette={palette}
        />
      );

    case "contracapa":
    case "back-cover":
      return (
        <EditorBackCoverPreview
          title={page.title}
          palette={palette}
          deliveryText={document?.custom_blocks?.prazo_entrega_texto ?? null}
          warrantyText={
            typeof document?.warranty_text === "string"
              ? document.warranty_text
              : (document?.warranty_text?.texto ?? null)
          }
          noteText={document?.custom_blocks?.nota_final_texto ?? null}
        />
      );

    case "attached-pdf":
      return (
        <EditorAttachedPdfPreview
          title={page.title}
          pdfPaths={document?.attached_pdf_paths ?? []}
          palette={palette}
        />
      );

    default:
      return (
        <div className="space-y-2">
          <h2
            className="text-2xl font-bold"
            style={{ color: palette.primary }}
          >
            {page.title || "Página"}
          </h2>
          <p className="text-sm" style={{ color: palette.muted }}>
            Preview específico ainda não implementado para este tipo de página.
          </p>
        </div>
      );
  }
}

export function EditorProposalPreview({
  proposal,
  document,
  template,
  tables,
  selectedPageId,
  placeholderContext,
}: Props) {
  const palette = buildEditorPreviewPalette(template);

  // Resolve placeholders dinamicamente em todo o documento + tabelas (preview ao vivo)
  const resolvedDocument = React.useMemo(
    () => (placeholderContext ? resolveDeep(document, placeholderContext) : document),
    [document, placeholderContext],
  );
  const resolvedTables = React.useMemo(
    () => (placeholderContext ? resolveDeep(tables, placeholderContext) : tables),
    [tables, placeholderContext],
  );

  const pages = (resolvedDocument?.pages ?? [])
    .filter((page: any) => page.visible !== false)
    .filter((page: any) => !selectedPageId || page.id === selectedPageId);

  return (
    <div className="space-y-6">
      {pages.map((page: any, index: number) => (
        <EditorA4Page
          key={page.id}
          header={
            <EditorPageHeader
              primaryColor={palette.primary}
              secondaryColor={palette.accent}
              companyName={template?.empresa_nome}
              proposalNumber={proposal?.proposal_number ?? proposal?.numero ?? null}
            />
          }
          footer={
            <EditorPageFooter
              primaryColor={palette.primary}
              pageNumber={index + 1}
            />
          }
        >
          {renderPageContent({ page, document, palette, tables })}
        </EditorA4Page>
      ))}
    </div>
  );
}
