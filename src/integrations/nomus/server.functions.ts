// Nomus integration server functions (TanStack Start)
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nomusFetch, listAll } from "./client";

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

/** Test connection by hitting a lightweight endpoint. */
export const nomusTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    // Try a few common entry endpoints; first 2xx wins.
    const candidates = ["/empresas", "/clientes", "/vendedores"];
    for (const path of candidates) {
      const res = await nomusFetch(path, {
        method: "GET",
        query: { pagina: 1 },
        entity: "test",
        operation: "ping",
        direction: "test",
        triggeredBy: userId,
      });
      if (res.ok) {
        return { ok: true as const, endpoint: path, status: res.status };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false as const, error: `Credencial rejeitada (${res.status})`, endpoint: path };
      }
    }
    return { ok: false as const, error: "Nenhum endpoint respondeu. Verifique a URL base." };
  });

/** Pull clients from Nomus and upsert locally. */
export const nomusSyncClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as { userId?: string }).userId ?? null;
    await setState("clientes", { running: true });
    const res = await listAll<Json>("/clientes", {}, { entity: "clientes", triggeredBy: userId });
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
    const res = await listAll<Json>("/produtos", {}, { entity: "produtos", triggeredBy: userId });
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
    const res = await listAll<Json>("/condicoes-pagamento", {}, {
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
    const path = isUpdate ? `/propostas/${propAny.nomus_id}` : "/propostas";
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

    const res = await nomusFetch(`/propostas/${nomusId}/eventos`, {
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

    const res = await nomusFetch<Json>("/pedidos-venda", {
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
