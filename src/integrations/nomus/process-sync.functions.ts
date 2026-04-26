// Server functions de sincronização do módulo de Processos do Nomus.
// O endpoint /processos cobre vários fluxos de negócio (Funil de Vendas,
// OBRA, PROJETO, Antecipação...). O CRM da nossa app trabalha em cima
// dessa tabela espelho.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- helpers ----------------

/** Converte "23/04/2026" ou "23/04/26" em ISO date string ou null. */
function parseBrDate(input: unknown): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // 23/04/2026 ou 23/04/26
  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const [, dd, mm, yyRaw] = m;
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    return `${yy}-${mm}-${dd}`;
  }
  // ISO direto
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return null;
}

/** Converte "01/06/26 00:00" em timestamptz ou null. */
function parseBrDateTime(input: unknown): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyRaw, hh = "00", mi = "00"] = m;
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    return `${yy}-${mm}-${dd}T${hh}:${mi}:00-03:00`;
  }
  return null;
}

// (resolveClienteIdByName removido — agora resolvido em batch dentro do handler)

type NomusProcessRaw = {
  id?: number | string;
  nome?: string;
  pessoa?: string;
  descricao?: string;
  tipo?: string;
  etapa?: string;
  prioridade?: string;
  idPrioridade?: number | string;
  equipe?: string;
  origem?: string;
  responsavel?: string;
  reportador?: string;
  dataCriacao?: string;
  dataHoraProgramada?: string;
  proximoContato?: string;
  [k: string]: unknown;
};

