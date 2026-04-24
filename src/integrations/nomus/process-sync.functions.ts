// Server functions de sincronização do módulo de Processos do Nomus.
// O endpoint /processos cobre vários fluxos de negócio (Funil de Vendas,
// OBRA, PROJETO, Antecipação...). O CRM da nossa app trabalha em cima
// dessa tabela espelho.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listAll, nomusFetch } from "./client";
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

/** Resolve o cliente local pelo nome (campo `pessoa` do Nomus). */
async function resolveClienteIdByName(pessoa: string | null): Promise<string | null> {
  if (!pessoa) return null;
  const trimmed = pessoa.trim();
  if (!trimmed) return null;
  const { data } = await supabaseAdmin
    .from("clients")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

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

// ---------------- pull ----------------

export const pullNomusProcesses = createServerFn({ method: "POST" })
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
    const wantedTipos = (data?.tipos ?? []).map((t) => t.trim()).filter(Boolean);
    const maxItems = data?.maxItems ?? 5_000;

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

    let upserted = 0;
    const stagesByTipo = new Map<string, Set<string>>();
    const errors: string[] = [];

    for (const raw of items) {
      const nomusId = raw.id != null ? String(raw.id) : "";
      if (!nomusId) continue;

      const tipo = (raw.tipo ?? "").trim() || null;
      const etapa = (raw.etapa ?? "").trim() || null;

      if (tipo && etapa) {
        if (!stagesByTipo.has(tipo)) stagesByTipo.set(tipo, new Set());
        stagesByTipo.get(tipo)!.add(etapa);
      }

      const clienteId = await resolveClienteIdByName(raw.pessoa ?? null);

      const row = {
        nomus_id: nomusId,
        nome: raw.nome?.trim() ?? null,
        pessoa: raw.pessoa?.trim() ?? null,
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
        // proposal_id é resolvido fora deste loop em fase posterior
        raw: raw as never,
        synced_at: new Date().toISOString(),
        local_dirty: false,
      };

      const { error } = await supabaseAdmin
        .from("nomus_processes")
        .upsert(row, { onConflict: "nomus_id" });

      if (error) {
        errors.push(`${nomusId}: ${error.message}`);
      } else {
        upserted += 1;
      }
    }

    // Atualiza cache de etapas descobertas por tipo
    const now = new Date().toISOString();
    for (const [tipo, etapas] of stagesByTipo.entries()) {
      for (const etapa of etapas) {
        await supabaseAdmin.from("crm_funnel_stages").upsert(
          { tipo, etapa, last_seen_at: now },
          { onConflict: "tipo,etapa" },
        );
      }
    }

    // Mantém entidade `processos` em nomus_sync_state
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
