import { Text, View } from "@react-pdf/renderer";
import { pdfStyles, FOOTER_INFO } from "./styles";

export function Footer() {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text>{FOOTER_INFO.empresa}</Text>
      <Text>
        {FOOTER_INFO.telefone} · {FOOTER_INFO.email} · {FOOTER_INFO.site}
      </Text>
    </View>
  );
}

export function PageNumber() {
  return (
    <Text
      style={pdfStyles.pageNumber}
      fixed
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  );
}
