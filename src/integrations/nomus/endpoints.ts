// Mapa central de endpoints do Nomus.
// Fonte única de verdade — qualquer mudança de path acontece aqui.
// Não importar de código client-side.
//
// Documentação humana: docs/nomus-endpoints.md

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

/** Endpoint usado como health check estável da integração. */
export const NOMUS_HEALTHCHECK_ENTITY: NomusEntity = "clientes";

/**
 * Recursos verificados pelo teste multi-recurso (`testNomusConnection`).
 * Ordem importa: do mais provável de funcionar para o mais restritivo.
 */
export const NOMUS_PROBE_ENTITIES: NomusEntity[] = [
  "clientes",
  "representantes",
  "propostas",
];

export function getEndpoint(entity: NomusEntity): string {
  return NOMUS_ENDPOINTS[entity];
}

/** Sub-recurso de uma proposta (ex.: eventos, itens). */
export function proposalSubpath(nomusId: string, sub?: string): string {
  const base = `${NOMUS_ENDPOINTS.propostas}/${encodeURIComponent(nomusId)}`;
  return sub ? `${base}/${sub.replace(/^\/+/, "")}` : base;
}

/** Contatos vinculados a uma pessoa (cliente/fornecedor) no Nomus. */
export function pessoaContatosPath(idPessoa: string | number): string {
  return `/pessoas/${encodeURIComponent(String(idPessoa))}/contatos`;
}

/** PDF do DANFE de uma NFe específica. */
export function nfeDanfePath(nfeId: string | number): string {
  return `${NOMUS_ENDPOINTS.notas_fiscais}/danfe/${encodeURIComponent(String(nfeId))}`;
}

/** Carta de Correção Eletrônica (CC-e) de uma NFe. */
export function nfeCcePath(nfeId: string | number): string {
  return `${NOMUS_ENDPOINTS.notas_fiscais}/cce/${encodeURIComponent(String(nfeId))}`;
}
