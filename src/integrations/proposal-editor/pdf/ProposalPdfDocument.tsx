// Documento PDF principal do Page Builder. Itera por DocumentPage[] e
// renderiza cada página com seus blocos.
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { DocumentPage } from "../types";
import type { ProposalTable } from "../types";
import type { ProposalTemplate } from "../template.types";
import { renderBlock } from "./BlockPdfRenderer";
import { buildStyles, defaultTheme, type PdfTheme } from "./styles";
import { fmtDateBR } from "./utils";

export interface ProposalPdfData {
  proposal: {
    id: string;
    number: string;
    title: string;
    valid_until: string | null;
    created_at: string;
    client_name?: string | null;
  };
  pages: DocumentPage[];
  tables: ProposalTable[];
  template: ProposalTemplate | null;
}

export function ProposalPdfDocument({ data }: { data: ProposalPdfData }) {
  const { proposal, pages, tables, template } = data;

  const theme: PdfTheme = {
    ...defaultTheme,
    primary: template?.primary_color || defaultTheme.primary,
    accent: template?.accent_color || defaultTheme.accent,
    accent2: template?.accent_color_2 || defaultTheme.accent2,
  };

  const styles = buildStyles(theme);

  // Indexa tabelas por page_id
  const tablesByPage = new Map<string, ProposalTable[]>();
  tables.forEach((t) => {
    if (!t.page_id) return;
    const arr = tablesByPage.get(t.page_id) ?? [];
    arr.push(t);
    tablesByPage.set(t.page_id, arr);
  });

  const visiblePages = pages
    .filter((p) => p.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <Document
      title={`Proposta ${proposal.number} — ${proposal.title}`}
      author={template?.empresa_nome ?? "CN Cold"}
    >
      {visiblePages.map((page, idx) =>
        page.type === "cover" ? (
          <CoverPdfPage
            key={page.id}
            page={page}
            proposal={proposal}
            template={template}
            theme={theme}
            styles={styles}
          />
        ) : (
          <StandardPdfPage
            key={page.id}
            page={page}
            pageNumber={idx + 1}
            totalPages={visiblePages.length}
            proposal={proposal}
            template={template}
            theme={theme}
            styles={styles}
            tablesByPage={tablesByPage}
          />
        ),
      )}
    </Document>
  );
}

interface PageProps {
  page: DocumentPage;
  proposal: ProposalPdfData["proposal"];
  template: ProposalTemplate | null;
  theme: PdfTheme;
  styles: ReturnType<typeof buildStyles>;
}

function CoverPdfPage({ page, proposal, template, theme, styles }: PageProps) {
  void theme;
  // Pega blocos de identidade
  const clientBlock = page.blocks.find((b) => b.type === "client_info");
  const projectBlock = page.blocks.find((b) => b.type === "project_info");
  const respBlock = page.blocks.find((b) => b.type === "responsible_info");
  const cliente =
    (clientBlock?.data?.cliente as string) ?? proposal.client_name ?? "Cliente";
  const projeto = (projectBlock?.data?.projeto as string) ?? proposal.title;
  const numero = (projectBlock?.data?.numero as string) ?? proposal.number;
  const dataEmissao = (projectBlock?.data?.data as string) ?? proposal.created_at;
  const responsavel = (respBlock?.data?.responsavel as string) ?? "—";

  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverHero}>
        <View style={styles.coverBrandRow}>
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: "#ffffff" }}>
            {template?.empresa_nome ?? "CN Cold"}
          </Text>
          <Text style={{ fontSize: 9, color: "#dbeafe" }}>
            Proposta Comercial Nº {numero}
          </Text>
        </View>
        <View>
          <Text style={styles.coverSubtitle}>Proposta Comercial</Text>
          <Text style={styles.coverTitle}>{template?.capa_titulo ?? projeto}</Text>
          {template?.capa_subtitulo ? (
            <Text style={styles.coverSubtitle}>{template.capa_subtitulo}</Text>
          ) : null}
          <Text style={[styles.coverSubtitle, { marginTop: 12 }]}>
            Para: <Text style={{ fontFamily: "Helvetica-Bold" }}>{cliente}</Text>
          </Text>
        </View>
        <View style={styles.coverFooter}>
          <Text>Emitida em {fmtDateBR(dataEmissao)}</Text>
          <Text>Responsável: {responsavel}</Text>
        </View>
      </View>
    </Page>
  );
}

interface StandardPageProps extends PageProps {
  pageNumber: number;
  totalPages: number;
  tablesByPage: Map<string, ProposalTable[]>;
}

function StandardPdfPage({
  page,
  pageNumber,
  totalPages,
  proposal,
  template,
  theme,
  styles,
  tablesByPage,
}: StandardPageProps) {
  const sortedBlocks = [...page.blocks].sort((a, b) => a.order - b.order);

  return (
    <Page size="A4" style={styles.page}>
      {!page.hideHeader ? (
        <View style={styles.pageHeader} fixed>
          <Text style={styles.pageHeaderTitle}>{page.title}</Text>
          <Text style={styles.pageHeaderMeta}>
            Proposta Nº {proposal.number}
          </Text>
        </View>
      ) : null}

      {sortedBlocks.map((block) =>
        renderBlock(block, {
          styles,
          theme,
          template,
          tablesByPage,
          pageId: page.id,
        }),
      )}

      {!page.hideFooter ? (
        <View style={styles.pageFooter} fixed>
          <Text>
            {page.footerText ??
              `${template?.empresa_nome ?? "CN Cold"} · ${template?.empresa_cidade ?? ""}`}
          </Text>
          <Text
            render={({ pageNumber: pn, totalPages: tp }) => `Página ${pn} de ${tp}`}
          />
        </View>
      ) : null}
      <Text style={{ display: "none" }}>{pageNumber}/{totalPages}</Text>
    </Page>
  );
}
