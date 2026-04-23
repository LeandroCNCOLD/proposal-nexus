// Upload de imagens inline para uso no RichTextEditor (TipTap).
// As imagens vão para `proposal-files/{proposalId}/inline-images/`
// e retornam uma signed URL de longa duração para embed no HTML do bloco.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "proposal-files";

const uploadSchema = z.object({
  proposalId: z.string().uuid(),
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
  mimeType: z.string().default("image/png"),
});

export const uploadInlineImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const binary = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.proposalId}/inline-images/${Date.now()}-${safe}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, binary, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(`Falha ao subir imagem: ${upErr.message}`);

    // URL longa (1 ano) para embed estável no HTML.
    const { data: signed, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Falha ao assinar URL");

    return { path, url: signed.signedUrl };
  });
