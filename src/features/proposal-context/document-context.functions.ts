/**
 * Server functions que expõem a camada `buildProposalDocumentContext` ao
 * cliente (editor + previews + qualquer bloco que precise dos dados).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildProposalDocumentContext } from "./build-proposal-document-context.server";

const proposalIdSchema = z.object({ proposalId: z.string().uuid() });

export const getProposalDocumentContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = await buildProposalDocumentContext(context.supabase, data.proposalId);
    return { context: ctx };
  });