async function persistNomusProcessBatch(items: NomusProcessRaw[], userId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (items.length === 0) {
    return { total: 0, upserted: 0, stagesDiscovered: [] as Array<{ tipo: string; etapas: string[] }>, errors: [] as string[] };
  }

  const pessoaSet = new Set<string>();
  for (const raw of items) {
    const p = (raw.pessoa ?? "").trim();
    if (p) pessoaSet.add(p);
  }

  const clienteIdByName = new Map<string, string>();
  const pessoaList = Array.from(pessoaSet);
  for (let i = 0; i < pessoaList.length; i += 200) {
    const slice = pessoaList.slice(i, i + 200);
    const { data: clients } = await supabaseAdmin.from("clients").select("id, name").in("name", slice);
    for (const c of clients ?? []) if (c.name) clienteIdByName.set(c.name.toLowerCase(), c.id);
  }

  const stagesByTipo = new Map<string, Set<string>>();
  const now = new Date().toISOString();
  const rows = items
    .map((raw) => {
      const nomusId = raw.id != null ? String(raw.id) : "";
      if (!nomusId || nomusId.trim() === "0") return null;
      const tipo = (raw.tipo ?? "").trim() || null;
      const etapa = (raw.etapa ?? "").trim() || null;
      if (tipo && etapa) {
        if (!stagesByTipo.has(tipo)) stagesByTipo.set(tipo, new Set());
        stagesByTipo.get(tipo)!.add(etapa);
      }
      const pessoa = raw.pessoa?.trim() ?? null;
      return {
        nomus_id: nomusId,
        nome: raw.nome?.trim() ?? null,
        pessoa,
        descricao: raw.descricao ?? null,
        tipo,
        etapa,
        prioridade: raw.prioridade?.trim() ?? null,
        id_prioridade: raw.idPrioridade != null && Number(raw.idPrioridade) > 0 ? Number(raw.idPrioridade) : null,
        equipe: raw.equipe?.trim() ?? null,
        origem: raw.origem?.trim() ?? null,
        responsavel: raw.responsavel?.trim() ?? null,
        reportador: raw.reportador?.trim() ?? null,
        data_criacao: parseBrDate(raw.dataCriacao),
        data_hora_programada: parseBrDateTime(raw.dataHoraProgramada),
        proximo_contato: parseBrDate(raw.proximoContato),
        cliente_id: pessoa ? clienteIdByName.get(pessoa.toLowerCase()) ?? null : null,
        raw: raw as never,
        synced_at: now,
        local_dirty: false,
        last_pull_error: null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const errors: string[] = [];
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const slice = rows.slice(i, i + 100);
    const { error } = await (supabaseAdmin as any).from("nomus_processes").upsert(slice, { onConflict: "nomus_id" });
    if (error) errors.push(`batch ${i}-${i + slice.length}: ${error.message}`);
    else upserted += slice.length;
  }

  if (stagesByTipo.size > 0) {
    const tipos = Array.from(stagesByTipo.keys());
    const { data: existing } = await supabaseAdmin
      .from("crm_funnel_stages")
      .select("tipo, etapa, display_order")
      .in("tipo", tipos);
    const known = new Set<string>();
    const maxOrderByTipo = new Map<string, number>();
    for (const e of existing ?? []) {
      known.add(`${e.tipo}|${e.etapa}`);
      const cur = maxOrderByTipo.get(e.tipo) ?? 0;
      if ((e.display_order ?? 0) > cur) maxOrderByTipo.set(e.tipo, e.display_order ?? 0);
    }

    const stageRows: Array<{ tipo: string; etapa: string; last_seen_at: string; display_order?: number }> = [];
    for (const [tipo, etapas] of stagesByTipo.entries()) {
      let nextOrder = (maxOrderByTipo.get(tipo) ?? 0) + 10;
      for (const etapa of etapas) {
        const key = `${tipo}|${etapa}`;
        if (known.has(key)) stageRows.push({ tipo, etapa, last_seen_at: now });
        else {
          stageRows.push({ tipo, etapa, last_seen_at: now, display_order: nextOrder });
          nextOrder += 10;
          known.add(key);
        }
      }
    }
    await supabaseAdmin.from("crm_funnel_stages").upsert(stageRows, { onConflict: "tipo,etapa" });
  }

  return {
    total: items.length,
    upserted,
    stagesDiscovered: Array.from(stagesByTipo.entries()).map(([tipo, set]) => ({ tipo, etapas: Array.from(set) })),
    errors,
  };
}

async function persistChangedNomusProcessBatch(items: NomusProcessRaw[], userId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const byId = new Map<string, NomusProcessRaw>();
  for (const item of items) {
    const id = processIdOf(item);
    if (id) byId.set(String(id), item);
  }
  if (byId.size === 0) return persistNomusProcessBatch([], userId);

  const ids = Array.from(byId.keys());
  const { data: existing } = await supabaseAdmin
    .from("nomus_processes")
    .select("nomus_id, raw")
    .in("nomus_id", ids);
  const rawById = new Map<string, unknown>();
  for (const row of (existing as Array<{ nomus_id?: string | null; raw?: unknown }> | null) ?? []) {
    if (row.nomus_id) rawById.set(row.nomus_id, row.raw ?? null);
  }

  const changed = ids
    .map((id) => byId.get(id)!)
    .filter((raw) => JSON.stringify(rawById.get(String(processIdOf(raw))) ?? null) !== JSON.stringify(raw ?? null));

  return persistNomusProcessBatch(changed, userId);
}

const PROCESS_RECENT_LIST_PAGES = 4;
const PROCESS_FORWARD_LOOKAHEAD = 6;
const PROCESS_RECENT_RECHECK = 4;
const PROCESS_MAX_CONSECUTIVE_MISSES = 3;

function normalizeTipo(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tipoMatches(rawTipo: string | null | undefined, wantedTipos: string[]): boolean {
  if (wantedTipos.length === 0) return true;
  const actual = normalizeTipo(rawTipo);
  if (!actual) return false;
  return wantedTipos.some((wanted) => {
    const target = normalizeTipo(wanted);
    if (!target) return false;
    if (actual === target) return true;
    const targetWords = target.split(" ").filter(Boolean);
    return targetWords.length > 0 && targetWords.every((word) => actual.includes(word));
  });
}

function processIdOf(raw: NomusProcessRaw): number {
  return Number(raw.id ?? 0) || 0;
}

async function syncNomusProcessRecord(
  rawSummary: NomusProcessRaw,
  options: { requireDetail?: boolean; triggeredBy?: string | null } = {},
): Promise<{ changed: boolean; id: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getOne } = await import("./client");
  const { NOMUS_ENDPOINTS } = await import("./endpoints");
  const id = processIdOf(rawSummary);
  if (!id) return { changed: false, id: 0 };

  let raw = rawSummary;
  if (options.requireDetail) {
    const detailRes = await getOne<NomusProcessRaw>(NOMUS_ENDPOINTS.processos, id, {
      entity: "processos",
      timeoutMs: 4_000,
      maxAttempts: 1,
      triggeredBy: options.triggeredBy ?? null,
    });
    if (!detailRes.ok) return { changed: false, id };
    raw = detailRes.data;
  }
  const { data: current } = await supabaseAdmin
    .from("nomus_processes")
    .select("raw")
    .eq("nomus_id", String(id))
    .maybeSingle();

  if (current && JSON.stringify((current as { raw?: unknown }).raw ?? null) === JSON.stringify(raw ?? null)) {
    return { changed: false, id };
  }

  const persisted = await persistNomusProcessBatch([raw], options.triggeredBy ?? null);
  return { changed: persisted.upserted > 0, id };
}

export async function syncNomusProcessesNewestFirst(options: { tipos?: string[]; triggeredBy?: string | null; maxPages?: number } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { listPage } = await import("./client");
  const { NOMUS_ENDPOINTS } = await import("./endpoints");
  const wantedTipos = (options.tipos ?? []).map((t) => t.trim()).filter(Boolean);
  const now = new Date().toISOString();

  const { data: lockRow } = await supabaseAdmin
    .from("nomus_sync_state")
    .select("running, updated_at, total_synced")
    .eq("entity", "processos")
    .maybeSingle();
  const lock = lockRow as { running?: boolean | null; updated_at?: string | null; total_synced?: number | null } | null;
  const lockAgeMs = lock?.updated_at ? Date.now() - new Date(lock.updated_at).getTime() : Number.POSITIVE_INFINITY;
  if (lock?.running && lockAgeMs < 90_000) {
    return { ok: true, count: 0, done: false, skipped: true };
  }

  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity: "processos",
    running: true,
    last_error: null,
    updated_at: now,
  });

  const previousTotal = lock?.total_synced ?? 0;

  const { data: knownRows } = await supabaseAdmin.from("nomus_processes").select("nomus_id").limit(10000);
  const maxKnownId = ((knownRows as Array<{ nomus_id?: string | null }> | null) ?? []).reduce((max, row) => {
    const id = Number(row.nomus_id ?? 0) || 0;
    return id > max ? id : max;
  }, 0);

  let count = 0;
  let newestSeenId = maxKnownId;
  let runError: string | null = null;

  const wants = (raw: NomusProcessRaw) => tipoMatches(raw.tipo, wantedTipos);

  try {
    const recentListPages = options.maxPages ?? PROCESS_RECENT_LIST_PAGES;
    for (let page = 1; page <= recentListPages; page += 1) {
      const recentPage = await listPage<NomusProcessRaw>(NOMUS_ENDPOINTS.processos, {}, {
        entity: "processos",
        page,
        pageSize: 50,
        triggeredBy: options.triggeredBy ?? null,
      });
      if (!recentPage.ok) {
        console.error("[nomus-process-sync] erro listando página recente:", recentPage.error);
        break;
      }
      const wantedRecent = recentPage.items.filter(wants);
      for (const summary of wantedRecent) newestSeenId = Math.max(newestSeenId, processIdOf(summary));
      const persisted = await persistChangedNomusProcessBatch(wantedRecent, options.triggeredBy ?? null);
      count += persisted.upserted;
      if (!recentPage.hasMore || recentPage.items.length === 0) break;
    }

    let misses = 0;
    for (let id = maxKnownId + 1; id <= maxKnownId + PROCESS_FORWARD_LOOKAHEAD; id += 1) {
      if (misses >= PROCESS_MAX_CONSECUTIVE_MISSES) break;
      const result = await syncNomusProcessRecord({ id }, { requireDetail: true, triggeredBy: options.triggeredBy });
      if (result.changed) {
        newestSeenId = Math.max(newestSeenId, id);
        count += 1;
        misses = 0;
      } else {
        misses += 1;
      }
    }

    const recheckStart = Math.max(1, newestSeenId - PROCESS_RECENT_RECHECK + 1);
    for (let id = newestSeenId; id >= recheckStart; id -= 1) {
      const result = await syncNomusProcessRecord({ id }, { requireDetail: true, triggeredBy: options.triggeredBy });
      if (result.changed) count += 1;
    }
  } catch (e) {
    runError = e instanceof Error ? e.message : String(e);
    console.error("[nomus-process-sync] exceção:", e);
  } finally {
    const finishedAt = new Date().toISOString();
    await supabaseAdmin.from("nomus_sync_state").upsert({
      entity: "processos",
      last_synced_at: finishedAt,
      total_synced: previousTotal + count,
      last_cursor: newestSeenId > 0 ? `recentes:${newestSeenId}` : null,
      running: false,
      last_error: runError,
      updated_at: finishedAt,
    });
  }

  return { ok: !runError, count, done: true, error: runError ?? undefined };
}

