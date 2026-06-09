import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusEnum = z.enum(["novo", "em_analise", "tentando_contato", "qualificado", "convertido", "descartado"]);

const inputSchema = z.object({
  contact_name: z.string().trim().max(120).optional().nullable(),
  client_name: z.string().trim().max(160).optional().nullable(),
  contact_email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  segmento: z.string().trim().max(80).optional().nullable(),
  aplicacao: z.string().trim().max(120).optional().nullable(),
  mensagem: z.string().trim().max(2000).optional().nullable(),
  origem: z.string().trim().max(40).default("manual"),
});

export const createMarketingLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { createMarketingLeadAdmin } = await import("./marketing-leads.server");
    return createMarketingLeadAdmin({
      ...data,
      contact_email: data.contact_email || null,
    });
  });

export type MarketingLeadRow = {
  id: string;
  lead_code: string;
  status: string;
  discard_reason: string | null;
  contact_name: string | null;
  client_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  segmento: string | null;
  aplicacao: string | null;
  mensagem: string | null;
  origem: string;
  origem_detalhe: Record<string, any> | null;
  assigned_to: string | null;
  assigned_at: string | null;
  first_response_at: string | null;
  qualified_at: string | null;
  converted_at: string | null;
  converted_to_sdr_lead_id: string | null;
  internal_note: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
};

export const listMarketingLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      status: statusEnum.optional(),
      search: z.string().trim().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<MarketingLeadRow[]> => {
    let q = context.supabase
      .from("marketing_leads" as never)
      .select("*")
      .order("received_at" as never, { ascending: false })
      .limit(data.limit ?? 200);
    if (data.status) q = q.eq("status" as never, data.status as never);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`client_name.ilike.${s},contact_name.ilike.${s},contact_email.ilike.${s},lead_code.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as MarketingLeadRow[];
  });

export const getMarketingLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: lead, error: e1 }, { data: events, error: e2 }] = await Promise.all([
      context.supabase.from("marketing_leads" as never).select("*").eq("id" as never, data.id as never).maybeSingle(),
      context.supabase.from("marketing_lead_events" as never).select("*").eq("lead_id" as never, data.id as never).order("created_at" as never, { ascending: false }).limit(100),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { lead: lead as unknown as MarketingLeadRow | null, events: (events ?? []) as unknown as Array<{ id: string; event_type: string; actor_name: string | null; payload: Record<string, any> | null; created_at: string }> };
  });

export const updateMarketingLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: statusEnum, note: z.string().trim().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.note) patch.internal_note = data.note;
    const { error } = await context.supabase
      .from("marketing_leads" as never)
      .update(patch as never)
      .eq("id" as never, data.id as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignMarketingLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("assign_marketing_lead" as never, {
      _lead_id: data.lead_id, _user_id: data.user_id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const discardMarketingLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid(), reason: z.string().trim().min(3).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("discard_marketing_lead" as never, {
      _lead_id: data.lead_id, _reason: data.reason,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const convertMarketingLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid(), sdr_id: z.string().uuid().optional().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("convert_marketing_lead_to_sdr" as never, {
      _lead_id: data.lead_id, _sdr_id: data.sdr_id ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { sdr_lead_id: res as unknown as string };
  });

export const markMarketingFirstResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lead_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_marketing_lead_first_response" as never, {
      _lead_id: data.lead_id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type MarketingDashboard = {
  total: number;
  novosHoje: number;
  novosSemana: number;
  porStatus: Record<string, number>;
  porOrigem: Record<string, number>;
  taxaConversao: number;
  slaMedioMin: number | null;
};

export const getMarketingDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MarketingDashboard> => {
    const { data, error } = await context.supabase
      .from("marketing_leads" as never)
      .select("status, origem, received_at, first_response_at, converted_at")
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ status: string; origem: string; received_at: string; first_response_at: string | null; converted_at: string | null }>;
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startWeek = new Date(now - 7 * 86400_000);
    const porStatus: Record<string, number> = {};
    const porOrigem: Record<string, number> = {};
    let novosHoje = 0, novosSemana = 0, converted = 0;
    const slas: number[] = [];
    for (const r of rows) {
      porStatus[r.status] = (porStatus[r.status] ?? 0) + 1;
      porOrigem[r.origem] = (porOrigem[r.origem] ?? 0) + 1;
      const t = new Date(r.received_at).getTime();
      if (t >= startToday.getTime()) novosHoje++;
      if (t >= startWeek.getTime()) novosSemana++;
      if (r.converted_at) converted++;
      if (r.first_response_at) {
        slas.push((new Date(r.first_response_at).getTime() - t) / 60_000);
      }
    }
    return {
      total: rows.length,
      novosHoje,
      novosSemana,
      porStatus,
      porOrigem,
      taxaConversao: rows.length ? (converted / rows.length) * 100 : 0,
      slaMedioMin: slas.length ? slas.reduce((a, b) => a + b, 0) / slas.length : null,
    };
  });

export const listMarketingAssignees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ur, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["marketing", "sdr", "gerente_comercial"]);
    if (error) throw new Error(error.message);
    const rows = (ur ?? []) as Array<{ user_id: string; role: string }>;
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length === 0) return [] as Array<{ user_id: string; full_name: string | null; email: string | null; roles: string[] }>;
    const { data: profs, error: pe } = await context.supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    if (pe) throw new Error(pe.message);
    const pmap = new Map<string, { full_name: string | null; email: string | null }>();
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      pmap.set(p.id, { full_name: p.full_name, email: p.email });
    }
    const map = new Map<string, { user_id: string; full_name: string | null; email: string | null; roles: string[] }>();
    for (const r of rows) {
      const prof = pmap.get(r.user_id) ?? { full_name: null, email: null };
      const cur = map.get(r.user_id) ?? { user_id: r.user_id, full_name: prof.full_name, email: prof.email, roles: [] };
      cur.roles.push(r.role);
      map.set(r.user_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  });

export type ScoreWeights = {
  mkt_triado: number;
  mkt_qualificado: number;
  mkt_sla_bonus: number;
  mkt_descarte_sem_motivo: number;
  sdr_tratativa: number;
  sdr_reuniao_agendada: number;
  sdr_handoff_aceito: number;
  sla_mkt_minutos: number;
  ranking_visivel_sdr: boolean;
};

export const getScoreWeights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScoreWeights> => {
    const { data, error } = await context.supabase
      .from("sdr_score_weights" as never)
      .select("*")
      .eq("id" as never, 1 as never)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? {
      mkt_triado: 1, mkt_qualificado: 3, mkt_sla_bonus: 1, mkt_descarte_sem_motivo: -2,
      sdr_tratativa: 2, sdr_reuniao_agendada: 5, sdr_handoff_aceito: 10,
      sla_mkt_minutos: 15, ranking_visivel_sdr: true,
    }) as unknown as ScoreWeights;
  });

export const updateScoreWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      mkt_triado: z.number(), mkt_qualificado: z.number(), mkt_sla_bonus: z.number(), mkt_descarte_sem_motivo: z.number(),
      sdr_tratativa: z.number(), sdr_reuniao_agendada: z.number(), sdr_handoff_aceito: z.number(),
      sla_mkt_minutos: z.number().int().min(1).max(1440),
      ranking_visivel_sdr: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sdr_score_weights" as never)
      .update({ ...data, updated_at: new Date().toISOString(), updated_by: context.userId } as never)
      .eq("id" as never, 1 as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
