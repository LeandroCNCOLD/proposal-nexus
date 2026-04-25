// Nomus integration server functions (TanStack Start)
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nomusFetch, listAll, listPage, getOne, testNomusConnection } from "./client";
import {
  NOMUS_ENDPOINTS,
  proposalSubpath,
  proposalItemDetailPath,
  proposalItemDetailFallbackPaths,
} from "./endpoints";

type Json = Record<string, unknown>;

const pickStr = (o: Json, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
};
const pickNum = (o: Json, ...keys: string[]): number | null => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
};

const pickNestedStr = (o: Json, nestedKey: string, ...keys: string[]): string | null => {
  const nested = o[nestedKey];
  if (!nested || typeof nested !== "object") return null;
  return pickStr(nested as Json, ...keys);
};

async function setState(entity: string, patch: Record<string, unknown>) {
  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity,
    updated_at: new Date().toISOString(),
    ...patch,
  });
}

type SyncResult =
  | { ok: true; count: number; skipped: number; unmatched: number; done?: boolean; nextPage?: number | null }
  | { ok: false; error: string };

/**
 * Padrão único para todos os syncs por entidade:
 *  - marca running=true
 *  - puxa todos os itens via listAll
 *  - chama processItem por item (erros individuais não derrubam o sync)
 *  - persiste total_synced, last_error e last_synced_at em nomus_sync_state
 *  - nunca falha silenciosamente
 *
 * processItem retorna:
 *  - "ok"        → contado como sucesso
 *  - "skip"      → item ignorado por falta de chave/nome
 *  - "unmatched" → item válido mas sem correspondência local (ex.: produto sem equipment)
 */
async function runEntitySync(args: {
  entity: string;
  endpoint: string;
  triggeredBy: string | null;
  processItem: (raw: Json) => Promise<"ok" | "skip" | "unmatched">;
  /** Query extra para o listAll (ex.: dataModificacaoInicial p/ incremental). */
  query?: Record<string, string | number | undefined>;
  /** Página máxima de itens — passado adiante para listAll. */
  pageSize?: number;
}): Promise<SyncResult> {
  const { entity, endpoint, triggeredBy, processItem, query, pageSize } = args;
  await setState(entity, { running: true, last_error: null });
  try {
    const res = await listAll<Json>(endpoint, query ?? {}, { entity, triggeredBy, pageSize });
    if (!res.ok) {
      const error = res.error ?? "Falha ao listar entidade no Nomus";
      await setState(entity, { running: false, last_error: error });
      return { ok: false, error };
    }
    let count = 0;
    let skipped = 0;
    let unmatched = 0;
    const itemErrors: string[] = [];
    for (const raw of res.items) {
      try {
        const r = await processItem(raw);
        if (r === "ok") count += 1;
        else if (r === "unmatched") { unmatched += 1; skipped += 1; }
        else skipped += 1;
      } catch (e) {
        skipped += 1;
        const msg = e instanceof Error ? e.message : String(e);
        if (itemErrors.length < 3) itemErrors.push(msg);
      }
    }
    const noteParts: string[] = [];
    if (itemErrors.length > 0) noteParts.push(`${itemErrors.length}+ itens com erro: ${itemErrors.join(" | ")}`);
    if (unmatched > 0) noteParts.push(`${unmatched} item(s) sem correspondência local`);
    await setState(entity, {
      running: false,
      last_synced_at: new Date().toISOString(),
      total_synced: count,
      last_error: noteParts.length > 0 ? noteParts.join(" • ") : null,
    });
    return { ok: true, count, skipped, unmatched };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setState(entity, { running: false, last_error: msg });
    return { ok: false, error: msg };
  }
}

/**
 * Health check da integração Nomus.
 * Usa o endpoint central de clientes (NOMUS_HEALTHCHECK_ENTITY) como referência única
 * de conectividade. Retorna contrato padronizado { success, message } com campos extras
 * úteis para diagnóstico (endpoint, status HTTP, duração, baseUrl).
 */
export const nomusTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const result = await testNomusConnection(userId);
    if (result.success) {
      return {
        success: true as const,
        message: `Conexão com o Nomus realizada com sucesso via ${result.endpoint} (${result.durationMs}ms).`,
        ok: true as const,
        endpoint: result.endpoint,
        status: result.status,
        durationMs: result.durationMs,
        baseUrl: result.baseUrl,
        probes: result.probes,
      };
    }
    const reason = result.error ?? "Falha ao conectar ao Nomus";
    return {
      success: false as const,
      message: `Falha ao conectar ao Nomus (${result.status || "sem resposta"}): ${reason}`,
      ok: false as const,
      error: reason,
      status: result.status,
      endpoint: result.endpoint,
      durationMs: result.durationMs,
      probes: result.probes,
    };
  });

