// Server-only helpers for inbound leads (public site form + internal form).
// Never imported from client code (filename matches **/*.server.* import guard).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type InboundLeadInput = {
  contact_name: string;
  client_name: string;        // empresa
  contact_email: string;
  contact_phone: string;
  city?: string | null;
  state?: string | null;
  segmento?: string | null;   // segmento / setor
  aplicacao?: string | null;  // câmara, túnel, processo, etc.
  mensagem?: string | null;
  origem?: "site" | "telefone" | "whatsapp" | "manual" | "evento" | "indicacao";
  origem_detalhe?: Record<string, unknown> | null;
};

function gerarLeadCode(prefix: string) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${ymd}-${rand}`;
}

export async function createInboundLeadAdmin(input: InboundLeadInput) {
  const origem = input.origem ?? "site";
  const prefix = origem === "site" ? "SITE" : origem === "whatsapp" ? "WPP" : "INB";

  // tenta até 3 vezes em caso de colisão de lead_code
  for (let attempt = 0; attempt < 3; attempt++) {
    const lead_code = gerarLeadCode(prefix);
    const detalheCombinado = {
      ...(input.origem_detalhe ?? {}),
      ...(input.segmento ? { segmento: input.segmento } : {}),
      ...(input.aplicacao ? { aplicacao: input.aplicacao } : {}),
    };
    const internalNote = [
      input.segmento ? `Segmento: ${input.segmento}` : null,
      input.aplicacao ? `Aplicação: ${input.aplicacao}` : null,
      input.mensagem ? `Mensagem do site:\n${input.mensagem}` : null,
    ].filter(Boolean).join("\n\n");

    const { data, error } = await supabaseAdmin
      .from("sdr_leads")
      .insert({
        lead_code,
        client_name: input.client_name,
        razao_social: input.client_name,
        contact_name: input.contact_name,
        contact_email: input.contact_email,
        contact_phone: input.contact_phone,
        contact_mobile: input.contact_phone,
        city: input.city ?? null,
        state: input.state ?? null,
        value: 0,
        sdr_status: "Não Contatado",
        temperature: "Quente",
        origem,
        priority_level: 0,
        priority: "Alta",
        origem_detalhe: detalheCombinado as never,
        internal_note: internalNote || null,
        received_at: new Date().toISOString(),
      } as never)
      .select("id, lead_code")
      .single();

    if (!error) return { id: (data as { id: string }).id, lead_code: (data as { lead_code: string }).lead_code };
    if (!String(error.message).includes("duplicate key")) {
      throw new Error(error.message);
    }
  }
  throw new Error("Falha ao gerar lead_code único após várias tentativas.");
}
