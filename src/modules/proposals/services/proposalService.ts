import type { Proposal, ProposalItem, TaxSummary } from "@/modules/proposals/types";

export type ProposalRepositoryRow = Record<string, unknown>;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export function mapRepositoryItemsToProposalItems(rows: ProposalRepositoryRow[] | null | undefined): ProposalItem[] {
  return (rows ?? []).map((row) => ({
    id: asString(row.id),
    nomusItemId: asString(row.nomus_item_id),
    nomusProductId: asString(row.nomus_product_id),
    productCode: asString(row.product_code),
    description: asString(row.description) ?? "",
    additionalInfo: asString(row.additional_info),
    quantity: asNumber(row.quantity),
    unitPrice: asNumber(row.unit_price),
    discount: asNumber(row.discount),
    total: asNumber(row.total),
    totalWithDiscount: asNumber(row.total_with_discount),
    deliveryDays: asNumber(row.prazo_entrega_dias),
    status: asString(row.item_status),
  }));
}

export function emptyTaxSummary(): TaxSummary {
  return {
    icms: null,
    icmsSt: null,
    ipi: null,
    iss: null,
    pis: null,
    cofins: null,
    simplesNacional: null,
    cbs: null,
    ibs: null,
    ibsEstadual: null,
    total: 0,
  };
}

export function mapRepositoryRowToProposal(row: ProposalRepositoryRow, items: ProposalItem[] = []): Proposal {
  const total = asNumber(row.total_value ?? row.valor_total);
  return {
    id: asString(row.id),
    number: asString(row.number ?? row.numero),
    title: asString(row.title),
    source: row.nomus_id || row.nomus_proposal_id ? "nomus" : "local",
    nomusId: asString(row.nomus_id ?? row.nomus_proposal_id),
    status: asString(row.status),
    customer: null,
    paymentCondition: null,
    items,
    taxSummary: emptyTaxSummary(),
    commissionSummary: null,
    financialSummary: null,
    total,
    discountTotal: asNumber(row.discount_total),
    issuedAt: asString(row.created_at),
    expiresAt: asString(row.valid_until),
    observations: asString(row.notes),
    raw: row,
  };
}
