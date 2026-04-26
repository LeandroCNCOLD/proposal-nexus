export function fmtColdProChart(value: unknown, digits = 1) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(value ?? 0));
}

export function toKW(kcalH: number) {
  return kcalH / 859.845;
}

export const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent-foreground))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--secondary-foreground))",
  "hsl(var(--foreground))",
  "hsl(var(--destructive))",
  "hsl(var(--ring))",
];
