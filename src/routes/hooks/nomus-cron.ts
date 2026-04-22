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
      const mapped = mapNomusProposal(raw);
      if (!mapped) return;

      // 1) Espelha em nomus_proposals (fonte fiel do payload Nomus)
      const { data: mirror } = await supabaseAdmin
        .from("nomus_proposals")
        .upsert(
          {
            nomus_id: mapped.nomus_id,
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
          },
          { onConflict: "nomus_id" }
        )
        .select("id")
        .single();
      const mirrorId = (mirror as { id: string } | null)?.id ?? null;

      // 2) Itens da proposta (vêm em itensProposta)
      if (mirrorId) {
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
          status: "em_elaboracao",
        });
      } else {
        const ex = existing as { id: string; client_id: string | null; title: string };
        await supabaseAdmin.from("proposals").update({
          nomus_proposal_id: mirrorId,
          title: baseTitle,
          total_value: mapped.valor_total ?? 0,
          valid_until: mapped.validade,
          ...(ex.client_id || !clientId ? {} : { client_id: clientId }),
          nomus_synced_at: new Date().toISOString(),
        }).eq("id", ex.id);
      }
    },
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
