// Utilitários puros (sem React) para converter BlockLayout em estilos CSS / PDF.
// Mantidos fora dos componentes UI para evitar puxar React/Popover/Slider
// em bundles que não precisam (ex.: pipeline de PDF).
import type { BlockLayout } from "./types";

export function layoutToBoxStyle(
  layout: BlockLayout | undefined,
  primaryColor?: string,
): React.CSSProperties {
  if (!layout) return {};
  const s: React.CSSProperties = {};
  const opacity = (layout.bgOpacity ?? 100) / 100;

  const mode =
    layout.bgMode ??
    (layout.background === "white" || layout.background === "primary" || layout.background === "muted"
      ? "solid"
      : "none");

  if (mode === "solid") {
    let color = layout.bgColor;
    if (!color) {
      if (layout.background === "primary") color = primaryColor ?? "#0c2340";
      else if (layout.background === "muted") color = "#f1f5f9";
      else color = "#ffffff";
    }
    s.background = hexToRgba(color, opacity);
  } else if (mode === "gradient") {
    const from = hexToRgba(layout.bgGradientFrom ?? "#3b82f6", opacity);
    const to = hexToRgba(layout.bgGradientTo ?? "#0c2340", opacity);
    s.background = `linear-gradient(${layout.bgGradientAngle ?? 135}deg, ${from}, ${to})`;
  }

  if ((layout.borderWidth ?? 0) > 0) {
    s.border = `${layout.borderWidth}px ${layout.borderStyle ?? "solid"} ${layout.borderColor ?? "#cbd5e1"}`;
  }
  if (typeof layout.borderRadius === "number") {
    s.borderRadius = layout.borderRadius;
  }
  return s;
}

export function layoutToPdfBoxStyle(
  layout: BlockLayout | undefined,
  primaryColor?: string,
): {
  backgroundColor?: string;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
} {
  if (!layout) return {};
  const out: ReturnType<typeof layoutToPdfBoxStyle> = {};
  const opacity = (layout.bgOpacity ?? 100) / 100;
  const mode =
    layout.bgMode ??
    (layout.background === "white" || layout.background === "primary" || layout.background === "muted"
      ? "solid"
      : "none");

  if (mode === "solid") {
    let color = layout.bgColor;
    if (!color) {
      if (layout.background === "primary") color = primaryColor ?? "#0c2340";
      else if (layout.background === "muted") color = "#f1f5f9";
      else color = "#ffffff";
    }
    out.backgroundColor = hexToRgba(color, opacity);
  } else if (mode === "gradient") {
    out.backgroundColor = hexToRgba(layout.bgGradientFrom ?? "#3b82f6", opacity);
  }

  if ((layout.borderWidth ?? 0) > 0) {
    out.borderWidth = layout.borderWidth;
    out.borderStyle = layout.borderStyle ?? "solid";
    out.borderColor = layout.borderColor ?? "#cbd5e1";
  }
  if (typeof layout.borderRadius === "number") {
    out.borderRadius = layout.borderRadius;
  }
  return out;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 3 && h.length !== 6) return hex;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
