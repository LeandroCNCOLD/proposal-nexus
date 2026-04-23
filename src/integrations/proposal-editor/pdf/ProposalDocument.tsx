import { Document } from "@react-pdf/renderer";
import type { CoverData, ContextData, DocumentPage, ProposalTable, ScopeItem, SolutionData } from "../types";
import type { ProposalTemplate, TemplateAsset } from "../template.types";
import { CoverPage } from "./CoverPage";
import { AboutPage, CasesPage, ContextPage, CustomRichPage, ScopePage, SolutionPage, WarrantyPage } from "./ContentPages";
import {
  CaracteristicasPage,
  ContracapaPage,
  DifferentialsPage,
  EquipamentoPage,
  ImpactPage,
  ImpostosPage,
  InvestimentoPage,
  NotaPage,
  PagamentoPage,
} from "./TechnicalPages";
import { FullImagePage } from "./FullImagePage";
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
  tables?: ProposalTable[];
}

export function ProposalDocumentPdf(props: ProposalDocumentProps) {
  const visible = props.pages.filter((p) => p.visible).sort((a, b) => a.order - b.order);
  const palette = makePalette({
    primary: props.template?.primary_color,
    accent: props.template?.accent_color,
    accent2: props.template?.accent_color_2,
  });
  const logoUrl = props.assets.find((a) => a.asset_kind === "logo")?.url;
  const headerBannerUrl = props.assets.find((a) => a.asset_kind === "header_banner")?.url;
  const footerBannerUrl = props.assets.find((a) => a.asset_kind === "footer_banner")?.url;
  const ctxBase = { palette, template: props.template, assets: props.assets, logoUrl, headerBannerUrl, footerBannerUrl };
  const tables = props.tables ?? [];
  const tableFor = (pageId: string) => tables.find((t) => t.page_id === pageId) ?? null;

  // Imagens A4 completas (substituem o layout dinâmico quando presentes)
  const coverFull = props.assets.find((a) => a.asset_kind === "cover_full")?.url;
  const aboutFull = props.assets.find((a) => a.asset_kind === "about_full")?.url;
  const clientsFull = props.assets.find((a) => a.asset_kind === "clients_full")?.url;

  return (
    <Document
      title={props.cover.projeto || "Proposta CN Cold"}
      author={props.template?.empresa_nome || "CN Cold"}
      subject={props.cover.cliente || ""}
    >
      {visible.map((p) => {
        switch (p.type) {
          case "cover":
            return coverFull
              ? <FullImagePage key={p.id} src={coverFull} />
              : <CoverPage key={p.id} palette={palette} template={props.template} assets={props.assets} cover={props.cover} />;
          case "about":
            return aboutFull
              ? <FullImagePage key={p.id} src={aboutFull} />
              : <AboutPage key={p.id} {...ctxBase} />;
          case "cases":
          case "clientes":
            return clientsFull
              ? <FullImagePage key={p.id} src={clientsFull} />
              : <CasesPage key={p.id} {...ctxBase} />;
          case "solution":
            return <SolutionPage key={p.id} {...ctxBase} solution={props.solution} />;
          case "context":
            return <ContextPage key={p.id} {...ctxBase} ctx={props.context} />;
          case "scope":
            return <ScopePage key={p.id} {...ctxBase} items={props.scope} />;
          case "investimento":
            return <InvestimentoPage key={p.id} {...ctxBase} table={tableFor(p.id)} pageTitle={p.title} />;
          case "caracteristicas":
            return <CaracteristicasPage key={p.id} {...ctxBase} table={tableFor(p.id)} pageTitle={p.title} />;
          case "equipamento":
            return <EquipamentoPage key={p.id} {...ctxBase} table={tableFor(p.id)} pageTitle={p.title} />;
          case "impostos":
            return <ImpostosPage key={p.id} {...ctxBase} table={tableFor(p.id)} pageTitle={p.title} />;
          case "pagamento":
            return <PagamentoPage key={p.id} {...ctxBase} table={tableFor(p.id)} pageTitle={p.title} />;
          case "differentials":
            return <DifferentialsPage key={p.id} {...ctxBase} pageTitle={p.title} />;
          case "impact":
            return (
              <ImpactPage
                key={p.id}
                {...ctxBase}
                pageTitle={p.title}
                items={(p.content?.items as Array<{ kpi: string; valor: string; descricao?: string }> | undefined) ?? []}
              />
            );
          case "nota":
            return <NotaPage key={p.id} {...ctxBase} pageTitle={p.title} text={p.content?.text as string | undefined} />;
          case "contracapa":
            return <ContracapaPage key={p.id} {...ctxBase} responsavel={props.cover.responsavel} />;
          case "warranty":
          case "prazo-garantia":
            return <WarrantyPage key={p.id} {...ctxBase} text={props.warranty} />;
          case "custom-rich":
            return <CustomRichPage key={p.id} {...ctxBase} title={p.title} html={(p.content?.html as string) ?? ""} />;
          default:
            return <CustomRichPage key={p.id} {...ctxBase} title={p.title} html="" />;
        }
      })}
    </Document>
  );
}
