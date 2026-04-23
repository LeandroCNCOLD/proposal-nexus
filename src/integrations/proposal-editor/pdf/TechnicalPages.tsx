import { Text, View } from "@react-pdf/renderer";
import type { PdfPalette } from "./styles";
import { StandardPage } from "./StandardPage";
import type { ProposalTemplate, TemplateAsset } from "../template.types";
import type { ProposalTable, TableColumn, ProposalTableRow } from "../types";

const fmtBRL = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? Number(n) : n;
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtNumber = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? Number(n) : n;
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR");
};

interface PageCtx {
  palette: PdfPalette;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  logoUrl?: string;
  headerBannerUrl?: string;
  footerBannerUrl?: string;
}

function renderCell(
  col: TableColumn,
  row: ProposalTableRow,
  rowIndex: number,
  rows: ProposalTableRow[],
): string {
  const raw = row[col.key];
  if (col.computed && col.key === "valor_total") {
    const q = Number(row.quantidade ?? 0);
    const u = Number(row.valor_unitario ?? 0);
    return fmtBRL(q * u);
  }
  if (col.type === "currency") return fmtBRL(raw as number);
  if (col.type === "number") return fmtNumber(raw as number);
  void rowIndex;
  void rows;
  return raw == null || raw === "" ? "—" : String(raw);
}

