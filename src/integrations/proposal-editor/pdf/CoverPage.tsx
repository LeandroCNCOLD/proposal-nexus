import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { colors } from "./styles";
import type { CoverData } from "../types";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    color: colors.white,
    backgroundColor: colors.primary,
    padding: 0,
  },
  topBrand: {
    paddingHorizontal: 48,
    paddingTop: 56,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 4,
  },
  middle: {
    flex: 1,
    paddingHorizontal: 48,
    justifyContent: "flex-end",
    paddingBottom: 24,
  },
  accentBar: { width: 60, height: 4, backgroundColor: colors.accent, marginBottom: 18 },
  projeto: { fontSize: 32, fontFamily: "Helvetica-Bold", marginBottom: 8, lineHeight: 1.2 },
  cliente: { fontSize: 18, opacity: 0.9, marginBottom: 4 },
  meta: { fontSize: 11, opacity: 0.7 },
  bottom: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 48,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
  },
  label: { opacity: 0.6, marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 },
  value: { fontFamily: "Helvetica-Bold" },
});

export function CoverPage({ cover }: { cover: CoverData }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.topBrand}>CN COLD</Text>
      <View style={s.middle}>
        <View style={s.accentBar} />
        <Text style={s.projeto}>{cover.projeto || "Proposta Comercial"}</Text>
        <Text style={s.cliente}>{cover.cliente || "—"}</Text>
        <Text style={s.meta}>
          Proposta {cover.numero || "—"} · {cover.data || ""}
        </Text>
      </View>
      <View style={s.bottom}>
        <View>
          <Text style={s.label}>Responsável</Text>
          <Text style={s.value}>{cover.responsavel || "—"}</Text>
        </View>
        <View>
          <Text style={s.label}>Validade</Text>
          <Text style={s.value}>{cover.data || "—"}</Text>
        </View>
      </View>
    </Page>
  );
}