/** Pull clients from Nomus and upsert locally. */
export const nomusSyncClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const now = new Date().toISOString();
    await setState("clientes", { running: true, last_error: null });
    try {
      const { data: state } = await supabaseAdmin
        .from("nomus_sync_state")
        .select("last_cursor, total_synced")
        .eq("entity", "clientes")
        .maybeSingle();
      const page = Math.max(1, Number((state as { last_cursor?: string | null } | null)?.last_cursor ?? "1") || 1);
      const previousTotal = page === 1 ? 0 : Number((state as { total_synced?: number | null } | null)?.total_synced ?? 0) || 0;
      const res = await listPage<Json>(NOMUS_ENDPOINTS.clientes, {}, { entity: "clientes", page, pageSize: 50, triggeredBy: userId });
      if (!res.ok) {
        await setState("clientes", { running: false, last_error: res.error });
        return { ok: false as const, error: res.error };
      }

      let count = 0;
      let skipped = 0;
      for (const raw of res.items) {
        const nomus_id = pickStr(raw, "id", "codigo", "idCliente");
        const name = pickStr(raw, "nome", "razaoSocial", "nomeFantasia");
        if (!nomus_id || !name) {
          skipped += 1;
          continue;
        }
        const { error } = await supabaseAdmin
          .from("clients")
          .upsert(
            {
              nomus_id,
              name,
              document: pickStr(raw, "cnpj", "cpf", "documento"),
              trade_name: pickStr(raw, "nomeFantasia", "fantasia"),
              city: pickStr(raw, "cidade", "municipio"),
              state: pickStr(raw, "uf", "estado"),
              segment: pickStr(raw, "segmento", "ramo"),
              origin: "nomus",
              nomus_synced_at: new Date().toISOString(),
            },
            { onConflict: "nomus_id" }
          );
        if (error) throw new Error(error.message);
        count += 1;
      }

      const done = !res.hasMore || res.items.length === 0;
      const nextPage = done ? null : page + 1;
      await setState("clientes", {
        running: false,
        last_synced_at: now,
        total_synced: previousTotal + count,
        last_cursor: nextPage,
        last_error: null,
      });
      return { ok: true as const, count, skipped, unmatched: 0, done, nextPage };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await setState("clientes", { running: false, last_error: msg });
      return { ok: false as const, error: msg };
    }
  });

/** Pull products and map to equipments via nomus_id. NÃO cria equipments automaticamente. */
export const nomusSyncProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    return runEntitySync({
      entity: "produtos",
      endpoint: NOMUS_ENDPOINTS.produtos,
      triggeredBy: userId,
      processItem: async (raw) => {
        const nomus_id = pickStr(raw, "id", "codigo", "idProduto");
        const model = pickStr(raw, "codigo", "modelo", "descricao");
        if (!nomus_id || !model) return "skip";
        // 1) match por nomus_id já vinculado
        let { data: existing } = await supabaseAdmin
          .from("equipments").select("id").eq("nomus_id", nomus_id).maybeSingle();
        // 2) match por model exato
        if (!existing) {
          const r = await supabaseAdmin
            .from("equipments").select("id").eq("model", model).maybeSingle();
          existing = r.data;
        }
        // 3) match case-insensitive
        if (!existing) {
          const r = await supabaseAdmin
            .from("equipments").select("id").ilike("model", model).maybeSingle();
          existing = r.data;
        }
        if (!existing) return "unmatched";
        const { error } = await supabaseAdmin
          .from("equipments")
          .update({ nomus_id, nomus_synced_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        return "ok";
      },
    });
  });

/** Pull payment terms. */
export const nomusSyncPaymentTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    return runEntitySync({
      entity: "condicoes_pagamento",
      endpoint: NOMUS_ENDPOINTS.condicoes_pagamento,
      triggeredBy: userId,
      processItem: async (raw) => {
        const nomus_id = pickStr(raw, "id", "codigo");
        const name = pickStr(raw, "descricao", "nome");
        if (!nomus_id || !name) return "skip";
        const { error } = await supabaseAdmin.from("nomus_payment_terms").upsert(
          {
            nomus_id,
            code: pickStr(raw, "codigo"),
            name,
            installments: pickNum(raw, "parcelas", "numeroParcelas"),
            raw: raw as never,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nomus_id" }
        );
        if (error) throw new Error(error.message);
        return "ok";
      },
    });
  });

/** Push a proposal to Nomus. Creates if no nomus_id, updates otherwise. */
export const nomusPushProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { proposalId } = data;

    const { data: prop, error: pErr } = await supabaseAdmin
      .from("proposals")
      .select("*, clients(nomus_id, name), proposal_items(*)")
      .eq("id", proposalId)
      .single();
    if (pErr || !prop) return { ok: false as const, error: pErr?.message ?? "Proposta não encontrada" };

    const propAny = prop as unknown as {
      nomus_id: string | null;
      title: string;
      number: string;
      total_value: number | null;
      status: string;
      valid_until: string | null;
      clients: { nomus_id: string | null; name: string } | null;
      proposal_items: Array<{ description: string; quantity: number; unit_price: number; equipment_id: string | null }>;
    };

    const payload = {
      numero: propAny.number,
      titulo: propAny.title,
      valor: propAny.total_value,
      status: propAny.status,
      validade: propAny.valid_until,
      idCliente: propAny.clients?.nomus_id,
      itens: propAny.proposal_items.map((it) => ({
        descricao: it.description,
        quantidade: it.quantity,
        valorUnitario: it.unit_price,
      })),
    };

    const isUpdate = !!propAny.nomus_id;
    const path = isUpdate ? proposalSubpath(propAny.nomus_id!) : NOMUS_ENDPOINTS.propostas;
    const res = await nomusFetch<Json>(path, {
      method: isUpdate ? "PUT" : "POST",
      body: payload,
      entity: "propostas",
      operation: isUpdate ? "update" : "create",
      direction: "push",
      triggeredBy: userId,
    });
    if (!res.ok) return { ok: false as const, error: res.error };

    const returnedId = pickStr(res.data as Json, "id", "idProposta", "codigo") ?? propAny.nomus_id;
    await supabaseAdmin
      .from("proposals")
      .update({ nomus_id: returnedId, nomus_synced_at: new Date().toISOString() })
      .eq("id", proposalId);

    return { ok: true as const, nomus_id: returnedId };
  });

