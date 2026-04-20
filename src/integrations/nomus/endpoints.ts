// Mapa central de endpoints do Nomus.
// Fonte única de verdade — qualquer mudança de path acontece aqui.
// Não importar de código client-side.

export const NOMUS_ENDPOINTS = {
  clientes: "/clientes",
  produtos: "/produtos",
  representantes: "/representantes",
  vendedores: "/vendedores",
  condicoes_pagamento: "/condicoes-pagamento",
  propostas: "/propostas",
  pedidos: "/pedidos-venda",
  notas_fiscais: "/notas-fiscais",
} as const;

export type NomusEntity = keyof typeof NOMUS_ENDPOINTS;

/** Endpoint usado como health check estável da integração. */
export const NOMUS_HEALTHCHECK_ENTITY: NomusEntity = "clientes";

export function getEndpoint(entity: NomusEntity): string {
  return NOMUS_ENDPOINTS[entity];
}

/** Sub-recurso de uma proposta (ex.: eventos, itens). */
export function proposalSubpath(nomusId: string, sub?: string): string {
  const base = `${NOMUS_ENDPOINTS.propostas}/${encodeURIComponent(nomusId)}`;
  return sub ? `${base}/${sub.replace(/^\/+/, "")}` : base;
}
