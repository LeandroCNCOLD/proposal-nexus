import {
  getOne,
  listAll,
  listPage,
  nomusFetch,
  type NomusFetchOptions,
} from "@/integrations/nomus/client";
import {
  NOMUS_ENDPOINTS,
  paymentConditionPath,
  proposalItemsPath,
} from "@/modules/nomus/services/endpoints";
import type {
  NomusCustomerRaw,
  NomusPaymentConditionRaw,
  NomusProposalItemRaw,
  NomusProposalRaw,
  NomusRepresentativeRaw,
} from "@/modules/nomus/types";

export type NomusServiceOptions = {
  triggeredBy?: string | null;
  timeoutMs?: number;
  maxAttempts?: number;
};

function requestOptions(entity: string, opts: NomusServiceOptions = {}) {
  return {
    entity,
    triggeredBy: opts.triggeredBy ?? null,
    timeoutMs: opts.timeoutMs,
    maxAttempts: opts.maxAttempts,
  };
}

function extractList<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const env = payload as Record<string, unknown>;
  for (const key of ["items", "resultados", "data", "content", "registros", "lista"]) {
    const value = env[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

export async function getNomusProposalById(
  nomusProposalId: string | number,
  opts: NomusServiceOptions = {},
) {
  return getOne<NomusProposalRaw>(
    NOMUS_ENDPOINTS.propostas,
    nomusProposalId,
    requestOptions("propostas", opts),
  );
}

export async function getNomusCustomerById(
  nomusCustomerId: string | number,
  opts: NomusServiceOptions = {},
) {
  return getOne<NomusCustomerRaw>(
    NOMUS_ENDPOINTS.clientes,
    nomusCustomerId,
    requestOptions("clientes", opts),
  );
}

export async function getNomusProposalItems(
  nomusProposalId: string | number,
  opts: NomusServiceOptions = {},
): Promise<{ ok: true; items: NomusProposalItemRaw[] } | { ok: false; error: string }> {
  const proposal = await getNomusProposalById(nomusProposalId, opts);
  if (proposal.ok) {
    const embedded = proposal.data.itensProposta ?? proposal.data.itens ?? proposal.data.items;
    if (Array.isArray(embedded)) return { ok: true, items: embedded };
  }

  const direct = await nomusFetch<unknown>(proposalItemsPath(nomusProposalId), {
    method: "GET",
    entity: "propostas",
    operation: "list-items",
    direction: "pull",
    triggeredBy: opts.triggeredBy ?? null,
    timeoutMs: opts.timeoutMs,
    maxAttempts: opts.maxAttempts,
  });
  if (!direct.ok) {
    return proposal.ok ? { ok: true, items: [] } : { ok: false, error: direct.error };
  }
  return { ok: true, items: extractList<NomusProposalItemRaw>(direct.data) };
}

export async function getNomusPaymentCondition(
  paymentConditionId: string | number,
  opts: NomusServiceOptions = {},
) {
  return getOne<NomusPaymentConditionRaw>(
    NOMUS_ENDPOINTS.condicoes_pagamento,
    paymentConditionId,
    requestOptions("condicoes_pagamento", opts),
  );
}

export async function getNomusRepresentatives(
  query: Record<string, string | number | undefined> = {},
  opts: NomusServiceOptions & { page?: number; pageSize?: number; maxItems?: number } = {},
) {
  if (opts.page != null) {
    return listPage<NomusRepresentativeRaw>(NOMUS_ENDPOINTS.representantes, query, {
      entity: "representantes",
      page: opts.page,
      pageSize: opts.pageSize,
      triggeredBy: opts.triggeredBy ?? null,
      timeoutMs: opts.timeoutMs,
      maxAttempts: opts.maxAttempts,
    });
  }

  return listAll<NomusRepresentativeRaw>(NOMUS_ENDPOINTS.representantes, query, {
    entity: "representantes",
    triggeredBy: opts.triggeredBy ?? null,
    maxItems: opts.maxItems,
  });
}

export async function updateNomusProposal(
  nomusProposalId: string | number,
  body: unknown,
  opts: Omit<NomusFetchOptions, "method" | "body" | "entity" | "operation" | "direction"> = {},
) {
  return nomusFetch<NomusProposalRaw>(
    `${NOMUS_ENDPOINTS.propostas}/${encodeURIComponent(String(nomusProposalId))}`,
    {
      ...opts,
      method: "PUT",
      body,
      entity: "propostas",
      operation: "update",
      direction: "push",
    },
  );
}

export { NOMUS_ENDPOINTS, paymentConditionPath, proposalItemsPath };
