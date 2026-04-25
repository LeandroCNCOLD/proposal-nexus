import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listAll, getOne, nomusFetch } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS } from "@/integrations/nomus/endpoints";
import {
  mapNomusProposal,
  extractProposalItems,
  pickStr,
  pickNumBR,
  pickDate,
} from "@/integrations/nomus/parse";

// Hook acionado pelo pg_cron a cada N minutos. Pull incremental
// de propostas, pedidos e NF do Nomus. Token Bearer simples só
// para autorizar a chamada.

type EntityKey = "propostas" | "pedidos" | "notas_fiscais";

type Mapper = (raw: Record<string, unknown>) => Promise<unknown>;

/**
 * Pull de propostas: listagem retorna só {id} → para cada uma chamamos
 * GET /propostas/{id} para puxar o payload completo (cliente, valores,
 * tributos, custos, lucro, itens etc.).
 */
async function syncProposalDetail(rawSummary: Record<string, unknown>, options: { requireDetail?: boolean } = {}): Promise<boolean> {
  const id = pickStr(rawSummary, "id", "idProposta", "codigo");
  if (!id) return false;

  const detailRes = await getOne<Record<string, unknown>>(NOMUS_ENDPOINTS.propostas, id, {
    entity: "propostas",
  });
  if (!detailRes.ok && options.requireDetail) return false;
  // Se falhar o detalhe, salvamos pelo menos o que veio na listagem para não perder o ID.
  const raw = detailRes.ok ? detailRes.data : rawSummary;
  const mapped = mapNomusProposal(raw);
  if (!mapped) return false;

  const { data: currentMirror } = await supabaseAdmin
    .from("nomus_proposals")
    .select("raw")
    .eq("nomus_id", mapped.nomus_id)
    .maybeSingle();
  if (currentMirror && JSON.stringify((currentMirror as { raw?: unknown }).raw ?? null) === JSON.stringify(raw ?? null)) {
    return false;
  }

  // 1) Espelha em nomus_proposals (fonte fiel do payload Nomus)
  const { data: mirror } = await supabaseAdmin
    .from("nomus_proposals")
    .upsert(
      {
        nomus_id: mapped.nomus_id,
        numero: mapped.numero,

        cliente_nomus_id: mapped.cliente_nomus_id,
        cliente_nome: mapped.nome_cliente,
        empresa_nomus_id: mapped.empresa_nomus_id,
        empresa_nome: mapped.empresa_nome,
        vendedor_nomus_id: mapped.vendedor_nomus_id,
        vendedor_nome: mapped.vendedor_nome,
        representante_nomus_id: mapped.representante_nomus_id,
        representante_nome: mapped.representante_nome,
        contato_nomus_id: mapped.contato_nomus_id,
        contato_nome: mapped.contato_nome,
        tabela_preco_nomus_id: mapped.tabela_preco_nomus_id,
        tabela_preco_nome: mapped.tabela_preco_nome,
        condicao_pagamento_nomus_id: mapped.condicao_pagamento_nomus_id,
        condicao_pagamento_nome: mapped.condicao_pagamento_nome,
        tipo_movimentacao: mapped.tipo_movimentacao,
        prazo_entrega_dias: mapped.prazo_entrega_dias,
        pedido_compra_cliente: mapped.pedido_compra_cliente,
        layout_pdf: mapped.layout_pdf,

        validade: mapped.validade,
        data_emissao: mapped.data_emissao,
        criada_em_nomus: mapped.criada_em_nomus,
        criada_por_nomus: mapped.criada_por_nomus,

        valor_total: mapped.valor_total,
        valor_produtos: mapped.valor_produtos,
        valor_descontos: mapped.valor_descontos,
        valor_total_com_desconto: mapped.valor_total_com_desconto,
        valor_liquido: mapped.valor_liquido,

        icms_recolher: mapped.icms_recolher,
        icms_st_recolher: mapped.icms_st_recolher,
        ipi_recolher: mapped.ipi_recolher,
        pis_recolher: mapped.pis_recolher,
        cofins_recolher: mapped.cofins_recolher,
        issqn_recolher: mapped.issqn_recolher,
        simples_nacional_recolher: mapped.simples_nacional_recolher,
        cbs_recolher: mapped.cbs_recolher,
        ibs_recolher: mapped.ibs_recolher,
        ibs_estadual_recolher: mapped.ibs_estadual_recolher,
        total_tributacao: mapped.total_tributacao as never,

        comissoes_venda: mapped.comissoes_venda,
        frete_valor: mapped.frete_valor,
        frete_percentual: mapped.frete_percentual,
        seguros_valor: mapped.seguros_valor,
        despesas_acessorias: mapped.despesas_acessorias,

        custos_producao: mapped.custos_producao,
        custos_materiais: mapped.custos_materiais,
        custos_mod: mapped.custos_mod,
        custos_cif: mapped.custos_cif,
        custos_administrativos: mapped.custos_administrativos,
        custos_incidentes_lucro: mapped.custos_incidentes_lucro,

        lucro_bruto: mapped.lucro_bruto,
        margem_bruta_pct: mapped.margem_bruta_pct,
        lucro_antes_impostos: mapped.lucro_antes_impostos,
        lucro_liquido: mapped.lucro_liquido,
        margem_liquida_pct: mapped.margem_liquida_pct,

        status_nomus: mapped.status_nomus,
        observacoes: mapped.observacoes,
        raw: raw as never,
        synced_at: new Date().toISOString(),
        ...(detailRes.ok ? { detail_synced_at: new Date().toISOString() } : {}),
      },
      { onConflict: "nomus_id" }
    )
    .select("id")
    .single();
  const mirrorId = (mirror as { id: string } | null)?.id ?? null;

  // 2) Itens da proposta — preserva o JSON ORIGINAL do Nomus em `raw`
  // (com tributos, NCM, CFOP, alíquotas etc.) para o usuário inspecionar
  // por completo no modal de detalhe do item.
  if (mirrorId && detailRes.ok) {
    const mappedItems = extractProposalItems(raw);
    const rawItemsArr = (raw["itensProposta"] ?? raw["itens"] ?? raw["items"]) as
      Array<Record<string, unknown>> | undefined;
    if (mappedItems.length > 0) {
      await supabaseAdmin.from("nomus_proposal_items").delete().eq("nomus_proposal_id", mirrorId);
      await supabaseAdmin.from("nomus_proposal_items").insert(
        mappedItems.map((it, idx) => ({
          nomus_proposal_id: mirrorId,
          nomus_item_id: it.nomus_item_id,
          nomus_product_id: it.nomus_product_id,
          product_code: it.product_code,
          description: it.description,
          additional_info: it.additional_info,
          quantity: it.quantity,
          unit_price: it.unit_price,
          unit_value_with_unit: it.unit_value_with_unit,
          discount: it.discount,
          total: it.total,
          total_with_discount: it.total_with_discount,
          prazo_entrega_dias: it.prazo_entrega_dias,
          item_status: it.item_status,
          position: idx,
          // Salva o JSON ORIGINAL do item (não o mapeado), preservando
          // todos os campos extras que o Nomus envia.
          raw: (Array.isArray(rawItemsArr) && rawItemsArr[idx] ? rawItemsArr[idx] : it) as never,
        }))
      );
    }
  }

  // 3) Resolve cliente local pelo nomus_id (se já existir)
  let clientId: string | null = null;
  if (mapped.cliente_nomus_id) {
    const { data: c } = await supabaseAdmin
      .from("clients").select("id").eq("nomus_id", mapped.cliente_nomus_id).maybeSingle();
    clientId = (c as { id: string } | null)?.id ?? null;
  }

  // 4) Espelha em proposals (UI lê daqui). Título = "PROPOSTA — CLIENTE".
  const baseTitle = mapped.nome_cliente
    ? `${mapped.numero ?? mapped.nomus_id} — ${mapped.nome_cliente}`
    : mapped.numero ?? `Proposta Nomus ${mapped.nomus_id}`;

  const { data: existing } = await supabaseAdmin
    .from("proposals").select("id, client_id, title").eq("nomus_id", mapped.nomus_id).maybeSingle();
  if (!existing) {
    await supabaseAdmin.from("proposals").insert({
      nomus_id: mapped.nomus_id,
      nomus_proposal_id: mirrorId,
      nomus_synced_at: new Date().toISOString(),
      source: "nomus",
      title: baseTitle,
      client_id: clientId,
      total_value: mapped.valor_total ?? 0,
      valid_until: mapped.validade,
      delivery_term: mapped.prazo_entrega_dias != null ? `${mapped.prazo_entrega_dias} dias` : null,
      payment_terms: mapped.condicao_pagamento_nome,
      nomus_payment_term_name: mapped.condicao_pagamento_nome,
      nomus_price_table_name: mapped.tabela_preco_nome,
      nomus_seller_name: mapped.vendedor_nome,
      status: "em_elaboracao",
    });
  } else {
    const ex = existing as { id: string; client_id: string | null; title: string };
    await supabaseAdmin.from("proposals").update({
      nomus_proposal_id: mirrorId,
      title: baseTitle,
      total_value: mapped.valor_total ?? 0,
      valid_until: mapped.validade,
      delivery_term: mapped.prazo_entrega_dias != null ? `${mapped.prazo_entrega_dias} dias` : null,
      payment_terms: mapped.condicao_pagamento_nome,
      nomus_payment_term_name: mapped.condicao_pagamento_nome,
      nomus_price_table_name: mapped.tabela_preco_nome,
      nomus_seller_name: mapped.vendedor_nome,
      ...(ex.client_id || !clientId ? {} : { client_id: clientId }),
      nomus_synced_at: new Date().toISOString(),
    }).eq("id", ex.id);
  }

  return true;
}

