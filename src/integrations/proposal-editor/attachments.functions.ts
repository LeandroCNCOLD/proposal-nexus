// Server functions para gerenciar PDFs anexos da proposta.
// Os arquivos vão para o bucket `proposal-files` em pasta {proposalId}/attachments.
// A ordem é mantida em proposal_documents.attached_pdf_paths (array de storage_paths).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ATTACH_BUCKET = "proposal-files";

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

async function loadDoc(supabase: any, proposalId: string) {
  const { data, error } = await supabase
    .from("proposal_documents")
    .select("id, attached_pdf_paths")
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Documento não encontrado. Abra o editor primeiro.");
  return data as { id: string; attached_pdf_paths: string[] };
}

export const listProposalAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const doc = await loadDoc(supabase, data.proposalId);
    const paths = (doc.attached_pdf_paths ?? []) as string[];

    const items = await Promise.all(
      paths.map(async (path) => {
        const { data: signed } = await supabase.storage
          .from(ATTACH_BUCKET)
          .createSignedUrl(path, 60 * 30);
        return {
          path,
          name: path.split("/").pop() ?? path,
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    return { items };
  });

const uploadSchema = z.object({
  proposalId: z.string().uuid(),
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
  mimeType: z.string().default("application/pdf"),
});

export const uploadProposalAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const doc = await loadDoc(supabase, data.proposalId);

    // Decodifica base64 → Uint8Array
    const binary = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.proposalId}/attachments/${Date.now()}-${safe}`;

    const { error: upErr } = await supabase.storage
      .from(ATTACH_BUCKET)
      .upload(path, binary, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(`Falha ao subir PDF: ${upErr.message}`);

    const next = [...(doc.attached_pdf_paths ?? []), path];
    const { error: updErr } = await supabase
      .from("proposal_documents")
      .update({
        attached_pdf_paths: next,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (updErr) throw new Error(updErr.message);

    return { path, total: next.length };
  });

const deleteSchema = z.object({
  proposalId: z.string().uuid(),
  path: z.string().min(1),
});

export const deleteProposalAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const doc = await loadDoc(supabase, data.proposalId);

    await supabase.storage.from(ATTACH_BUCKET).remove([data.path]);

    const next = (doc.attached_pdf_paths ?? []).filter((p: string) => p !== data.path);
    const { error: updErr } = await supabase
      .from("proposal_documents")
      .update({
        attached_pdf_paths: next,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, total: next.length };
  });

const reorderSchema = z.object({
  proposalId: z.string().uuid(),
  paths: z.array(z.string().min(1)),
});

export const reorderProposalAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reorderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const doc = await loadDoc(supabase, data.proposalId);

    // Sanitiza: só mantém os caminhos que já estavam vinculados.
    const allowed = new Set(doc.attached_pdf_paths ?? []);
    const next = data.paths.filter((p) => allowed.has(p));

    const { error: updErr } = await supabase
      .from("proposal_documents")
      .update({
        attached_pdf_paths: next,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, paths: next };
  });
