import * as React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  ProposalTable,
  ProposalTableColumn,
  ProposalTableRow,
} from "@/features/proposal-editor/proposal-tables.types";
import {
  formatCurrencyBRL,
  getGrandTotal,
} from "@/features/proposal-editor/proposal-tables.utils";

type PdfPalette = {
  primary: string;
  accent: string;
  accent2: string;
  text?: string;
  muted?: string;
  border?: string;
};

type Props = {
  title?: string | null;
  subtitle?: string | null;
  table: ProposalTable;
  palette: PdfPalette;
};

function getCellText(
  row: ProposalTableRow,
  column: ProposalTableColumn,
): string {
  const value = row[column.key];

  if (value == null) return "";

  if (column.type === "currency") {
    return formatCurrencyBRL(value);
  }

  if (column.type === "percentage") {
    return String(value).includes("%") ? String(value) : `${value}%`;
  }

  return String(value);
}

export function TablePage({ title, subtitle, table, palette }: Props) {
  const columns = table.settings.columns ?? [];

  return (
    <View style={styles.wrapper}>
      {(title || table.title) && (
        <Text style={[styles.title, { color: palette.primary }]}>
          {title ?? table.title}
        </Text>
      )}

      {(subtitle || table.subtitle) && (
        <Text style={styles.subtitle}>{subtitle ?? table.subtitle}</Text>
      )}

      <View
        style={[styles.table, { borderColor: palette.border ?? "#D9E1EC" }]}
      >
        {table.settings.show_header !== false && (
          <View
            style={[
              styles.row,
              styles.headerRow,
              {
                backgroundColor: palette.primary,
                borderColor: palette.border ?? "#D9E1EC",
              },
            ]}
            fixed={!!table.settings.repeat_header}
          >
            {columns.map((column) => (
              <View
                key={column.key}
                style={[
                  styles.cell,
                  {
                    width: `${column.width ?? Math.floor(100 / columns.length)}%`,
                    borderColor: palette.border ?? "#D9E1EC",
                  },
                ]}
              >
                <Text style={styles.headerText}>{column.label}</Text>
              </View>
            ))}
          </View>
        )}

        {table.rows.length === 0 ? (
          <View
            style={[styles.row, { borderColor: palette.border ?? "#D9E1EC" }]}
          >
            <View style={[styles.cell, { width: "100%" }]}>
              <Text style={styles.emptyText}>Sem dados cadastrados.</Text>
            </View>
          </View>
        ) : (
          table.rows.map((row, rowIndex) => (
            <View
              key={String(row.id ?? rowIndex)}
              style={[styles.row, { borderColor: palette.border ?? "#D9E1EC" }]}
              wrap={false}
            >
              {columns.map((column) => (
                <View
                  key={column.key}
                  style={[
                    styles.cell,
                    {
                      width: `${column.width ?? Math.floor(100 / columns.length)}%`,
                      borderColor: palette.border ?? "#D9E1EC",
                      alignItems:
                        column.align === "center"
                          ? "center"
                          : column.align === "right"
                            ? "flex-end"
                            : "flex-start",
                    },
                  ]}
                >
                  <Text style={styles.cellText}>
                    {getCellText(row, column)}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      {table.settings.show_grand_total && (
        <View style={styles.totalBox}>
          <Text style={[styles.totalLabel, { color: palette.primary }]}>
            {table.settings.grand_total_label ?? "Total Geral"}
          </Text>
          <Text style={styles.totalValue}>
            {formatCurrencyBRL(getGrandTotal(table))}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    display: "flex",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#555",
    marginBottom: 6,
  },
  table: {
    width: "100%",
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    width: "100%",
    borderBottomWidth: 1,
  },
  headerRow: {
    minHeight: 28,
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 1,
    justifyContent: "center",
  },
  headerText: {
    fontSize: 8.5,
    color: "#FFFFFF",
    fontWeight: 700,
  },
  cellText: {
    fontSize: 8.2,
    color: "#111827",
    lineHeight: 1.35,
  },
  emptyText: {
    fontSize: 8.2,
    color: "#6B7280",
    textAlign: "center",
  },
  totalBox: {
    marginTop: 10,
    alignSelf: "flex-end",
    minWidth: 220,
    borderWidth: 1,
    borderColor: "#D9E1EC",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111827",
  },
});