/** Push a follow-up event to Nomus. */
export const nomusPushFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string; description: string; nextStep?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { data: prop } = await supabaseAdmin
      .from("proposals")
      .select("nomus_id")
      .eq("id", data.proposalId)
      .single();
    const nomusId = (prop as { nomus_id: string | null } | null)?.nomus_id;
    if (!nomusId) return { ok: false as const, error: "Proposta ainda não está sincronizada com o Nomus." };

    const res = await nomusFetch(proposalSubpath(nomusId, "eventos"), {
      method: "POST",
      body: {
        descricao: data.description,
        proximaAcao: data.nextStep ?? null,
        data: new Date().toISOString(),
      },
      entity: "propostas",
      operation: "followup",
      direction: "push",
      triggeredBy: userId,
    });
    return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
  });

/* ============================================================
   NOVO MODELO: Nomus é fonte da proposta — funções de pull
   ============================================================ */

/** Pull vendedores. */
export const nomusSyncSellers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    return runEntitySync({
      entity: "vendedores",
      endpoint: NOMUS_ENDPOINTS.vendedores,
      triggeredBy: userId,
      processItem: async (raw) => {
        const nomus_id = pickStr(raw, "id", "codigo", "idVendedor");
        const name = pickStr(raw, "nome", "razaoSocial");
        if (!nomus_id || !name) return "skip";
        const { error } = await supabaseAdmin.from("nomus_sellers").upsert(
          {
            nomus_id, name,
            email: pickStr(raw, "email"),
            document: pickStr(raw, "cpf", "cnpj", "documento"),
            raw: raw as never,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nomus_id" }
        );
        if (error) throw new Error(error.message);
        return "ok";
      },
    });
  });
/** Pull representantes. */
export const nomusSyncRepresentatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    return runEntitySync({
      entity: "representantes",
      endpoint: NOMUS_ENDPOINTS.representantes,
      triggeredBy: userId,
      processItem: async (raw) => {
        const nomus_id = pickStr(raw, "id", "codigo");
        const name = pickStr(raw, "nome", "razaoSocial");
        if (!nomus_id || !name) return "skip";
        const { error } = await supabaseAdmin.from("nomus_representatives").upsert(
          {
            nomus_id, name,
            email: pickStr(raw, "email"),
            document: pickStr(raw, "cnpj", "cpf"),
            region: pickStr(raw, "regiao", "uf"),
            raw: raw as never,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nomus_id" }
        );
        if (error) throw new Error(error.message);
        return "ok";
      },
    });
  });
/**
 * Kick-off rápido: marca a entidade `propostas` como "running" e retorna
 * imediatamente. O trabalho pesado (paginação Nomus + upserts) é feito de
 * forma assíncrona pelo cron (`/hooks/nomus-cron`) — que dispara a cada
 * N minutos via pg_cron e também é chamado em background aqui.
 *
 * Por que não rodar tudo aqui? O Worker tem limite de tempo de execução
 * (~30s) e o pull completo de propostas estourava esse limite, devolvendo
 * 504 ao cliente. Agora o usuário recebe resposta em < 1s e acompanha o
 * progresso lendo `nomus_sync_state`.
 */
export const nomusKickoffSyncProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;

    const LOVABLE_PROJECT_ID = "917813d5-8e5a-4655-8778-64228cb3d23e";
    const stablePublishedOrigin = `https://project--${LOVABLE_PROJECT_ID}.lovable.app`;
    const stablePreviewOrigin = `https://project--${LOVABLE_PROJECT_ID}-dev.lovable.app`;
    const cronToken =
      process.env.NOMUS_CRON_SECRET?.trim()
      || process.env.SUPABASE_PUBLISHABLE_KEY?.trim()
      || process.env.SUPABASE_ANON_KEY?.trim()
      || "";

    let origin: string = process.env.PUBLIC_BASE_URL?.trim() || stablePublishedOrigin;
    try {
      const req = getRequest();
      const reqOrigin = new URL(req.url).origin;
      if (/localhost|127\.0\.0\.1/i.test(reqOrigin)) {
        origin = process.env.PUBLIC_BASE_URL?.trim() || stablePublishedOrigin;
      } else if (/preview|id-preview--|-dev\.lovable\.app/i.test(reqOrigin)) {
        origin = stablePreviewOrigin;
      } else if (/^https:\/\//.test(reqOrigin)) {
        origin = reqOrigin;
      }
    } catch { /* mantém origin */ }

    let kickoffOk = false;
    let kickoffError: string | null = null;
    try {
      const r = await fetch(`${origin}/hooks/nomus-cron`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entity: "propostas" }),
        signal: AbortSignal.timeout(3000),
      }).catch((e) => {
        console.error("[nomus] kickoff fetch failed", e);
        kickoffError = e instanceof Error ? e.message : String(e);
        return null;
      });

      if (r) {
        kickoffOk = r.ok;
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          kickoffError = `cron HTTP ${r.status}${body ? `: ${body.slice(0, 180)}` : ""}`;
          console.warn("[nomus] kickoff recusado", kickoffError);
        }
      }
    } catch (e) {
      console.error("[nomus] kickoff fetch threw", e);
      kickoffError = e instanceof Error ? e.message : String(e);
    }

    if (kickoffOk) {
      return {
        ok: true as const,
        queued: true as const,
        message: "Sincronização iniciada em segundo plano. Atualize a lista em alguns instantes.",
        triggered_by: userId,
      };
    }

    // Fallback inline: garante que o sync acontece mesmo se o cron HTTP não puder ser disparado.
    console.warn(`[nomus] kickoff falhou (${kickoffError ?? "sem detalhes"}), executando sync inline como fallback`);
    try {
      const { syncProposalsBatch } = await import("@/routes/hooks/nomus-cron");
      const result = await syncProposalsBatch();
      return {
        ok: true as const,
        queued: false as const,
        inline: true as const,
        message: result.done
          ? `Sincronização concluída: ${result.count ?? 0} propostas processadas.`
          : `Lote processado: ${result.count ?? 0} propostas. Clique em "Buscar do Nomus" novamente para continuar.`,
        count: result.count ?? 0,
        done: result.done ?? false,
        triggered_by: userId,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await setState("propostas", { running: false, last_error: `inline fallback falhou: ${msg}` });
      return {
        ok: false as const,
        queued: false as const,
        message: `Falha ao iniciar sincronização: ${msg}`,
        error: msg,
        triggered_by: userId,
      };
    }
  });

