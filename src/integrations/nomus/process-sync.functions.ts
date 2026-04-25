// Server functions de sincronização do módulo de Processos do Nomus.
// O endpoint /processos cobre vários fluxos de negócio (Funil de Vendas,
// OBRA, PROJETO, Antecipação...). O CRM da nossa app trabalha em cima
// dessa tabela espelho.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOne, listAll, listPage, nomusFetch } from "./client";
import { NOMUS_ENDPOINTS } from "./endpoints";

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
      if (!nomusId) return null;
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
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const errors: string[] = [];
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const slice = rows.slice(i, i + 100);
    const { error } = await supabaseAdmin.from("nomus_processes").upsert(slice, { onConflict: "nomus_id" });
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

const PROCESS_RECENT_BATCH_SIZE = 20;
const PROCESS_FORWARD_LOOKAHEAD = 40;
const PROCESS_RECENT_RECHECK = 20;
const PROCESS_RECENT_PAGE_SCAN = 20;
const PROCESS_MAX_CONSECUTIVE_MISSES = 8;

function processIdOf(raw: NomusProcessRaw): number {
  return Number(raw.id ?? 0) || 0;
}

async function syncNomusProcessRecord(
  rawSummary: NomusProcessRaw,
  options: { requireDetail?: boolean; triggeredBy?: string | null } = {},
): Promise<{ changed: boolean; id: number }> {
  const id = processIdOf(rawSummary);
  if (!id) return { changed: false, id: 0 };

  const detailRes = await getOne<NomusProcessRaw>(NOMUS_ENDPOINTS.processos, id, {
    entity: "processos",
    timeoutMs: options.requireDetail ? 4_000 : undefined,
    maxAttempts: options.requireDetail ? 1 : undefined,
    triggeredBy: options.triggeredBy ?? null,
  });
  if (!detailRes.ok && options.requireDetail) return { changed: false, id };

  const raw = detailRes.ok ? detailRes.data : rawSummary;
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

export async function syncNomusProcessesNewestFirst(options: { tipos?: string[]; triggeredBy?: string | null } = {}) {
  const wantedTipos = (options.tipos ?? []).map((t) => t.trim()).filter(Boolean);
  const now = new Date().toISOString();

  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity: "processos",
    running: true,
    last_error: null,
    updated_at: now,
  });

  const { data: stateRow } = await supabaseAdmin
    .from("nomus_sync_state")
    .select("total_synced")
    .eq("entity", "processos")
    .maybeSingle();
  const previousTotal = (stateRow as { total_synced?: number | null } | null)?.total_synced ?? 0;

  const { data: knownRows } = await supabaseAdmin.from("nomus_processes").select("nomus_id").limit(10000);
  const maxKnownId = ((knownRows as Array<{ nomus_id?: string | null }> | null) ?? []).reduce((max, row) => {
    const id = Number(row.nomus_id ?? 0) || 0;
    return id > max ? id : max;
  }, 0);

  let count = 0;
  let newestSeenId = maxKnownId;
  let runError: string | null = null;

  const wants = (raw: NomusProcessRaw) => wantedTipos.length === 0 || wantedTipos.includes((raw.tipo ?? "").trim());

  try {
    const firstPage = await listPage<NomusProcessRaw>(NOMUS_ENDPOINTS.processos, {}, {
      entity: "processos",
      page: 1,
      pageSize: 50,
      triggeredBy: options.triggeredBy ?? null,
    });
    if (firstPage.ok) {
      for (const summary of firstPage.items.slice(0, PROCESS_RECENT_PAGE_SCAN)) {
        if (count >= PROCESS_RECENT_BATCH_SIZE) break;
        if (!wants(summary)) continue;
        const result = await syncNomusProcessRecord(summary, { requireDetail: false, triggeredBy: options.triggeredBy });
        newestSeenId = Math.max(newestSeenId, result.id);
        if (result.changed) count += 1;
      }
    } else {
      console.error("[nomus-process-sync] erro listando página recente:", firstPage.error);
    }

    let misses = 0;
    for (let id = maxKnownId + 1; id <= maxKnownId + PROCESS_FORWARD_LOOKAHEAD; id += 1) {
      if (count >= PROCESS_RECENT_BATCH_SIZE || misses >= PROCESS_MAX_CONSECUTIVE_MISSES) break;
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
      if (count >= PROCESS_RECENT_BATCH_SIZE) break;
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
    const userId = context.userId;
    const wantedTipos = (data?.tipos ?? []).map((t) => t.trim()).filter(Boolean);
    // Default reduzido: 500 processos cabem com folga em ~30s.
    const maxItems = data?.maxItems ?? 500;

    const result = await listAll<NomusProcessRaw>(
      NOMUS_ENDPOINTS.processos,
      {},
      { entity: "processos", pageSize: 50, maxItems, triggeredBy: userId },
    );

    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }

    const items = wantedTipos.length
      ? result.items.filter((p) => wantedTipos.includes((p.tipo ?? "").trim()))
      : result.items;

    if (items.length === 0) {
      return { ok: true as const, total: 0, upserted: 0, stagesDiscovered: [] };
    }

    // 1) Resolve TODOS os clientes em UMA query (em vez de N queries sequenciais)
    const pessoaSet = new Set<string>();
    for (const raw of items) {
      const p = (raw.pessoa ?? "").trim();
      if (p) pessoaSet.add(p);
    }
    const pessoaList = Array.from(pessoaSet);
    const clienteIdByName = new Map<string, string>();
    if (pessoaList.length > 0) {
      // Quebra em batches de 200 para não estourar o limite de URL do .in()
      const BATCH = 200;
      for (let i = 0; i < pessoaList.length; i += BATCH) {
        const slice = pessoaList.slice(i, i + BATCH);
        const { data: clients } = await supabaseAdmin
          .from("clients")
          .select("id, name")
          .in("name", slice);
        for (const c of clients ?? []) {
          if (c.name) clienteIdByName.set(c.name.toLowerCase(), c.id);
        }
      }
    }

    const stagesByTipo = new Map<string, Set<string>>();
    const now = new Date().toISOString();

    // 2) Monta TODAS as linhas em memória
    const rows = items
      .map((raw) => {
        const nomusId = raw.id != null ? String(raw.id) : "";
        if (!nomusId) return null;

        const tipo = (raw.tipo ?? "").trim() || null;
        const etapa = (raw.etapa ?? "").trim() || null;

        if (tipo && etapa) {
          if (!stagesByTipo.has(tipo)) stagesByTipo.set(tipo, new Set());
          stagesByTipo.get(tipo)!.add(etapa);
        }

        const pessoa = raw.pessoa?.trim() ?? null;
        const clienteId = pessoa ? clienteIdByName.get(pessoa.toLowerCase()) ?? null : null;

        return {
          nomus_id: nomusId,
          nome: raw.nome?.trim() ?? null,
          pessoa,
          descricao: raw.descricao ?? null,
          tipo,
          etapa,
          prioridade: raw.prioridade?.trim() ?? null,
          equipe: raw.equipe?.trim() ?? null,
          origem: raw.origem?.trim() ?? null,
          responsavel: raw.responsavel?.trim() ?? null,
          reportador: raw.reportador?.trim() ?? null,
          data_criacao: parseBrDate(raw.dataCriacao),
          data_hora_programada: parseBrDateTime(raw.dataHoraProgramada),
          proximo_contato: parseBrDate(raw.proximoContato),
          cliente_id: clienteId,
          raw: raw as never,
          synced_at: now,
          local_dirty: false,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // 3) BULK upsert em batches (1 round-trip por batch em vez de 1 por linha)
    const errors: string[] = [];
    let upserted = 0;
    const UPSERT_BATCH = 100;
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const slice = rows.slice(i, i + UPSERT_BATCH);
      const { error } = await supabaseAdmin
        .from("nomus_processes")
        .upsert(slice, { onConflict: "nomus_id" });
      if (error) {
        errors.push(`batch ${i}-${i + slice.length}: ${error.message}`);
      } else {
        upserted += slice.length;
      }
    }

    // 4) Cache de etapas: registra cada (tipo, etapa) vista. Para etapas NOVAS,
    //    define display_order = MAX existente + 10 para que apareçam no final do funil
    //    automaticamente. Etapas já cadastradas mantêm a ordem/flags atuais (apenas
    //    atualizamos last_seen_at).
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

      const stageRows: Array<{
        tipo: string;
        etapa: string;
        last_seen_at: string;
        display_order?: number;
      }> = [];
      for (const [tipo, etapas] of stagesByTipo.entries()) {
        let nextOrder = (maxOrderByTipo.get(tipo) ?? 0) + 10;
        for (const etapa of etapas) {
          const key = `${tipo}|${etapa}`;
          if (known.has(key)) {
            stageRows.push({ tipo, etapa, last_seen_at: now });
          } else {
            stageRows.push({ tipo, etapa, last_seen_at: now, display_order: nextOrder });
            nextOrder += 10;
            known.add(key);
          }
        }
      }
      await supabaseAdmin
        .from("crm_funnel_stages")
        .upsert(stageRows, { onConflict: "tipo,etapa" });
    }

    // 5) Estado de sync
    await supabaseAdmin.from("nomus_sync_state").upsert(
      {
        entity: "processos",
        last_synced_at: now,
        total_synced: upserted,
        running: false,
        last_error: errors.length ? errors.slice(0, 5).join(" | ") : null,
        updated_at: now,
      },
      { onConflict: "entity" },
    );

    return {
      ok: true as const,
      total: items.length,
      upserted,
      stagesDiscovered: Array.from(stagesByTipo.entries()).map(([tipo, set]) => ({
        tipo,
        etapas: Array.from(set),
      })),
      errors: errors.length ? errors.slice(0, 10) : undefined,
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
    const userId = context.userId;
    const { data: job, error } = await (supabaseAdmin as any)
      .from("nomus_process_sync_jobs")
      .insert({
        requested_by: userId,
        status: "queued",
        tipos: (data?.tipos ?? []).map((t) => t.trim()).filter(Boolean),
        max_items: data?.maxItems ?? 5000,
        page_size: 10,
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
    const maxPages = data.maxPages ?? 1;
    const tipos: string[] = Array.isArray(job.tipos) ? job.tipos : [];

    try {
      for (let i = 0; i < maxPages && processed < Number(job.max_items); i += 1) {
        const page = await listPage<NomusProcessRaw>(
          NOMUS_ENDPOINTS.processos,
          {},
          { entity: "processos", pageSize: Number(job.page_size ?? 10), page: currentPage, triggeredBy: userId },
        );
        if (!page.ok) throw new Error(page.error);

        const wantedItems = tipos.length
          ? page.items.filter((p) => tipos.includes((p.tipo ?? "").trim()))
          : page.items;
        const persisted = await persistNomusProcessBatch(wantedItems, userId);
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
          return { ok: true as const, job: updated, done: true as const };
        }
      }

      const { data: updated } = await (supabaseAdmin as any)
        .from("nomus_process_sync_jobs")
        .update({ status: "running", current_page: currentPage, processed_items: processed, upserted_items: upserted, stages_discovered: stagesCount })
        .eq("id", job.id)
        .select("*")
        .single();
      return { ok: true as const, job: updated, done: false as const };
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

// ---------------- ping individual: garante que o PUT segue funcionando ----------------

export const pingProcessoPut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ nomusId: z.string().min(1).max(20) }))
  .handler(async ({ data, context }) => {
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
