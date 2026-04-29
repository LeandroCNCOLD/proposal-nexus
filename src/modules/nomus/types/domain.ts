export type ProposalSource = "local" | "nomus" | "manual";

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
  raw?: unknown;
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
  unitValueWithUnit?: string | null;
  discount: number | null;
  total: number | null;
  totalWithDiscount: number | null;
  deliveryDays?: number | null;
  status?: string | null;
  raw?: unknown;
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
  installments: PaymentConditionInstallment[];
  raw?: unknown;
}

export interface TaxSummary {
  icms: number | null;
  icmsSt: number | null;
  ipi: number | null;
  iss: number | null;
  pis: number | null;
  cofins: number | null;
  simplesNacional: number | null;
  cbs: number | null;
  ibs: number | null;
  ibsEstadual: number | null;
  total: number;
  raw?: unknown;
}

export interface Proposal {
  id: string | null;
  number: string | null;
  title?: string | null;
  source?: ProposalSource;
  nomusId?: string | null;
  status: string | null;
  customer: Customer | null;
  paymentCondition: PaymentCondition | null;
  items: ProposalItem[];
  taxSummary: TaxSummary;
  total: number | null;
  productsTotal?: number | null;
  discountTotal?: number | null;
  totalWithDiscount?: number | null;
  netValue?: number | null;
  issuedAt?: string | null;
  openedAt?: string | null;
  expiresAt?: string | null;
  observations?: string | null;
  raw?: unknown;
}