async function syncNomusProcessesFullScan(options: { tipos?: string[]; triggeredBy?: string | null; maxPages?: number; maxItems?: number } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { listPage } = await import("./client");
  const { NOMUS_ENDPOINTS } = await import("./endpoints");
  const wantedTipos = (options.tipos ?? []).map((t) => t.trim()).filter(Boolean);
  const now = new Date().toISOString();
  const maxPages = options.maxPages ?? 50;
  const maxItems = options.maxItems ?? 5_000;
  const pageSize = 50;
  const deadlineAt = Date.now() + 25_000;

  const { data: lockRow } = await supabaseAdmin
    .from("nomus_sync_state")
    .select("running, updated_at, total_synced")
    .eq("entity", "processos")
    .maybeSingle();
  const lock = lockRow as { running?: boolean | null; updated_at?: string | null; total_synced?: number | null } | null;
  const lockAgeMs = lock?.updated_at ? Date.now() - new Date(lock.updated_at).getTime() : Number.POSITIVE_INFINITY;
  if (lock?.running && lockAgeMs < 60_000) {
    return { ok: true, count: 0, processed: 0, done: false, skipped: true };
  }

  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity: "processos",
    running: true,
    last_error: null,
    updated_at: now,
  });

  let processed = 0;
  let upserted = 0;
  let lastPage = 0;
  let runError: string | null = null;

  try {
    for (let page = 1; page <= maxPages && processed < maxItems; page += 1) {
      if (Date.now() > deadlineAt) break;
      const res = await listPage<NomusProcessRaw>(NOMUS_ENDPOINTS.processos, {}, {
        entity: "processos",
        page,
        pageSize,
        timeoutMs: 4_000,
        triggeredBy: options.triggeredBy ?? null,
      });
      if (!res.ok) throw new Error(res.error);
      lastPage = page;
      if (res.items.length === 0) break;

      processed += res.items.length;
      const wantedItems = res.items.filter((p) => tipoMatches(p.tipo, wantedTipos));
      const persisted = await persistNomusProcessBatch(wantedItems, options.triggeredBy ?? null);
      upserted += persisted.upserted;

      if (!res.hasMore || res.items.length < pageSize) break;
    }
  } catch (e) {
    runError = e instanceof Error ? e.message : String(e);
    console.error("[nomus-process-sync] full scan exception:", e);
  } finally {
    const finishedAt = new Date().toISOString();
    await supabaseAdmin.from("nomus_sync_state").upsert({
      entity: "processos",
      last_synced_at: finishedAt,
      total_synced: upserted,
      last_cursor: lastPage > 0 ? `pagina:${lastPage}` : null,
      running: false,
      last_error: runError,
      updated_at: finishedAt,
    });
  }

  return { ok: !runError, count: upserted, processed, done: true, error: runError ?? undefined };
}

