import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { proposal_id, task } = body || {};

    if (!proposal_id || !task) {
      return new Response(
        JSON.stringify({ error: "Missing parameters" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let content = "";

    if (task === "resumo") {
      content = `Resumo da proposta ${proposal_id}:
- Proposta em andamento
- Cliente ativo
- Aguardando avanço comercial`;
    } else if (task === "proximo_passo") {
      content = `Próximo passo:
- Fazer follow-up com cliente
- Confirmar decisão
- Registrar retorno`;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid task" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ content }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
