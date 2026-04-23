import * as React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ProposalTable } from "@/features/proposal-editor/proposal-tables.types";
import { TablePage } from "./TablePage";

type PdfPalette = {
  primary: string;
  accent: string;
  accent2: string;
  text?: string;
  muted?: string;
  border?: string;
};

type Props = {
  title?: string;
  tables: ProposalTable[];
  palette: PdfPalette;
};

export function PaymentPage({
  title = "Condições de pagamento",
  tables,
  palette,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.pageTitle, { color: palette.primary }]}>
        {title}
      </Text>

      {tables.length === 0 ? (
        <Text style={styles.empty}>
          Nenhuma condição de pagamento cadastrada.
        </Text>
      ) : (
        tables.map((table) => (
          <View key={table.id} style={styles.section}>
            <TablePage table={table} palette={palette} />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    display: "flex",
    gap: 10,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  section: {
    marginBottom: 10,
  },
  empty: {
    fontSize: 10,
    color: "#6B7280",
  },
});