// ---------------- pull ----------------

export const pullNomusProcesses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        tipos: z.array(z.string()).optional(),
        maxItems: z.number().int().min(1).max(50_000).optional(),
        /** Quantas páginas baixar por chamada. Permite "sync rápido" só das mais recentes. */
        maxPages: z.number().int().min(1).max(50).optional(),
      })
      .optional()
      .default({}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const tipos = (data?.tipos ?? []).map((t) => t.trim()).filter(Boolean);
    const { data: existingJob } = await (supabaseAdmin as any)
      .from("nomus_process_sync_jobs")
      .select("*")
      .eq("requested_by", userId)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const job = existingJob ?? (await (supabaseAdmin as any)
      .from("nomus_process_sync_jobs")
      .insert({
        requested_by: userId,
        status: "queued",
        tipos,
        max_items: data?.maxItems ?? 5_000,
        page_size: 50,
        current_page: 1,
      })
      .select("*")
      .single()).data;

    if (!job?.id) return { ok: false as const, error: "Não foi possível iniciar a sincronização do funil." };
    const batch = await processNomusProcessSyncBatch({ data: { jobId: job.id, maxPages: data?.maxPages ?? 3 } });
    if (!batch.ok) return { ok: false as const, error: "error" in batch ? batch.error : "Falha ao sincronizar processos" };
    return {
      ok: true as const,
      scanned: batch.scanned ?? 0,
      matched: batch.matched ?? 0,
      persisted: batch.persisted ?? 0,
      total: batch.matched ?? 0,
      upserted: batch.persisted ?? 0,
      cumulativeScanned: batch.job?.processed_items ?? 0,
      cumulativeUpserted: batch.job?.upserted_items ?? 0,
      done: batch.done,
      job: batch.job,
      warning: "warning" in batch ? batch.warning : undefined,
      stagesDiscovered: [],
    };
  });

