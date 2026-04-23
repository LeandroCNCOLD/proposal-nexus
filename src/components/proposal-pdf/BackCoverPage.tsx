import * as React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";

type PdfPalette = {
  primary: string;
  accent: string;
  accent2: string;
};

type Props = {
  title?: string;
  noteText?: string | null;
  deliveryText?: string | null;
  warrantyText?: string | null;
  palette: PdfPalette;
};

export function BackCoverPage({
  title = "Informações finais",
  noteText,
  deliveryText,
  warrantyText,
  palette,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: palette.primary }]}>{title}</Text>

      {deliveryText ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: palette.primary }]}>
            Prazo de entrega
          </Text>
          <Text style={styles.blockText}>{deliveryText}</Text>
        </View>
      ) : null}

      {warrantyText ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: palette.primary }]}>
            Garantia
          </Text>
          <Text style={styles.blockText}>{warrantyText}</Text>
        </View>
      ) : null}

      {noteText ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: palette.primary }]}>
            Nota
          </Text>
          <Text style={styles.blockText}>{noteText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    display: "flex",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  block: {
    borderWidth: 1,
    borderColor: "#D9E1EC",
    padding: 10,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  blockText: {
    fontSize: 9,
    lineHeight: 1.45,
    color: "#1F2937",
  },
});
