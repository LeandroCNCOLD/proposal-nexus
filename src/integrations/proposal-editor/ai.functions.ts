// Server function de IA para assistência de escrita técnico-comercial em propostas.
// Usa o Lovable AI Gateway (LOVABLE_API_KEY já provisionado).
// Aplica técnicas de PNL, copywriting B2B e frameworks de vendas (PAS, AIDA, FAB, SPIN).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ACTIONS = [
  "improve",
  "summarize",
  "expand",
  "continue",
  "bullets",
  "consultive",
  "benefits",
  "nlp_triggers",
  "storytelling",
  "objections",
  "cta",
  "analyze",
  "variations",
  "free",
] as const;

export type AiAssistAction = (typeof ACTIONS)[number];

const InputSchema = z.object({
  action: z.enum(ACTIONS),
  text: z.string().min(1).max(20000),
  instruction: z.string().max(2000).optional(),
  contextHint: z.string().max(2000).optional(),
});

const BASE_PERSONA = `Você é um copywriter sênior B2B especializado em vendas técnicas industriais
e um engenheiro de vendas em refrigeração industrial (câmaras frigoríficas, equipamentos plugin,
climatização). Escreve em PORTUGUÊS DO BRASIL, com tom consultivo, autoridade técnica e foco em
conversão.

Domina e aplica naturalmente:
- PNL aplicada a vendas (rapport, calibragem, ancoragem, reframing, future pacing, pressuposições positivas).
- Frameworks de copy: PAS (Problem/Agitate/Solve), AIDA (Atenção/Interesse/Desejo/Ação), FAB (Feature/Advantage/Benefit).
- Vendas consultivas: SPIN (Situação/Problema/Implicação/Necessidade), Sandler, Challenger Sale.
- Gatilhos mentais calibrados para B2B industrial: autoridade técnica, prova social setorial,
  reciprocidade, escassez real, compromisso e coerência, aversão à perda (downtime, perda de produto).
- Princípios: clareza > rebuscamento; benefícios > features; números concretos > adjetivos vagos;
  voz ativa; frases curtas; sem jargão vazio; sem promessas exageradas; sem inventar dados.

Regras:
- NUNCA invente números, prazos, modelos ou marcas que não estejam no texto/contexto.
- Mantenha a precisão técnica de termos de refrigeração (carga térmica, temperatura, plugin, MT/LT, etc.).
- Devolva HTML simples e válido (use <p>, <strong>, <em>, <ul><li>, <h3>) — NUNCA markdown, NUNCA \`\`\` cercas.
- Não inclua preâmbulos como "Aqui está…" ou "Claro!". Devolva direto o conteúdo final.`;

