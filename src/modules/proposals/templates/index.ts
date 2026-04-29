import type { Proposal, ProposalTemplate } from "@/modules/proposals/types";

export type TemplateVariableMap = Record<string, string | number | null | undefined>;

export interface TemplateVariableIssue {
  variable: string;
  message: string;
}

export function extractTemplateVariables(templateContent: string): string[] {
  const variables = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(templateContent)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables).sort();
}

export function validateTemplateVariables(
  requiredVariables: string[],
  values: TemplateVariableMap,
): { valid: boolean; missing: TemplateVariableIssue[] } {
  const missing = requiredVariables
    .filter((name) => values[name] === null || values[name] === undefined || values[name] === "")
    .map((variable) => ({ variable, message: `Variável obrigatória ausente: ${variable}` }));

  return { valid: missing.length === 0, missing };
}

export function fillProposalTemplate(templateContent: string, values: TemplateVariableMap): string {
  return templateContent.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function createTemplatePreviewData(
  proposal: Proposal,
  template?: ProposalTemplate | null,
): TemplateVariableMap {
  return {
    proposal_number: proposal.number,
    proposal_title: proposal.title,
    proposal_status: proposal.status,
    proposal_total: proposal.total,
    customer_name: proposal.customer?.name,
    customer_document: proposal.customer?.document,
    payment_condition: proposal.paymentCondition?.name,
    issued_at: proposal.issuedAt,
    expires_at: proposal.expiresAt,
    seller_name: proposal.commissionSummary?.sellerName,
    representative_name: proposal.commissionSummary?.representativeName,
    company_name: template?.empresa_nome,
    company_email: template?.empresa_email,
    company_phone: template?.empresa_telefone,
  };
}
