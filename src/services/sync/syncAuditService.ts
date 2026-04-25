import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Json = Record<string, unknown>;
export type SyncAction = "inserted" | "updated" | "skipped" | "duplicated" | "merged" | "error";
export type RowStatus = "success" | "skipped" | "error";

export async function startSyncRun(entityType: string, createdBy: string | null, totalReceived = 0) {
  const { data, error } = await supabaseAdmin
    .from("sync_runs")
    .insert({
      source_system: "nomus",
      entity_type: entityType,
      status: "running",
      total_received: totalReceived,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao iniciar auditoria de sincronização");
  return (data as { id: string }).id;
}

export async function logSyncRow(input: {
  syncRunId: string | null;
  entityType: string;
  externalId?: string | null;
  localId?: string | null;
  action: SyncAction;
  status: RowStatus;
  errorMessage?: string | null;
  rawPayload?: unknown;
}) {
  if (!input.syncRunId) return;
  await supabaseAdmin.from("sync_row_logs").insert({
    sync_run_id: input.syncRunId,
    entity_type: input.entityType,
    external_id: input.externalId ?? null,
    local_id: input.localId ?? null,
    action: input.action,
    status: input.status,
    error_message: input.errorMessage ?? null,
    raw_payload: input.rawPayload ? (input.rawPayload as Json) : null,
  });
}

export async function finishSyncRun(input: {
  syncRunId: string | null;
  status?: "success" | "partial_success" | "error";
  totalReceived?: number;
  totalInserted?: number;
  totalUpdated?: number;
  totalSkipped?: number;
  totalErrors?: number;
  errorMessage?: string | null;
}) {
  if (!input.syncRunId) return;
  const totalErrors = input.totalErrors ?? 0;
  const status = input.status ?? (totalErrors > 0 ? "partial_success" : "success");
  await supabaseAdmin
    .from("sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      total_received: input.totalReceived ?? 0,
      total_inserted: input.totalInserted ?? 0,
      total_updated: input.totalUpdated ?? 0,
      total_skipped: input.totalSkipped ?? 0,
      total_errors: totalErrors,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.syncRunId);
}