/** @deprecated Use `nomusKickoffSyncProposals`. Mantido para compatibilidade. */
export const nomusSyncProposalsFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { data: settings } = await supabaseAdmin
      .from("nomus_settings").select("auto_create_local_proposal").maybeSingle();
    const autoCreate = (settings as { auto_create_local_proposal?: boolean } | null)?.auto_create_local_proposal ?? true;

    // Cache em memória para evitar N lookups de clientes durante o sync
    const clientCache = new Map<string, string | null>();

    return runEntitySync({
      entity: "propostas",
      endpoint: NOMUS_ENDPOINTS.propostas,
      triggeredBy: userId,
      processItem: async (raw) => {
        const { mapNomusProposal, extractProposalItems } = await import("./parse");
        const mapped = mapNomusProposal(raw);
        if (!mapped) return "skip";
        const nomus_id = mapped.nomus_id;

        const upsertPayload = {
          nomus_id,
          numero: mapped.numero,
          cliente_nomus_id: mapped.cliente_nomus_id,
          vendedor_nomus_id: mapped.vendedor_nomus_id,
          representante_nomus_id: mapped.representante_nomus_id,
          valor_total: mapped.valor_total,
          status_nomus: mapped.status_nomus,
          validade: mapped.validade,
          data_emissao: mapped.data_emissao,
          observacoes: mapped.observacoes,
          raw: raw as never,
          synced_at: new Date().toISOString(),
        };
        const { data: mirror, error: mErr } = await supabaseAdmin
          .from("nomus_proposals")
          .upsert(upsertPayload, { onConflict: "nomus_id" })
          .select("id")
          .single();
        if (mErr || !mirror) throw new Error(mErr?.message ?? "Falha ao gravar nomus_proposals");
        const mirrorId = (mirror as { id: string }).id;

        // Itens da proposta (itensProposta)
        const items = extractProposalItems(raw);
        if (items.length > 0) {
          await supabaseAdmin.from("nomus_proposal_items").delete().eq("nomus_proposal_id", mirrorId);
          await supabaseAdmin.from("nomus_proposal_items").insert(
            items.map((it, idx) => ({
              nomus_proposal_id: mirrorId,
              nomus_item_id: it.nomus_item_id,
              nomus_product_id: it.nomus_product_id,
              product_code: it.product_code,
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
              discount: it.discount,
              total: it.total,
              position: idx,
              raw: it as never,
            }))
          );
        }

        // Espelha em proposals (cria ou atualiza)
        if (autoCreate) {
          let clientId: string | null = null;
          if (mapped.cliente_nomus_id) {
            const cached = clientCache.get(mapped.cliente_nomus_id);
            if (cached !== undefined) {
              clientId = cached;
            } else {
              const { data: c } = await supabaseAdmin
                .from("clients").select("id").eq("nomus_id", mapped.cliente_nomus_id).maybeSingle();
              clientId = (c as { id: string } | null)?.id ?? null;
              clientCache.set(mapped.cliente_nomus_id, clientId);
            }
          }
          const baseTitle = mapped.nome_cliente
            ? `${mapped.numero ?? nomus_id} — ${mapped.nome_cliente}`
            : mapped.numero ?? `Proposta Nomus ${nomus_id}`;

          const { data: existing } = await supabaseAdmin
            .from("proposals").select("id, client_id").eq("nomus_id", nomus_id).maybeSingle();
          if (!existing) {
            const { error } = await supabaseAdmin.from("proposals").insert({
              nomus_id,
              nomus_proposal_id: mirrorId,
              nomus_synced_at: new Date().toISOString(),
              source: "nomus",
              title: baseTitle,
              client_id: clientId,
              total_value: mapped.valor_total ?? 0,
              valid_until: mapped.validade,
              status: "em_elaboracao",
            });
            if (error) throw new Error(error.message);
          } else {
            const ex = existing as { id: string; client_id: string | null };
            const { error } = await supabaseAdmin.from("proposals")
              .update({
                nomus_proposal_id: mirrorId,
                title: baseTitle,
                total_value: mapped.valor_total ?? 0,
                valid_until: mapped.validade,
                ...(ex.client_id || !clientId ? {} : { client_id: clientId }),
                nomus_synced_at: new Date().toISOString(),
              })
              .eq("id", ex.id);
            if (error) throw new Error(error.message);
          }
        }
        return "ok";
      },
    });
  });
