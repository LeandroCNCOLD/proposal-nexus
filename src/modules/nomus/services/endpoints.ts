// Centralized Nomus endpoint map for the modular integration layer.
// Server-side only: do not import from browser/client components.

export const NOMUS_ENDPOINTS = {
  clientes: "/clientes",
  produtos: "/produtos",
  representantes: "/representantes",
  vendedores: "/vendedores",
  condicoes_pagamento: "/condicoesPagamentos",
  propostas: "/propostas",
  pedidos: "/pedidos",
  notas_fiscais: "/nfes",
  tabelas_preco: "/tabelasPreco",
  processos: "/processos",
  contas_receber: "/contasReceber",
} as const;

export type NomusEntity = keyof typeof NOMUS_ENDPOINTS;

export const NOMUS_HEALTHCHECK_ENTITY: NomusEntity = "clientes";

export const NOMUS_PROBE_ENTITIES: NomusEntity[] = ["clientes", "representantes", "propostas"];

export function getEndpoint(entity: NomusEntity): string {
  return NOMUS_ENDPOINTS[entity];
}

export function entityDetailPath(entity: NomusEntity, id: string | number): string {
  return `${NOMUS_ENDPOINTS[entity]}/${encodeURIComponent(String(id))}`;
}

export function proposalSubpath(nomusId: string, sub?: string): string {
  const base = entityDetailPath("propostas", nomusId);
  return sub ? `${base}/${sub.replace(/^\/+/, "")}` : base;
}

export function proposalItemsPath(proposalId: string | number): string {
  return `${entityDetailPath("propostas", proposalId)}/itens`;
}

export function paymentConditionPath(paymentConditionId: string | number): string {
  return entityDetailPath("condicoes_pagamento", paymentConditionId);
}

export function proposalItemDetailPath(
  propostaId: string | number,
  itemId: string | number,
): string {
  return `${proposalItemsPath(propostaId)}/${encodeURIComponent(String(itemId))}`;
}

export function proposalItemDetailFallbackPaths(itemId: string | number): string[] {
  const id = encodeURIComponent(String(itemId));
  return [`${NOMUS_ENDPOINTS.propostas}/itens/${id}`, `/itensPropostas/${id}`];
}

export function pessoaContatosPath(idPessoa: string | number): string {
  return `/pessoas/${encodeURIComponent(String(idPessoa))}/contatos`;
}

export function nfeDanfePath(nfeId: string | number): string {
  return `${NOMUS_ENDPOINTS.notas_fiscais}/danfe/${encodeURIComponent(String(nfeId))}`;
}

export function nfeCcePath(nfeId: string | number): string {
  return `${NOMUS_ENDPOINTS.notas_fiscais}/cce/${encodeURIComponent(String(nfeId))}`;
}
