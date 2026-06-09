import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inboundSchema = z.object({
  contact_name: z.string().trim().min(2).max(120),
  client_name: z.string().trim().min(2).max(160),
  contact_email: z.string().trim().email().max(160),
  contact_phone: z.string().trim().min(8).max(40),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  segmento: z.string().trim().max(80).optional().nullable(),
  aplicacao: z.string().trim().max(120).optional().nullable(),
  mensagem: z.string().trim().max(2000).optional().nullable(),
  origem: z.enum(["site", "telefone", "whatsapp", "manual", "evento", "indicacao"]).optional(),
});

export const createInboundLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inboundSchema.parse(data))
  .handler(async ({ data }) => {
    const { createInboundLeadAdmin } = await import("./leads-inbound.server");
    return createInboundLeadAdmin({
      ...data,
      origem: data.origem ?? "manual",
    });
  });

export const listInboundUnassignedLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sdr_leads")
      .select("id, lead_code, client_name, contact_name, contact_phone, contact_email, city, state, origem, origem_detalhe, received_at, internal_note")
      .is("sdr_id", null)
      .eq("priority_level" as never, 0 as never)
      .order("received_at" as never, { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; lead_code: string; client_name: string; contact_name: string | null;
      contact_phone: string | null; contact_email: string | null; city: string | null; state: string | null;
      origem: string; origem_detalhe: Record<string, unknown> | null; received_at: string; internal_note: string | null;
    }>;
  });

export const listSdrsForAssignment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("suggest_sdr_for_assignment" as never);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null; active_count: number }>;
  });

export const assignInboundLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ lead_id: z.string().uuid(), sdr_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("assign_lead_to_sdr" as never, {
      _lead_id: data.lead_id, _sdr_id: data.sdr_id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
