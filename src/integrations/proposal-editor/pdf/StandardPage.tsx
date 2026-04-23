import { Page, View, Text } from "@react-pdf/renderer";
import { ReactNode } from "react";
import type { PdfPalette } from "./styles";
import { BrandFooter, BrandHeader, PageNumber } from "./Footer";
import type { ProposalTemplate } from "../template.types";

export function StandardPage({
  title,
  children,
  palette,
  template,
  logoUrl,
  headerBannerUrl,
  footerBannerUrl,
}: {
  title?: string;
  children: ReactNode;
  palette: PdfPalette;
  template: ProposalTemplate | null;
  logoUrl?: string;
  headerBannerUrl?: string;
  footerBannerUrl?: string;
}) {
  return (
    <Page
      size="A4"
      style={{
        paddingTop: 78,
        paddingBottom: 60,
        paddingHorizontal: 36,
        fontFamily: "Helvetica",
        fontSize: 10,
        color: palette.text,
        lineHeight: 1.5,
      }}
    >
      <BrandHeader palette={palette} logoUrl={logoUrl} pageTitle={title} bannerUrl={headerBannerUrl} />
      {title ? (
        <View style={{ marginBottom: 14 }}>
          <Text
            style={{
              fontSize: 20,
              fontFamily: "Helvetica-Bold",
              color: palette.primary,
              marginBottom: 4,
            }}
          >
            {title}
          </Text>
          <View
            style={{
              height: 3,
              width: 50,
              backgroundColor: palette.accent,
            }}
          />
        </View>
      ) : null}
      {children}
      <BrandFooter palette={palette} template={template} bannerUrl={footerBannerUrl} />
      <PageNumber palette={palette} />
    </Page>
  );
}
