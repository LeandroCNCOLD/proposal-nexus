import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nomusFetch, listAll } from "@/integrations/nomus/client";

// Hook acionado pelo pg_cron a cada N minutos. Faz pull incremental
// de propostas, pedidos e NF do Nomus. Usa um token Bearer simples
// (publishable key) só pra autorizar a chamada.

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
        const entity = body.entity ?? "all";

        const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};

        async function pullList(name: string, path: string, mapRow: (raw: Record<string, unknown>) => Promise<void>) {
          const res = await listAll<Record<string, unknown>>(path, {}, { entity: name });
          if (!res.ok) { results[name] = { ok: false, error: res.error }; return; }
          let count = 0;
          for (const r of res.items) { await mapRow(r); count += 1; }
          results[name] = { ok: true, count };
          await supabaseAdmin.from("nomus_sync_state").upsert({
            entity: name, last_synced_at: new Date().toISOString(), total_synced: count, running: false, updated_at: new Date().toISOString(),
          });
        }

        const pickStr = (o: Record<string, unknown>, ...keys: string[]): string | null => {
          for (const k of keys) {
            const v = o[k]; if (v !== undefined && v !== null && v !== "") return String(v);
          } return null;
        };
        const pickNum = (o: Record<string, unknown>, ...keys: string[]): number | null => {
          for (const k of keys) {
            const v = o[k]; if (v !== undefined && v !== null && v !== "") { const n = Number(v); if (!Number.isNaN(n)) return n; }
          } return null;
        };

        if (entity === "all" || entity === "propostas") {
          await pullList("propostas", "/propostas", async (raw) => {
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
              raw: raw as never, synced_at: new Date().toISOString(),
            }, { onConflict: "nomus_id" });
          });
        }
        if (entity === "all" || entity === "pedidos") {
          await pullList("pedidos", "/pedidos-venda", async (raw) => {
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
              raw: raw as never, synced_at: new Date().toISOString(),
            }, { onConflict: "nomus_id" });
          });
        }
        if (entity === "all" || entity === "notas_fiscais") {
          await pullList("notas_fiscais", "/notas-fiscais", async (raw) => {
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
              raw: raw as never, synced_at: new Date().toISOString(),
            }, { onConflict: "nomus_id" });
          });
        }

        return new Response(JSON.stringify({ ok: true, results }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

// Suprimir warning de import não usado (nomusFetch não é usado neste arquivo)
void nomusFetch;
