import {
  compareItemsTotalWithProposalTotal,
  calculateFinancialSummary,
} from "@/modules/proposals/financial";
import type {
  FinancialSummary,
  Proposal,
  ProposalValidationResult,
  ValidationIssue,
} from "@/modules/proposals/types";

export type ValidateProposalOptions = {
  minimumGrossMarginPct?: number;
  itemsTotalTolerance?: number;
};

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return { severity, code, message, path };
}

function hasPositiveMoney(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasAnyTaxValue(proposal: Proposal): boolean {
  const tax = proposal.taxSummary;
  return [
    tax.icms,
    tax.icmsSt,
    tax.ipi,
    tax.iss,
    tax.pis,
    tax.cofins,
    tax.simplesNacional,
    tax.cbs,
    tax.ibs,
    tax.ibsEstadual,
  ].some((value) => typeof value === "number" && Number.isFinite(value));
}

function resolveFinancialSummary(proposal: Proposal): FinancialSummary {
  return proposal.financialSummary ?? calculateFinancialSummary(proposal);
}

export function validateProposal(
  proposal: Proposal,
  options: ValidateProposalOptions = {},
): ProposalValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const minimumGrossMarginPct = options.minimumGrossMarginPct ?? 0;

  if (!proposal.customer?.name) {
    errors.push(issue("error", "missing_customer", "Cliente ausente.", "customer"));
  }

  if (!proposal.status) {
    errors.push(issue("error", "missing_status", "Proposta sem status.", "status"));
  }

  if ((proposal.total ?? 0) < 0) {
    errors.push(issue("error", "negative_total", "Proposta com total negativo.", "total"));
  }

  if (proposal.items.length === 0) {
    errors.push(issue("error", "missing_items", "Proposta sem itens.", "items"));
  }

  proposal.items.forEach((item, index) => {
    if (!item.description) {
      errors.push(
        issue(
          "error",
          "missing_item_description",
          "Item sem descrição.",
          `items.${index}.description`,
        ),
      );
    }
    if (
      !hasPositiveMoney(item.unitPrice) &&
      !hasPositiveMoney(item.total) &&
      !hasPositiveMoney(item.totalWithDiscount)
    ) {
      errors.push(issue("error", "missing_item_price", "Item sem preço.", `items.${index}`));
    }
  });

  if (!hasAnyTaxValue(proposal)) {
    warnings.push(issue("warning", "missing_taxes", "Impostos ausentes.", "taxSummary"));
  }

  if (!proposal.paymentCondition?.name && proposal.paymentCondition?.installments.length === 0) {
    warnings.push(
      issue(
        "warning",
        "incomplete_payment_condition",
        "Condição de pagamento incompleta.",
        "paymentCondition",
      ),
    );
  }

  if (!proposal.commissionSummary || proposal.commissionSummary.amount <= 0) {
    warnings.push(
      issue("warning", "missing_commission", "Comissão faltante.", "commissionSummary"),
    );
  }

  const comparison = compareItemsTotalWithProposalTotal(
    proposal.items,
    proposal.total,
    options.itemsTotalTolerance,
  );
  if (!comparison.matches) {
    warnings.push(
      issue(
        "warning",
        "items_total_divergence",
        `Divergência entre valor total e soma dos itens: diferença de ${comparison.difference.toFixed(2)}.`,
        "items",
      ),
    );
  }

  const financial = resolveFinancialSummary(proposal);
  if (financial.grossMarginPct !== null && financial.grossMarginPct < minimumGrossMarginPct) {
    warnings.push(
      issue(
        "warning",
        "gross_margin_below_minimum",
        `Margem abaixo do mínimo (${financial.grossMarginPct.toFixed(2)}% < ${minimumGrossMarginPct.toFixed(2)}%).`,
        "financialSummary.grossMarginPct",
      ),
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
