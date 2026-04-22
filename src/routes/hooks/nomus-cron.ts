import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listAll } from "@/integrations/nomus/client";
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

type Mapper = (raw: Record<string, unknown>) => Promise<void>;

const mappers: Record<EntityKey, { endpoint: string; map: Mapper }> = {
  propostas: {
    endpoint: NOMUS_ENDPOINTS.propostas,
    map: async (raw) => {
      const nomus_id = pickStr(raw, "id", "idProposta", "codigo");
      if (!nomus_id) return;
      await supabaseAdmin.from("nomus_proposals").upsert({
        nomus_id,
        numero: pickStr(raw, "numero"),
        cliente_nomus_id: pickStr(raw, "idCliente", "clienteId"),
        vendedor_nomus_id: pickStr(raw, "idVendedor"),
        valor_total: pickNum(raw, "valorTotal", "valor"),
        status_nomus: pickStr(raw, "status", "situacao"),
        validade: pickStr(raw, "validade"),
        data_emissao: pickStr(raw, "dataEmissao"),
        raw: raw as never,
        synced_at: new Date().toISOString(),
      }, { onConflict: "nomus_id" });
    },
  },
  pedidos: {
    endpoint: NOMUS_ENDPOINTS.pedidos,
    map: async (raw) => {
      const nomus_id = pickStr(raw, "id", "idPedido", "numero");
      if (!nomus_id) return;
      await supabaseAdmin.from("nomus_pedidos").upsert({
        nomus_id,
        numero: pickStr(raw, "numero"),
        proposal_nomus_id: pickStr(raw, "idProposta"),
        cliente_nomus_id: pickStr(raw, "idCliente"),
        valor_total: pickNum(raw, "valorTotal", "valor"),
        status_nomus: pickStr(raw, "status"),
        data_emissao: pickStr(raw, "dataEmissao"),
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
        valor_total: pickNum(raw, "valorTotal", "valor"),
        status_nomus: pickStr(raw, "status"),
        data_emissao: pickStr(raw, "dataEmissao"),
        raw: raw as never,
        synced_at: new Date().toISOString(),
      }, { onConflict: "nomus_id" });
    },
  },
};

async function pullEntity(name: EntityKey): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { endpoint, map } = mappers[name];
  const res = await listAll<Record<string, unknown>>(endpoint, {}, { entity: name });
  if (!res.ok) return { ok: false, error: res.error };
  let count = 0;
  for (const r of res.items) { await map(r); count += 1; }
  await supabaseAdmin.from("nomus_sync_state").upsert({
    entity: name,
    last_synced_at: new Date().toISOString(),
    total_synced: count,
    running: false,
    updated_at: new Date().toISOString(),
  });
  return { ok: true, count };
}

export const Route = createFileRoute("/hooks/nomus-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
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
