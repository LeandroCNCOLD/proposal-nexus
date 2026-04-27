import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Json = Record<string, unknown>;
export type SyncAction = "inserted" | "updated" | "skipped" | "skipped_no_change" | "quarantined" | "duplicated" | "merged" | "error";
export type RowStatus = "success" | "skipped" | "error";

export type SyncCheckpointStatus = "idle" | "running" | "completed" | "failed";

export async function startSyncRun(entityType: string, createdBy: string | null, totalReceived = 0, options: { dryRun?: boolean; lockKey?: string; parentSyncRunId?: string | null } = {}) {
  const { data, error } = await supabaseAdmin
    .from("sync_runs")
    .insert({
      source_system: "nomus",
      entity_type: entityType,
      status: "running",
      total_received: totalReceived,
      created_by: createdBy,
      dry_run: options.dryRun ?? false,
      lock_key: options.lockKey ?? null,
      parent_sync_run_id: options.parentSyncRunId ?? null,
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
    errorCode?: string | null;
    previousHash?: string | null;
    newHash?: string | null;
}) {
  if (!input.syncRunId) return;
  const payload = {
    sync_run_id: input.syncRunId,
    entity_type: input.entityType,
    external_id: input.externalId ?? null,
    local_id: input.localId ?? null,
    action: input.action,
    status: input.status,
    error_message: input.errorMessage ?? null,
    raw_payload: input.rawPayload ? (input.rawPayload as Json) : null,
    error_code: input.errorCode ?? null,
    previous_hash: input.previousHash ?? null,
    new_hash: input.newHash ?? null,
  };
  await supabaseAdmin.from("sync_row_logs").insert(payload as never);
}

export async function acquireSyncLock(input: { entityType: string; syncRunId: string | null; userId: string | null; ttlMinutes?: number }) {
  const lockKey = `nomus:${input.entityType}`;
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 15) * 60_000).toISOString();
  const { error } = await supabaseAdmin.from("sync_locks").insert({
    lock_key: lockKey,
    source_system: "nomus",
    entity_type: input.entityType,
    sync_run_id: input.syncRunId,
    acquired_by: input.userId,
    expires_at: expiresAt,
  } as never);
  if (!error) return { ok: true as const, lockKey };
  const { data: stale } = await supabaseAdmin.from("sync_locks").select("expires_at").eq("lock_key", lockKey).maybeSingle();
  const isExpired = stale && new Date((stale as { expires_at: string }).expires_at).getTime() < Date.now();
  if (isExpired) {
    await supabaseAdmin.from("sync_locks").delete().eq("lock_key", lockKey);
    const retry = await supabaseAdmin.from("sync_locks").insert({
      lock_key: lockKey,
      source_system: "nomus",
      entity_type: input.entityType,
      sync_run_id: input.syncRunId,
      acquired_by: input.userId,
      expires_at: expiresAt,
    } as never);
    if (!retry.error) return { ok: true as const, lockKey };
  }
  return { ok: false as const, lockKey, error: "Sincronização já está em andamento para esta entidade." };
}

export async function releaseSyncLock(lockKey: string | null) {
  if (!lockKey) return;
  await supabaseAdmin.from("sync_locks").delete().eq("lock_key", lockKey);
}

export async function quarantineSyncRow(input: { syncRunId: string | null; entityType: string; externalId?: string | null; errorCode: string; reason: string; rawPayload?: unknown; normalizedPayload?: unknown }) {
  await supabaseAdmin.from("sync_quarantine").insert({
    sync_run_id: input.syncRunId,
    source_system: "nomus",
    entity_type: input.entityType,
    external_id: input.externalId ?? null,
    error_code: input.errorCode,
    reason: input.reason,
    raw_payload: input.rawPayload ? (input.rawPayload as Json) : null,
    normalized_payload: input.normalizedPayload ? (input.normalizedPayload as Json) : null,
  } as never);
  await logSyncRow({ syncRunId: input.syncRunId, entityType: input.entityType, externalId: input.externalId, action: "quarantined", status: "error", errorCode: input.errorCode, errorMessage: input.reason, rawPayload: input.rawPayload });
}

