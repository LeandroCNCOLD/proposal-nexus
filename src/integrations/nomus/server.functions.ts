// Nomus integration server functions (TanStack Start)
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nomusFetch, listAll, testNomusConnection } from "./client";
import { NOMUS_ENDPOINTS, proposalSubpath } from "./endpoints";

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

async function setState(entity: string, patch: Record<string, unknown>) {
  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity,
    updated_at: new Date().toISOString(),
    ...patch,
  });
}

/** Test connection by hitting /clientes. */
export const nomusTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const result = await testNomusConnection(userId);
    if (result.success) {
      return {
        ok: true as const,
        endpoint: result.endpoint,
        status: result.status,
        durationMs: result.durationMs,
        baseUrl: result.baseUrl,
      };
    }
    return {
      ok: false as const,
      error: result.error ?? "Falha ao conectar ao Nomus",
      status: result.status,
      endpoint: result.endpoint,
      durationMs: result.durationMs,
    };
  });

/** Pull clients from Nomus and upsert locally. */
export const nomusSyncClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("clientes", { running: true });
    const res = await listAll<Json>(NOMUS_ENDPOINTS.clientes, {}, { entity: "clientes", triggeredBy: userId });
    if (!res.ok) {
      await setState("clientes", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let upserts = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "codigo", "idCliente");
      const name = pickStr(raw, "nome", "razaoSocial", "nomeFantasia");
      if (!nomus_id || !name) continue;
      const document = pickStr(raw, "cnpj", "cpf", "documento");
      const trade_name = pickStr(raw, "nomeFantasia", "fantasia");
      const city = pickStr(raw, "cidade", "municipio");
      const state = pickStr(raw, "uf", "estado");
      const segment = pickStr(raw, "segmento", "ramo");

      const { error } = await supabaseAdmin
        .from("clients")
        .upsert(
          {
            nomus_id,
            name,
            document,
            trade_name,
            city,
            state,
            segment,
            origin: "nomus",
            nomus_synced_at: new Date().toISOString(),
          },
          { onConflict: "nomus_id" }
        );
      if (!error) upserts += 1;
    }
    await setState("clientes", {
      running: false,
      last_synced_at: new Date().toISOString(),
      total_synced: upserts,
      last_error: null,
    });
    return { ok: true as const, count: upserts };
  });

/** Pull products and map to equipments via nomus_id. */
export const nomusSyncProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("produtos", { running: true });
    const res = await listAll<Json>(NOMUS_ENDPOINTS.produtos, {}, { entity: "produtos", triggeredBy: userId });
    if (!res.ok) {
      await setState("produtos", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let updated = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "codigo", "idProduto");
      const model = pickStr(raw, "codigo", "modelo", "descricao");
      if (!nomus_id || !model) continue;
      // Try to attach to existing equipment by model match; do NOT auto-create.
      const { data: existing } = await supabaseAdmin
        .from("equipments")
        .select("id")
        .or(`nomus_id.eq.${nomus_id},model.eq.${model}`)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("equipments")
          .update({ nomus_id, nomus_synced_at: new Date().toISOString() })
          .eq("id", existing.id);
        updated += 1;
      }
    }
    await setState("produtos", {
      running: false,
      last_synced_at: new Date().toISOString(),
      total_synced: updated,
      last_error: null,
    });
    return { ok: true as const, count: updated };
  });

