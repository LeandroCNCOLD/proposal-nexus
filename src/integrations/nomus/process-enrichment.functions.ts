import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----------- helpers -----------

function normalizeName(n: string | null | undefined): string {
  return (n ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function proposalStatusLabel(status: string | null | undefined): string | null {
  const s = (status ?? "").trim();
  if (!s) return null;
  if (s === "3") return "Venda confirmada";
  return s;
}

function shouldMoveToWonStage(status: string | null | undefined): boolean {
  const label = normalizeName(proposalStatusLabel(status));
  return /venda confirmada|confirmad|ganh|aprovad/.test(label);
}

function extractProposalNumbers(...values: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const value of values) {
    const text = value ?? "";
    for (const match of text.matchAll(/CN\s*0*\d+(?:\s*Rev\.?\s*0*\d+)?/gi)) {
      found.add(match[0].replace(/\s+/g, " ").trim().toLowerCase());
    }
  }
  return Array.from(found);
}

function normalizeProposalNumber(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

const FIELD_PATTERNS: Record<string, RegExp> = {
  decisor: /decisor\s*[:：]\s*([^\n<]+)/i,
  interesse: /interesse\s*[:：]\s*([^\n<]+)/i,
  probabilidade: /probabilidade\s*[:：]\s*([^\n<]+)/i,
  projeto: /projeto\s*[:：]\s*([^\n<]+)/i,
  segmento: /segmento\s*[:：]\s*([^\n<]+)/i,
};

export function parseProcessDescription(html: string | null | undefined): {
  decisor?: string;
  interesse?: string;
  probabilidade?: string;
  probabilidade_pct?: number;
  projeto?: string;
  segmento?: string;
} {
  if (!html) return {};
  const text = html.replace(/<[^>]+>/g, "\n");
  const out: Record<string, string> = {};
  for (const [k, re] of Object.entries(FIELD_PATTERNS)) {
    const m = text.match(re);
    if (m) out[k] = m[1].trim();
  }
  let probabilidade_pct: number | undefined;
  if (out.probabilidade) {
    const m = out.probabilidade.match(/(\d{1,3})\s*%/);
    if (m) probabilidade_pct = Math.min(100, parseInt(m[1], 10));
  }
  return { ...out, probabilidade_pct };
}

// ----------- getFunnelData -----------

export const getFunnelData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      tipo: z.string().min(1),
      filters: z
        .object({
          responsavel: z.string().optional(),
          equipe: z.string().optional(),
          pessoa: z.string().optional(),
          processo: z.string().optional(),
          proposta: z.string().optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1) Processos do tipo
    let q = supabase
      .from("nomus_processes")
      .select(
        "id, nomus_id, nome, pessoa, tipo, etapa, prioridade, responsavel, equipe, proximo_contato, data_criacao, descricao",
      )
      .eq("tipo", data.tipo)
      .order("data_criacao", { ascending: false })
      .limit(10000);
    const f = data.filters ?? {};
    if (f.responsavel) q = q.ilike("responsavel", `%${f.responsavel}%`);
    if (f.equipe) q = q.ilike("equipe", `%${f.equipe}%`);
    if (f.pessoa) q = q.ilike("pessoa", `%${f.pessoa}%`);
    if (f.processo) q = q.or(`nome.ilike.%${f.processo}%,nomus_id.ilike.%${f.processo}%`);

    const { data: processes, error: pErr } = await q;
    if (pErr) return { ok: false as const, error: pErr.message };

    const processList = Array.from(
      new Map((processes ?? []).map((p) => [p.nomus_id, p])).values(),
    );
    const processIds = processList.map((p) => p.id);
    const clientNames = Array.from(new Set(processList.map((p) => normalizeName(p.pessoa)).filter(Boolean)));

    // 2) Propostas Nomus por nome de cliente (match automático)
    const proposalsByClient = new Map<string, Array<{
      id: string;
      numero: string | null;
      valor_total: number | null;
      validade: string | null;
      status_nomus: string | null;
      data_emissao: string | null;
      nomus_id: string;
    }>>();
    const proposalIds: string[] = [];
    if (clientNames.length > 0) {
      const { data: props } = await supabase
        .from("nomus_proposals")
        .select("id, nomus_id, numero, cliente_nome, valor_total, validade, status_nomus, data_emissao")
        .in("cliente_nome", processList.map((p) => p.pessoa).filter(Boolean) as string[])
        .limit(1000);
      for (const pr of props ?? []) {
        const key = normalizeName(pr.cliente_nome);
        if (!key) continue;
        proposalIds.push(pr.id);
        if (!proposalsByClient.has(key)) proposalsByClient.set(key, []);
        proposalsByClient.get(key)!.push({
          id: pr.id,
          numero: pr.numero,
          valor_total: pr.valor_total,
          validade: pr.validade,
          status_nomus: pr.status_nomus,
          data_emissao: pr.data_emissao,
          nomus_id: pr.nomus_id,
        });
      }
    }

    const itemStatusByProposal = new Map<string, string>();

    // 3) Meta local + vínculos manuais + último stage_change
    const [metaRes, manualLinksRes, stageChangesRes, attachCountsRes] = await Promise.all([
      processIds.length
        ? supabase.from("crm_process_meta").select("*").in("process_id", processIds)
        : Promise.resolve({ data: [] as any[] }),
      processIds.length
        ? supabase
            .from("crm_process_proposals")
            .select("process_id, nomus_proposal_id, proposal_id, is_primary")
            .in("process_id", processIds)
        : Promise.resolve({ data: [] as any[] }),
      processIds.length
        ? supabase
            .from("crm_stage_changes")
            .select("process_id, changed_at")
            .in("process_id", processIds)
            .order("changed_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      processIds.length
        ? supabase.from("crm_attachments").select("process_id").in("process_id", processIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const metaMap = new Map<string, any>();
    for (const m of metaRes.data ?? []) metaMap.set(m.process_id, m);

    const lastStageChange = new Map<string, string>();
    for (const sc of stageChangesRes.data ?? []) {
      if (!lastStageChange.has(sc.process_id)) lastStageChange.set(sc.process_id, sc.changed_at);
    }

    const attachCount = new Map<string, number>();
    for (const a of attachCountsRes.data ?? []) {
      attachCount.set(a.process_id, (attachCount.get(a.process_id) ?? 0) + 1);
    }

    // 4) Monta cards enriquecidos
    const enriched = processList.map((p) => {
      const parsed = parseProcessDescription(p.descricao);
      const meta = metaMap.get(p.id);
      const clientKey = normalizeName(p.pessoa);
      const allClientProposals = proposalsByClient.get(clientKey) ?? [];
      const mentionedNumbers = extractProposalNumbers(p.nome, p.descricao);
      const clientProposals = mentionedNumbers.length > 0
        ? allClientProposals.filter((proposal) => mentionedNumbers.includes(normalizeProposalNumber(proposal.numero)))
        : allClientProposals.length === 1
          ? allClientProposals
          : [];

      // Proposta primária: vínculo explícito por número CN; se houver mais de uma revisão, usa a mais recente.
      const sorted = [...clientProposals].sort((a, b) => {
        const byDate = new Date(b.data_emissao ?? "").getTime() - new Date(a.data_emissao ?? "").getTime();
        if (Number.isFinite(byDate) && byDate !== 0) return byDate;
        return (Number(b.nomus_id) || 0) - (Number(a.nomus_id) || 0);
      });
      const primary = sorted[0];
      const primaryStatus = proposalStatusLabel(primary?.status_nomus ?? itemStatusByProposal.get(primary?.id ?? ""));
      const etapa = shouldMoveToWonStage(primaryStatus) ? "Venda confirmada" : p.etapa;

      const totalValue = clientProposals.reduce((s, x) => s + (x.valor_total ?? 0), 0);

      return {
        id: p.id,
        nomus_id: p.nomus_id,
        nome: p.nome,
        pessoa: p.pessoa,
        etapa,
        prioridade: p.prioridade,
        responsavel: p.responsavel,
        equipe: p.equipe,
        proximo_contato: p.proximo_contato,
        data_criacao: p.data_criacao,
        decisor: meta?.decisor ?? parsed.decisor ?? null,
        interesse: meta?.interesse ?? parsed.interesse ?? null,
        probabilidade_pct: meta?.probabilidade_pct ?? parsed.probabilidade_pct ?? null,
        probabilidade_label: meta?.probabilidade_label ?? parsed.probabilidade ?? null,
        projeto_estado: meta?.projeto_estado ?? parsed.projeto ?? null,
        segmento: meta?.segmento_override ?? parsed.segmento ?? null,
        proposta_numero: primary?.numero ?? null,
        proposta_valor: primary?.valor_total ?? null,
        proposta_validade: primary?.validade ?? null,
        propostas_count: clientProposals.length,
        propostas_valor_total: totalValue,
        last_stage_change: lastStageChange.get(p.id) ?? null,
        attachments_count: attachCount.get(p.id) ?? 0,
      };
    });

    // 5) Agrupa por etapa
    const byStage = new Map<string, typeof enriched>();
    for (const e of enriched) {
      const key = (e.etapa ?? "").trim() || "Sem etapa";
      if (!byStage.has(key)) byStage.set(key, []);
      byStage.get(key)!.push(e);
    }

    // 5.1) Busca a estrutura oficial do funil (todas as etapas conhecidas, na ordem do Nomus)
    const { data: stageDefs } = await supabase
      .from("crm_funnel_stages")
      .select("etapa, display_order, is_won, is_lost, is_hidden, color")
      .eq("tipo", data.tipo)
      .eq("is_hidden", false)
      .order("display_order", { ascending: true });

    const orderedEtapas: Array<{ etapa: string; is_won: boolean; is_lost: boolean; color: string | null }> = [];
    const seen = new Set<string>();
    for (const sd of stageDefs ?? []) {
      orderedEtapas.push({ etapa: sd.etapa, is_won: sd.is_won, is_lost: sd.is_lost, color: sd.color });
      seen.add(sd.etapa);
    }
    // Acrescenta etapas que apareceram em processos mas não estão cadastradas (ex: "Sem etapa" ou novas)
    for (const k of byStage.keys()) {
      if (!seen.has(k)) orderedEtapas.push({ etapa: k, is_won: false, is_lost: false, color: null });
    }

    const stages = orderedEtapas.map(({ etapa, is_won, is_lost, color }) => {
      const items = byStage.get(etapa) ?? [];
      const totalValue = items.reduce((s, x) => s + (x.proposta_valor ?? 0), 0);
      const proposalCount = items.reduce((s, x) => s + x.propostas_count, 0);
      return {
        etapa,
        is_won,
        is_lost,
        color,
        count: items.length,
        totalValue,
        proposalCount,
        avgTicket: items.length ? totalValue / items.length : 0,
        processes: items,
      };
    });

    return { ok: true as const, stages };
  });

// ----------- getProcessDetail -----------

export const getProcessDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: process, error } = await supabase
      .from("nomus_processes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!process) return { ok: false as const, error: "Processo não encontrado" };

    const clientKey = normalizeName(process.pessoa);

    const [metaRes, followupsRes, notesRes, attachmentsRes, stageChangesRes, manualLinksRes, propsRes] =
      await Promise.all([
        supabase.from("crm_process_meta").select("*").eq("process_id", process.id).maybeSingle(),
        supabase
          .from("crm_followups")
          .select("*")
          .eq("process_id", process.id)
          .order("scheduled_for", { ascending: false }),
        supabase
          .from("crm_notes")
          .select("*")
          .eq("process_id", process.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("crm_attachments")
          .select("*")
          .eq("process_id", process.id)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("crm_stage_changes")
          .select("*")
          .eq("process_id", process.id)
          .order("changed_at", { ascending: false }),
        supabase
          .from("crm_process_proposals")
          .select("*")
          .eq("process_id", process.id),
        clientKey
          ? supabase
              .from("nomus_proposals")
              .select("id, nomus_id, numero, cliente_nome, valor_total, validade, status_nomus, data_emissao, vendedor_nome")
              .limit(500)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    const allProps = (propsRes.data ?? []).filter(
      (p: any) => normalizeName(p.cliente_nome) === clientKey,
    );

    const parsed = parseProcessDescription(process.descricao);

    return {
      ok: true as const,
      process,
      meta: metaRes.data,
      parsed,
      followups: followupsRes.data ?? [],
      notes: notesRes.data ?? [],
      attachments: attachmentsRes.data ?? [],
      stageChanges: stageChangesRes.data ?? [],
      manualLinks: manualLinksRes.data ?? [],
      clientProposals: allProps,
    };
  });

// ----------- mutations -----------

export const updateProcessMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      process_id: z.string().uuid(),
      decisor: z.string().nullable().optional(),
      interesse: z.string().nullable().optional(),
      probabilidade_pct: z.number().min(0).max(100).nullable().optional(),
      probabilidade_label: z.string().nullable().optional(),
      projeto_estado: z.string().nullable().optional(),
      segmento_override: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("crm_process_meta")
      .upsert(
        { ...data, updated_by: userId, updated_at: new Date().toISOString() },
        { onConflict: "process_id" },
      );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const addFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      process_id: z.string().uuid(),
      scheduled_for: z.string(),
      note: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("crm_followups").insert({ ...data, created_by: userId });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const markFollowupDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("crm_followups")
      .update({ done_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ process_id: z.string().uuid(), body: z.string().min(1).max(5000) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("crm_notes").insert({ ...data, created_by: userId });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const linkProposalManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      process_id: z.string().uuid(),
      nomus_proposal_id: z.string().uuid().optional(),
      proposal_id: z.string().uuid().optional(),
      is_primary: z.boolean().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("crm_process_proposals")
      .insert({ ...data, created_by: userId });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const unlinkProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("crm_process_proposals").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
