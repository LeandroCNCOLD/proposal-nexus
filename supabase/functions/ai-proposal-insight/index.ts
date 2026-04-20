type InsightTask = "resumo" | "proximo_passo";

type InsightPayload = {
  proposal_id?: string;
  task?: InsightTask;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const buildContent = (proposalId: string, task: InsightTask) => {
  if (task === "resumo") {
    return [
      `Resumo inicial da proposta ${proposalId}.`,
      "Esta é uma implementação básica da função de insight.",
      "Use este retorno como fallback até integrar uma análise mais avançada.",
    ].join("\n");
  }

  return [
    `Próximo passo sugerido para a proposta ${proposalId}:`,
    "confirmar escopo comercial, validar condições finais e registrar o próximo follow-up com o cliente.",
  ].join("\n");
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  let payload: InsightPayload;

  try {
    payload = (await request.json()) as InsightPayload;
  } catch {
    return json({ error: "Payload inválido." }, 400);
  }

  const proposalId = payload.proposal_id?.trim();
  const task = payload.task;

  if (!proposalId) {
    return json({ error: "proposal_id é obrigatório." }, 400);
  }

  if (task !== "resumo" && task !== "proximo_passo") {
    return json({ error: "task deve ser resumo ou proximo_passo." }, 400);
  }

  return json({
    content: buildContent(proposalId, task),
  });
});
