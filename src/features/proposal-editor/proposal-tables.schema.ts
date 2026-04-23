import { z } from "zod";

export const proposalTableTypeSchema = z.enum([
  "caracteristicas",
  "equipamentos",
  "investimento",
  "impostos",
  "pagamento",
  "itens_inclusos",
  "itens_nao_inclusos",
  "dados_bancarios",
  "custom",
]);

export const proposalTableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  width: z.number().optional(),
  type: z.enum(["text", "number", "currency", "percentage", "multiline"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

export const proposalTableSettingsSchema = z.object({
  show_header: z.boolean().optional(),
  repeat_header: z.boolean().optional(),
  currency_columns: z.array(z.string()).optional(),
  sum_columns: z.array(z.string()).optional(),
  grand_total_label: z.string().optional(),
  show_grand_total: z.boolean().optional(),
  columns: z.array(proposalTableColumnSchema),
});

export const proposalTableRowSchema = z.record(z.string(), z.unknown());

export const proposalTableSchema = z.object({
  id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  page_id: z.string().nullable(),
  table_type: proposalTableTypeSchema,
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  rows: z.array(proposalTableRowSchema),
  settings: proposalTableSettingsSchema,
  sort_order: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable().optional(),
  updated_by: z.string().uuid().nullable().optional(),
});

export const upsertProposalTableInputSchema = z.object({
  id: z.string().uuid().optional(),
  proposal_id: z.string().uuid(),
  page_id: z.string().nullable().optional(),
  table_type: proposalTableTypeSchema,
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  rows: z.array(proposalTableRowSchema),
  settings: proposalTableSettingsSchema,
  sort_order: z.number().int().optional(),
});

export const listProposalTablesInputSchema = z.object({
  proposalId: z.string().uuid(),
  pageId: z.string().optional(),
});