export const nomusSyncPedidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    return runEntitySync({
      entity: "pedidos",
      endpoint: NOMUS_ENDPOINTS.pedidos,
      triggeredBy: userId,
      processItem: async (raw) => {
        const nomus_id = pickStr(raw, "id", "idPedido", "numero");
        if (!nomus_id) return "skip";
        const { error } = await supabaseAdmin.from("nomus_pedidos").upsert(
          {
            nomus_id,
            numero: pickStr(raw, "numero"),
            proposal_nomus_id: pickStr(raw, "idProposta", "propostaId"),
            cliente_nomus_id: pickStr(raw, "idCliente", "clienteId"),
            vendedor_nomus_id: pickStr(raw, "idVendedor", "vendedorId"),
            valor_total: pickNum(raw, "valorTotal", "valor"),
            status_nomus: pickStr(raw, "status", "situacao"),
            data_emissao: pickStr(raw, "dataEmissao", "data"),
            data_entrega: pickStr(raw, "dataEntrega", "previsaoEntrega"),
            raw: raw as never,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nomus_id" }
        );
        if (error) throw new Error(error.message);
        return "ok";
      },
    });
  });
/** Pull notas fiscais. */
export const nomusSyncInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    return runEntitySync({
      entity: "notas_fiscais",
      endpoint: NOMUS_ENDPOINTS.notas_fiscais,
      triggeredBy: userId,
      processItem: async (raw) => {
        const nomus_id = pickStr(raw, "id", "idNota", "numero");
        if (!nomus_id) return "skip";
        const { error } = await supabaseAdmin.from("nomus_invoices").upsert(
          {
            nomus_id,
            numero: pickStr(raw, "numero"),
            serie: pickStr(raw, "serie"),
            chave_acesso: pickStr(raw, "chaveAcesso", "chave"),
            pedido_nomus_id: pickStr(raw, "idPedido", "pedidoId"),
            cliente_nomus_id: pickStr(raw, "idCliente", "clienteId"),
            valor_total: pickNum(raw, "valorTotal", "valor"),
            status_nomus: pickStr(raw, "status", "situacao"),
            data_emissao: pickStr(raw, "dataEmissao", "data"),
            raw: raw as never,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nomus_id" }
        );
        if (error) throw new Error(error.message);
        return "ok";
      },
    });
  });
export const nomusGetProposalRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { data: prop } = await supabaseAdmin
      .from("proposals").select("nomus_id").eq("id", data.proposalId).maybeSingle();
    const nomusId = (prop as { nomus_id: string | null } | null)?.nomus_id;
    if (!nomusId) return { ok: false as const, error: "Proposta não tem vínculo com o Nomus." };

    const res = await nomusFetch<Json>(proposalSubpath(nomusId), {
      method: "GET", entity: "propostas", operation: "refresh", direction: "pull", triggeredBy: userId,
    });
    if (!res.ok) return { ok: false as const, error: res.error };

    const raw = res.data;
    await supabaseAdmin.from("nomus_proposals").upsert(
      {
        nomus_id: nomusId,
        numero: pickStr(raw, "numero"),
        valor_total: pickNum(raw, "valorTotal", "valor"),
        status_nomus: pickStr(raw, "status", "situacao"),
        validade: pickStr(raw, "validade"),
        raw: raw as never,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "nomus_id" }
    );
    await supabaseAdmin.from("proposals").update({
      total_value: pickNum(raw, "valorTotal", "valor") ?? 0,
      valid_until: pickStr(raw, "validade"),
      nomus_synced_at: new Date().toISOString(),
    }).eq("id", data.proposalId);
    return { ok: true as const };
  });

/** Push status comercial para o Nomus. */
export const nomusPushProposalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { data: prop } = await supabaseAdmin
      .from("proposals").select("nomus_id").eq("id", data.proposalId).maybeSingle();
    const nomusId = (prop as { nomus_id: string | null } | null)?.nomus_id;
    if (!nomusId) return { ok: false as const, error: "Proposta sem vínculo Nomus." };
    const res = await nomusFetch(proposalSubpath(nomusId), {
      method: "PUT", body: { status: data.status },
      entity: "propostas", operation: "update_status", direction: "push", triggeredBy: userId,
    });
    return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
  });

/** Push evento de envio para o Nomus. */
export const nomusPushSendEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string; channel: string; recipient?: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { data: prop } = await supabaseAdmin
      .from("proposals").select("nomus_id").eq("id", data.proposalId).maybeSingle();
    const nomusId = (prop as { nomus_id: string | null } | null)?.nomus_id;
    if (!nomusId) return { ok: false as const, error: "Proposta sem vínculo Nomus." };
    const res = await nomusFetch(proposalSubpath(nomusId, "eventos"), {
      method: "POST",
      body: {
        descricao: `Proposta enviada via ${data.channel}${data.recipient ? ` para ${data.recipient}` : ""}`,
        tipo: "envio",
        data: new Date().toISOString(),
      },
      entity: "propostas", operation: "send_event", direction: "push", triggeredBy: userId,
    });
    return res.ok ? { ok: true as const } : { ok: false as const, error: res.error };
  });

// `generateProposalFile` (legado) substituído por `createProposalSendVersion`
// em `@/integrations/proposal-editor/server.functions` — Page Builder com blocos.

/**
 * Registra envio da proposta:
 * 1) Sempre grava `proposal_send_events`, atualiza `proposals.sent_at` e timeline local "enviada".
 * 2) Se a proposta tiver `nomus_id`, tenta também postar evento de envio no Nomus
 *    (POST /propostas/{id}/eventos). Esse passo é best-effort: falha NÃO derruba o envio local.
 * 3) Resultado do push externo é refletido em uma segunda entrada na timeline
 *    ("observacao") com sucesso/erro, para auditoria.
 */
