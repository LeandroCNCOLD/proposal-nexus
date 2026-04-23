import { Page, View, Text } from "@react-pdf/renderer";
import { ReactNode } from "react";
import { pdfStyles } from "./styles";
import { Footer, PageNumber } from "./Footer";

export function StandardPage({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.bandTop} />
      {title ? <Text style={pdfStyles.h1}>{title}</Text> : null}
      {children}
      <Footer />
      <PageNumber />
    </Page>
  );
}
