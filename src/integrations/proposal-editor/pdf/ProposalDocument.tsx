import { Document } from "@react-pdf/renderer";
import type {
  CoverData,
  ContextData,
  DocumentPage,
  ScopeItem,
  SolutionData,
} from "../types";
import { CoverPage } from "./CoverPage";
import {
  AboutPage,
  CasesPage,
  ContextPage,
  CustomRichPage,
  ScopePage,
  SolutionPage,
  WarrantyPage,
} from "./ContentPages";

export interface ProposalDocumentProps {
  pages: DocumentPage[];
  cover: CoverData;
  solution: SolutionData;
  context: ContextData;
  scope: ScopeItem[];
  warranty: { html?: string; text?: string };
}

export function ProposalDocumentPdf(props: ProposalDocumentProps) {
  const visible = props.pages
    .filter((p) => p.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <Document
      title={props.cover.projeto || "Proposta CN Cold"}
      author="CN Cold"
      subject={props.cover.cliente || ""}
    >
      {visible.map((p) => {
        switch (p.type) {
          case "cover":
            return <CoverPage key={p.id} cover={props.cover} />;
          case "about":
            return <AboutPage key={p.id} />;
          case "cases":
            return <CasesPage key={p.id} />;
          case "solution":
            return <SolutionPage key={p.id} solution={props.solution} />;
          case "context":
            return <ContextPage key={p.id} ctx={props.context} />;
          case "scope":
            return <ScopePage key={p.id} items={props.scope} />;
          case "warranty":
            return <WarrantyPage key={p.id} text={props.warranty} />;
          case "custom-rich":
            return (
              <CustomRichPage
                key={p.id}
                title={p.title}
                html={(p.content?.html as string) ?? ""}
              />
            );
          case "custom-block":
          case "attached-pdf":
            // Etapa 5
            return null;
          default:
            return null;
        }
      })}
    </Document>
  );
}
