import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProposalTablesByProposalId } from "./proposal-tables.server";
import { buildProposalSendSnapshot } from "./build-proposal-send-snapshot";

const inputSchema = z.object({
  proposalId: z.string().uuid(),
  pdfStoragePath: z.string().min(1),
  channel: z.string().optional().default("system"),
  recipient: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function getNextVersionNumber(supabase: any, proposalId: string) {
  const { data, error } = await supabase
    .from("proposal_send_versions")
    .select("version_number")
    .eq("proposal_id", proposalId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Erro ao buscar versão anterior: ${error.message}`);
  }

  const current = data?.[0]?.version_number ?? 0;
  return Number(current) + 1;
}

export const createProposalSendVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", data.proposalId)
      .single();

    if (proposalError) {
      throw new Error(`Erro ao carregar proposta: ${proposalError.message}`);
    }

    const { data: document, error: documentError } = await supabase
      .from("proposal_documents")
      .select("*")
      .eq("proposal_id", data.proposalId)
      .single();

    if (documentError) {
      throw new Error(`Erro ao carregar documento: ${documentError.message}`);
    }

    let template: any = null;
    if (document?.template_id) {
      const { data: tpl, error: templateError } = await supabase
        .from("proposal_templates")
        .select("*")
        .eq("id", document.template_id)
        .single();

      if (templateError) {
        throw new Error(`Erro ao carregar template: ${templateError.message}`);
      }
      template = tpl;
    }

    const tables = await getProposalTablesByProposalId(data.proposalId);

    const versionNumber = await getNextVersionNumber(supabase, data.proposalId);

    const snapshot = buildProposalSendSnapshot({
      proposal,
      template,
      document,
      tables,
    });

    // Marca versões anteriores como não-correntes
    const { error: unsetError } = await supabase
      .from("proposal_send_versions")
      .update({ is_current: false })
      .eq("proposal_id", data.proposalId)
      .eq("is_current", true);

    if (unsetError) {
      throw new Error(`Erro ao atualizar versões anteriores: ${unsetError.message}`);
    }

    // O schema atual de proposal_send_versions só tem template_snapshot e
    // document_snapshot (jsonb). Embutimos tabelas e proposta dentro do
    // document_snapshot para preservar o snapshot completo.
    const documentSnapshotFull = {
      ...snapshot.document_snapshot,
      proposal_snapshot: snapshot.proposal_snapshot,
      tables_snapshot: snapshot.tables_snapshot,
      generated_at: snapshot.generated_at,
    };

    const { data: version, error: versionError } = await supabase
      .from("proposal_send_versions")
      .insert([
        {
          proposal_id: data.proposalId,
          version_number: versionNumber,
          pdf_storage_path: data.pdfStoragePath,
          template_snapshot: snapshot.template_snapshot as never,
          document_snapshot: documentSnapshotFull as never,
          is_current: true,
          notes: data.notes ?? null,
          generated_by: userId,
        },
      ])
      .select("*")
      .single();

    if (versionError) {
      throw new Error(`Erro ao criar versão enviada: ${versionError.message}`);
    }

    const { error: eventError } = await supabase
      .from("proposal_send_events")
      .insert({
        proposal_id: data.proposalId,
        version_id: version.id,
        channel: data.channel,
        recipient: data.recipient ?? null,
        subject: data.subject ?? null,
        message: data.message ?? null,
        delivery_status: "generated",
        sent_by: userId,
        metadata: {
          pdf_storage_path: data.pdfStoragePath,
          version_number: versionNumber,
          generated_at: snapshot.generated_at,
        },
      });

    if (eventError) {
      throw new Error(`Erro ao registrar evento de envio: ${eventError.message}`);
    }

    return version;
  });
