import * as React from "react";
import { Text, View, StyleSheet, Link } from "@react-pdf/renderer";

type PdfPalette = {
  primary: string;
  accent: string;
  accent2: string;
};

type Props = {
  title?: string;
  pdfPaths: string[];
  palette: PdfPalette;
  storageBaseUrl?: string;
};

function buildUrl(path: string, storageBaseUrl?: string) {
  if (!storageBaseUrl) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${storageBaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function AttachedPdfListPage({
  title = "Anexos da proposta",
  pdfPaths,
  palette,
  storageBaseUrl,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: palette.primary }]}>{title}</Text>

      {pdfPaths.length === 0 ? (
        <Text style={styles.empty}>Nenhum PDF anexo vinculado.</Text>
      ) : (
        <View style={styles.list}>
          {pdfPaths.map((path, index) => {
            const href = buildUrl(path, storageBaseUrl);
            return (
              <View key={`${path}-${index}`} style={styles.item}>
                <Text style={styles.itemIndex}>{index + 1}.</Text>
                <Link src={href} style={styles.link}>
                  {path.split("/").pop() || `Anexo ${index + 1}`}
                </Link>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    display: "flex",
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  empty: {
    fontSize: 10,
    color: "#6B7280",
  },
  list: {
    display: "flex",
    gap: 8,
  },
  item: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
  },
  itemIndex: {
    fontSize: 10,
    color: "#111827",
    fontWeight: 700,
  },
  link: {
    fontSize: 10,
    color: "#1D4ED8",
    textDecoration: "underline",
  },
});
