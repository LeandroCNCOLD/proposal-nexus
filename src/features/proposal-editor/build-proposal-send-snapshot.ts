import type { ProposalTable } from "./proposal-tables.types";
import type {
  ProposalSendSnapshot,
  ProposalTemplateSnapshot,
  ProposalDocumentSnapshot,
} from "./proposal-send-snapshot.types";

export function buildTemplateSnapshot(template: any): ProposalTemplateSnapshot {
  return {
    template_id: template?.id ?? null,
    template_version: template?.version ?? template?.current_version ?? null,
    name: template?.name ?? null,
    colors: template?.colors ?? {},
    styles: template?.styles ?? {},
    pages_config: template?.pages_config ?? [],
    assets: template?.assets ?? {},
  };
}

export function buildDocumentSnapshot(document: any): ProposalDocumentSnapshot {
  return {
    document_id: document?.id,
    proposal_id: document?.proposal_id,
    template_id: document?.template_id ?? null,
    pages: document?.pages ?? [],
    cover_data: document?.cover_data ?? null,
    context_data: document?.context_data ?? null,
    solution_data: document?.solution_data ?? null,
    scope_items: document?.scope_items ?? [],
    warranty_text: document?.warranty_text ?? null,
    custom_blocks: document?.custom_blocks ?? {},
    attached_pdf_paths: document?.attached_pdf_paths ?? [],
    updated_at: document?.updated_at ?? null,
  };
}

export function buildProposalSendSnapshot(params: {
  proposal: any;
  template: any;
  document: any;
  tables: ProposalTable[];
}): ProposalSendSnapshot {
  return {
    proposal_snapshot: {
      id: params.proposal?.id,
      number: params.proposal?.number ?? params.proposal?.proposal_number,
      title: params.proposal?.title,
      client_name: params.proposal?.client_name,
      customer_name: params.proposal?.customer_name,
      total_value: params.proposal?.total_value,
      status: params.proposal?.status,
      valid_until: params.proposal?.valid_until,
      payment_terms: params.proposal?.payment_terms,
      delivery_time: params.proposal?.delivery_time,
    },
    template_snapshot: buildTemplateSnapshot(params.template),
    document_snapshot: buildDocumentSnapshot(params.document),
    tables_snapshot: params.tables ?? [],
    generated_at: new Date().toISOString(),
  };
}
