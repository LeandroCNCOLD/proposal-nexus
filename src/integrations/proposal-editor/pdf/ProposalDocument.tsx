import { Document } from "@react-pdf/renderer";
import type { CoverData, ContextData, DocumentPage, ScopeItem, SolutionData } from "../types";
import type { ProposalTemplate, TemplateAsset } from "../template.types";
import { CoverPage } from "./CoverPage";
import { AboutPage, CasesPage, ContextPage, CustomRichPage, ScopePage, SolutionPage, WarrantyPage } from "./ContentPages";
import { makePalette } from "./styles";

export interface ProposalDocumentProps {
  pages: DocumentPage[];
  cover: CoverData;
  solution: SolutionData;
  context: ContextData;
  scope: ScopeItem[];
  warranty: { html?: string; text?: string };
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
}

export function ProposalDocumentPdf(props: ProposalDocumentProps) {
  const visible = props.pages.filter((p) => p.visible).sort((a, b) => a.order - b.order);
  const palette = makePalette({
    primary: props.template?.primary_color,
    accent: props.template?.accent_color,
    accent2: props.template?.accent_color_2,
  });
  const logoUrl = props.assets.find((a) => a.asset_kind === "logo")?.url;
  const ctxBase = { palette, template: props.template, assets: props.assets, logoUrl };

  return (
    <Document
      title={props.cover.projeto || "Proposta CN Cold"}
      author={props.template?.empresa_nome || "CN Cold"}
      subject={props.cover.cliente || ""}
    >
      {visible.map((p) => {
        switch (p.type) {
          case "cover":
            return <CoverPage key={p.id} palette={palette} template={props.template} assets={props.assets} cover={props.cover} />;
          case "about":
            return <AboutPage key={p.id} {...ctxBase} />;
          case "cases":
            return <CasesPage key={p.id} {...ctxBase} />;
          case "solution":
            return <SolutionPage key={p.id} {...ctxBase} solution={props.solution} />;
          case "context":
            return <ContextPage key={p.id} {...ctxBase} ctx={props.context} />;
          case "scope":
          case "investimento":
            return <ScopePage key={p.id} {...ctxBase} items={props.scope} />;
          case "warranty":
          case "prazo-garantia":
            return <WarrantyPage key={p.id} {...ctxBase} text={props.warranty} />;
          case "custom-rich":
            return <CustomRichPage key={p.id} {...ctxBase} title={p.title} html={(p.content?.html as string) ?? ""} />;
          default:
            // tipos novos do template (scope-apresentacao, caracteristicas, equipamento, etc.)
            // renderizam como página padrão com título, até implementação dedicada
            return <CustomRichPage key={p.id} {...ctxBase} title={p.title} html="" />;
        }
      })}
    </Document>
  );
}
