// Admin / server-only helpers for marketing_leads.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MarketingLeadInput = {
  contact_name?: string | null;
  client_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  state?: string | null;
  segmento?: string | null;
  aplicacao?: string | null;
  mensagem?: string | null;
  origem?: string;
  origem_detalhe?: Record<string, unknown> | null;
};

function genCode() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `MKT-${ymd}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function createMarketingLeadAdmin(input: MarketingLeadInput) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const lead_code = genCode();
    const { data, error } = await supabaseAdmin
      .from("marketing_leads" as never)
      .insert({
        lead_code,
        contact_name: input.contact_name ?? null,
        client_name: input.client_name ?? null,
        contact_email: input.contact_email ?? null,
        contact_phone: input.contact_phone ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        segmento: input.segmento ?? null,
        aplicacao: input.aplicacao ?? null,
        mensagem: input.mensagem ?? null,
        origem: input.origem ?? "site",
        origem_detalhe: (input.origem_detalhe ?? null) as never,
        received_at: new Date().toISOString(),
      } as never)
      .select("id, lead_code")
      .single();
    if (!error) {
      const row = data as { id: string; lead_code: string };
      return { id: row.id, lead_code: row.lead_code };
    }
    if (!String(error.message).includes("duplicate key")) {
      throw new Error(error.message);
    }
  }
  throw new Error("Falha ao gerar lead_code único.");
}
