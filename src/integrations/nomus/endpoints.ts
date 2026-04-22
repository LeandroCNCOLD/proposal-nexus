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

/**
 * Detalhe completo de um item de proposta no Nomus.
 *
 * O caminho canônico documentado é
 * `GET /propostas/{idProposta}/itens/{idItem}` — devolve impostos
 * discriminados, análise de lucro com 23 campos, atributos e centros de custo.
 *
 * Em ambientes onde o caminho canônico não está disponível, tentamos os
 * fallbacks abaixo (na ordem) antes de devolver 404.
 */
export function proposalItemDetailPath(propostaId: string | number, itemId: string | number): string {
  return `${NOMUS_ENDPOINTS.propostas}/${encodeURIComponent(String(propostaId))}/itens/${encodeURIComponent(String(itemId))}`;
}

export function proposalItemDetailFallbackPaths(itemId: string | number): string[] {
  const id = encodeURIComponent(String(itemId));
  return [
    `${NOMUS_ENDPOINTS.propostas}/itens/${id}`,
    `/itensPropostas/${id}`,
  ];
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
