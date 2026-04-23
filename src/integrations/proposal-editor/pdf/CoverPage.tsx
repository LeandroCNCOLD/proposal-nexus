import { Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { PdfPalette } from "./styles";
import type { CoverData } from "../types";
import type { ProposalTemplate, TemplateAsset } from "../template.types";

export function CoverPage({
  palette,
  template,
  assets,
  cover,
}: {
  palette: PdfPalette;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  cover: CoverData;
}) {
  const logo = assets.find((a) => a.asset_kind === "logo")?.url;
  const fotoCapa = cover.foto_capa_url || assets.find((a) => a.asset_kind === "equipment_photo")?.url;

  const s = StyleSheet.create({
    page: { fontFamily: "Helvetica", color: palette.white, backgroundColor: palette.primary, padding: 0 },
    topBrand: { paddingHorizontal: 40, paddingTop: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    middle: { flex: 1, paddingHorizontal: 40, justifyContent: "center" },
    accentBar: { width: 60, height: 4, backgroundColor: palette.accent, marginBottom: 24 },
    tagline: { fontSize: 10, letterSpacing: 3, marginBottom: 16, color: palette.accent, fontFamily: "Helvetica-Bold" },
    titulo: { fontSize: 28, fontFamily: "Helvetica-Bold", marginBottom: 12, lineHeight: 1.2 },
    subtitulo: { fontSize: 13, opacity: 0.85, marginBottom: 24, lineHeight: 1.5 },
    cliente: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    projeto: { fontSize: 12, opacity: 0.85, marginBottom: 4 },
    meta: { fontSize: 10, opacity: 0.7 },
    bottom: { backgroundColor: palette.primarySoft, paddingHorizontal: 40, paddingVertical: 18, flexDirection: "row", justifyContent: "space-between", fontSize: 9 },
    label: { opacity: 0.6, marginBottom: 2, textTransform: "uppercase", letterSpacing: 1, fontSize: 8 },
    value: { fontFamily: "Helvetica-Bold" },
    coverImage: { position: "absolute", right: 0, bottom: 80, width: 280, height: 280, opacity: 0.2 },
  });

  return (
    <Page size="A4" style={s.page}>
      {fotoCapa ? <Image src={fotoCapa} style={s.coverImage} /> : null}
      <View style={s.topBrand}>
        {logo ? (
          <Image src={logo} style={{ width: 110, height: 36, objectFit: "contain" }} />
        ) : (
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 4 }}>CN COLD</Text>
        )}
        <Text style={{ fontSize: 9, opacity: 0.7, letterSpacing: 1 }}>{template?.empresa_site}</Text>
      </View>

      <View style={s.middle}>
        {template?.capa_tagline ? <Text style={s.tagline}>{template.capa_tagline}</Text> : null}
        <View style={s.accentBar} />
        <Text style={s.titulo}>{template?.capa_titulo || "PROPOSTA TÉCNICA E COMERCIAL"}</Text>
        {template?.capa_subtitulo ? <Text style={s.subtitulo}>{template.capa_subtitulo}</Text> : null}
        <View style={{ marginTop: 24 }}>
          <Text style={s.cliente}>{cover.cliente || "—"}</Text>
          <Text style={s.projeto}>{cover.projeto || ""}</Text>
          <Text style={s.meta}>Proposta {cover.numero || "—"} · {cover.data || ""}</Text>
        </View>
      </View>

      <View style={s.bottom}>
        <View>
          <Text style={s.label}>Responsável</Text>
          <Text style={s.value}>{cover.responsavel || "—"}</Text>
        </View>
        <View>
          <Text style={s.label}>Contato</Text>
          <Text style={s.value}>{template?.empresa_telefone || "—"}</Text>
        </View>
        <View>
          <Text style={s.label}>E-mail</Text>
          <Text style={s.value}>{template?.empresa_email || "—"}</Text>
        </View>
      </View>
    </Page>
  );
}
