// Server-only service facade for Nomus proposal resources.
// Keeps endpoint selection centralized while preserving the legacy integration client.
import { getOne, listAll, listPage, nomusFetch, type NomusFetchOptions } from "@/integrations/nomus/client";
import { NOMUS_ENDPOINTS, proposalSubpath } from "@/integrations/nomus/endpoints";
import type { NomusProposalRaw } from "../types";

export async function fetchNomusProposal(
  nomusId: string | number,
  opts: { triggeredBy?: string | null; timeoutMs?: number; maxAttempts?: number } = {},
) {
  return getOne<NomusProposalRaw>(NOMUS_ENDPOINTS.propostas, nomusId, {
    entity: "propostas",
    triggeredBy: opts.triggeredBy ?? null,
    timeoutMs: opts.timeoutMs,
    maxAttempts: opts.maxAttempts,
  });
}

export async function listNomusProposals(
  query: Record<string, string | number | undefined> = {},
  opts: { triggeredBy?: string | null; maxItems?: number } = {},
) {
  return listAll<NomusProposalRaw>(NOMUS_ENDPOINTS.propostas, query, {
    entity: "propostas",
    triggeredBy: opts.triggeredBy ?? null,
    maxItems: opts.maxItems,
  });
}

export async function listNomusProposalPage(
  query: Record<string, string | number | undefined>,
  opts: { page: number; pageSize?: number; triggeredBy?: string | null },
) {
  return listPage<NomusProposalRaw>(NOMUS_ENDPOINTS.propostas, query, {
    entity: "propostas",
    page: opts.page,
    pageSize: opts.pageSize,
    triggeredBy: opts.triggeredBy ?? null,
  });
}

export async function updateNomusProposal(
  nomusId: string | number,
  body: unknown,
  opts: Omit<NomusFetchOptions, "method" | "body" | "entity" | "operation" | "direction"> = {},
) {
  return nomusFetch<NomusProposalRaw>(proposalSubpath(String(nomusId)), {
    ...opts,
    method: "PUT",
    body,
    entity: "propostas",
    operation: "update",
    direction: "push",
  });
}
