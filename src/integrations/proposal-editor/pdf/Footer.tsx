import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PdfPalette } from "./styles";
import type { ProposalTemplate } from "../template.types";

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 8,
  },
  cell: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontFamily: "Helvetica-Bold" },
});

/** Rodapé azul fixo (modelo CN Cold) com 4 colunas: telefone, site, email, cidade. */
export function BrandFooter({
  palette,
  template,
}: {
  palette: PdfPalette;
  template: ProposalTemplate | null;
}) {
  const tel = template?.empresa_telefone ?? "";
  const site = template?.empresa_site ?? "";
  const email = template?.empresa_email ?? "";
  const cidade = template?.empresa_cidade ?? "";
  return (
    <View style={[s.bar, { backgroundColor: palette.primary }]} fixed>
      <View style={s.cell}>
        <Text style={[s.label, { color: palette.accent }]}>Tel.: </Text>
        <Text style={{ color: palette.white }}>{tel}</Text>
      </View>
      <View style={s.cell}>
        <Text style={[s.label, { color: palette.accent }]}>Site: </Text>
        <Text style={{ color: palette.white }}>{site}</Text>
      </View>
      <View style={s.cell}>
        <Text style={[s.label, { color: palette.accent }]}>E-mail: </Text>
        <Text style={{ color: palette.white }}>{email}</Text>
      </View>
      <View style={s.cell}>
        <Text style={[s.label, { color: palette.accent }]}>Cidade: </Text>
        <Text style={{ color: palette.white }}>{cidade}</Text>
      </View>
    </View>
  );
}

/** Faixa azul gradiente no topo de cada página interna. */
export function BrandHeader({
  palette,
  logoUrl,
  pageTitle,
  bannerUrl,
}: {
  palette: PdfPalette;
  logoUrl?: string;
  pageTitle?: string;
  bannerUrl?: string;
}) {
  // Quando há um banner enviado pelo usuário, usar a imagem inteira como cabeçalho.
  if (bannerUrl) {
    return (
      <View
        fixed
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 54,
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image_ src={bannerUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </View>
    );
  }
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        backgroundColor: palette.primary,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 32,
        justifyContent: "space-between",
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {logoUrl ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Image_ src={logoUrl} style={{ height: 28, width: 90, objectFit: "contain" }} />
      ) : (
        <Text style={{ color: palette.white, fontFamily: "Helvetica-Bold", fontSize: 14, letterSpacing: 2 }}>
          CN COLD
        </Text>
      )}
      {pageTitle ? (
        <Text style={{ color: palette.white, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
          {pageTitle}
        </Text>
      ) : null}
    </View>
  );
}

// Workaround para o linter — re-import nominal
import { Image as Image_ } from "@react-pdf/renderer";

/** Numerador de páginas (canto inferior direito acima do rodapé azul). */
export function PageNumber({ palette }: { palette: PdfPalette }) {
  return (
    <Text
      style={{
        position: "absolute",
        bottom: 38,
        right: 32,
        fontSize: 8,
        color: palette.white,
        opacity: 0.7,
      }}
      fixed
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  );
}
