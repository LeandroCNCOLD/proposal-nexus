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
    const { proposal_id, task } = body ?? {};

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
      content = [
        `Resumo da proposta ${proposal_id}:`,
        "- Proposta em acompanhamento",
        "- Verificar cliente, valor, validade e estágio atual",
        "- Confirmar pendências e histórico recente",
      ].join("\n");
    } else if (task === "proximo_passo") {
      content = [
        "Próximo passo recomendado:",
        "- Realizar follow-up com o cliente",
        "- Confirmar pendências técnicas e comerciais",
        "- Registrar a próxima ação com data definida",
      ].join("\n");
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
    const message = err instanceof Error ? err.message : "Unknown error";

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