export const sendProposalFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    proposalId: string; versionId: string; channel: string;
    recipient?: string; subject?: string; message?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;

    // 1) Envio local — sempre executa primeiro e é o "fato gerador"
    const { error: evErr } = await supabaseAdmin.from("proposal_send_events").insert({
      proposal_id: data.proposalId, version_id: data.versionId,
      channel: data.channel, recipient: data.recipient ?? null,
      subject: data.subject ?? null, message: data.message ?? null,
      sent_by: userId, delivery_status: "sent",
    });
    if (evErr) return { ok: false as const, error: `Falha ao registrar envio: ${evErr.message}` };

    await supabaseAdmin.from("proposals")
      .update({ sent_at: new Date().toISOString() }).eq("id", data.proposalId);

    const recipientSuffix = data.recipient ? ` para ${data.recipient}` : "";
    await supabaseAdmin.from("proposal_timeline_events").insert({
      proposal_id: data.proposalId, event_type: "enviada",
      description: `Enviada via ${data.channel}${recipientSuffix}`,
      user_id: userId,
    });

    // 2) Push best-effort para Nomus (somente se houver vínculo)
    const { data: prop } = await supabaseAdmin
      .from("proposals").select("nomus_id").eq("id", data.proposalId).maybeSingle();
    const nomusId = (prop as { nomus_id: string | null } | null)?.nomus_id ?? null;

    let nomusPush: { ok: true } | { ok: false; error: string } | { ok: false; skipped: true } =
      { ok: false, skipped: true };

    if (nomusId) {
      const res = await nomusFetch(proposalSubpath(nomusId, "eventos"), {
        method: "POST",
        body: {
          descricao: `Proposta enviada via ${data.channel}${recipientSuffix}`,
          tipo: "envio",
          data: new Date().toISOString(),
        },
        entity: "propostas", operation: "send_event", direction: "push", triggeredBy: userId,
      });
      if (res.ok) {
        nomusPush = { ok: true };
        await supabaseAdmin.from("proposal_timeline_events").insert({
          proposal_id: data.proposalId, event_type: "observacao",
          description: "Evento de envio replicado no Nomus",
          user_id: userId,
        });
      } else {
        const errMsg = res.error ?? `HTTP ${res.status ?? "?"}`;
        nomusPush = { ok: false, error: errMsg };
        await supabaseAdmin.from("proposal_timeline_events").insert({
          proposal_id: data.proposalId, event_type: "observacao",
          description: `Falha ao replicar envio no Nomus: ${errMsg}`,
          user_id: userId,
        });
      }
    }

    return { ok: true as const, nomus_push: nomusPush };
  });


/**
 * Cria Pedido de venda no Nomus a partir de uma proposta ganha.
 * - Não cria duplicado: se a proposta já tem nomus_pedido_id, retorna o existente.
 * - Exige vínculo com Nomus (proposals.nomus_id).
 * - Faz log via nomusFetch + grava nomus_pedido_id em proposals.
 */
export const nomusCreatePedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { data: prop, error: propErr } = await supabaseAdmin
      .from("proposals")
      .select("nomus_id, nomus_pedido_id, number, closed_value, total_value")
      .eq("id", data.proposalId)
      .single();
    if (propErr || !prop) {
      return { ok: false as const, error: propErr?.message ?? "Proposta não encontrada." };
    }
    const propAny = prop as {
      nomus_id: string | null;
      nomus_pedido_id: string | null;
      number: string;
      closed_value: number | null;
      total_value: number | null;
    };
    if (!propAny.nomus_id) {
      return { ok: false as const, error: "Proposta sem vínculo com o Nomus (nomus_id ausente)." };
    }
    // Idempotência: se já existe pedido vinculado, não recria
    if (propAny.nomus_pedido_id) {
      return {
        ok: true as const,
        pedido_id: propAny.nomus_pedido_id,
        already_existed: true as const,
      };
    }

    const res = await nomusFetch<Json>(NOMUS_ENDPOINTS.pedidos, {
      method: "POST",
      body: {
        idProposta: propAny.nomus_id,
        numeroProposta: propAny.number,
        valor: propAny.closed_value ?? propAny.total_value,
      },
      entity: "pedidos_venda",
      operation: "create",
      direction: "push",
      triggeredBy: userId,
    });
    if (!res.ok) {
      return {
        ok: false as const,
        error: res.error ?? `Falha ao criar pedido no Nomus (HTTP ${res.status ?? "?"}).`,
        status: res.status,
      };
    }
    const pedidoId = pickStr(res.data as Json, "id", "idPedido", "numero");
    if (!pedidoId) {
      return { ok: false as const, error: "Pedido criado mas o Nomus não retornou um ID válido." };
    }
    const { error: updErr } = await supabaseAdmin
      .from("proposals")
      .update({ nomus_pedido_id: pedidoId })
      .eq("id", data.proposalId);
    if (updErr) {
      return { ok: false as const, error: `Pedido criado (${pedidoId}) mas falhou ao gravar local: ${updErr.message}` };
    }
    return { ok: true as const, pedido_id: pedidoId, already_existed: false as const };
  });

/**
 * Busca SOB DEMANDA o detalhe completo de um item de proposta.
 *
 * Combina:
 *  - JSON original do item espelhado (`nomus_proposal_items.raw`)
 *  - JSON original da proposta (`nomus_proposals.raw`)
 *  - `GET /propostas/{idProposta}/itens/{idItem}` no Nomus — traz tributos
 *    discriminados (ICMS/IPI/PIS/COFINS/IBS/CBS), Análise de Lucro com
 *    23 campos, atributos do produto, centros de custo, frete/seguro/pesos
 *  - `GET /produtos/{id}` para enriquecer o cadastro do produto
 *  - Equipamento local mapeado e preços por tabela (já estão no Supabase)
 *
 * Persiste no banco o que conseguir (raw._detail, analise_lucro, impostos)
 * para que próximas aberturas saiam instantâneas.
 */
