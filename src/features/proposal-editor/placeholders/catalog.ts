/**
 * Catálogo de placeholders disponíveis no editor de propostas.
 * Cada placeholder usa a sintaxe `{{namespace.chave}}` no texto/HTML.
 *
 * Para ADICIONAR um novo placeholder:
 *  1. Adicione a entrada em PLACEHOLDER_CATALOG abaixo.
 *  2. Garanta que o `path` resolva contra o `PlaceholderContext` (use-placeholder-context.ts).
 */

export type PlaceholderNamespace =
  | "cliente"
  | "proposta"
  | "vendedor"
  | "pagamento"
  | "equipamentos"
  | "empresa"
  | "data";

export interface PlaceholderEntry {
  /** Chave completa, ex: "cliente.nome_fantasia" */
  key: string;
  namespace: PlaceholderNamespace;
  label: string;
  description?: string;
  /** Exemplo a ser exibido no autocomplete */
  example?: string;
}

export const PLACEHOLDER_CATALOG: PlaceholderEntry[] = [
  // Cliente
  { key: "cliente.razao_social", namespace: "cliente", label: "Razão social", example: "Empresa LTDA" },
  { key: "cliente.nome_fantasia", namespace: "cliente", label: "Nome fantasia", example: "Empresa" },
  { key: "cliente.cnpj", namespace: "cliente", label: "CNPJ", example: "00.000.000/0000-00" },
  { key: "cliente.cidade", namespace: "cliente", label: "Cidade" },
  { key: "cliente.estado", namespace: "cliente", label: "UF" },
  { key: "cliente.endereco", namespace: "cliente", label: "Endereço completo" },
  { key: "cliente.contato_nome", namespace: "cliente", label: "Contato — nome" },
  { key: "cliente.contato_email", namespace: "cliente", label: "Contato — e-mail" },
  { key: "cliente.contato_telefone", namespace: "cliente", label: "Contato — telefone" },
  { key: "cliente.contato_cargo", namespace: "cliente", label: "Contato — cargo" },

  // Proposta
  { key: "proposta.numero", namespace: "proposta", label: "Número da proposta", example: "PROP-2025-001" },
  { key: "proposta.titulo", namespace: "proposta", label: "Título / projeto" },
  { key: "proposta.valor_total", namespace: "proposta", label: "Valor total", example: "R$ 120.000,00" },
  { key: "proposta.valor_produtos", namespace: "proposta", label: "Valor dos produtos" },
  { key: "proposta.valor_descontos", namespace: "proposta", label: "Valor de descontos" },
  { key: "proposta.validade", namespace: "proposta", label: "Validade", example: "30/12/2025" },
  { key: "proposta.prazo_entrega", namespace: "proposta", label: "Prazo de entrega" },
  { key: "proposta.data_emissao", namespace: "proposta", label: "Data de emissão" },
  { key: "proposta.observacoes", namespace: "proposta", label: "Observações" },

  // Vendedor
  { key: "vendedor.nome", namespace: "vendedor", label: "Nome do vendedor" },
  { key: "vendedor.email", namespace: "vendedor", label: "E-mail do vendedor" },
  { key: "vendedor.telefone", namespace: "vendedor", label: "Telefone do vendedor" },
  { key: "vendedor.cargo", namespace: "vendedor", label: "Cargo do vendedor" },

  // Pagamento
  { key: "pagamento.condicao", namespace: "pagamento", label: "Condição de pagamento", example: "30/60/90 dias" },
  { key: "pagamento.tabela_preco", namespace: "pagamento", label: "Tabela de preço" },

  // Equipamentos
  { key: "equipamentos.lista", namespace: "equipamentos", label: "Lista de equipamentos (texto)", example: "1× Câmara fria; 2× Compressor…" },
  { key: "equipamentos.quantidade_total", namespace: "equipamentos", label: "Quantidade total de itens" },
  { key: "equipamentos.primeiro", namespace: "equipamentos", label: "Primeiro equipamento (descrição)" },

  // Empresa (CN Cold)
  { key: "empresa.nome", namespace: "empresa", label: "Nome da empresa" },
  { key: "empresa.email", namespace: "empresa", label: "E-mail da empresa" },
  { key: "empresa.telefone", namespace: "empresa", label: "Telefone da empresa" },
  { key: "empresa.site", namespace: "empresa", label: "Site da empresa" },
  { key: "empresa.cidade", namespace: "empresa", label: "Cidade da empresa" },

  // Data
  { key: "data.hoje", namespace: "data", label: "Data de hoje", example: "23/04/2026" },
  { key: "data.ano", namespace: "data", label: "Ano atual", example: "2026" },
  { key: "data.mes", namespace: "data", label: "Mês atual (extenso)", example: "abril" },
];

export const PLACEHOLDER_BY_KEY: Record<string, PlaceholderEntry> = Object.fromEntries(
  PLACEHOLDER_CATALOG.map((p) => [p.key, p]),
);

export const NAMESPACE_LABELS: Record<PlaceholderNamespace, string> = {
  cliente: "Cliente",
  proposta: "Proposta",
  vendedor: "Vendedor",
  pagamento: "Pagamento",
  equipamentos: "Equipamentos",
  empresa: "Empresa",
  data: "Data",
};

export function groupPlaceholdersByNamespace(): Array<{
  namespace: PlaceholderNamespace;
  label: string;
  items: PlaceholderEntry[];
}> {
  const groups = new Map<PlaceholderNamespace, PlaceholderEntry[]>();
  for (const p of PLACEHOLDER_CATALOG) {
    const list = groups.get(p.namespace) ?? [];
    list.push(p);
    groups.set(p.namespace, list);
  }
  return Array.from(groups.entries()).map(([ns, items]) => ({
    namespace: ns,
    label: NAMESPACE_LABELS[ns],
    items,
  }));
}
