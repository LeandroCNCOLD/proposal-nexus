import type {
  CommissionSummary,
  FinancialSummary,
  Proposal,
  ProposalItem,
  TaxSummary,
} from "@/modules/proposals/types";
export * from "./nomusLucroAnalysis";

function amount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseFinancialNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function calculateProposalSubtotal(items: ProposalItem[]): number {
  return items.reduce((sum, item) => {
    if (item.total !== null && item.total !== undefined) return sum + amount(item.total);
    return sum + amount(item.quantity) * amount(item.unitPrice);
  }, 0);
}

export function calculateTaxSummary(input: Partial<TaxSummary> | null | undefined): TaxSummary {
  const summary: TaxSummary = {
    icms: input?.icms ?? null,
    icmsSt: input?.icmsSt ?? null,
    ipi: input?.ipi ?? null,
    iss: input?.iss ?? null,
    pis: input?.pis ?? null,
    cofins: input?.cofins ?? null,
    simplesNacional: input?.simplesNacional ?? null,
    cbs: input?.cbs ?? null,
    ibs: input?.ibs ?? null,
    ibsEstadual: input?.ibsEstadual ?? null,
    total: 0,
  };

  summary.total = [
    summary.icms,
    summary.icmsSt,
    summary.ipi,
    summary.iss,
    summary.pis,
    summary.cofins,
    summary.simplesNacional,
    summary.cbs,
    summary.ibs,
    summary.ibsEstadual,
  ].reduce((sum, value) => sum + amount(value), 0);
  return summary;
}

export function calculateCommissionSummary(input: {
  baseValue: number | null | undefined;
  amount?: number | null;
  rate?: number | null;
  representativeId?: string | null;
  representativeName?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
}): CommissionSummary {
  const baseValue = amount(input.baseValue);
  const rate = input.rate ?? (baseValue > 0 && input.amount != null ? (amount(input.amount) / baseValue) * 100 : null);
  const calculatedAmount = input.amount ?? (rate != null ? (baseValue * rate) / 100 : 0);

  return {
    representativeId: input.representativeId,
    representativeName: input.representativeName,
    sellerId: input.sellerId,
    sellerName: input.sellerName,
    baseValue,
    rate,
    amount: amount(calculatedAmount),
  };
}

export function calculateGrossMargin(grossProfit: number | null | undefined, revenue: number | null | undefined): number | null {
  const revenueValue = amount(revenue);
  if (revenueValue <= 0 || grossProfit == null) return null;
  return (grossProfit / revenueValue) * 100;
}

export function calculateNetMargin(netProfit: number | null | undefined, revenue: number | null | undefined): number | null {
  const revenueValue = amount(revenue);
  if (revenueValue <= 0 || netProfit == null) return null;
  return (netProfit / revenueValue) * 100;
}

export function calculateMarkup(revenue: number | null | undefined, totalCost: number | null | undefined): number | null {
  const cost = amount(totalCost);
  if (cost <= 0) return null;
  return ((amount(revenue) - cost) / cost) * 100;
}

export function compareItemsTotalWithProposalTotal(
  items: ProposalItem[],
  proposalTotal: number | null | undefined,
  tolerance = 0.01,
): { matches: boolean; itemsTotal: number; proposalTotal: number; difference: number } {
  const itemsTotal = items.reduce((sum, item) => sum + amount(item.totalWithDiscount ?? item.total), 0);
  const total = amount(proposalTotal);
  const difference = itemsTotal - total;
  return {
    matches: Math.abs(difference) <= tolerance,
    itemsTotal,
    proposalTotal: total,
    difference,
  };
}

export function calculateFinancialSummary(proposal: Pick<
  Proposal,
  "items" | "taxSummary" | "commissionSummary" | "total" | "discountTotal"
> & {
  freightTotal?: number | null;
  insuranceTotal?: number | null;
  accessoryExpensesTotal?: number | null;
  productionCostTotal?: number | null;
  administrativeCostTotal?: number | null;
  incidentCostTotal?: number | null;
  grossProfit?: number | null;
  netProfit?: number | null;
}): FinancialSummary {
  const subtotal = calculateProposalSubtotal(proposal.items);
  const taxTotal = calculateTaxSummary(proposal.taxSummary).total;
  const commissionTotal = amount(proposal.commissionSummary?.amount);
  const total = proposal.total ?? subtotal - amount(proposal.discountTotal);
  const productionCostTotal = amount(proposal.productionCostTotal);
  const administrativeCostTotal = amount(proposal.administrativeCostTotal);
  const incidentCostTotal = amount(proposal.incidentCostTotal);
  const grossProfit = proposal.grossProfit ?? total - taxTotal - commissionTotal - productionCostTotal;
  const netProfit = proposal.netProfit ?? grossProfit - administrativeCostTotal - incidentCostTotal;
  const totalCost = taxTotal + commissionTotal + productionCostTotal + administrativeCostTotal + incidentCostTotal;

  return {
    subtotal,
    discountTotal: amount(proposal.discountTotal),
    taxTotal,
    commissionTotal,
    freightTotal: amount(proposal.freightTotal),
    insuranceTotal: amount(proposal.insuranceTotal),
    accessoryExpensesTotal: amount(proposal.accessoryExpensesTotal),
    productionCostTotal,
    administrativeCostTotal,
    incidentCostTotal,
    grossProfit,
    netProfit,
    grossMarginPct: calculateGrossMargin(grossProfit, total),
    netMarginPct: calculateNetMargin(netProfit, total),
    markupPct: calculateMarkup(total, totalCost),
    total,
  };
}