const mappers: Record<EntityKey, { endpoint: string; map: Mapper }> = {
  propostas: {
    endpoint: NOMUS_ENDPOINTS.propostas,
    map: syncProposalDetail,
  },
  pedidos: {
    endpoint: NOMUS_ENDPOINTS.pedidos,
    map: async (raw) => {
      const nomus_id = pickStr(raw, "id", "idPedido", "numero");
      if (!nomus_id) return;
      await supabaseAdmin.from("nomus_pedidos").upsert({
        nomus_id,
        numero: pickStr(raw, "pedido", "numero"),
        proposal_nomus_id: pickStr(raw, "idProposta"),
        cliente_nomus_id: pickStr(raw, "idCliente"),
        valor_total: pickNumBR(raw, "valorTotal", "valor"),
        status_nomus: pickStr(raw, "status"),
        data_emissao: pickDate(raw, "dataHoraAbertura", "dataEmissao"),
        raw: raw as never,
        synced_at: new Date().toISOString(),
      }, { onConflict: "nomus_id" });
    },
  },
  notas_fiscais: {
    endpoint: NOMUS_ENDPOINTS.notas_fiscais,
    map: async (raw) => {
      const nomus_id = pickStr(raw, "id", "idNota");
      if (!nomus_id) return;
      await supabaseAdmin.from("nomus_invoices").upsert({
        nomus_id,
        numero: pickStr(raw, "numero"),
        serie: pickStr(raw, "serie"),
        chave_acesso: pickStr(raw, "chaveAcesso"),
        pedido_nomus_id: pickStr(raw, "idPedido"),
        cliente_nomus_id: pickStr(raw, "idCliente"),
        valor_total: pickNumBR(raw, "valorTotal", "valor"),
        status_nomus: pickStr(raw, "status"),
        data_emissao: pickDate(raw, "dataHoraAbertura", "dataEmissao"),
        raw: raw as never,
        synced_at: new Date().toISOString(),
      }, { onConflict: "nomus_id" });
    },
  },
};