const ACTION_PROMPTS: Record<AiAssistAction, string> = {
  improve:
    "Reescreva o texto corrigindo gramática, ortografia, fluidez e clareza técnica. Mantenha o sentido " +
    "original e o nível de detalhe. Use voz ativa e frases curtas.",
  summarize:
    "Resuma o texto em até 40% do tamanho original, preservando dados técnicos, números e conclusões. " +
    "Estrutura: 1 parágrafo curto + (se útil) bullets com os pontos-chave.",
  expand:
    "Desenvolva o texto com mais profundidade técnica e comercial, sem inventar dados. Acrescente " +
    "implicações operacionais, benefícios práticos para o cliente e conexões com o resultado final. " +
    "Pode crescer até 2x o tamanho.",
  continue:
    "Continue o texto a partir do final, mantendo voz, tom e nível técnico. Adicione 1-3 parágrafos " +
    "que avancem naturalmente o argumento. Devolva APENAS a continuação (não repita o texto original).",
  bullets:
    "Reestruture o texto como uma lista de bullets claros e escaneáveis. Use <ul><li>. Cada bullet " +
    "começa com um substantivo ou verbo de ação forte. Mantenha 100% do conteúdo técnico.",
  consultive:
    "Reescreva no TOM CONSULTIVO de um especialista sênior. Aplique PNL: pressuposições positivas " +
    "('quando você operar com…' em vez de 'se decidir por…'), future pacing (descreva o cliente já " +
    "operando com a solução), ancoragem em autoridade técnica. Demonstra domínio sem soar arrogante.",
  benefits:
    "Reescreva aplicando o framework FAB: para cada característica técnica do texto, transforme em " +
    "BENEFÍCIO TANGÍVEL para o cliente (redução de perdas de produto, eficiência energética, " +
    "previsibilidade operacional, ROI, segurança alimentar, redução de manutenção corretiva). " +
    "Estrutura sugerida: o quê → por que importa → o que o cliente ganha.",
  nlp_triggers:
    "Reescreva incorporando gatilhos mentais calibrados para B2B industrial, SEM exagero: " +
    "autoridade técnica (engenharia, normas, expertise), prova social setorial (operações similares), " +
    "aversão à perda (downtime, perdas de produto, multas sanitárias), compromisso e coerência, " +
    "reciprocidade (suporte, garantia, acompanhamento). Mantenha credibilidade — sem clichês de " +
    "infomercial.",
  storytelling:
    "Reescreva como narrativa de vendas problema → solução. Estrutura: " +
    "1) DOR atual do cliente (situação real); 2) CONSEQUÊNCIA se mantida (custos, riscos, perdas); " +
    "3) NOSSA SOLUÇÃO (o que faz, como age); 4) NOVO CENÁRIO (o cliente operando com previsibilidade " +
    "e estabilidade). Use future pacing no item 4.",
  objections:
    "Reescreva antecipando e respondendo as objeções B2B mais comuns no setor: " +
    "preço/investimento, prazo de entrega, complexidade de instalação, manutenção, suporte pós-venda, " +
    "garantia, retorno do investimento. Inclua respostas tecnicamente sólidas no próprio fluxo do " +
    "texto, sem usar formato de FAQ.",
  cta:
    "Mantenha o texto original e ADICIONE ao final um Call-to-Action de fechamento, calibrado para " +
    "decisor industrial (gerente de operações, engenheiro, diretor industrial). Tom firme mas " +
    "consultivo. Sugira o próximo passo concreto (reunião técnica, visita, alinhamento de cronograma).",
  analyze:
    "ANÁLISE — não reescreva o texto. Devolva HTML com a estrutura: " +
    "<h3>Diagnóstico</h3><p>2-3 linhas sobre clareza, tom, foco.</p>" +
    "<h3>Score de persuasão</h3><p><strong>X/10</strong> — justificativa em 1 linha.</p>" +
    "<h3>Gatilhos presentes</h3><ul><li>…</li></ul>" +
    "<h3>Gatilhos ausentes que poderiam ajudar</h3><ul><li>…</li></ul>" +
    "<h3>Objeções não tratadas</h3><ul><li>…</li></ul>" +
    "<h3>3 sugestões pontuais</h3><ol><li>…</li><li>…</li><li>…</li></ol>",
  variations:
    "Gere DUAS variações alternativas do texto. Devolva HTML: " +
    "<h3>Variação A — Mais técnica</h3><div>…</div>" +
    "<h3>Variação B — Mais comercial</h3><div>…</div>. " +
    "Cada variação preserva o conteúdo central, mas calibra tom e ênfase.",
  free:
    "Aplique a instrução do usuário ao texto. Mantenha rigor técnico, não invente dados, e devolva " +
    "HTML simples válido.",
};

interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GatewayChoice {
  message?: { content?: string };
}

interface GatewayResponse {
  choices?: GatewayChoice[];
}

async function callGateway(messages: GatewayMessage[]): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada no servidor.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
    }),
  });

  if (res.status === 429) {
    throw new Error("Limite de uso da IA atingido. Aguarde alguns instantes e tente novamente.");
  }
  if (res.status === 402) {
    throw new Error(
      "Créditos da IA esgotados. Adicione créditos em Configurações → Workspace → Uso.",
    );
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Falha na IA (${res.status}): ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as GatewayResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("A IA não retornou conteúdo.");
  return content;
}

export const aiAssistText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const actionPrompt = ACTION_PROMPTS[data.action];
    const userParts: string[] = [];

    if (data.contextHint) {
      userParts.push(`CONTEXTO DA PROPOSTA: ${data.contextHint}`);
    }
    userParts.push(`TAREFA: ${actionPrompt}`);
    if (data.action === "free" && data.instruction) {
      userParts.push(`INSTRUÇÃO DO USUÁRIO: ${data.instruction}`);
    } else if (data.instruction) {
      userParts.push(`OBSERVAÇÃO ADICIONAL: ${data.instruction}`);
    }
    userParts.push(`TEXTO DE ENTRADA:\n"""\n${data.text}\n"""`);
    userParts.push("Devolva apenas o resultado em HTML simples (sem markdown, sem cercas).");

    const content = await callGateway([
      { role: "system", content: BASE_PERSONA },
      { role: "user", content: userParts.join("\n\n") },
    ]);

    return { content };
  });