export const startNomusProcessSyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        tipos: z.array(z.string()).optional(),
        maxItems: z.number().int().min(1).max(50_000).optional(),
      })
      .optional()
      .default({}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: job, error } = await (supabaseAdmin as any)
      .from("nomus_process_sync_jobs")
      .insert({
        requested_by: userId,
        status: "queued",
        tipos: (data?.tipos ?? []).map((t) => t.trim()).filter(Boolean),
        max_items: data?.maxItems ?? 5000,
        page_size: 50,
        current_page: 1,
      })
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, job };
  });

export const getNomusProcessSyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("nomus_process_sync_jobs" as any)
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!job) return { ok: false as const, error: "Job de sincronização não encontrado" };
    return { ok: true as const, job };
  });

export const processNomusProcessSyncBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: z.string().uuid(), maxPages: z.number().int().min(1).max(3).optional() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listPage } = await import("./client");
    const { NOMUS_ENDPOINTS } = await import("./endpoints");
    const userId = context.userId;
    const { data: job, error: jobErr } = await (supabaseAdmin as any)
      .from("nomus_process_sync_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jobErr) return { ok: false as const, error: jobErr.message };
    if (!job) return { ok: false as const, error: "Job de sincronização não encontrado" };
    if (job.requested_by !== userId) return { ok: false as const, error: "Sem permissão para processar esta sincronização" };
    if (!["queued", "running"].includes(job.status)) return { ok: true as const, job, done: true as const };

    const now = new Date().toISOString();
    await (supabaseAdmin as any)
      .from("nomus_process_sync_jobs")
      .update({ status: "running", started_at: job.started_at ?? now, last_error: null })
      .eq("id", job.id);

    let currentPage = Number(job.current_page ?? 1);
    let processed = Number(job.processed_items ?? 0);
    let upserted = Number(job.upserted_items ?? 0);
    let stagesCount = Number(job.stages_discovered ?? 0);
    let batchScanned = 0;
    let batchMatched = 0;
    let batchPersisted = 0;
    const maxPages = data.maxPages ?? 1;
    const tipos: string[] = Array.isArray(job.tipos) ? job.tipos : [];

    try {
      const failSoft = async (message: string) => {
        const finalStatus = batchScanned > 0 ? "running" : "failed";
        const { data: updated } = await (supabaseAdmin as any)
          .from("nomus_process_sync_jobs")
          .update({
            status: finalStatus,
            current_page: currentPage,
            processed_items: processed,
            upserted_items: upserted,
            stages_discovered: stagesCount,
            last_error: batchScanned > 0
              ? `${message}. Clique novamente para tentar continuar da página ${currentPage}.`
              : `${message}. Não houve progresso neste lote; uma nova sincronização pode tentar novamente pela página 1.`,
            finished_at: finalStatus === "failed" ? new Date().toISOString() : null,
          })
          .eq("id", job.id)
          .select("*")
          .single();
        return { ok: finalStatus !== "failed", job: updated, done: false as const, warning: message, scanned: batchScanned, matched: batchMatched, persisted: batchPersisted };
      };

      for (let i = 0; i < maxPages && processed < Number(job.max_items); i += 1) {
        if (Date.now() - new Date(now).getTime() > 18_000) return failSoft("Tempo seguro do lote atingido");
        const page = await listPage<NomusProcessRaw>(
          NOMUS_ENDPOINTS.processos,
          {},
          { entity: "processos", pageSize: Number(job.page_size ?? 50), page: currentPage, timeoutMs: 12_000, maxAttempts: 2, triggeredBy: userId },
        );
        if (!page.ok) {
          return failSoft(page.error);
        }

        const wantedItems = page.items.filter((p) => tipoMatches(p.tipo, tipos));
        const persisted = await persistNomusProcessBatch(wantedItems, userId);
        batchScanned += page.items.length;
        batchMatched += wantedItems.length;
        batchPersisted += persisted.upserted;
        processed += page.items.length;
        upserted += persisted.upserted;
        stagesCount += persisted.stagesDiscovered.reduce((sum, s) => sum + s.etapas.length, 0);
        currentPage += 1;

        if (!page.hasMore || page.items.length === 0 || processed >= Number(job.max_items)) {
          const finishedAt = new Date().toISOString();
          const { data: updated } = await (supabaseAdmin as any)
            .from("nomus_process_sync_jobs")
            .update({
              status: "completed",
              current_page: currentPage,
              processed_items: processed,
              upserted_items: upserted,
              stages_discovered: stagesCount,
              finished_at: finishedAt,
            })
            .eq("id", job.id)
            .select("*")
            .single();
          await supabaseAdmin.from("nomus_sync_state").upsert(
            { entity: "processos", last_synced_at: finishedAt, total_synced: upserted, running: false, last_error: null, updated_at: finishedAt },
            { onConflict: "entity" },
          );
          return { ok: true as const, job: updated, done: true as const, scanned: batchScanned, matched: batchMatched, persisted: batchPersisted };
        }
      }

      const { data: updated } = await (supabaseAdmin as any)
        .from("nomus_process_sync_jobs")
        .update({ status: "running", current_page: currentPage, processed_items: processed, upserted_items: upserted, stages_discovered: stagesCount })
        .eq("id", job.id)
        .select("*")
        .single();
      return { ok: true as const, job: updated, done: false as const, scanned: batchScanned, matched: batchMatched, persisted: batchPersisted };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const { data: updated } = await (supabaseAdmin as any)
        .from("nomus_process_sync_jobs")
        .update({ status: "failed", last_error: msg, finished_at: new Date().toISOString() })
        .eq("id", job.id)
        .select("*")
        .single();
      return { ok: false as const, error: msg, job: updated };
    }
  });