export const nomusGetItemDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;

    // 1) Carrega o item espelho (com raw original do Nomus)
    const { data: itemRow, error: itemErr } = await supabaseAdmin
      .from("nomus_proposal_items")
      .select("*, nomus_proposals(nomus_id, raw)")
      .eq("id", data.itemId)
      .maybeSingle();

    if (itemErr || !itemRow) {
      return { ok: false as const, error: itemErr?.message ?? "Item não encontrado." };
    }

    const item = itemRow as unknown as {
      id: string;
      nomus_item_id: string | null;
      nomus_product_id: string | null;
      product_code: string | null;
      raw: Json | null;
      nomus_proposals: { nomus_id: string; raw: Json | null } | null;
    };

    // 2) Detalhe COMPLETO do item no Nomus (sob demanda).
    // Tenta o caminho canônico e, se 404, percorre os fallbacks documentados.
    let itemDetail: Json | null = null;
    let itemDetailError: string | null = null;
    const propostaNomusId = item.nomus_proposals?.nomus_id ?? null;
    const itemNomusId = item.nomus_item_id ?? null;

    if (propostaNomusId && itemNomusId) {
      const candidatePaths: string[] = [
        proposalItemDetailPath(propostaNomusId, itemNomusId),
        ...proposalItemDetailFallbackPaths(itemNomusId),
      ];
      for (const path of candidatePaths) {
        const res = await nomusFetch<Json>(path, {
          method: "GET",
          entity: "propostas",
          operation: "get_item_detail",
          direction: "pull",
          triggeredBy: userId,
        });
        if (res.ok) {
          itemDetail = res.data;
          itemDetailError = null;
          break;
        }
        // se for 404, tenta o próximo; se for outro erro, mantém a mensagem
        itemDetailError = res.error;
        const status = (res as { status?: number }).status;
        if (status && status !== 404) break;
      }
    } else {
      itemDetailError = "IDs de proposta/item ausentes — não é possível buscar detalhe completo no Nomus.";
    }

    // 2b) Persiste o detalhe no item para acelerar próximas aberturas
    if (itemDetail && typeof itemDetail === "object") {
      const detailObj = itemDetail as Record<string, unknown>;
      const analiseLucro = (detailObj.analiseLucro ?? detailObj.analise_lucro ?? null) as Json | null;
      const impostos =
        (detailObj.impostos ??
          detailObj.tributos ??
          detailObj.totalTributacao ??
          null) as Json | null;

      const baseRaw = (item.raw && typeof item.raw === "object" ? (item.raw as Record<string, unknown>) : {});
      const mergedRaw: Record<string, unknown> = { ...baseRaw, _detail: detailObj };

      const { error: upErr } = await supabaseAdmin
        .from("nomus_proposal_items")
        .update({
          raw: mergedRaw as never,
          analise_lucro: analiseLucro as never,
          impostos: impostos as never,
          synced_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (upErr) {
        // não interrompe — apenas loga implicitamente via retorno
        itemDetailError = `Detalhe carregado, mas falhou ao gravar local: ${upErr.message}`;
      }
    }

    // 3) Detalhe do produto no Nomus (sob demanda) — só se tivermos id
    let produto: Json | null = null;
    let produtoError: string | null = null;
    if (item.nomus_product_id) {
      const res = await nomusFetch<Json>(
        `${NOMUS_ENDPOINTS.produtos}/${encodeURIComponent(item.nomus_product_id)}`,
        {
          method: "GET",
          entity: "produtos",
          operation: "get",
          direction: "pull",
          triggeredBy: userId,
        }
      );
      if (res.ok) {
        produto = res.data;
      } else {
        produtoError = `Não foi possível carregar produto ${item.nomus_product_id}: ${res.error}`;
      }
    }

    // 4) Equipamento local mapeado (se houver)
    let equipment: Json | null = null;
    if (item.nomus_product_id) {
      const { data: eq } = await supabaseAdmin
        .from("equipments")
        .select("*, equipment_lines(code, name, family, application)")
        .eq("nomus_id", item.nomus_product_id)
        .maybeSingle();
      if (eq) equipment = eq as unknown as Json;
    }

    // 5) Preços do produto em todas as tabelas de preço (Nomus)
    let priceTableItems: Json[] = [];
    if (item.nomus_product_id) {
      const { data: pti } = await supabaseAdmin
        .from("nomus_price_table_items")
        .select("*, nomus_price_tables(nomus_id, name, code, currency, is_active)")
        .eq("nomus_product_id", item.nomus_product_id);
      if (pti && Array.isArray(pti)) priceTableItems = pti as unknown as Json[];
    }

    // TanStack Start exige tipos serializáveis estritos. Como o conteúdo aqui
    // é JSON arbitrário do Nomus (estrutura desconhecida), serializamos como
    // string e o cliente faz JSON.parse — assim atravessa o validador sem
    // arrastar `unknown` pela inferência.
    return {
      ok: true as const,
      item_raw_json: JSON.stringify(item.raw ?? null),
      item_detail_json: JSON.stringify(itemDetail ?? null),
      item_detail_error: itemDetailError,
      proposta_raw_json: JSON.stringify(item.nomus_proposals?.raw ?? null),
      proposta_nomus_id: item.nomus_proposals?.nomus_id ?? null,
      produto_raw_json: JSON.stringify(produto ?? null),
      produto_error: produtoError,
      equipment_json: JSON.stringify(equipment ?? null),
      price_table_items_json: JSON.stringify(priceTableItems),
    };
  });

// ============================================================================
// Importação de custos via CSV (relatório do Nomus)
// ============================================================================

