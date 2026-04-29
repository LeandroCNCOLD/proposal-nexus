import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;
type DbPayload = Record<string, unknown>;

type NomusHttpResult =
  | { ok: true; status: number; data: unknown; text: string; url: string }
  | { ok: false; status: number; error: string; data: unknown; text: string; url: string };

type MapperResult<T> = { ok: true; payload: T } | { ok: false; reason: string; raw: unknown };

type DiagnosticsSummary = {
  apiOk: boolean;
  mapperOk: boolean;
  dbOk: boolean;
  tablesFound: number;
  itemsFound: number;
  tablesWritten: number;
  itemsWritten: number;
};

const PRICE_TABLES_PATH = "/tabelasPreco";
const REQUIRED_ENV = [
  "NOMUS_BASE_URL",
  "NOMUS_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    loadEnvFile(resolve(process.cwd(), name));
  }
}

function requireEnv(name: (typeof REQUIRED_ENV)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

function normalizeNomusBaseUrl(): string {
  const raw = requireEnv("NOMUS_BASE_URL");
  const looksLikeUrl = /^https?:\/\//i.test(raw);
  const looksLikeBase64 = /^[A-Za-z0-9+/=]{16,}$/.test(raw);
  const looksLikeCredential = !looksLikeUrl && /^[^\s/]+:[^\s/]+$/.test(raw);

  if (!looksLikeUrl || looksLikeBase64 || looksLikeCredential) {
    throw new Error(
      `NOMUS_BASE_URL parece inválida. Configure uma URL REST do Nomus, ex.: https://SEU_DOMINIO.nomus.com.br/SEU_DOMINIO/rest`,
    );
  }

  const url = new URL(raw);
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function buildQuery(query?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function classifyApiError(status: number, body: string): string {
  if (status === 0) return body;
  if (status === 401)
    return `Falha de autenticação (401): chave API rejeitada pelo Nomus. Body: ${body}`;
  if (status === 403)
    return `Acesso negado (403): chave sem permissão para o endpoint. Body: ${body}`;
  if (status === 404)
    return `Endpoint não encontrado (404): verifique NOMUS_BASE_URL e caminho chamado. Body: ${body}`;
  return `Nomus respondeu HTTP ${status}. Body: ${body}`;
}

async function nomusGet(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<NomusHttpResult> {
  let url = "";
  try {
    const baseUrl = normalizeNomusBaseUrl();
    const apiKey = requireEnv("NOMUS_API_KEY");
    const authValue = /^basic\s+/i.test(apiKey) ? apiKey : `Basic ${apiKey}`;
    url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}${buildQuery(query)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authValue,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: classifyApiError(response.status, text),
        data,
        text,
        url,
      };
    }

    return { ok: true, status: response.status, data, text, url };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, error: message, data: null, text: message, url };
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function extractArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];

  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function pickString(raw: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return null;
}

function pickNumber(raw: JsonRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function pickBoolean(raw: JsonRecord, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && value.trim()) {
      return /^(true|sim|s|ativo|1)$/i.test(value.trim());
    }
  }
  return null;
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function tableNomusId(raw: JsonRecord): string | null {
  return pickString(raw, "id", "idTabelaPreco", "codigo", "codTabelaPreco", "codigoTabelaPreco");
}

function itemProductId(raw: JsonRecord): string | null {
  const direct = pickString(
    raw,
    "nomus_product_id",
    "idProduto",
    "produtoId",
    "idProdutoServico",
    "codigoProduto",
    "codigo",
    "codProduto",
    "produtoCodigo",
  );
  if (direct) return direct;

  const product = asRecord(raw.produto);
  return product ? pickString(product, "id", "codigo", "idProduto", "codigoProduto") : null;
}

function itemUnitPrice(raw: JsonRecord): number | null {
  return pickNumber(
    raw,
    "unit_price",
    "precoUnitario",
    "precoVenda",
    "preco",
    "valor",
    "valorUnitario",
    "precoTabela",
    "precoCalculado",
    "precoUnitarioCalculado",
  );
}

function mapNomusPriceTableToDb(raw: unknown): MapperResult<DbPayload> {
  const record = asRecord(raw);
  if (!record) return { ok: false, reason: "Tabela não é um objeto JSON.", raw };

  const nomusId = tableNomusId(record);
  const name = pickString(record, "nome", "name", "descricao", "description");
  if (!nomusId)
    return { ok: false, reason: "Tabela descartada: sem id/codigo/idTabelaPreco.", raw };
  if (!name) return { ok: false, reason: "Tabela descartada: sem nome/name/descricao.", raw };

  return {
    ok: true,
    payload: {
      nomus_id: nomusId,
      code: pickString(record, "codigo", "code", "codTabelaPreco", "codigoTabelaPreco"),
      name,
      currency: pickString(record, "moeda", "currency") ?? "BRL",
      is_active: pickBoolean(record, "ativo", "active", "isActive", "situacao") ?? true,
      raw: record,
      synced_at: new Date().toISOString(),
    },
  };
}

function mapNomusPriceTableItemToDb(raw: unknown, priceTableId: string): MapperResult<DbPayload> {
  const record = asRecord(raw);
  if (!record) return { ok: false, reason: "Item descartado: item não é um objeto JSON.", raw };

  const productId = itemProductId(record);
  const unitPrice = itemUnitPrice(record);
  if (!productId)
    return { ok: false, reason: "Item descartado: sem idProduto/codigoProduto/codigo.", raw };
  if (unitPrice === null)
    return { ok: false, reason: "Item descartado: sem preco/precoVenda/precoUnitario/valor.", raw };

  return {
    ok: true,
    payload: {
      price_table_id: priceTableId,
      nomus_product_id: productId,
      unit_price: unitPrice,
      currency: pickString(record, "moeda", "currency") ?? "BRL",
      raw: record,
      synced_at: new Date().toISOString(),
    },
  };
}

function logSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function createSupabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function main() {
  loadLocalEnv();

  for (const key of REQUIRED_ENV) requireEnv(key);

  const supabase = createSupabaseAdmin();
  const summary: DiagnosticsSummary = {
    apiOk: false,
    mapperOk: false,
    dbOk: false,
    tablesFound: 0,
    itemsFound: 0,
    tablesWritten: 0,
    itemsWritten: 0,
  };

  logSection("TESTE 1 - Conexão básica");
  const tablesResponse = await nomusGet(PRICE_TABLES_PATH, { pagina: 1 });
  console.log("endpoint:", "GET /tabelasPreco?pagina=1");
  console.log("status HTTP:", tablesResponse.status);

  if (tablesResponse.ok === false) {
    console.error("❌ erro na API:", tablesResponse.error);
    throw new Error("Falha no TESTE 1.");
  }

  const tables = extractArray(tablesResponse.data, [
    "items",
    "resultados",
    "data",
    "content",
    "registros",
    "lista",
    "tabelasPreco",
  ]);
  summary.apiOk = true;
  summary.tablesFound = tables.length;
  console.log("quantidade de tabelas:", tables.length);
  console.log("primeira tabela retornada:", pretty(tables[0] ?? null));
  if (tables.length === 0) throw new Error("Nenhuma tabela retornada por /tabelasPreco?pagina=1.");

  const firstTable = tables[0];
  const firstTableRecord = asRecord(firstTable);
  const firstTableNomusId = firstTableRecord ? tableNomusId(firstTableRecord) : null;
  if (!firstTableNomusId)
    throw new Error("Primeira tabela não tem id/codigo/idTabelaPreco para chamar /itens.");

  logSection("TESTE 2 - Itens da tabela");
  const itemsPath = `${PRICE_TABLES_PATH}/${encodeURIComponent(firstTableNomusId)}/itens`;
  const itemsResponse = await nomusGet(itemsPath);
  console.log("endpoint:", `GET ${itemsPath}`);
  console.log("status HTTP:", itemsResponse.status);

  if (itemsResponse.ok === false) {
    console.error("❌ erro na API:", itemsResponse.error);
    throw new Error("Falha no TESTE 2.");
  }

  const items = extractArray(itemsResponse.data, [
    "items",
    "resultados",
    "data",
    "content",
    "registros",
    "lista",
    "itens",
    "tabelaPrecoItens",
    "produtos",
  ]);
  summary.itemsFound = items.length;
  console.log("quantidade de itens:", items.length);
  console.log("primeiro item:", pretty(items[0] ?? null));
  if (items.length === 0) console.warn("Itens da tabela retornaram vazio");

  logSection("TESTE 3 - Mapeamento");
  const mappedTable = mapNomusPriceTableToDb(firstTable);
  if (mappedTable.ok === false) {
    summary.mapperOk = false;
    console.error("❌ erro no mapper:", mappedTable.reason);
    console.error("raw:", pretty(mappedTable.raw));
    throw new Error("Falha ao mapear tabela.");
  }
  console.log("tabela mapeada:", pretty(mappedTable.payload));

  logSection("TESTE 4 - Gravação no banco");
  console.log("payload enviado para nomus_price_tables:", pretty(mappedTable.payload));
  const tableUpsert = await supabase
    .from("nomus_price_tables")
    .upsert(mappedTable.payload, { onConflict: "nomus_id" })
    .select("*")
    .single();

  if (tableUpsert.error || !tableUpsert.data) {
    summary.dbOk = false;
    console.error("❌ erro no banco: nomus_price_tables");
    console.error("erro do Supabase:", pretty(tableUpsert.error));
    throw new Error("Falha no upsert de nomus_price_tables.");
  }
  summary.tablesWritten = 1;
  console.log("sucesso nomus_price_tables:", pretty(tableUpsert.data));

  const dbPriceTableId = String((tableUpsert.data as JsonRecord).id);
  let firstMappedItem: DbPayload | null = null;
  let discardedItems = 0;
  for (const item of items) {
    const mappedItem = mapNomusPriceTableItemToDb(item, dbPriceTableId);
    if (mappedItem.ok === false) {
      discardedItems += 1;
      console.warn(mappedItem.reason);
      console.warn("raw descartado:", pretty(mappedItem.raw));
      continue;
    }

    if (!firstMappedItem) {
      firstMappedItem = mappedItem.payload;
      console.log("item mapeado:", pretty(mappedItem.payload));
    }

    console.log("payload enviado para nomus_price_table_items:", pretty(mappedItem.payload));
    const itemUpsert = await supabase
      .from("nomus_price_table_items")
      .upsert(mappedItem.payload, { onConflict: "price_table_id,nomus_product_id" })
      .select("*")
      .single();

    if (itemUpsert.error || !itemUpsert.data) {
      summary.dbOk = false;
      console.error("❌ erro no banco: nomus_price_table_items");
      console.error("erro do Supabase:", pretty(itemUpsert.error));
      throw new Error("Falha no upsert de nomus_price_table_items.");
    }

    summary.itemsWritten += 1;
    console.log("sucesso nomus_price_table_items:", pretty(itemUpsert.data));
  }

  if (items.length > 0 && !firstMappedItem) {
    summary.mapperOk = false;
    throw new Error(`Todos os ${items.length} itens foram descartados pelo mapper.`);
  }

  summary.mapperOk = true;
  summary.dbOk = true;
  if (discardedItems > 0) console.warn(`itens descartados pelo mapper: ${discardedItems}`);

  logSection("TESTE 5 - Leitura do banco");
  const readTables = await supabase.from("nomus_price_tables").select("*").limit(5);
  if (readTables.error) {
    summary.dbOk = false;
    console.error("❌ erro no banco: select nomus_price_tables");
    console.error("erro do Supabase:", pretty(readTables.error));
    throw new Error("Falha ao ler nomus_price_tables.");
  }
  console.log("nomus_price_tables encontrados:", readTables.data?.length ?? 0);
  console.log("primeiro nomus_price_tables:", pretty(readTables.data?.[0] ?? null));

  const readItems = await supabase.from("nomus_price_table_items").select("*").limit(5);
  if (readItems.error) {
    summary.dbOk = false;
    console.error("❌ erro no banco: select nomus_price_table_items");
    console.error("erro do Supabase:", pretty(readItems.error));
    throw new Error("Falha ao ler nomus_price_table_items.");
  }
  console.log("nomus_price_table_items encontrados:", readItems.data?.length ?? 0);
  console.log("primeiro nomus_price_table_items:", pretty(readItems.data?.[0] ?? null));

  logSection("SAÍDA FINAL");
  console.log("✔ conexão OK");
  console.log(`✔ tabelas encontradas: ${summary.tablesFound}`);
  console.log(`✔ itens encontrados: ${summary.itemsFound}`);
  console.log(`✔ tabelas gravadas: ${summary.tablesWritten}`);
  console.log(`✔ itens gravados: ${summary.itemsWritten}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\n=== SAÍDA FINAL ===");
  console.error("❌ diagnóstico falhou:", message);
  process.exitCode = 1;
});