export async function logFieldChanges(input: { syncRunId: string | null; entityType: string; localId?: string | null; externalId?: string | null; previous: Record<string, unknown> | null; next: Record<string, unknown>; origin?: string }) {
  if (!input.syncRunId || !input.previous) return;
  const rows = Object.entries(input.next)
    .filter(([field, value]) => JSON.stringify(input.previous?.[field] ?? null) !== JSON.stringify(value ?? null))
    .map(([field, value]) => ({
      sync_run_id: input.syncRunId,
      source_system: "nomus",
      entity_type: input.entityType,
      local_id: input.localId ?? null,
      external_id: input.externalId ?? null,
      field_name: field,
      previous_value: (input.previous?.[field] === undefined ? null : input.previous?.[field]) as never,
      new_value: (value === undefined ? null : value) as never,
      origin: input.origin ?? "nomus",
    }));
  if (rows.length > 0) await supabaseAdmin.from("sync_field_changes").insert(rows as never);
}

export async function finishSyncRun(input: {
  syncRunId: string | null;
  status?: "success" | "partial_success" | "error";
  totalReceived?: number;
  totalInserted?: number;
  totalUpdated?: number;
  totalSkipped?: number;
  totalErrors?: number;
  totalQuarantined?: number;
  totalNoChange?: number;
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
      total_quarantined: input.totalQuarantined ?? 0,
      total_no_change: input.totalNoChange ?? 0,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.syncRunId);
}

export async function upsertSyncCheckpoint(input: {
  entityType: string;
  syncRunId?: string | null;
  lastPage?: number | null;
  lastExternalId?: string | null;
  lastUpdatedAt?: string | null;
  status: SyncCheckpointStatus;
  cursorPayload?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  await supabaseAdmin.from("sync_checkpoints").upsert({
    source_system: "nomus",
    entity_type: input.entityType,
    sync_run_id: input.syncRunId ?? null,
    last_page: input.lastPage ?? 1,
    last_external_id: input.lastExternalId ?? null,
    last_updated_at: input.lastUpdatedAt ?? null,
    status: input.status,
    cursor_payload: (input.cursorPayload ?? {}) as Json,
    error_message: input.errorMessage ?? null,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: "source_system,entity_type" });
}

export async function getSyncCheckpoint(entityType: string) {
  const { data } = await supabaseAdmin
    .from("sync_checkpoints")
    .select("last_page,last_external_id,last_updated_at,status,cursor_payload")
    .eq("source_system", "nomus")
    .eq("entity_type", entityType)
    .maybeSingle();
  return data as { last_page?: number | null; last_external_id?: string | null; last_updated_at?: string | null; status?: string | null; cursor_payload?: Json | null } | null;
}

export async function recordPendingIssue(input: {
  syncRunId?: string | null;
  entityType: string;
  issueType: string;
  title: string;
  severity?: "info" | "warning" | "error";
  externalId?: string | null;
  localId?: string | null;
  details?: string | null;
  payload?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("sync_pending_issues").insert({
    source_system: "nomus",
    entity_type: input.entityType,
    issue_type: input.issueType,
    severity: input.severity ?? "warning",
    external_id: input.externalId ?? null,
    local_id: input.localId ?? null,
    sync_run_id: input.syncRunId ?? null,
    title: input.title,
    details: input.details ?? null,
    payload: (input.payload ?? {}) as Json,
    status: "open",
  } as never);
}

export async function writeSyncQualityReport(input: {
  syncRunId?: string | null;
  entityType?: string;
  metrics: Record<string, unknown>;
}) {
  await supabaseAdmin.from("sync_quality_reports").insert({
    sync_run_id: input.syncRunId ?? null,
    source_system: "nomus",
    entity_type: input.entityType ?? "global",
    metrics: input.metrics as Json,
  } as never);
}
