export const brl = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n ?? 0);

export const num = (n: number | null | undefined, frac = 0) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac }).format(n ?? 0);

export const pct = (n: number | null | undefined, frac = 1) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: frac, maximumFractionDigits: frac }).format((n ?? 0) / 100);

export const dateBR = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export const dateTimeBR = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR") : "—";

export const daysBetween = (a: Date | string, b: Date | string = new Date()) => {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(diff / 86400000);
};
