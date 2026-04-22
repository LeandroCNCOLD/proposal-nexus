// Helpers de parsing dos payloads do Nomus.
// O Nomus devolve números como string em formato BR ("139.103,505674"),
// e os campos da proposta vêm com nomes específicos (proposta, nomeCliente,
// dataHoraAbertura, valorTotal, itensProposta, etc.).

type Json = Record<string, unknown>;

/** Converte "139.103,505674" → 139103.505674. Aceita number puro também. */
export function parseNomusNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  // Remove tudo exceto dígitos, vírgula, ponto e sinal.
  // Se tem vírgula, é formato BR: ponto = milhar, vírgula = decimal.
  // Se só tem ponto, assume formato US (ex: "7494.7").
  const hasComma = s.includes(",");
  const normalized = hasComma
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Pega o primeiro campo presente (string não vazia). */
export function pickStr(o: Json, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
}

/** Pega o primeiro campo presente e parseia como número (suporta BR). */
export function pickNumBR(o: Json, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    const n = parseNomusNumber(v);
    if (n !== null) return n;
  }
  return null;
}

/** Extrai a data ISO de "dataHoraAbertura" tipo "2024-05-12 09:30:00" ou ISO. */
export function pickDate(o: Json, ...keys: string[]): string | null {
  const raw = pickStr(o, ...keys);
  if (!raw) return null;
  // já é ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    // converte "YYYY-MM-DD HH:mm:ss" → "YYYY-MM-DD"
    return raw.slice(0, 10);
  }
  // "DD/MM/YYYY"
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return raw;
}

/**
 * Mapeia uma proposta do Nomus para o shape do nosso espelho `nomus_proposals`.
 * Lida com os nomes reais que o ERP usa: `proposta`, `nomeCliente`, `valorTotal`
 * (string BR), `dataHoraAbertura`, `itensProposta`.
 */
export type NomusProposalMapped = {
  nomus_id: string;
  numero: string | null;
  nome_cliente: string | null;
  cliente_nomus_id: string | null;
  vendedor_nomus_id: string | null;
  representante_nomus_id: string | null;
  valor_total: number | null;
  status_nomus: string | null;
  validade: string | null;
  data_emissao: string | null;
  observacoes: string | null;
};

export function mapNomusProposal(raw: Json): NomusProposalMapped | null {
  const nomus_id = pickStr(raw, "id", "idProposta", "codigo");
  if (!nomus_id) return null;
  return {
    nomus_id,
    // Nomus chama o número humano de "proposta" (ex.: "CN00154").
    // Mantemos fallback para "numero"/"numeroProposta" caso outra rota use isso.
    numero: pickStr(raw, "proposta", "numero", "numeroProposta"),
    nome_cliente: pickStr(raw, "nomeCliente", "clienteNome"),
    cliente_nomus_id: pickStr(raw, "idCliente", "clienteId"),
    vendedor_nomus_id: pickStr(raw, "idVendedor", "vendedorId"),
    representante_nomus_id: pickStr(raw, "idRepresentante", "representanteId"),
    valor_total: pickNumBR(raw, "valorTotal", "valor", "total"),
    status_nomus: pickStr(raw, "status", "situacao"),
    validade: pickDate(raw, "validade", "dataValidade"),
    data_emissao: pickDate(raw, "dataHoraAbertura", "dataEmissao", "data"),
    observacoes: pickStr(raw, "observacoes", "obs"),
  };
}

export type NomusProposalItemMapped = {
  nomus_item_id: string | null;
  nomus_product_id: string | null;
  product_code: string | null;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  discount: number | null;
  total: number | null;
};

/** Extrai itens da proposta (`itensProposta` no payload do Nomus). */
export function extractProposalItems(raw: Json): NomusProposalItemMapped[] {
  const arr = (raw["itensProposta"] ?? raw["itens"] ?? raw["items"]) as Json[] | undefined;
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => ({
    nomus_item_id: pickStr(it, "id", "idItem"),
    nomus_product_id: pickStr(it, "idProduto", "produtoId"),
    product_code: pickStr(it, "codigoProduto", "codigo"),
    description: pickStr(it, "descricaoProduto", "descricao", "nome") ?? "",
    quantity: pickNumBR(it, "qtde", "quantidade", "qtd"),
    // valorUnitario vem como "3.747,3484 por UN" → extrai o número.
    unit_price: pickNumBR(it, "valorUnitario", "preco"),
    discount: pickNumBR(it, "desconto"),
    total: pickNumBR(it, "valorTotal", "valorTotalProdutos", "total"),
  }));
}
