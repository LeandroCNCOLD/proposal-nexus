type Json = Record<string, unknown>;

type PriceTableMapperResult<T extends Json> =
  | { ok: true; payload: T }
  | { ok: false; reason: string; raw: unknown };

const pickStr = (o: Json, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
};

const pickBool = (o: Json, ...keys: string[]): boolean | null => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string" && v.trim()) return /^(true|sim|s|1)$/i.test(v.trim());
  }
  return null;
};

export function parseNomusNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;

  const withoutUnit = raw.replace(/\s+por\s+\w+/i, "").trim();
  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(withoutUnit)) {
    const scientific = Number(withoutUnit);
    return Number.isFinite(scientific) ? scientific : null;
  }

  const cleaned = withoutUnit.replace(/[^\d,.\-+]/g, "");
  if (!cleaned) return null;

  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const pickNomusNumber = (o: Json, ...keys: string[]): number | null => {
  for (const k of keys) {
    const n = parseNomusNumber(o[k]);
    if (n !== null) return n;
  }
  return null;
};

export function extractNomusPriceTableItems<T = unknown>(response: unknown): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as T[];
  if (typeof response !== "object") return [];

  const env = response as Json;
  if (Array.isArray(env.itensTabelaPreco)) return env.itensTabelaPreco as T[];

  const data = env.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataEnv = data as Json;
    if (Array.isArray(dataEnv.itensTabelaPreco)) return dataEnv.itensTabelaPreco as T[];
  }

  if (Array.isArray(env.itens)) return env.itens as T[];
  if (Array.isArray(env.produtos)) return env.produtos as T[];
  return [];
}

function priceTableNomusId(raw: Json): string | null {
  return pickStr(raw, "id", "idTabelaPreco", "codigo", "codTabelaPreco", "codigoTabelaPreco");
}

function priceTableItemProductId(raw: Json): string | null {
  const direct = pickStr(
    raw,
    "idProduto",
    "nomus_product_id",
    "produtoId",
    "idProdutoServico",
    "codigoProduto",
    "codigo",
    "codProduto",
    "produtoCodigo",
  );
  if (direct) return direct;
  const produto = raw.produto;
  return produto && typeof produto === "object"
    ? pickStr(produto as Json, "id", "codigo", "idProduto", "codigoProduto")
    : null;
}

function priceTableItemUnitPrice(raw: Json): number | null {
  return pickNomusNumber(
    raw,
    "preco",
    "unit_price",
    "precoUnitario",
    "precoVenda",
    "valor",
    "valorUnitario",
    "precoTabela",
    "precoCalculado",
    "precoUnitarioCalculado",
  );
}

function resolvePriceTableId(
  priceTable: string | { id?: string | null; price_table_id?: string | null },
): string | null {
  if (typeof priceTable === "string") return priceTable;
  return priceTable.id ?? priceTable.price_table_id ?? null;
}

export function mapNomusPriceTableToDb(raw: unknown): PriceTableMapperResult<Json> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Tabela descartada: payload não é objeto JSON.", raw };
  }
  const record = raw as Json;
  const nomusId = priceTableNomusId(record);
  const name = pickStr(record, "nome", "name", "descricao", "description");
  if (!nomusId)
    return { ok: false, reason: "Tabela descartada: sem id/codigo/idTabelaPreco.", raw };
  if (!name) return { ok: false, reason: "Tabela descartada: sem nome/name/descricao.", raw };

  return {
    ok: true,
    payload: {
      nomus_id: nomusId,
      code: pickStr(record, "codigo", "code", "codTabelaPreco", "codigoTabelaPreco"),
      name,
      currency: pickStr(record, "moeda", "currency") ?? "BRL",
      is_active: pickBool(record, "ativo", "active", "isActive", "situacao") ?? true,
      raw: record,
      synced_at: new Date().toISOString(),
    },
  };
}

export function mapNomusPriceTableItemToDb(
  raw: unknown,
  priceTable: string | { id?: string | null; price_table_id?: string | null },
): PriceTableMapperResult<Json> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Item descartado: payload não é objeto JSON.", raw };
  }
  const record = raw as Json;
  const priceTableId = resolvePriceTableId(priceTable);
  const productId = priceTableItemProductId(record);
  const unitPrice = priceTableItemUnitPrice(record);
  if (!priceTableId)
    return { ok: false, reason: "Item descartado: sem price_table_id local.", raw };
  if (!productId)
    return { ok: false, reason: "Item descartado: sem idProduto/codigoProduto/codigo.", raw };
  if (unitPrice === null)
    return { ok: false, reason: "Item descartado: sem preco/precoVenda/precoUnitario/valor.", raw };

  return {
    ok: true,
    payload: {
      price_table_id: priceTableId,
      nomus_product_id: productId,
      product_name: pickStr(record, "nomeProduto", "product_name", "nome", "name"),
      product_description: pickStr(
        record,
        "descricaoProduto",
        "product_description",
        "descricao",
        "description",
      ),
      unit_price: unitPrice,
      currency: pickStr(record, "moeda", "currency") ?? "BRL",
      custo_materiais: pickNomusNumber(record, "custoMateriais", "custo_materiais"),
      custo_mod: pickNomusNumber(record, "custoMod", "custo_mod"),
      custo_cif: pickNomusNumber(record, "custoCif", "custo_cif"),
      custos_adm: pickNomusNumber(record, "custosAdm", "custos_adm"),
      custo_producao_total: pickNomusNumber(record, "custoProducaoTotal", "custo_producao_total"),
      custos_venda: pickNomusNumber(record, "custosVenda", "custos_venda"),
      preco_calculado: pickNomusNumber(record, "precoCalculado", "preco_calculado"),
      preco_liquido: pickNomusNumber(record, "precoLiquido", "preco_liquido"),
      margem_desejada_pct: pickNomusNumber(record, "margemDesejadaPct", "margem_desejada_pct"),
      lucro_bruto: pickNomusNumber(record, "lucroBruto", "lucro_bruto"),
      lucro_liquido: pickNomusNumber(record, "lucroLiquido", "lucro_liquido"),
      margem_contribuicao: pickNomusNumber(record, "margemContribuicao", "margem_contribuicao"),
      unidade_medida: pickStr(
        record,
        "siglaUnidadeMedidaProduto",
        "unidadeMedida",
        "unidade_medida",
      ),
      raw: record,
      synced_at: new Date().toISOString(),
    },
  };
}
