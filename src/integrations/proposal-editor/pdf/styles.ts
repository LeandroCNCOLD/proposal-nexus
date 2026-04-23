// Design tokens do PDF — derivados do template (cores podem ser sobrescritas)
import { StyleSheet } from "@react-pdf/renderer";

export const DEFAULT_COLORS = {
  primary: "#0B2545",
  primarySoft: "#13315C",
  accent: "#1FB6FF",
  accent2: "#2AA9E0",
};

export interface PdfPalette {
  primary: string;
  primarySoft: string;
  accent: string;
  accent2: string;
  text: string;
  textMuted: string;
  border: string;
  white: string;
  bgSoft: string;
}

export function makePalette(opts?: Partial<PdfPalette>): PdfPalette {
  return {
    primary: opts?.primary ?? DEFAULT_COLORS.primary,
    primarySoft: opts?.primarySoft ?? DEFAULT_COLORS.primarySoft,
    accent: opts?.accent ?? DEFAULT_COLORS.accent,
    accent2: opts?.accent2 ?? DEFAULT_COLORS.accent2,
    text: opts?.text ?? "#1F2937",
    textMuted: opts?.textMuted ?? "#6B7280",
    border: opts?.border ?? "#E5E7EB",
    white: opts?.white ?? "#FFFFFF",
    bgSoft: opts?.bgSoft ?? "#F3F6FA",
  };
}

// Estilos legados (mantidos para compatibilidade até refator completo)
export const colors = {
  primary: DEFAULT_COLORS.primary,
  primarySoft: DEFAULT_COLORS.primarySoft,
  accent: DEFAULT_COLORS.accent,
  text: "#1F2937",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  white: "#FFFFFF",
  bgSoft: "#F3F6FA",
};

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 90,
    paddingBottom: 80,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.5,
  },
  pageCover: {
    padding: 0,
    fontFamily: "Helvetica",
    color: colors.white,
    backgroundColor: colors.primary,
  },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", color: colors.primary, marginBottom: 12 },
  h2: { fontSize: 16, fontFamily: "Helvetica-Bold", color: colors.primary, marginBottom: 8 },
  h3: { fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.primary, marginBottom: 6 },
  paragraph: { marginBottom: 8 },
  small: { fontSize: 9, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  bandTop: { height: 6, backgroundColor: colors.primary, marginBottom: 18 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: colors.textMuted,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 48,
    fontSize: 8,
    color: colors.textMuted,
  },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 10, color: colors.accent },
  bulletText: { flex: 1 },
  table: { borderWidth: 1, borderColor: colors.border, marginTop: 6 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.bgSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: { padding: 6, fontSize: 9 },
  tableCellHeader: { padding: 6, fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.primary },
  badge: {
    backgroundColor: colors.accent,
    color: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8,
    borderRadius: 2,
  },
});

export const FOOTER_INFO = {
  empresa: "CN Cold Refrigeração Industrial",
  site: "www.cncold.com.br",
  email: "comercial@cncold.com.br",
  telefone: "+55 (11) 0000-0000",
};
