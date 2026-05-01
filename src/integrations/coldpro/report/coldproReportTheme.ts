// Tema visual do relatório do ColdPro. Centraliza cores, tipografia, dimensões
// e helpers para manter identidade visual consistente entre templates.

import { rgb, type RGB } from "pdf-lib";

export type ColdProReportTemplateKind = "tecnico" | "comercial" | "resumido";
export type ColdProReportStatus = "preliminar" | "em_analise" | "final";

export type ColdProReportSettings = {
  company_name: string;
  logo_url: string | null;
  logo_data_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  footer_text: string | null;
  default_template: ColdProReportTemplateKind;
  show_watermark: boolean;
  watermark_text: string | null;
  default_status: ColdProReportStatus;
  default_responsible: string | null;
  cover_image_url: string | null;
  cover_image_data_url: string | null;
};

export type ColdProReportCover = {
  client_name: string | null;
  project_name: string;
  location: string | null;
  responsible: string | null;
  revision: number;
  generated_at: string;
  image_data_url: string | null;
  notes: string | null;
};

export type ColdProReportContext = {
  template: ColdProReportTemplateKind;
  settings: ColdProReportSettings;
  cover: ColdProReportCover;
  status: ColdProReportStatus;
  watermark: { enabled: boolean; text: string | null };
};

export const PAGE = {
  size: [595.28, 841.89] as [number, number],
  margin: 36,
  headerHeight: 42,
  footerHeight: 30,
};

export type Theme = {
  primary: RGB;
  secondary: RGB;
  accent: RGB;
  text: RGB;
  muted: RGB;
  border: RGB;
  soft: RGB;
  white: RGB;
  danger: RGB;
  success: RGB;
  warning: RGB;
  watermark: RGB;
};

function hexToRgb(hex: string, fallback: RGB): RGB {
  const cleaned = hex?.trim().replace(/^#/, "");
  if (!cleaned || !/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleaned)) return fallback;
  const full = cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export function buildTheme(settings: ColdProReportSettings): Theme {
  return {
    primary: hexToRgb(settings.primary_color, rgb(0.05, 0.14, 0.22)),
    secondary: hexToRgb(settings.secondary_color, rgb(0.12, 0.43, 0.65)),
    accent: hexToRgb(settings.accent_color, rgb(0.12, 0.43, 0.65)),
    text: rgb(0.12, 0.16, 0.22),
    muted: rgb(0.42, 0.45, 0.5),
    border: rgb(0.82, 0.84, 0.87),
    soft: rgb(0.95, 0.97, 0.98),
    white: rgb(1, 1, 1),
    danger: rgb(0.72, 0.12, 0.16),
    success: rgb(0.13, 0.55, 0.32),
    warning: rgb(0.84, 0.55, 0.18),
    watermark: rgb(0.85, 0.86, 0.88),
  };
}

export const STATUS_LABELS: Record<ColdProReportStatus, string> = {
  preliminar: "PRELIMINAR",
  em_analise: "EM ANÁLISE",
  final: "FINAL",
};

export function statusLabel(status: ColdProReportStatus | null | undefined) {
  return STATUS_LABELS[status ?? "preliminar"] ?? "PRELIMINAR";
}

export const TEMPLATE_LABELS: Record<ColdProReportTemplateKind, string> = {
  tecnico: "Técnico Completo",
  comercial: "Comercial",
  resumido: "Resumido",
};

export function templateLabel(template: ColdProReportTemplateKind) {
  return TEMPLATE_LABELS[template] ?? "Técnico Completo";
}
