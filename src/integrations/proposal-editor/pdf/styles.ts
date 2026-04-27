// Estilos do PDF do Page Builder. Cores derivadas do template (primary/accent).
import { StyleSheet } from "@react-pdf/renderer";

export type PdfTheme = {
  primary: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  border: string;
  bg: string;
};

export const defaultTheme: PdfTheme = {
  primary: "#0f3057",
  accent: "#2b9eb3",
  accent2: "#f1c40f",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#d1d5db",
  bg: "#ffffff",
};

export const buildStyles = (theme: PdfTheme) =>
  StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingBottom: 50,
      paddingHorizontal: 40,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: theme.text,
      backgroundColor: theme.bg,
    },
    coverPage: {
      padding: 0,
      fontFamily: "Helvetica",
      color: "#ffffff",
      backgroundColor: theme.primary,
    },
    coverHero: {
      flex: 1,
      paddingHorizontal: 50,
      paddingVertical: 80,
      justifyContent: "space-between",
    },
    coverBrandRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    coverTitle: {
      fontSize: 36,
      fontFamily: "Helvetica-Bold",
      lineHeight: 1.2,
      marginBottom: 12,
    },
    coverSubtitle: {
      fontSize: 16,
      color: "#dbeafe",
      marginBottom: 6,
    },
    coverFooter: {
      borderTop: `1px solid rgba(255,255,255,0.25)`,
      paddingTop: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 9,
      color: "#dbeafe",
    },
    pageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: `1px solid ${theme.border}`,
      paddingBottom: 8,
      marginBottom: 14,
    },
    pageHeaderTitle: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: theme.primary,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    pageHeaderMeta: {
      fontSize: 8,
      color: theme.muted,
    },
    pageFooter: {
      position: "absolute",
      bottom: 24,
      left: 40,
      right: 40,
      borderTop: `1px solid ${theme.border}`,
      paddingTop: 6,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 8,
      color: theme.muted,
    },
    h1: {
      fontSize: 20,
      fontFamily: "Helvetica-Bold",
      color: theme.primary,
      marginBottom: 10,
      marginTop: 4,
    },
    h2: {
      fontSize: 15,
      fontFamily: "Helvetica-Bold",
      color: theme.primary,
      marginBottom: 8,
      marginTop: 4,
    },
    h3: {
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      color: theme.text,
      marginBottom: 6,
      marginTop: 4,
    },
    p: {
      fontSize: 10,
      lineHeight: 1.55,
      marginBottom: 6,
      color: theme.text,
    },
    blockTitle: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    kvList: {
      marginBottom: 8,
    },
    kvRow: {
      flexDirection: "row",
      paddingVertical: 4,
      borderBottom: `1px solid ${theme.border}`,
    },
    kvLabel: {
      width: 130,
      fontSize: 9,
      color: theme.muted,
      fontFamily: "Helvetica-Bold",
    },
    kvValue: {
      flex: 1,
      fontSize: 10,
    },
    bulletItem: {
      flexDirection: "row",
      marginBottom: 3,
      paddingLeft: 4,
    },
    bulletDot: {
      width: 10,
      fontSize: 10,
      color: theme.accent,
    },
    bulletText: {
      flex: 1,
      fontSize: 10,
      lineHeight: 1.4,
    },
    image: {
      marginTop: 8,
      marginBottom: 8,
      maxHeight: 280,
      objectFit: "contain",
    },
    table: {
      marginTop: 6,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: theme.primary,
      color: "#ffffff",
      fontFamily: "Helvetica-Bold",
      fontSize: 9,
    },
    tableRow: {
      flexDirection: "row",
      borderTop: `1px solid ${theme.border}`,
      fontSize: 9,
    },
    tableRowAlt: {
      backgroundColor: "#f9fafb",
    },
    tableCell: {
      padding: 5,
    },
    tableTotalRow: {
      flexDirection: "row",
      borderTop: `2px solid ${theme.primary}`,
      backgroundColor: "#f3f4f6",
      fontFamily: "Helvetica-Bold",
      fontSize: 10,
    },
    bankCard: {
      borderWidth: 1,
      borderColor: theme.border,
      padding: 10,
      marginBottom: 6,
      borderRadius: 4,
    },
    bankBank: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: theme.primary,
      marginBottom: 4,
    },
    signatureBlock: {
      marginTop: 30,
      paddingTop: 10,
      borderTop: `1px solid ${theme.text}`,
      width: 240,
    },
    notice: {
      backgroundColor: "#f3f4f6",
      borderLeft: `3px solid ${theme.accent}`,
      padding: 8,
      marginVertical: 6,
      fontSize: 9,
      color: theme.muted,
    },
  });

export type PdfStyles = ReturnType<typeof buildStyles>;
