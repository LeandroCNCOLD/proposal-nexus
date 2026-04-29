import type { ProposalStatus as SupabaseProposalStatus } from "@/lib/proposal";
import type { ProposalTemplate as EditorProposalTemplate } from "@/integrations/proposal-editor/template.types";

export type Money = number | null;

export type ProposalSource = "local" | "nomus" | "coldpro" | "manual";

export type ProposalStatus = SupabaseProposalStatus | string;

export interface Customer {
  id: string | null;
  nomusId?: string | null;
  name: string | null;
  tradeName?: string | null;
  document?: string | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PaymentConditionInstallment {
  label: string;
  percentage: number | null;
  value: number | null;
  dueInDays?: number | null;
  dueDate?: string | null;
}

export interface PaymentCondition {
  id: string | null;
  nomusId?: string | null;
  name: string | null;
  description?: string | null;
  daysToFirstPayment?: number | null;
  installments: PaymentConditionInstallment[];
}

export interface TaxSummary {
  icms: Money;
  icmsSt: Money;
  ipi: Money;
  iss: Money;
  pis: Money;
  cofins: Money;
  simplesNacional: Money;
  cbs: Money;
  ibs: Money;
  ibsEstadual: Money;
  total: number;
}

export interface CommissionSummary {
  representativeId?: string | null;
  representativeName?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  baseValue: number;
  rate: number | null;
  amount: number;
}

export interface FinancialSummary {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  commissionTotal: number;
  freightTotal: number;
  insuranceTotal: number;
  accessoryExpensesTotal: number;
  productionCostTotal: number;
  administrativeCostTotal: number;
  incidentCostTotal: number;
  grossProfit: number | null;
  netProfit: number | null;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  markupPct: number | null;
  total: number;
}

export interface ProposalItem {
  id: string | null;
  nomusItemId?: string | null;
  nomusProductId?: string | null;
  productCode?: string | null;
  description: string;
  additionalInfo?: string | null;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
  total: number | null;
  totalWithDiscount: number | null;
  deliveryDays?: number | null;
  status?: string | null;
}

export interface ApprovalStep {
  id: string;
  level: number;
  approverProfile: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  required: boolean;
}

export interface ApprovalWorkflow {
  required: boolean;
  requiredLevel: number;
  reasons: string[];
  steps: ApprovalStep[];
}

export interface ProposalVersion {
  id: string;
  proposalId: string;
  versionNumber: number;
  status?: string | null;
  filePath?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export type ProposalTemplate = EditorProposalTemplate;

export interface Proposal {
  id: string | null;
  number: string | null;
  title?: string | null;
  source: ProposalSource;
  nomusId?: string | null;
  status: ProposalStatus | null;
  customer: Customer | null;
  paymentCondition: PaymentCondition | null;
  items: ProposalItem[];
  taxSummary: TaxSummary;
  commissionSummary: CommissionSummary | null;
  financialSummary: FinancialSummary | null;
  approvalWorkflow?: ApprovalWorkflow | null;
  template?: ProposalTemplate | null;
  versions?: ProposalVersion[];
  issuedAt?: string | null;
  expiresAt?: string | null;
  total: number | null;
  discountTotal?: number | null;
  observations?: string | null;
  raw?: unknown;
}

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
}

export interface ProposalValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