/** Pull payment terms. */
export const nomusSyncPaymentTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("condicoes_pagamento", { running: true });
    const res = await listAll<Json>(NOMUS_ENDPOINTS.condicoes_pagamento, {}, {
      entity: "condicoes_pagamento", triggeredBy: userId,
    });
    if (!res.ok) {
      await setState("condicoes_pagamento", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let count = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "codigo");
      const name = pickStr(raw, "descricao", "nome");
      if (!nomus_id || !name) continue;
      await supabaseAdmin.from("nomus_payment_terms").upsert(
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
      count += 1;
    }
    await setState("condicoes_pagamento", {
      running: false,
      last_synced_at: new Date().toISOString(),
      total_synced: count,
      last_error: null,
    });
    return { ok: true as const, count };
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
    await setState("vendedores", { running: true });
    const res = await listAll<Json>(NOMUS_ENDPOINTS.vendedores, {}, { entity: "vendedores", triggeredBy: userId });
    if (!res.ok) {
      await setState("vendedores", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let count = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "codigo", "idVendedor");
      const name = pickStr(raw, "nome", "razaoSocial");
      if (!nomus_id || !name) continue;
      await supabaseAdmin.from("nomus_sellers").upsert(
        {
          nomus_id, name,
          email: pickStr(raw, "email"),
          document: pickStr(raw, "cpf", "cnpj", "documento"),
          raw: raw as never,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "nomus_id" }
      );
      count += 1;
    }
    await setState("vendedores", {
      running: false, last_synced_at: new Date().toISOString(),
      total_synced: count, last_error: null,
    });
    return { ok: true as const, count };
  });

/** Pull representantes. */
export const nomusSyncRepresentatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("representantes", { running: true });
    const res = await listAll<Json>(NOMUS_ENDPOINTS.representantes, {}, { entity: "representantes", triggeredBy: userId });
    if (!res.ok) {
      await setState("representantes", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let count = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "codigo");
      const name = pickStr(raw, "nome", "razaoSocial");
      if (!nomus_id || !name) continue;
      await supabaseAdmin.from("nomus_representatives").upsert(
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
      count += 1;
    }
    await setState("representantes", {
      running: false, last_synced_at: new Date().toISOString(),
      total_synced: count, last_error: null,
    });
    return { ok: true as const, count };
  });