// ---------------- listar tipos disponíveis (para o seletor de funis) ----------------

export const listAvailableProcessTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("nomus_processes")
      .select("tipo")
      .not("tipo", "is", null);
    if (error) return { ok: false as const, error: error.message };
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const t = (row.tipo ?? "").trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const tipos = Array.from(counts.entries())
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count);
    return { ok: true as const, tipos };
  });

// ---------------- preferências de funil do usuário ----------------

export const getUserFunnels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data, error } = await context.supabase
      .from("crm_user_funnels")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, funnels: data ?? [] };
  });

export const setUserFunnels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      tipos: z
        .array(z.object({ tipo: z.string().min(1).max(120), display_order: z.number().int().min(0).max(50) }))
        .max(50),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    // Apaga e reinsere (lista pequena por usuário)
    const { error: delErr } = await context.supabase
      .from("crm_user_funnels")
      .delete()
      .eq("user_id", userId);
    if (delErr) return { ok: false as const, error: delErr.message };

    if (data.tipos.length === 0) return { ok: true as const };

    const rows = data.tipos.map((t) => ({
      user_id: userId,
      tipo: t.tipo,
      display_order: t.display_order,
      is_active: true,
    }));
    const { error: insErr } = await context.supabase.from("crm_user_funnels").insert(rows);
    if (insErr) return { ok: false as const, error: insErr.message };
    return { ok: true as const };
  });

