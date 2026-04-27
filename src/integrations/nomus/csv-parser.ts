/**
 * Parser de CSV exportado pelo Nomus (relatório de tabela de preço com custos).
 *
 * Características conhecidas dos arquivos:
 *   - Encoding Windows-1252 (latin1) — acentos quebram em UTF-8 puro.
 *   - Separador `;` (padrão Excel-PT-BR).
 *   - Decimal `,` e milhar `.`.
 *   - Cabeçalhos com acento, espaços e parênteses.
 *
 * Detecta encoding pela presença de bytes 0x80–0xFF inválidos em UTF-8 e
 * cai para Windows-1252. Funciona tanto no browser (File.arrayBuffer())
 * quanto em server functions (Buffer/Uint8Array).
 */

export type ParsedRow = {
  productCode: string;
  description: string | null;
  unidadeMedida: string | null;
  unitPrice: number | null;
  quantity: number | null;
  margemDesejadaPct: number | null;
  precoCalculado: number | null;
  custosVenda: number | null;
  precoLiquido: number | null;
  custoProducaoTotal: number | null;
  custoMateriais: number | null;
  custoMod: number | null;
  custoCif: number | null;
  lucroBruto: number | null;
  custosAdm: number | null;
  lucroLiquido: number | null;
  margemContribuicao: number | null;
  hasCostData: boolean;
};

export type ParseResult = {
  rows: ParsedRow[];
  warnings: string[];
  columnMap: Record<string, string>;
  rejectedDuplicates: string[];
  rejectedNoCode: number;
  totalRowsRead: number;
};

// Mapa de "header normalizado" -> "chave canônica usada pelo upserter"
const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  "codigo do produto": "productCode",
  "codigo produto": "productCode",
  "codigo": "productCode",
  "descricao do produto": "description",
  "descricao": "description",
  "unidade de medida": "unidadeMedida",
  "unidade": "unidadeMedida",
  "preco unitario": "unitPrice",
  "quantidade": "quantity",
  "margem de lucro": "margemDesejadaPct",
  "margem de lucro desejada": "margemDesejadaPct",
  "margem desejada": "margemDesejadaPct",
  "preco unitario calculado": "precoCalculado",
  "preco calculado": "precoCalculado",
  "custos de venda": "custosVenda",
  "preco liquido": "precoLiquido",
  "custo de producao total": "custoProducaoTotal",
  "custo producao total": "custoProducaoTotal",
  "custo de materiais": "custoMateriais",
  "custo materiais": "custoMateriais",
  "custo de mod": "custoMod",
  "custo mod": "custoMod",
  "custo cif": "custoCif",
  "custo de cif": "custoCif",
  "lucro bruto": "lucroBruto",
  "custos administrativos": "custosAdm",
  "custo administrativo": "custosAdm",
  "lucro liquido": "lucroLiquido",
  "margem de contribuicao": "margemContribuicao",
  "margem contribuicao": "margemContribuicao",
};

const NUMERIC_FIELDS: Array<keyof ParsedRow> = [
  "unitPrice",
  "quantity",
  "margemDesejadaPct",
  "precoCalculado",
  "custosVenda",
  "precoLiquido",
  "custoProducaoTotal",
  "custoMateriais",
  "custoMod",
  "custoCif",
  "lucroBruto",
  "custosAdm",
  "lucroLiquido",
  "margemContribuicao",
];

const COST_FIELDS_FOR_FLAG: Array<keyof ParsedRow> = [
  "custoProducaoTotal",
  "custoMateriais",
  "custoMod",
  "custoCif",
  "custosAdm",
];