/** Pull propostas + itens; cria espelho local em proposals quando habilitado. */
export const nomusSyncProposalsFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("propostas", { running: true });

    const { data: settings } = await supabaseAdmin
      .from("nomus_settings").select("auto_create_local_proposal").maybeSingle();
    const autoCreate = (settings as { auto_create_local_proposal?: boolean } | null)?.auto_create_local_proposal ?? true;

    const res = await listAll<Json>(NOMUS_ENDPOINTS.propostas, {}, { entity: "propostas", triggeredBy: userId });
    if (!res.ok) {
      await setState("propostas", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let count = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "idProposta", "codigo");
      if (!nomus_id) continue;

      const upsertPayload = {
        nomus_id,
        numero: pickStr(raw, "numero", "numeroProposta"),
        cliente_nomus_id: pickStr(raw, "idCliente", "clienteId"),
        vendedor_nomus_id: pickStr(raw, "idVendedor", "vendedorId"),
        representante_nomus_id: pickStr(raw, "idRepresentante", "representanteId"),
        valor_total: pickNum(raw, "valorTotal", "valor", "total"),
        status_nomus: pickStr(raw, "status", "situacao"),
        validade: pickStr(raw, "validade", "dataValidade"),
        data_emissao: pickStr(raw, "dataEmissao", "data"),
        observacoes: pickStr(raw, "observacoes", "obs"),
        raw: raw as never,
        synced_at: new Date().toISOString(),
      };
      const { data: mirror } = await supabaseAdmin
        .from("nomus_proposals")
        .upsert(upsertPayload, { onConflict: "nomus_id" })
        .select("id")
        .single();

      // Itens (se vierem inline)
      const itensRaw = (raw["itens"] ?? raw["items"]) as Json[] | undefined;
      if (mirror && Array.isArray(itensRaw)) {
        await supabaseAdmin.from("nomus_proposal_items").delete().eq("nomus_proposal_id", (mirror as { id: string }).id);
        const rows = itensRaw.map((it, idx) => ({
          nomus_proposal_id: (mirror as { id: string }).id,
          nomus_item_id: pickStr(it, "id", "idItem"),
          nomus_product_id: pickStr(it, "idProduto", "produtoId"),
          product_code: pickStr(it, "codigo", "codigoProduto"),
          description: pickStr(it, "descricao", "nome") ?? "",
          quantity: pickNum(it, "quantidade", "qtd"),
          unit_price: pickNum(it, "valorUnitario", "preco"),
          discount: pickNum(it, "desconto"),
          total: pickNum(it, "total", "valorTotal"),
          position: idx,
          raw: it as never,
        }));
        if (rows.length > 0) await supabaseAdmin.from("nomus_proposal_items").insert(rows);
      }

      // Cria proposta local se ainda não existir
      if (autoCreate && mirror) {
        const mirrorId = (mirror as { id: string }).id;
        const { data: existing } = await supabaseAdmin
          .from("proposals").select("id").eq("nomus_id", nomus_id).maybeSingle();
        if (!existing) {
          // tenta vincular cliente
          let clientId: string | null = null;
          if (upsertPayload.cliente_nomus_id) {
            const { data: c } = await supabaseAdmin
              .from("clients").select("id").eq("nomus_id", upsertPayload.cliente_nomus_id).maybeSingle();
            clientId = (c as { id: string } | null)?.id ?? null;
          }
          await supabaseAdmin.from("proposals").insert({
            nomus_id,
            nomus_proposal_id: mirrorId,
            nomus_synced_at: new Date().toISOString(),
            source: "nomus",
            title: upsertPayload.numero ?? `Proposta Nomus ${nomus_id}`,
            client_id: clientId,
            total_value: upsertPayload.valor_total ?? 0,
            valid_until: upsertPayload.validade,
            status: "em_elaboracao",
          });
        } else {
          await supabaseAdmin.from("proposals")
            .update({
              nomus_proposal_id: mirrorId,
              total_value: upsertPayload.valor_total ?? 0,
              valid_until: upsertPayload.validade,
              nomus_synced_at: new Date().toISOString(),
            })
            .eq("id", (existing as { id: string }).id);
        }
      }
      count += 1;
    }
    await setState("propostas", {
      running: false, last_synced_at: new Date().toISOString(),
      total_synced: count, last_error: null,
    });
    return { ok: true as const, count };
  });

/** Pull pedidos de venda. Trigger no banco vincula proposta automaticamente. */
export const nomusSyncPedidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("pedidos", { running: true });
    const res = await listAll<Json>(NOMUS_ENDPOINTS.pedidos, {}, { entity: "pedidos", triggeredBy: userId });
    if (!res.ok) {
      await setState("pedidos", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let count = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "idPedido", "numero");
      if (!nomus_id) continue;
      await supabaseAdmin.from("nomus_pedidos").upsert(
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
      count += 1;
    }
    await setState("pedidos", {
      running: false, last_synced_at: new Date().toISOString(),
      total_synced: count, last_error: null,
    });
    return { ok: true as const, count };
  });

/** Pull notas fiscais. */
export const nomusSyncInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("notas_fiscais", { running: true });
    const res = await listAll<Json>(NOMUS_ENDPOINTS.notas_fiscais, {}, { entity: "notas_fiscais", triggeredBy: userId });
    if (!res.ok) {
      await setState("notas_fiscais", { running: false, last_error: res.error });
      return { ok: false as const, error: res.error };
    }
    let count = 0;
    for (const raw of res.items) {
      const nomus_id = pickStr(raw, "id", "idNota", "numero");
      if (!nomus_id) continue;
      await supabaseAdmin.from("nomus_invoices").upsert(
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
      count += 1;
    }
    await setState("notas_fiscais", {
      running: false, last_synced_at: new Date().toISOString(),
      total_synced: count, last_error: null,
    });
    return { ok: true as const, count };
  });

/** Refresh forçado de uma proposta específica do Nomus. */
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