// ---------------- criação/edição bidirecional Nomus ----------------

const processMutationSchema = z.object({
  process_id: z.string().uuid(),
  nome: z.string().min(1).max(255).optional(),
  etapa: z.string().min(1).max(120).optional(),
  tipo: z.string().min(1).max(120).optional(),
  prioridade: z.string().min(1).max(80).optional(),
  idPrioridade: z.number().int().positive().nullable().optional(),
  reportador: z.string().min(1).max(160).optional(),
  responsavel: z.string().min(1).max(160).optional(),
  equipe: z.string().min(1).max(160).optional(),
  dataHoraProgramada: z.string().min(1).max(40).nullable().optional(),
  origem: z.string().min(1).max(160).optional(),
});

const processCreateSchema = processMutationSchema.omit({ process_id: true }).extend({
  nome: z.string().min(1).max(255),
  tipo: z.string().min(1).max(120),
  etapa: z.string().min(1).max(120),
  responsavel: z.string().min(1).max(160),
  reportador: z.string().min(1).max(160),
});

function formatNomusDateTime(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)?(\d{2})?:?(\d{2})?/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]} ${iso[4] ?? "00"}:${iso[5] ?? "00"}`;
  return trimmed;
}

function cleanPayload(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function buildProcessPayload(row: Record<string, unknown>, patch: z.infer<typeof processMutationSchema> | z.infer<typeof processCreateSchema>) {
  const raw = (row.raw && typeof row.raw === "object" ? row.raw : {}) as Record<string, unknown>;
  const idPrioridade = "idPrioridade" in patch ? patch.idPrioridade : (row.id_prioridade as number | null | undefined);
  return cleanPayload({
    ...raw,
    id: row.nomus_id ? Number(row.nomus_id) : undefined,
    nome: patch.nome ?? row.nome ?? raw.nome,
    etapa: patch.etapa ?? row.etapa ?? raw.etapa,
    tipo: patch.tipo ?? row.tipo ?? raw.tipo,
    prioridade: patch.prioridade ?? row.prioridade ?? raw.prioridade,
    idPrioridade: idPrioridade ?? raw.idPrioridade,
    reportador: patch.reportador ?? row.reportador ?? raw.reportador,
    responsavel: patch.responsavel ?? row.responsavel ?? raw.responsavel,
    equipe: patch.equipe ?? row.equipe ?? raw.equipe,
    origem: patch.origem ?? row.origem ?? raw.origem,
    dataHoraProgramada: formatNomusDateTime(patch.dataHoraProgramada) ?? raw.dataHoraProgramada,
  });
}

export const updateNomusProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(processMutationSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { nomusFetch } = await import("./client");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("nomus_processes")
      .select("*")
      .eq("id", data.process_id)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!row?.nomus_id || row.nomus_id === "0") return { ok: false as const, error: "Processo sem ID válido do Nomus" };

    const payload = buildProcessPayload(row, data);
    const res = await nomusFetch<NomusProcessRaw>(`/processos/${encodeURIComponent(row.nomus_id)}`, {
      method: "PUT",
      body: payload,
      entity: "processos",
      operation: "update",
      direction: "push",
      triggeredBy: context.userId,
    });
    if (!res.ok) {
      await (supabaseAdmin as any).from("nomus_processes").update({ local_dirty: true, last_push_error: res.error }).eq("id", data.process_id);
      return { ok: false as const, error: res.error };
    }

    const newRaw = res.data && typeof res.data === "object" ? res.data : { ...((row.raw as object) ?? {}), ...payload };
    const updateRow = {
      nome: data.nome ?? row.nome,
      etapa: data.etapa ?? row.etapa,
      tipo: data.tipo ?? row.tipo,
      prioridade: data.prioridade ?? row.prioridade,
      id_prioridade: data.idPrioridade ?? row.id_prioridade ?? null,
      reportador: data.reportador ?? row.reportador,
      responsavel: data.responsavel ?? row.responsavel,
      equipe: data.equipe ?? row.equipe,
      origem: data.origem ?? row.origem,
      data_hora_programada: parseBrDateTime(data.dataHoraProgramada ?? undefined) ?? row.data_hora_programada,
      raw: newRaw as never,
      local_dirty: false,
      last_pushed_at: new Date().toISOString(),
      last_push_error: null,
      synced_at: new Date().toISOString(),
    };
    const { error: updErr } = await (supabaseAdmin as any).from("nomus_processes").update(updateRow).eq("id", data.process_id);
    if (updErr) return { ok: false as const, error: updErr.message };
    if (data.etapa && data.etapa !== row.etapa) {
      await supabaseAdmin.from("crm_stage_changes").insert({
        process_id: data.process_id,
        from_etapa: row.etapa ?? null,
        to_etapa: data.etapa,
        changed_by: context.userId,
      });
    }
    return {
      ok: true as const,
      process: {
        id: String(row.id),
        nomus_id: String(row.nomus_id),
        nome: updateRow.nome ?? null,
        etapa: updateRow.etapa ?? null,
        tipo: updateRow.tipo ?? null,
      },
    };
  });

export const createNomusProcess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(processCreateSchema)
  .handler(async ({ data, context }) => {
    const { nomusFetch } = await import("./client");
    const payload = buildProcessPayload({}, data);
    const res = await nomusFetch<NomusProcessRaw>("/processos", {
      method: "POST",
      body: payload,
      entity: "processos",
      operation: "create",
      direction: "push",
      triggeredBy: context.userId,
    });
    if (!res.ok) return { ok: false as const, error: res.error };
    const raw = res.data && typeof res.data === "object" ? res.data : (payload as NomusProcessRaw);
    const persisted = await persistNomusProcessBatch([raw], context.userId);
    const createdId = raw.id != null ? String(raw.id) : "";
    return persisted.errors.length
      ? { ok: false as const, error: persisted.errors.join("; ") }
      : { ok: true as const, process: { nomus_id: createdId, nome: raw.nome ?? null, etapa: raw.etapa ?? null, tipo: raw.tipo ?? null } };
  });

// ---------------- ping individual: garante que o PUT segue funcionando ----------------

export const pingProcessoPut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ nomusId: z.string().min(1).max(20) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { nomusFetch } = await import("./client");
    const userId = context.userId;
    // Busca etapa atual para fazer um PUT idempotente (não muda nada).
    const { data: row } = await supabaseAdmin
      .from("nomus_processes")
      .select("etapa")
      .eq("nomus_id", data.nomusId)
      .maybeSingle();
    if (!row?.etapa) return { ok: false as const, error: "Processo não encontrado localmente" };
    const res = await nomusFetch(`/processos/${encodeURIComponent(data.nomusId)}`, {
      method: "PUT",
      body: { id: Number(data.nomusId), etapa: row.etapa },
      entity: "processos",
      operation: "ping",
      direction: "test",
      triggeredBy: userId,
    });
    return res.ok
      ? { ok: true as const, status: res.status }
      : { ok: false as const, error: res.error, status: res.status };
  });
