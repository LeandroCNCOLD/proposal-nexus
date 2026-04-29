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
  materiais: "/materiais",
  unidades: "/unidadesMedida",
} as const;

export type NomusEntity = keyof typeof NOMUS_ENDPOINTS;

export const NOMUS_ENDPOINT_PLACEHOLDERS = {
  productPrices:
    "Itens de tabela de preço não têm endpoint confirmado; tentamos sub-recursos de /tabelasPreco e /produtos.",
  productCosts:
    "Custos por produto não têm endpoint confirmado; tentamos sub-recursos de /produtos e campos embutidos.",
  productTaxes:
    "Impostos por produto não têm endpoint confirmado; tentamos sub-recursos fiscais de /produtos.",
  productStructures:
    "Estruturas/composições não têm endpoint confirmado; placeholder para documentação.",
} as const;

export function entityPath(entity: NomusEntity): string {
  return NOMUS_ENDPOINTS[entity];
}

export function entityDetailPath(entity: NomusEntity, id: string | number): string {
  return `${entityPath(entity)}/${encodeURIComponent(String(id))}`;
}

export function priceTableItemsPath(priceTableId: string | number): string {
  return `${entityDetailPath("tabelas_preco", priceTableId)}/itens`;
}

export function productPricesCandidatePaths(productId?: string | number): string[] {
  const suffix = productId ? `?produto=${encodeURIComponent(String(productId))}` : "";
  return [`${NOMUS_ENDPOINTS.tabelas_preco}/itens${suffix}`, `/tabelasPrecoItens${suffix}`];
}

export function productCostCandidatePaths(productId: string | number): string[] {
  const id = encodeURIComponent(String(productId));
  return [
    `${NOMUS_ENDPOINTS.produtos}/${id}/custos`,
    `${NOMUS_ENDPOINTS.produtos}/${id}?incluirCusto=true`,
    `/custosProdutos/${id}`,
  ];
}

export function productTaxCandidatePaths(productId: string | number): string[] {
  const id = encodeURIComponent(String(productId));
  return [
    `${NOMUS_ENDPOINTS.produtos}/${id}/tributos`,
    `${NOMUS_ENDPOINTS.produtos}/${id}/impostos`,
    `${NOMUS_ENDPOINTS.produtos}/${id}?incluirImpostos=true`,
  ];
}
