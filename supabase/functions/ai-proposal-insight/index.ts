// Edge Function: ai-proposal-insight
// Gera insights de proposta (resumo / próximo passo) usando o Lovable AI Gateway.
// - Valida autenticação do usuário (JWT do Supabase).
// - Monta contexto rico: proposta, cliente, itens, timeline, envios.
// - Persiste resultado em ai_insights para auditoria/cache.
// - Retorna { content: string } compatível com a UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Task = "resumo" | "proximo_passo";

interface Body {
  proposal_id?: string;
  task?: Task;
}

const SYSTEM_PROMPTS: Record<Task, string> = {
  resumo:
    "Você é um analista comercial sênior em equipamentos de refrigeração industrial. " +
    "Gere um RESUMO EXECUTIVO curto e objetivo da proposta, em português do Brasil. " +
    "Estrutura obrigatória (markdown):\n" +
    "**Resumo executivo**: 2-3 linhas.\n" +
    "**Pontos comerciais**: bullets curtos.\n" +
    "**Riscos imediatos**: bullets curtos (se não houver, escreva 'Nenhum risco evidente').\n" +
    "Não invente dados. Use apenas o contexto fornecido.",
  proximo_passo:
    "Você é um gerente comercial sênior. Recomende o PRÓXIMO PASSO comercial mais eficaz, " +
    "em português do Brasil, com base no contexto da proposta. Estrutura obrigatória (markdown):\n" +
    "**Próximo passo recomendado**: 1 frase clara e acionável.\n" +
    "**Justificativa**: 2-3 bullets baseados no contexto.\n" +
    "**Urgência**: baixa | média | alta — com 1 linha de motivo.\n" +
    "Não invente dados. Use apenas o contexto fornecido.",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(v));
  } catch {
    return String(v);
  }
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function buildContext(args: {
  proposal: any;
  client: any;
  items: any[];
  timeline: any[];
  sends: any[];
}): string {
  const { proposal: p, client, items, timeline, sends } = args;
  const lines: string[] = [];
  lines.push("=== PROPOSTA ===");
  lines.push(`Número: ${p.number ?? "—"}`);
  lines.push(`Título: ${p.title ?? "—"}`);
  lines.push(`Status: ${p.status ?? "—"}`);
  lines.push(`Temperatura: ${p.temperature ?? "—"}`);
  lines.push(`Probabilidade: ${p.win_probability != null ? p.win_probability + "%" : "—"}`);
  lines.push(`Valor total: ${fmtBRL(p.total_value)}`);
  lines.push(`Desconto: ${p.discount ?? 0}`);
  lines.push(`Validade: ${fmtDate(p.valid_until)}`);
  lines.push(`Próximo follow-up: ${fmtDate(p.next_followup_at)}`);
  lines.push(`Enviada em: ${fmtDate(p.sent_at)}`);
  lines.push(`Pagamento: ${p.payment_terms ?? "—"}`);
  lines.push(`Prazo de entrega: ${p.delivery_term ?? "—"}`);
  if (p.commercial_notes) lines.push(`Notas comerciais: ${p.commercial_notes}`);
  if (p.technical_notes) lines.push(`Notas técnicas: ${p.technical_notes}`);

  lines.push("\n=== CLIENTE ===");
  if (client) {
    lines.push(`Nome: ${client.name ?? "—"}`);
    lines.push(`Segmento: ${client.segment ?? "—"}`);
    lines.push(`Região: ${client.region ?? "—"}`);
    lines.push(`Cidade/UF: ${client.city ?? "—"}/${client.state ?? "—"}`);
  } else {
    lines.push("(sem cliente vinculado)");
  }

  lines.push("\n=== ITENS ===");
  if (items.length === 0) {
    lines.push("(sem itens)");
  } else {
    for (const it of items.slice(0, 30)) {
      lines.push(
        `- ${it.description ?? "item"} | qtd ${it.quantity ?? 1} | un ${fmtBRL(
          it.unit_price,
        )} | total ${fmtBRL(it.total_price)}`,
      );
    }
    if (items.length > 30) lines.push(`(+${items.length - 30} itens omitidos)`);
  }

  lines.push("\n=== TIMELINE RECENTE ===");
  if (timeline.length === 0) {
    lines.push("(sem eventos)");
  } else {
    for (const t of timeline.slice(0, 15)) {
      lines.push(
        `- [${fmtDate(t.created_at)}] ${t.event_type}: ${t.description ?? ""}${
          t.next_step ? ` → próximo: ${t.next_step}` : ""
        }`,
      );
    }
  }

  lines.push("\n=== ENVIOS ===");
  if (sends.length === 0) {
    lines.push("(nenhum envio registrado)");
  } else {
    for (const s of sends.slice(0, 10)) {
      lines.push(
        `- [${fmtDate(s.sent_at)}] ${s.channel} → ${s.recipient ?? "—"} (${s.delivery_status})${
          s.opened_at ? ` | aberto em ${fmtDate(s.opened_at)}` : ""
        }`,
      );
    }
  }

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // 2) Input
    const body = (await req.json().catch(() => ({}))) as Body;
    const proposalId = body.proposal_id;
    const task = body.task;
    if (!proposalId || (task !== "resumo" && task !== "proximo_passo")) {
      return new Response(
        JSON.stringify({
          error:
            "Parâmetros inválidos: 'proposal_id' obrigatório e 'task' deve ser 'resumo' ou 'proximo_passo'.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3) Carrega contexto (RLS aplicada — usa o client do usuário)
    const [
      { data: proposal, error: pErr },
      { data: items },
      { data: timeline },
      { data: sends },
    ] = await Promise.all([
      userClient
        .from("proposals")
        .select(
          "id, number, title, status, temperature, total_value, discount, valid_until, next_followup_at, sent_at, payment_terms, delivery_term, commercial_notes, technical_notes, win_probability, client_id",
        )
        .eq("id", proposalId)
        .maybeSingle(),
      userClient
        .from("proposal_items")
        .select("description, quantity, unit_price, total_price, position")
        .eq("proposal_id", proposalId)
        .order("position", { ascending: true }),
      userClient
        .from("proposal_timeline_events")
        .select("event_type, description, next_step, created_at")
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: false })
        .limit(20),
      userClient
        .from("proposal_send_events")
        .select("channel, recipient, delivery_status, sent_at, opened_at")
        .eq("proposal_id", proposalId)
        .order("sent_at", { ascending: false })
        .limit(10),
    ]);

    if (pErr || !proposal) {
      return new Response(
        JSON.stringify({ error: "Proposta não encontrada ou sem acesso." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let client: any = null;
    if (proposal.client_id) {
      const { data: c } = await userClient
        .from("clients")
        .select("name, segment, region, city, state")
        .eq("id", proposal.client_id)
        .maybeSingle();
      client = c;
    }

    const context = buildContext({
      proposal,
      client,
      items: items ?? [],
      timeline: timeline ?? [],
      sends: sends ?? [],
    });

    const promptHash = await sha256Hex(`${task}::${context}`);

    // 3.1) Cache: se já existe insight com mesmo hash, retorna direto
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: cached } = await admin
      .from("ai_insights")
      .select("content")
      .eq("proposal_id", proposalId)
      .eq("insight_type", task)
      .eq("prompt_hash", promptHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached?.content) {
      return new Response(
        JSON.stringify({ content: cached.content, cached: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4) Chama Lovable AI
    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPTS[task] },
            { role: "user", content: context },
          ],
        }),
      },
    );

    if (!aiResp.ok) {
      const txt = await aiResp.text().catch(() => "");
      console.error("AI gateway error", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requisições atingido. Tente novamente em instantes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos do Lovable AI esgotados. Adicione créditos em Settings → Workspace → Usage.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({ error: `Falha no provedor de IA (HTTP ${aiResp.status}).` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiJson = await aiResp.json();
    const content: string =
      aiJson?.choices?.[0]?.message?.content?.toString().trim() ?? "";
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do provedor de IA." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5) Persiste em ai_insights (service role para garantir gravação)
    await admin.from("ai_insights").insert({
      proposal_id: proposalId,
      insight_type: task,
      content,
      prompt_hash: promptHash,
      created_by: userId,
      metadata: {
        model: "google/gemini-3-flash-preview",
        items_count: items?.length ?? 0,
        timeline_count: timeline?.length ?? 0,
      },
    });

    return new Response(JSON.stringify({ content, cached: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-proposal-insight fatal", e);
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
