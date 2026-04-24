// Renderer de blocos individuais para o PDF. Cada DocumentBlock vira um
// pedaço do React-PDF.
import { Image, Text, View } from "@react-pdf/renderer";
import type { DocumentBlock } from "../types";
import type { ProposalTable } from "../types";
import type { ProposalTemplate } from "../template.types";
import { normalizeDadosBancarios } from "../template.types";
import type { PdfStyles, PdfTheme } from "./styles";
import { fmtCurrency, fmtDateBR, fmtNumber } from "./utils";
import { renderRichHtml } from "./rich-text";

interface BlockRenderContext {
  styles: PdfStyles;
  theme: PdfTheme;
  template: ProposalTemplate | null;
  tablesByPage: Map<string, ProposalTable[]>;
  pageId: string;
}

export function renderBlock(block: DocumentBlock, ctx: BlockRenderContext): React.ReactNode {
  const { styles, theme, template, tablesByPage, pageId } = ctx;
  const key = block.id;

  switch (block.type) {
    case "container": {
      const printVisible = (block.data.printVisible as boolean | undefined) ?? true;
      // Container marcado como "não imprime" — apenas organiza no editor.
      if (!printVisible) return null;
      const title = (block.data.title as string | undefined) ?? block.title;
      const borderColor = (block.data.borderColor as string | undefined) ?? "#cbd5e1";
      const borderWidth = (block.data.borderWidth as number | undefined) ?? 1;
      const radius = (block.data.radius as number | undefined) ?? 6;
      const backgroundColor =
        (block.data.backgroundColor as string | undefined) ?? undefined;
      return (
        <View
          key={key}
          style={{
            width: "100%",
            height: "100%",
            borderWidth,
            borderColor,
            borderStyle: "solid",
            borderRadius: radius,
            backgroundColor:
              backgroundColor && backgroundColor !== "transparent" ? backgroundColor : undefined,
          }}
        >
          {title ? (
            <Text style={{ fontSize: 8, color: theme.muted, padding: 4 }}>{title}</Text>
          ) : null}
        </View>
      );
    }

    case "heading": {
      const text = (block.data.text as string) ?? "";
      const level = (block.data.level as number) ?? 1;
      const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      return (
        <Text key={key} style={style}>
          {text}
        </Text>
      );
    }

    case "rich_text": {
      const html = (block.data.html as string) ?? "";
      const rendered = renderRichHtml(html, styles);
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
          {rendered ?? (
            <Text style={[styles.p, { color: theme.muted, fontStyle: "italic" }]}>—</Text>
          )}
        </View>
      );
    }

    case "image": {
      const url = (block.data.url as string | null) ?? null;
      if (!url) return null;
      return (
        <View key={key}>
          {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
          <Image src={url} style={styles.image} />
        </View>
      );
    }

    case "key_value_list": {
      const items =
        (block.data.items as Array<{ label: string; value: string }> | undefined) ?? [];
      if (items.length === 0) return null;
      return (
        <View key={key} style={styles.kvList}>
          {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
          {items.map((it, i) => (
            <View key={i} style={styles.kvRow}>
              <Text style={styles.kvLabel}>{it.label}</Text>
              <Text style={styles.kvValue}>{it.value || "—"}</Text>
            </View>
          ))}
        </View>
      );
    }

    case "included_items":
    case "excluded_items": {
      const items = (block.data.items as string[] | undefined) ?? [];
      if (items.length === 0) return null;
      const marker = block.type === "included_items" ? "✓" : "✗";
      const color = block.type === "included_items" ? theme.accent : "#dc2626";
      return (
        <View key={key} style={{ marginBottom: 8 }}>
          {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
          {items.map((it, i) => (
            <View key={i} style={styles.bulletItem}>
              <Text style={[styles.bulletDot, { color }]}>{marker}</Text>
              <Text style={styles.bulletText}>{it}</Text>
            </View>
          ))}
        </View>
      );
    }

    case "client_info":
    case "project_info":
    case "responsible_info":
    case "cover_identity": {
      const fields = Object.entries(block.data ?? {}).filter(
        ([, v]) => v !== null && v !== undefined && String(v).trim().length > 0,
      );
      if (fields.length === 0) return null;
      return (
        <View key={key} style={styles.kvList}>
          {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
          {fields.map(([k, v]) => (
            <View key={k} style={styles.kvRow}>
              <Text style={styles.kvLabel}>{labelize(k)}</Text>
              <Text style={styles.kvValue}>{String(v)}</Text>
            </View>
          ))}
        </View>
      );
    }

    case "investment_table":
    case "tax_table":
    case "payment_table":
    case "characteristics_table":
    case "equipments_table":
    case "technical_table": {
      // Busca tabela estruturada associada à página
      const tableTypeMap: Record<string, string> = {
        investment_table: "investimento",
        tax_table: "impostos",
        payment_table: "pagamento",
        characteristics_table: "caracteristicas",
        equipments_table: "equipamentos",
        technical_table: "itens",
      };
      const tableType = tableTypeMap[block.type];
      const pageTables = tablesByPage.get(pageId) ?? [];
      const table = pageTables.find((t) => t.table_type === tableType);
      if (!table || !table.rows || table.rows.length === 0) {
        return (
          <View key={key} style={styles.notice}>
            <Text>Tabela "{tableType}" sem dados ainda.</Text>
          </View>
        );
      }
      return renderTable(key, block.title, table, ctx);
    }

    case "bank_data": {
      const banks = normalizeDadosBancarios(template?.dados_bancarios);
      if (banks.length === 0) return null;
      return (
        <View key={key}>
          {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
          {banks.map((b, i) => (
            <View key={i} style={styles.bankCard}>
              <Text style={styles.bankBank}>{b.banco}</Text>
              {b.agencia ? <Text style={styles.p}>Agência: {b.agencia}</Text> : null}
              {b.conta ? <Text style={styles.p}>Conta: {b.conta}</Text> : null}
              {b.pix ? <Text style={styles.p}>Pix: {b.pix}</Text> : null}
              {b.titular ? <Text style={styles.p}>Titular: {b.titular}</Text> : null}
            </View>
          ))}
        </View>
      );
    }

    case "signature": {
      return (
        <View key={key} style={styles.signatureBlock}>
          <Text style={{ fontSize: 9, color: theme.muted }}>
            {template?.empresa_nome ?? "Responsável Comercial"}
          </Text>
          <Text style={{ fontSize: 9, color: theme.muted }}>
            {template?.empresa_email ?? ""}
          </Text>
        </View>
      );
    }

    case "attached_pdf": {
      const paths = (block.data.paths as string[] | undefined) ?? [];
      return (
        <View key={key} style={styles.notice}>
          <Text>
            {paths.length > 0
              ? `${paths.length} PDF(s) anexado(s) — incluídos no final do documento.`
              : "Nenhum PDF anexado."}
          </Text>
        </View>
      );
    }

    case "proposal_summary_box": {
      // Renderiza Cliente / Projeto / Proposta / Data / Responsável Comercial
      // com os valores do template/contexto. Quebra de linha automática.
      const overrides =
        (block.data.overrides as Record<string, { label?: string; value?: string }> | undefined) ??
        {};
      const ctxData = (block.data.context as Record<string, string | undefined> | undefined) ?? {};
      const items = [
        { key: "cliente", label: "Cliente:", value: ctxData.client_name ?? "" },
        { key: "projeto", label: "Projeto:", value: ctxData.proposal_title ?? "" },
        { key: "proposta", label: "Proposta:", value: ctxData.proposal_number ?? "" },
        { key: "data", label: "Data:", value: ctxData.data_emissao ?? "" },
        {
          key: "responsavel",
          label: "Responsável Comercial:",
          value: (block.data.responsavel as string | undefined) ?? ctxData.vendedor ?? "",
        },
      ].map((f) => ({
        key: f.key,
        label: overrides[f.key]?.label ?? f.label,
        value: overrides[f.key]?.value ?? f.value,
      }));
      return (
        <View key={key} style={{ width: "100%", padding: 6, gap: 4 }}>
          {items.map((it) => (
            <View
              key={it.key}
              style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}
            >
              <Text style={{ fontSize: 10, fontWeight: 700, color: theme.text }}>
                {it.label}
              </Text>
              <Text style={{ fontSize: 10, color: theme.text, flex: 1 }}>
                {it.value || "—"}
              </Text>
            </View>
          ))}
        </View>
      );
    }
      return (
        <View key={key} style={styles.notice}>
          <Text>Bloco "{block.type}" sem renderer dedicado.</Text>
        </View>
      );
  }
}

function renderTable(
  key: string,
  title: string | undefined,
  table: ProposalTable,
  ctx: BlockRenderContext,
): React.ReactNode {
  const { styles, theme } = ctx;
  const settings = table.settings ?? {};
  const columns = (settings.columns as Array<{
    key: string;
    label: string;
    type?: string;
    width?: number;
    align?: string;
  }>) ?? [];

  if (columns.length === 0) {
    return (
      <View key={key} style={styles.notice}>
        <Text>Tabela "{table.table_type}" sem colunas configuradas.</Text>
      </View>
    );
  }

  const totalWidth = columns.reduce((s, c) => s + (c.width ?? 1), 0);
  const showHeader = settings.show_header !== false;
  const sumColumns = (settings.sum_columns as string[]) ?? [];
  const showGrandTotal = settings.show_grand_total === true;

  const formatCell = (col: typeof columns[number], value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (col.type === "currency") return fmtCurrency(value);
    if (col.type === "number") return fmtNumber(value, 0);
    if (col.type === "date") return fmtDateBR(value);
    return String(value);
  };

  const totals: Record<string, number> = {};
  if (showGrandTotal && sumColumns.length > 0) {
    sumColumns.forEach((k) => {
      totals[k] = table.rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
    });
  }

  return (
    <View key={key} style={{ marginVertical: 6 }}>
      {(title || table.title) ? (
        <Text style={styles.blockTitle}>{title ?? table.title}</Text>
      ) : null}
      <View style={styles.table}>
        {showHeader ? (
          <View style={styles.tableHeader}>
            {columns.map((c) => (
              <Text
                key={c.key}
                style={[
                  styles.tableCell,
                  {
                    width: `${((c.width ?? 1) / totalWidth) * 100}%`,
                    textAlign: (c.align as "left" | "right" | "center" | undefined) ?? "left",
                  },
                ]}
              >
                {c.label}
              </Text>
            ))}
          </View>
        ) : null}
        {table.rows.map((row, i) => (
          <View
            key={i}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            {columns.map((c) => (
              <Text
                key={c.key}
                style={[
                  styles.tableCell,
                  {
                    width: `${((c.width ?? 1) / totalWidth) * 100}%`,
                    textAlign: (c.align as "left" | "right" | "center" | undefined) ?? "left",
                  },
                ]}
              >
                {formatCell(c, row[c.key])}
              </Text>
            ))}
          </View>
        ))}
        {showGrandTotal && sumColumns.length > 0 ? (
          <View style={styles.tableTotalRow}>
            {columns.map((c, idx) => {
              const isSum = sumColumns.includes(c.key);
              const isFirst = idx === 0;
              const value = isSum
                ? fmtCurrency(totals[c.key])
                : isFirst
                  ? (settings.grand_total_label as string) ?? "Total"
                  : "";
              return (
                <Text
                  key={c.key}
                  style={[
                    styles.tableCell,
                    {
                      width: `${((c.width ?? 1) / totalWidth) * 100}%`,
                      textAlign: (c.align as "left" | "right" | "center" | undefined) ?? "left",
                      color: theme.primary,
                    },
                  ]}
                >
                  {value}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