/** Máximo de propostas novas/alteradas processadas por invocação (evita timeout). */
const PROPOSALS_BATCH_SIZE = 20;
const PROPOSALS_FORWARD_LOOKAHEAD = 80;
const PROPOSALS_RECENT_RECHECK = 30;
const PROPOSALS_MAX_CONSECUTIVE_MISSES = 20;

function extractItems(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  const env = (payload ?? {}) as Record<string, unknown>;
  for (const k of ["items", "resultados", "data", "content", "registros", "lista"]) {
    const v = env[k];
    if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
  }
  return [];
}

function parseNomusSortDate(raw: Record<string, unknown>): number {
  const value = pickStr(raw, "dataHoraCriacao", "criadaEm", "dataCriacao", "dataHoraAbertura", "dataEmissao", "dataModificacao");
  if (!value) return 0;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value
    : /^\d{2}\/\d{2}\/\d{4}/.test(value)
      ? `${value.slice(6, 10)}-${value.slice(3, 5)}-${value.slice(0, 2)}${value.length > 10 ? value.slice(10) : ""}`
      : value;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function parseNomusProposalRank(raw: Record<string, unknown>) {
  const numero = pickStr(raw, "proposta", "numero", "numeroProposta") ?? "";
  const cn = numero.match(/CN\s*0*(\d+)/i);
  const rev = numero.match(/Rev\.?\s*0*(\d+)/i);
  const id = Number(pickStr(raw, "id", "idProposta", "codigo") ?? 0) || 0;
  return {
    cn: cn ? Number(cn[1]) || 0 : 0,
    rev: rev ? Number(rev[1]) || 0 : 0,
    id,
  };
}

/**
 * Sync incremental de propostas — uma página por clique.
 *
 * MUDANÇA CRÍTICA (anti-rate-limit): em vez de listar TODAS as páginas a cada clique
 * (o que gerava 138+ chamadas e batia em HTTP 429), agora pedimos UMA página de cada
 * vez ao Nomus. O cursor agora é o NÚMERO DA PÁGINA, não o id da última proposta.
 *
 * Fluxo:
 * - Lê cursor (número da página atual; padrão 1).
 * - Busca a página `?pagina=N` (até ~50 propostas).
 * - Para cada uma, GET /propostas/{id} para detalhe completo + upsert.
 * - Se a página vier vazia ou todas estiverem fora da janela de 36 meses → done.
 * - Caso contrário, avança o cursor para N+1 e termina.
 */
export async function syncProposalsBatch(): Promise<{ ok: boolean; count?: number; error?: string; done?: boolean }> {
  return pullProposalsNewestFirst();
}

async function pullProposalsNewestFirst(): Promise<{ ok: boolean; count?: number; error?: string; done?: boolean }> {
  const endpoint = NOMUS_ENDPOINTS.propostas;

  // Marca início
  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity: "propostas",
    running: true,
    last_error: null,
    updated_at: new Date().toISOString(),
  });

  // Lista os resumos de todas as páginas e processa só o topo mais recente.
  // O Nomus não garante que a página 1 contenha as últimas propostas; por isso
  // não podemos limitar a busca às primeiras páginas.
  const { data: stateRow } = await supabaseAdmin
    .from("nomus_sync_state")
    .select("total_synced")
    .eq("entity", "propostas")
    .maybeSingle();

  const previousTotal = (stateRow as { total_synced: number } | null)?.total_synced ?? 0;

  let count = 0;
  let done = false;
  let runError: string | null = null;
  let newestSeenId = 0;

  try {
    const listRes = await listAll<Record<string, unknown>>(endpoint, {}, {
      entity: "propostas",
      pageSize: 50,
      maxItems: 500,
    });
    if (!listRes.ok) {
      runError = listRes.error;
      return { ok: false, error: listRes.error };
    }
    const summaries = listRes.items;

    if (summaries.length === 0) {
      done = true;
    } else {
      const seen = new Set<string>();
      const items = summaries
        .filter((summary) => {
          const id = pickStr(summary, "id", "idProposta", "codigo");
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .sort((a, b) => {
          const ar = parseNomusProposalRank(a);
          const br = parseNomusProposalRank(b);
          if (br.cn !== ar.cn) return br.cn - ar.cn;
          if (br.rev !== ar.rev) return br.rev - ar.rev;
          if (br.id !== ar.id) return br.id - ar.id;
          const dateDiff = parseNomusSortDate(b) - parseNomusSortDate(a);
          return dateDiff;
        });

      for (const summary of items) {
        if (count >= PROPOSALS_BATCH_SIZE) break;

        const id = pickStr(summary, "id", "idProposta", "codigo");
        if (!id) continue;

        const { data: existing } = await supabaseAdmin
          .from("nomus_proposals")
          .select("nomus_id")
          .eq("nomus_id", id)
          .maybeSingle();

        try {
          const changed = await syncProposalDetail(summary, { requireDetail: !existing });
          if (changed) {
            newestSeenId = Math.max(newestSeenId, Number(id) || 0);
            count += 1;
          }
        } catch (e) {
          console.error("[nomus-cron] erro mapeando proposta:", e);
        }
      }

      done = true;
    }
  } catch (e) {
    runError = e instanceof Error ? e.message : String(e);
    console.error("[nomus-cron] exceção em pullProposalsNewestFirst:", e);
  } finally {
    // SEMPRE libera a flag, mesmo em exceção/timeout
    await supabaseAdmin.from("nomus_sync_state").upsert({
      entity: "propostas",
      last_synced_at: new Date().toISOString(),
      total_synced: previousTotal + count,
      last_cursor: newestSeenId > 0 ? `recentes:${newestSeenId}` : null,
      running: false,
      last_error: runError,
      updated_at: new Date().toISOString(),
    });
  }

  return { ok: !runError, count, done, error: runError ?? undefined };
}

async function pullEntity(name: EntityKey): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (name === "propostas") return pullProposalsNewestFirst();
  const { endpoint, map } = mappers[name];
  const res = await listAll<Record<string, unknown>>(endpoint, {}, { entity: name });
  if (!res.ok) return { ok: false, error: res.error };
  let count = 0;
  for (const r of res.items) {
    try {
      await map(r);
      count += 1;
    } catch (e) {
      console.error(`[nomus-cron] erro mapeando ${name}:`, e);
    }
  }
  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity: name,
    last_synced_at: new Date().toISOString(),
    total_synced: count,
    running: false,
    updated_at: new Date().toISOString(),
  });
  return { ok: true, count };
}

export const Route = createFileRoute("/api/public/hooks/nomus-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        const allowedTokens = new Set(
          [
            process.env.NOMUS_CRON_SECRET?.trim(),
            process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),
            process.env.SUPABASE_ANON_KEY?.trim(),
          ].filter((value): value is string => Boolean(value))
        );

        if (!token || !allowedTokens.has(token)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { entity?: string } = {};
        try { body = await request.json(); } catch { /* empty body ok */ }
        const requested = body.entity ?? "all";

        const targets: EntityKey[] = requested === "all"
          ? ["propostas", "pedidos", "notas_fiscais"]
          : (Object.keys(mappers).includes(requested) ? [requested as EntityKey] : []);

        if (targets.length === 0) {
          return new Response(JSON.stringify({ ok: false, error: `entity inválida: ${requested}` }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};
        for (const t of targets) results[t] = await pullEntity(t);

        return new Response(JSON.stringify({ ok: true, results }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