/** Remove acentos, caixa e pontuação extra para casar headers tolerante. */
function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()%/]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detecta se os bytes formam UTF-8 válido. Caso contrário, decodifica como Windows-1252. */
export function decodeBytes(bytes: Uint8Array): string {
  // tenta UTF-8 estrito
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return utf8;
  } catch {
    // fallback: Windows-1252
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Parse de uma linha CSV respeitando aspas e o separador `;`. */
function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

/** Converte string PT-BR ("1.234,56" ou "0,40" ou "") em number ou null. */
function parseNumberPtBr(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // remove tudo que não for dígito, vírgula, ponto ou sinal
  const cleaned = s.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;
  // Se tem vírgula, assume formato BR (vírgula decimal, ponto milhar)
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Detecta o separador da primeira linha (preferindo `;` para arquivos PT-BR). */
function detectSeparator(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semis >= commas ? ";" : ",";
}

export function parseNomusCostsCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const columnMap: Record<string, string> = {};
  const rejectedDuplicates: string[] = [];
  let rejectedNoCode = 0;

  // Remove BOM e normaliza CRLF
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const allLines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (allLines.length === 0) {
    return { rows: [], warnings: ["Arquivo vazio."], columnMap, rejectedDuplicates, rejectedNoCode: 0, totalRowsRead: 0 };
  }

  const sep = detectSeparator(allLines[0]);
  const headers = parseCsvLine(allLines[0], sep).map((h) => h.trim());
  const headerKeys: Array<keyof ParsedRow | null> = headers.map((h) => {
    const norm = normalizeHeader(h);
    const key = HEADER_ALIASES[norm] ?? null;
    if (key) columnMap[h] = key;
    return key;
  });

  const recognized = headerKeys.filter((k) => k !== null).length;
  if (recognized < 4) {
    warnings.push(
      `Apenas ${recognized} colunas reconhecidas dos ${headers.length} cabeçalhos. Verifique se este é o relatório correto do Nomus.`,
    );
  }
  if (!headerKeys.includes("productCode")) {
    warnings.push("Coluna 'Código do produto' não encontrada — importação não pode prosseguir.");
    return { rows: [], warnings, columnMap, rejectedDuplicates, rejectedNoCode: 0, totalRowsRead: allLines.length - 1 };
  }

  const seenCodes = new Set<string>();
  const rows: ParsedRow[] = [];

  for (let i = 1; i < allLines.length; i++) {
    const cells = parseCsvLine(allLines[i], sep);
    const row: Partial<ParsedRow> = {};
    for (let c = 0; c < headerKeys.length; c++) {
      const key = headerKeys[c];
      if (!key) continue;
      const raw = (cells[c] ?? "").trim();
      if (NUMERIC_FIELDS.includes(key)) {
        // @ts-expect-error índice dinâmico controlado
        row[key] = parseNumberPtBr(raw);
      } else {
        // @ts-expect-error índice dinâmico controlado
        row[key] = raw || null;
      }
    }

    const code = (row.productCode ?? "").toString().trim();
    if (!code) {
      rejectedNoCode++;
      continue;
    }
    if (seenCodes.has(code)) {
      rejectedDuplicates.push(code);
      continue;
    }
    seenCodes.add(code);

    // has_cost_data = true se QUALQUER campo de custo for > 0
    const hasCostData = COST_FIELDS_FOR_FLAG.some((f) => {
      const v = row[f];
      return typeof v === "number" && v > 0;
    });

    rows.push({
      productCode: code,
      description: row.description ?? null,
      unidadeMedida: row.unidadeMedida ?? null,
      unitPrice: row.unitPrice ?? null,
      quantity: row.quantity ?? null,
      margemDesejadaPct: row.margemDesejadaPct ?? null,
      precoCalculado: row.precoCalculado ?? null,
      custosVenda: row.custosVenda ?? null,
      precoLiquido: row.precoLiquido ?? null,
      custoProducaoTotal: row.custoProducaoTotal ?? null,
      custoMateriais: row.custoMateriais ?? null,
      custoMod: row.custoMod ?? null,
      custoCif: row.custoCif ?? null,
      lucroBruto: row.lucroBruto ?? null,
      custosAdm: row.custosAdm ?? null,
      lucroLiquido: row.lucroLiquido ?? null,
      margemContribuicao: row.margemContribuicao ?? null,
      hasCostData,
    });
  }

  if (rejectedDuplicates.length > 0) {
    warnings.push(`${rejectedDuplicates.length} código(s) duplicado(s) ignorados (mantida a primeira ocorrência).`);
  }
  if (rejectedNoCode > 0) {
    warnings.push(`${rejectedNoCode} linha(s) sem código de produto ignoradas.`);
  }

  return {
    rows,
    warnings,
    columnMap,
    rejectedDuplicates,
    rejectedNoCode,
    totalRowsRead: allLines.length - 1,
  };
}