function StructuredTable({
  palette,
  columns,
  rows,
  showTotal,
}: {
  palette: PdfPalette;
  columns: TableColumn[];
  rows: ProposalTableRow[];
  showTotal?: boolean;
}) {
  const totalGeral = showTotal
    ? rows.reduce(
        (s, r) => s + Number(r.quantidade ?? 0) * Number(r.valor_unitario ?? 0),
        0,
      )
    : 0;

  return (
    <View style={{ borderWidth: 1, borderColor: palette.border, marginTop: 6 }}>
      <View style={{ flexDirection: "row", backgroundColor: palette.primary }} fixed>
        {columns.map((c) => (
          <Text
            key={c.key}
            style={{
              flex: c.width ?? 1,
              padding: 6,
              fontSize: 9,
              color: palette.white,
              fontFamily: "Helvetica-Bold",
              textAlign: c.align ?? "left",
            }}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <View style={{ padding: 10 }}>
          <Text style={{ fontSize: 9, color: palette.textMuted }}>Sem linhas.</Text>
        </View>
      ) : (
        rows.map((r, i) => (
          <View
            key={i}
            wrap={false}
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
              backgroundColor: i % 2 === 0 ? palette.white : palette.bgSoft,
            }}
          >
            {columns.map((c) => (
              <Text
                key={c.key}
                style={{
                  flex: c.width ?? 1,
                  padding: 6,
                  fontSize: 9,
                  textAlign: c.align ?? "left",
                }}
              >
                {renderCell(c, r, i, rows)}
              </Text>
            ))}
          </View>
        ))
      )}
      {showTotal && rows.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: palette.bgSoft,
            padding: 8,
            justifyContent: "flex-end",
          }}
        >
          <Text
            style={{
              fontFamily: "Helvetica-Bold",
              color: palette.primary,
              fontSize: 11,
            }}
          >
            Total geral: {fmtBRL(totalGeral)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface TablePageProps extends PageCtx {
  title: string;
  table?: ProposalTable | null;
  defaultColumns: TableColumn[];
  showTotal?: boolean;
  intro?: string;
}

function TablePage({
  palette,
  template,
  logoUrl,
  headerBannerUrl,
  footerBannerUrl,
  title,
  table,
  defaultColumns,
  showTotal,
  intro,
}: TablePageProps) {
  const settingsCols = (table?.settings?.columns as TableColumn[] | undefined) ?? null;
  const columns = (settingsCols && settingsCols.length ? settingsCols : defaultColumns) as TableColumn[];
  const rows = (table?.rows ?? []) as ProposalTableRow[];
  return (
    <StandardPage
      title={title}
      palette={palette}
      template={template}
      logoUrl={logoUrl}
      headerBannerUrl={headerBannerUrl}
      footerBannerUrl={footerBannerUrl}
    >
      {intro ? <Text style={{ marginBottom: 10 }}>{intro}</Text> : null}
      <StructuredTable palette={palette} columns={columns} rows={rows} showTotal={showTotal} />
    </StandardPage>
  );
}

export function CaracteristicasPage(props: PageCtx & { table?: ProposalTable | null; pageTitle?: string }) {
  const { table, pageTitle, ...rest } = props;
  return (
    <TablePage
      {...rest}
      title={pageTitle || "Características técnicas"}
      table={table}
      defaultColumns={[
        { key: "descricao", label: "Característica", type: "text", width: 3 },
        { key: "valor", label: "Valor", type: "text", width: 2 },
        { key: "unidade", label: "Unidade", type: "text", width: 1 },
      ]}
    />
  );
}

export function EquipamentoPage(props: PageCtx & { table?: ProposalTable | null; pageTitle?: string }) {
  const { table, pageTitle, ...rest } = props;
  return (
    <TablePage
      {...rest}
      title={pageTitle || "Equipamentos"}
      table={table}
      defaultColumns={[
        { key: "modelo", label: "Modelo", type: "text", width: 2 },
        { key: "descricao", label: "Descrição", type: "text", width: 3 },
        { key: "quantidade", label: "Qtd", type: "number", width: 1, align: "right" },
        { key: "unidade", label: "Un", type: "text", width: 1 },
      ]}
    />
  );
}

export function InvestimentoPage(props: PageCtx & { table?: ProposalTable | null; pageTitle?: string }) {
  const { table, pageTitle, ...rest } = props;
  return (
    <TablePage
      {...rest}
      title={pageTitle || "Resumo de investimento"}
      table={table}
      defaultColumns={[
        { key: "descricao", label: "Descrição", type: "text", width: 4 },
        { key: "quantidade", label: "Qtd", type: "number", width: 1, align: "right" },
        { key: "unidade", label: "Un", type: "text", width: 1 },
        { key: "valor_unitario", label: "Valor Unitário", type: "currency", width: 2, align: "right" },
        { key: "valor_total", label: "Total", type: "currency", width: 2, align: "right", computed: true },
      ]}
      showTotal
    />
  );
}

export function ImpostosPage(props: PageCtx & { table?: ProposalTable | null; pageTitle?: string }) {
  const { table, pageTitle, ...rest } = props;
  return (
    <TablePage
      {...rest}
      title={pageTitle || "Tributação"}
      table={table}
      defaultColumns={[
        { key: "tributo", label: "Tributo", type: "text", width: 2 },
        { key: "aliquota", label: "Alíquota (%)", type: "number", width: 1, align: "right" },
        { key: "base_calculo", label: "Base de cálculo", type: "currency", width: 2, align: "right" },
        { key: "valor", label: "Valor", type: "currency", width: 2, align: "right" },
      ]}
      intro="Tributos incidentes sobre a operação conforme legislação vigente."
    />
  );
}

export function PagamentoPage(props: PageCtx & { table?: ProposalTable | null; pageTitle?: string }) {
  const { table, pageTitle, ...rest } = props;
  return (
    <TablePage
      {...rest}
      title={pageTitle || "Condições de pagamento"}
      table={table}
      defaultColumns={[
        { key: "parcela", label: "Parcela", type: "text", width: 1 },
        { key: "vencimento", label: "Vencimento", type: "text", width: 2 },
        { key: "percentual", label: "%", type: "number", width: 1, align: "right" },
        { key: "valor", label: "Valor", type: "currency", width: 2, align: "right" },
        { key: "observacao", label: "Observação", type: "text", width: 3 },
      ]}
    />
  );
}

export function DifferentialsPage(props: PageCtx & { pageTitle?: string }) {
  const { palette, template, logoUrl, headerBannerUrl, footerBannerUrl, pageTitle } = props;
  const items = (template?.sobre_diferenciais ?? []) as Array<{ titulo: string; descricao?: string }>;
  return (
    <StandardPage
      title={pageTitle || "Diferenciais"}
      palette={palette}
      template={template}
      logoUrl={logoUrl}
      headerBannerUrl={headerBannerUrl}
      footerBannerUrl={footerBannerUrl}
    >
      {items.length === 0 ? (
        <Text style={{ fontSize: 9, color: palette.textMuted }}>Sem diferenciais cadastrados.</Text>
      ) : (
        items.map((d, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 10 }} wrap={false}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: palette.accent,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <Text style={{ color: palette.white, fontFamily: "Helvetica-Bold", fontSize: 10 }}>
                {i + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 2 }}>
                {d.titulo}
              </Text>
              {d.descricao ? (
                <Text style={{ fontSize: 9, color: palette.textMuted }}>{d.descricao}</Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </StandardPage>
  );
}

export function ImpactPage(props: PageCtx & { items?: Array<{ kpi: string; valor: string; descricao?: string }>; pageTitle?: string }) {
  const { palette, template, logoUrl, headerBannerUrl, footerBannerUrl, items = [], pageTitle } = props;
  return (
    <StandardPage
      title={pageTitle || "Impacto esperado"}
      palette={palette}
      template={template}
      logoUrl={logoUrl}
      headerBannerUrl={headerBannerUrl}
      footerBannerUrl={footerBannerUrl}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.length === 0 ? (
          <Text style={{ fontSize: 9, color: palette.textMuted }}>Conteúdo de impacto a definir.</Text>
        ) : (
          items.map((it, i) => (
            <View
              key={i}
              style={{
                width: "48%",
                padding: 12,
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: 4,
                backgroundColor: palette.bgSoft,
              }}
              wrap={false}
            >
              <Text style={{ fontSize: 9, color: palette.textMuted, marginBottom: 4 }}>{it.kpi}</Text>
              <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: palette.primary }}>
                {it.valor}
              </Text>
              {it.descricao ? (
                <Text style={{ fontSize: 9, marginTop: 4 }}>{it.descricao}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </StandardPage>
  );
}

export function NotaPage(props: PageCtx & { text?: string; pageTitle?: string }) {
  const { palette, template, logoUrl, headerBannerUrl, footerBannerUrl, text, pageTitle } = props;
  return (
    <StandardPage
      title={pageTitle || "Notas"}
      palette={palette}
      template={template}
      logoUrl={logoUrl}
      headerBannerUrl={headerBannerUrl}
      footerBannerUrl={footerBannerUrl}
    >
      <View
        style={{
          padding: 14,
          borderLeftWidth: 4,
          borderLeftColor: palette.accent,
          backgroundColor: palette.bgSoft,
        }}
      >
        <Text style={{ fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 6 }}>
          Observação importante
        </Text>
        <Text>{text || "Adicione aqui notas, esclarecimentos ou avisos relevantes para o cliente."}</Text>
      </View>
    </StandardPage>
  );
}

export function ContracapaPage(props: PageCtx & { responsavel?: string }) {
  const { palette, template, logoUrl, headerBannerUrl, footerBannerUrl, responsavel } = props;
  const empresa = template?.empresa_nome ?? "CN Cold";
  return (
    <StandardPage
      title="Agradecemos a oportunidade"
      palette={palette}
      template={template}
      logoUrl={logoUrl}
      headerBannerUrl={headerBannerUrl}
      footerBannerUrl={footerBannerUrl}
    >
      <View style={{ marginTop: 40, alignItems: "center" }}>
        <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: palette.primary, marginBottom: 12 }}>
          Conte com a {empresa}
        </Text>
        <Text style={{ marginBottom: 20, textAlign: "center" }}>
          Seguimos à disposição para esclarecer dúvidas, ajustar o escopo ou agendar uma reunião técnica.
        </Text>
        <View
          style={{
            width: 220,
            borderTopWidth: 1,
            borderTopColor: palette.border,
            paddingTop: 6,
            alignItems: "center",
          }}
        >
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{responsavel || "Equipe Comercial"}</Text>
          <Text style={{ fontSize: 9, color: palette.textMuted }}>{empresa}</Text>
        </View>
        <View style={{ marginTop: 30, alignItems: "center" }}>
          <Text style={{ fontSize: 9, color: palette.textMuted }}>{template?.empresa_telefone}</Text>
          <Text style={{ fontSize: 9, color: palette.textMuted }}>{template?.empresa_email}</Text>
          <Text style={{ fontSize: 9, color: palette.textMuted }}>{template?.empresa_site}</Text>
        </View>
      </View>
    </StandardPage>
  );
}
