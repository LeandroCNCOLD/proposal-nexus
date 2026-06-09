import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sourceEnum = z.enum(["sdr", "marketing"]);
const statusEnum = z.enum(["pendente", "em_campanha", "concluido", "descartado"]);

export type RemarketingRow = {
  id: string;
  source: "sdr" | "marketing";
  source_lead_id: string;
  lead_code: string | null;
  client_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  segmento: string | null;
  mensagem: string | null;
  reason: string | null;
  status: "pendente" | "em_campanha" | "concluido" | "descartado";
  campaign_name: string | null;
  scheduled_for: string | null;
  added_by: string | null;
  added_by_name: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export const enqueueRemarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      source: sourceEnum,
      lead_id: z.string().uuid(),
      reason: z.string().trim().max(500).optional().nullable(),
      scheduled_for: z.string().datetime().optional().nullable(),
      campaign_name: z.string().trim().max(160).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("enqueue_remarketing" as never, {
      _source: data.source,
      _lead_id: data.lead_id,
      _reason: data.reason ?? null,
      _scheduled_for: data.scheduled_for ?? null,
      _campaign: data.campaign_name ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

export const listRemarketingQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      status: statusEnum.optional(),
      source: sourceEnum.optional(),
      search: z.string().trim().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<RemarketingRow[]> => {
    let q = context.supabase
      .from("marketing_remarketing_queue" as never)
      .select("*")
      .order("created_at" as never, { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status" as never, data.status as never);
    if (data.source) q = q.eq("source" as never, data.source as never);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`client_name.ilike.${s},contact_name.ilike.${s},lead_code.ilike.${s},contact_email.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as RemarketingRow[];
  });

export const updateRemarketingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: statusEnum.optional(),
      campaign_name: z.string().trim().max(160).optional().nullable(),
      scheduled_for: z.string().datetime().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.status) {
      patch.status = data.status;
      if (data.status === "concluido" || data.status === "em_campanha") {
        patch.processed_by = context.userId;
        patch.processed_at = new Date().toISOString();
      }
    }
    if (data.campaign_name !== undefined) patch.campaign_name = data.campaign_name;
    if (data.scheduled_for !== undefined) patch.scheduled_for = data.scheduled_for;
    const { error } = await context.supabase
      .from("marketing_remarketing_queue" as never)
      .update(patch as never)
      .eq("id" as never, data.id as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeRemarketingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketing_remarketing_queue" as never)
      .delete()
      .eq("id" as never, data.id as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
