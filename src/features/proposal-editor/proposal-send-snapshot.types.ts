import type { ProposalTable } from "./proposal-tables.types";

export interface ProposalTemplateSnapshot {
  template_id: string | null;
  template_version: string | null;
  name: string | null;
  colors: Record<string, unknown>;
  styles: Record<string, unknown>;
  pages_config: unknown[];
  assets: Record<string, unknown>;
}

export interface ProposalDocumentSnapshot {
  document_id: string | undefined;
  proposal_id: string | undefined;
  template_id: string | null;
  pages: unknown[];
  cover_data: unknown;
  context_data: unknown;
  solution_data: unknown;
  scope_items: unknown[];
  warranty_text: unknown;
  custom_blocks: unknown;
  attached_pdf_paths: string[];
  updated_at: string | null;
}

export interface ProposalCoreSnapshot {
  id: string | undefined;
  number: string | number | undefined;
  title: string | undefined;
  client_name: string | undefined;
  customer_name: string | undefined;
  total_value: number | undefined;
  status: string | undefined;
  valid_until: string | undefined;
  payment_terms: string | undefined;
  delivery_time: string | undefined;
}

export interface ProposalSendSnapshot {
  proposal_snapshot: ProposalCoreSnapshot;
  template_snapshot: ProposalTemplateSnapshot;
  document_snapshot: ProposalDocumentSnapshot;
  tables_snapshot: ProposalTable[];
  generated_at: string;
}
