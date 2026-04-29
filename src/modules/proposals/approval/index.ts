import type { ApprovalStep, ApprovalWorkflow, Proposal } from "@/modules/proposals/types";
import { calculateNetMargin } from "@/modules/proposals/financial";

export interface ApprovalPolicy {
  minimumMarginPct: number;
  managerMarginPct: number;
  directorMarginPct: number;
  managerDiscountPct: number;
  directorDiscountPct: number;
  managerTotalValue: number;
  directorTotalValue: number;
  maxInstallmentsWithoutApproval: number;
}

export interface ApprovalInput {
  proposal: Proposal;
  approverProfile?: string | null;
  policy?: Partial<ApprovalPolicy>;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  minimumMarginPct: 18,
  managerMarginPct: 15,
  directorMarginPct: 10,
  managerDiscountPct: 5,
  directorDiscountPct: 12,
  managerTotalValue: 250_000,
  directorTotalValue: 750_000,
  maxInstallmentsWithoutApproval: 3,
};

function withPolicy(policy?: Partial<ApprovalPolicy>): ApprovalPolicy {
  return { ...DEFAULT_APPROVAL_POLICY, ...(policy ?? {}) };
}

function pct(discount: number, base: number): number {
  return base > 0 ? (discount / base) * 100 : 0;
}

function step(id: string, level: number, approverProfile: string, reason: string): ApprovalStep {
  return { id, level, approverProfile, reason, status: "pending", required: true };
}

export function checkMarginApproval(proposal: Proposal, policy: Partial<ApprovalPolicy> = {}): ApprovalStep | null {
  const p = withPolicy(policy);
  const netMargin = proposal.financialSummary?.netMarginPct
    ?? calculateNetMargin(proposal.financialSummary?.netProfit ?? null, proposal.total);
  if (netMargin === null) return null;
  if (netMargin < p.directorMarginPct) {
    return step("margin-director", 3, "director", `Margem líquida ${netMargin.toFixed(2)}% abaixo de ${p.directorMarginPct}%.`);
  }
  if (netMargin < p.managerMarginPct || netMargin < p.minimumMarginPct) {
    return step("margin-manager", 2, "manager", `Margem líquida ${netMargin.toFixed(2)}% abaixo da política de ${p.minimumMarginPct}%.`);
  }
  return null;
}

export function checkDiscountApproval(proposal: Proposal, policy: Partial<ApprovalPolicy> = {}): ApprovalStep | null {
  const p = withPolicy(policy);
  const discount = proposal.discountTotal ?? 0;
  const subtotal = proposal.items.reduce((sum, item) => sum + (item.total ?? item.totalWithDiscount ?? 0), 0);
  const discountPct = pct(discount, subtotal);
  if (discountPct >= p.directorDiscountPct) {
    return step("discount-director", 3, "director", `Desconto de ${discountPct.toFixed(2)}% exige diretoria.`);
  }
  if (discountPct >= p.managerDiscountPct) {
    return step("discount-manager", 2, "manager", `Desconto de ${discountPct.toFixed(2)}% exige gerência.`);
  }
  return null;
}

export function checkPaymentConditionApproval(proposal: Proposal, policy: Partial<ApprovalPolicy> = {}): ApprovalStep | null {
  const p = withPolicy(policy);
  const installments = proposal.paymentCondition?.installments ?? [];
  if (installments.length > p.maxInstallmentsWithoutApproval) {
    return step("payment-manager", 2, "manager", `Condição com ${installments.length} parcelas exige aprovação.`);
  }
  if (!proposal.paymentCondition?.name) {
    return step("payment-missing", 1, "commercial", "Condição de pagamento ausente.");
  }
  return null;
}

export function getRequiredApprovalLevel(proposal: Proposal, policy: Partial<ApprovalPolicy> = {}): number {
  const p = withPolicy(policy);
  const total = proposal.total ?? 0;
  const checks = [
    checkMarginApproval(proposal, p),
    checkDiscountApproval(proposal, p),
    checkPaymentConditionApproval(proposal, p),
  ].filter(Boolean) as ApprovalStep[];
  const valueLevel = total >= p.directorTotalValue ? 3 : total >= p.managerTotalValue ? 2 : 0;
  return Math.max(valueLevel, ...checks.map((item) => item.level), 0);
}

export function evaluateApprovalWorkflow(input: ApprovalInput): ApprovalWorkflow {
  const policy = withPolicy(input.policy);
  const steps = [
    checkMarginApproval(input.proposal, policy),
    checkDiscountApproval(input.proposal, policy),
    checkPaymentConditionApproval(input.proposal, policy),
  ].filter(Boolean) as ApprovalStep[];

  const total = input.proposal.total ?? 0;
  if (total >= policy.directorTotalValue) {
    steps.push(step("value-director", 3, "director", `Valor total acima de ${policy.directorTotalValue}.`));
  } else if (total >= policy.managerTotalValue) {
    steps.push(step("value-manager", 2, "manager", `Valor total acima de ${policy.managerTotalValue}.`));
  }

  const deduped = Array.from(new Map(steps.map((item) => [item.id, item])).values())
    .sort((a, b) => a.level - b.level);

  return {
    required: deduped.length > 0,
    requiredLevel: deduped.reduce((max, item) => Math.max(max, item.level), 0),
    reasons: deduped.map((item) => item.reason),
    steps: deduped,
  };
}