type CsvRowInput = {
  productCode: string;
  description: string | null;
  unidadeMedida: string | null;
  unitPrice: number | null;
  margemDesejadaPct: number | null;
  precoCalculado: number | null;
  custosVenda: number | null;
  precoLiquido: number | null;
  custoProducaoTotal: number | null;
  custoMateriais: number | null;
  custoMod: number | null;
  custoCif: number | null;
  lucroBruto: number | null;
  custosAdm: number | null;
  lucroLiquido: number | null;
  margemContribuicao: number | null;
  hasCostData: boolean;
};

type ImportInput = {
  priceTableId: string;
  filename: string;
  rows: CsvRowInput[];
  dryRun: boolean;
};

const ALLOWED_IMPORT_ROLES = ["admin", "gerente_comercial", "diretoria", "engenharia"] as const;

/**
 * Importa custos para uma tabela de preço a partir de linhas pré-parseadas
 * pelo csv-parser (cliente). Faz upsert por (price_table_id, nomus_product_id).
 *
 * Em modo dry-run, apenas calcula contagens e devolve preview — não toca no banco.
 */
export const nomusImportPriceTableCosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ImportInput) => {
    if (!input || typeof input !== "object") throw new Error("Payload inválido.");
    if (!input.priceTableId) throw new Error("priceTableId obrigatório.");
    if (!input.filename) throw new Error("filename obrigatório.");
    if (!Array.isArray(input.rows)) throw new Error("rows deve ser array.");
    if (input.rows.length > 10_000) throw new Error("Excede 10.000 linhas — divida o arquivo.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1) Verificar role
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) {
      return { ok: false as const, error: `Falha ao verificar permissões: ${rolesErr.message}` };
    }
    const userRoles = (roles ?? []).map((r) => r.role);
    const allowed = userRoles.some((r) => (ALLOWED_IMPORT_ROLES as readonly string[]).includes(r));
    if (!allowed) {
      return { ok: false as const, error: "Sem permissão para importar custos. Necessário: admin, gerente comercial, diretoria ou engenharia." };
    }

    // 2) Validar tabela de preço existe
    const { data: priceTable, error: ptErr } = await supabaseAdmin
      .from("nomus_price_tables")
      .select("id, name")
      .eq("id", data.priceTableId)
      .maybeSingle();
    if (ptErr || !priceTable) {
      return { ok: false as const, error: "Tabela de preço não encontrada." };
    }

    // 3) Buscar itens existentes da tabela para classificar update vs insert
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("nomus_price_table_items")
      .select("id, nomus_product_id")
      .eq("price_table_id", data.priceTableId);
    if (exErr) {
      return { ok: false as const, error: `Falha ao ler itens existentes: ${exErr.message}` };
    }
    const existingByCode = new Map<string, string>(); // nomus_product_id -> id
    for (const r of existing ?? []) {
      existingByCode.set(String(r.nomus_product_id), r.id);
    }

    let toUpdate = 0;
    let toInsert = 0;
    let withCost = 0;
    for (const row of data.rows) {
      if (existingByCode.has(row.productCode)) toUpdate++;
      else toInsert++;
      if (row.hasCostData) withCost++;
    }

    if (data.dryRun) {
      return {
        ok: true as const,
        dryRun: true,
        priceTableName: priceTable.name,
        totalRows: data.rows.length,
        toUpdate,
        toInsert,
        withCost,
        existingNotInCsv: (existing?.length ?? 0) - toUpdate,
      };
    }

    // 4) Executar upsert
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of data.rows) {
      const payload = {
        price_table_id: data.priceTableId,
        nomus_product_id: row.productCode,
        unit_price: row.unitPrice ?? row.precoCalculado ?? 0,
        custo_materiais: row.custoMateriais,
        custo_mod: row.custoMod,
        custo_cif: row.custoCif,
        custos_adm: row.custosAdm,
        custo_producao_total: row.custoProducaoTotal,
        custos_venda: row.custosVenda,
        preco_calculado: row.precoCalculado,
        preco_liquido: row.precoLiquido,
        margem_desejada_pct: row.margemDesejadaPct,
        lucro_bruto: row.lucroBruto,
        lucro_liquido: row.lucroLiquido,
        margem_contribuicao: row.margemContribuicao,
        unidade_medida: row.unidadeMedida,
        import_source: "csv",
        imported_at: now,
        has_cost_data: row.hasCostData,
        synced_at: now,
      };

      const existingId = existingByCode.get(row.productCode);
      if (existingId) {
        const { error } = await supabaseAdmin
          .from("nomus_price_table_items")
          .update(payload)
          .eq("id", existingId);
        if (error) {
          skipped++;
          console.error(`[import-costs] update falhou para ${row.productCode}:`, error.message);
        } else {
          updated++;
        }
      } else {
        const { error } = await supabaseAdmin
          .from("nomus_price_table_items")
          .insert(payload);
        if (error) {
          skipped++;
          console.error(`[import-costs] insert falhou para ${row.productCode}:`, error.message);
        } else {
          inserted++;
        }
      }
    }

    // 5) Auditoria
    const { error: auditErr } = await supabaseAdmin.from("nomus_cost_imports").insert({
      price_table_id: data.priceTableId,
      filename: data.filename,
      total_rows: data.rows.length,
      inserted_count: inserted,
      updated_count: updated,
      skipped_count: skipped,
      with_cost_count: withCost,
      imported_by: userId,
    });
    if (auditErr) {
      console.error("[import-costs] falha ao gravar auditoria:", auditErr.message);
    }

    return {
      ok: true as const,
      dryRun: false,
      priceTableName: priceTable.name,
      totalRows: data.rows.length,
      inserted,
      updated,
      skipped,
      withCost,
    };
  });