/** Gera arquivo PDF da proposta e cria nova versão. */
export const generateProposalFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { proposalId } = data;

    // Busca proposta + cliente + itens (mirror Nomus se existir, senão proposal_items)
    const { data: prop } = await supabaseAdmin
      .from("proposals")
      .select("*, clients(name, document, city, state), nomus_proposal_id")
      .eq("id", proposalId).maybeSingle();
    if (!prop) return { ok: false as const, error: "Proposta não encontrada." };
    const propAny = prop as unknown as {
      id: string; title: string; number: string; total_value: number | null;
      valid_until: string | null; nomus_proposal_id: string | null;
      clients: { name: string; document: string | null; city: string | null; state: string | null } | null;
    };

    let items: Array<{ description: string; quantity: number; unit_price: number; total: number }> = [];
    if (propAny.nomus_proposal_id) {
      const { data: nItems } = await supabaseAdmin
        .from("nomus_proposal_items").select("*").eq("nomus_proposal_id", propAny.nomus_proposal_id)
        .order("position");
      items = ((nItems as Array<{ description: string | null; quantity: number | null; unit_price: number | null; total: number | null }>) ?? []).map((it) => ({
        description: it.description ?? "",
        quantity: Number(it.quantity ?? 0),
        unit_price: Number(it.unit_price ?? 0),
        total: Number(it.total ?? 0),
      }));
    }
    if (items.length === 0) {
      const { data: localItems } = await supabaseAdmin
        .from("proposal_items").select("description, quantity, unit_price, total_price").eq("proposal_id", proposalId)
        .order("position");
      items = ((localItems as Array<{ description: string; quantity: number; unit_price: number; total_price: number | null }>) ?? []).map((it) => ({
        description: it.description, quantity: Number(it.quantity), unit_price: Number(it.unit_price),
        total: Number(it.total_price ?? it.quantity * it.unit_price),
      }));
    }

    // Render PDF
    const React = await import("react");
    const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");
    const h = React.createElement;
    const styles = StyleSheet.create({
      page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
      header: { borderBottomWidth: 2, borderBottomColor: "#1e40af", paddingBottom: 12, marginBottom: 16 },
      title: { fontSize: 18, fontWeight: 700 },
      subtitle: { fontSize: 10, color: "#6b7280", marginTop: 4 },
      section: { marginTop: 12, marginBottom: 8 },
      label: { color: "#6b7280", fontSize: 9, textTransform: "uppercase" as const },
      value: { fontSize: 11, marginTop: 2 },
      row: { flexDirection: "row" as const, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 6 },
      th: { fontWeight: 700, fontSize: 9, color: "#374151" },
      cellDesc: { flex: 4 }, cellQty: { flex: 1, textAlign: "right" as const },
      cellPrice: { flex: 1.5, textAlign: "right" as const }, cellTotal: { flex: 1.5, textAlign: "right" as const },
      total: { marginTop: 16, padding: 12, backgroundColor: "#f3f4f6", flexDirection: "row" as const, justifyContent: "space-between" as const },
    });
    const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const totalSum = items.reduce((s, it) => s + it.total, 0) || (propAny.total_value ?? 0);
    const subtitleParts = [propAny.clients?.document, propAny.clients?.city, propAny.clients?.state].filter(Boolean).join(" • ");

    const doc = h(Document, null,
      h(Page, { size: "A4", style: styles.page },
        h(View, { style: styles.header },
          h(Text, { style: styles.title }, "CN COLD — Proposta Comercial"),
          h(Text, { style: styles.subtitle }, `Nº ${propAny.number} • ${propAny.title}`),
        ),
        h(View, { style: styles.section },
          h(Text, { style: styles.label }, "Cliente"),
          h(Text, { style: styles.value }, propAny.clients?.name ?? "—"),
          h(Text, { style: styles.subtitle }, subtitleParts),
        ),
        h(View, { style: { marginTop: 16 } },
          h(View, { style: styles.row },
            h(Text, { style: [styles.th, styles.cellDesc] }, "Descrição"),
            h(Text, { style: [styles.th, styles.cellQty] }, "Qtde"),
            h(Text, { style: [styles.th, styles.cellPrice] }, "Unitário"),
            h(Text, { style: [styles.th, styles.cellTotal] }, "Total"),
          ),
          ...items.map((it, idx) => h(View, { style: styles.row, key: idx },
            h(Text, { style: styles.cellDesc }, it.description),
            h(Text, { style: styles.cellQty }, String(it.quantity)),
            h(Text, { style: styles.cellPrice }, fmt(it.unit_price)),
            h(Text, { style: styles.cellTotal }, fmt(it.total)),
          )),
        ),
        h(View, { style: styles.total },
          h(Text, null, "Total da proposta"),
          h(Text, { style: { fontWeight: 700, fontSize: 14 } }, fmt(totalSum)),
        ),
        propAny.valid_until ? h(View, { style: { marginTop: 24 } },
          h(Text, { style: styles.label }, "Validade"),
          h(Text, { style: styles.value }, new Date(propAny.valid_until).toLocaleDateString("pt-BR")),
        ) : null,
      ),
    );

    const buffer = await renderToBuffer(doc as never);

    // Versão
    const { data: lastVer } = await supabaseAdmin
      .from("proposal_send_versions").select("version_number")
      .eq("proposal_id", proposalId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const nextVer = ((lastVer as { version_number: number } | null)?.version_number ?? 0) + 1;
    const path = `${proposalId}/v${nextVer}-${Date.now()}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage.from("proposal-files")
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (upErr) return { ok: false as const, error: upErr.message };

    await supabaseAdmin.from("proposal_send_versions").update({ is_current: false }).eq("proposal_id", proposalId);
    const { data: ver } = await supabaseAdmin.from("proposal_send_versions").insert({
      proposal_id: proposalId, version_number: nextVer, pdf_storage_path: path,
      generated_by: userId, is_current: true,
      template_snapshot: { items_count: items.length, total: totalSum } as never,
    }).select("id").single();

    return { ok: true as const, version_id: (ver as { id: string }).id, path, version_number: nextVer };
  });

/** Registra envio + push opcional para Nomus. */
export const sendProposalFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    proposalId: string; versionId: string; channel: string;
    recipient?: string; subject?: string; message?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await supabaseAdmin.from("proposal_send_events").insert({
      proposal_id: data.proposalId, version_id: data.versionId,
      channel: data.channel, recipient: data.recipient ?? null,
      subject: data.subject ?? null, message: data.message ?? null,
      sent_by: userId, delivery_status: "sent",
    });
    await supabaseAdmin.from("proposals").update({ sent_at: new Date().toISOString() }).eq("id", data.proposalId);
    await supabaseAdmin.from("proposal_timeline_events").insert({
      proposal_id: data.proposalId, event_type: "enviada",
      description: `Enviada via ${data.channel}${data.recipient ? ` para ${data.recipient}` : ""}`,
      user_id: userId,
    });
    return { ok: true as const };
  });

/** Generate Pedido de venda when proposal is won. */
export const nomusCreatePedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { proposalId: string }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    const { data: prop } = await supabaseAdmin
      .from("proposals")
      .select("nomus_id, number, closed_value, total_value")
      .eq("id", data.proposalId)
      .single();
    const propAny = prop as { nomus_id: string | null; number: string; closed_value: number | null; total_value: number | null } | null;
    if (!propAny?.nomus_id) return { ok: false as const, error: "Proposta sem vínculo com o Nomus." };

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
    if (!res.ok) return { ok: false as const, error: res.error };
    const pedidoId = pickStr(res.data as Json, "id", "idPedido", "numero");
    if (pedidoId) {
      await supabaseAdmin
        .from("proposals")
        .update({ nomus_pedido_id: pedidoId })
        .eq("id", data.proposalId);
    }
    return { ok: true as const, pedido_id: pedidoId };
  });
