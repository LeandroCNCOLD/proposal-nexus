import * as XLSX from "xlsx";

/**
 * Parser inteligente do catálogo CN ColdPro.
 * Lê a planilha com 99 colunas (A..CU) e normaliza para a estrutura do banco.
 */

// ===== Mapeamento de colunas conhecidas (por header normalizado) =====
// Aceita variações de acentuação/maiúsculas. Sempre normalizamos antes de comparar.
function norm(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Converte número aceitando formato BR ("1.234,56") e US ("1,234.56")
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  // remove unidades coladas
  s = s.replace(/[^0-9,.\-eE]/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // assume vírgula = decimal BR
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

// Aliases por campo lógico → lista de headers possíveis (normalizados)
const FIELD_ALIASES: Record<string, string[]> = {
  modelo: ["modelo"],
  linha: ["linha"],
  designacao_hp: ["designacao comercial em hp", "designacao hp", "hp"],
  gabinete: ["gabinete"],
  tipo_gabinete: ["tipo de gabinete", "tipo gabinete"],
  copeland: ["copeland"],
  bitzer: ["bitzer"],
  danfoss_bock: ["danfoss / bock", "danfoss/bock", "danfoss bock", "danfoss"],
  dorin: ["dorin"],
  refrigerante: ["refrigerante", "fluido refrigerante"],
  gwp_ar6: ["gwp-ar6", "gwp ar6", "gwp"],
  odp_ar6: ["odp-ar6", "odp ar6", "odp"],
  tipo_degelo: ["tipo de degelo", "tipo degelo", "degelo"],

  // Condensador
  condenser_model: ["modelo condensador", "modelo do condensador"],
  cond_tube_in: ["o tubo_cond [in]", "diametro tubo cond [in]", "o tubo cond in"],
  cond_tube_mm: ["o tubo_cond [mm]", "diametro tubo cond [mm]", "o tubo cond mm"],
  cond_tube_thickness: ["esp. tubo_cond [mm]", "espessura tubo cond"],
  cond_geometry: ["geometria condensador"],
  cond_volume: ["volume interno condensador"],
  cond_fan: ["ventilador condensador"],
  cond_airflow: ["vazao ventilador condensador", "vazao condensador"],

  // Evaporador
  evap_model: ["modelo evaporador", "modelo do evaporador"],
  evap_reheat: ["reaquecimento"],
  evap_tube_in: ["o tubo_evap [in]", "o tubo evap in"],
  evap_tube_mm: ["o tubo_evap [mm]", "o tubo evap mm"],
  evap_tube_thickness: ["esp. tubo_evap [mm]", "espessura tubo evap"],
  evap_geometry: ["geometria evaporador"],
  evap_volume: ["volume interno evaporador"],
  evap_area: ["area da superficie de troca evaporador", "area de troca evaporador"],
  evap_qty: ["quantidade de evaporadores", "qtd evaporadores"],
  evap_fan: ["ventilador evaporador"],
  evap_airflow: ["vazao ventilador evaporador", "vazao evaporador"],

  // Performance
  evap_capacity: ["capacidade evaporador", "capacidade do evaporador"],
  comp_capacity: ["capacidade compressor", "capacidade do compressor"],
  heat_rejection: ["calor rejeitado", "rejeicao de calor"],
  temp_room: ["temperatura da camara", "temperatura camara", "temp camara"],
  hum_room: ["umidade da camara", "umidade camara"],
  evap_temp: ["temperatura de evaporacao", "tevap", "t evap"],
  cond_temp: ["temperatura de condensacao", "tcond", "t cond"],
  ext_temp: ["temperatura externa", "temp externa"],
  ext_hum: ["umidade externa"],
  altitude: ["altitude", "altitude m"],

  mass_flow_h: ["vazao massica kg/h", "vazao massica [kg/h]"],
  mass_flow_s: ["vazao massica kg/s", "vazao massica [kg/s]"],
  enthalpy_diff: ["diferenca de entalpia", "delta h"],
  superheat_total: ["superaquecimento total"],
  superheat_useful: ["superaquecimento util"],
  subcool: ["subresfriamento"],
  subcool_extra: ["subresfriamento adicional"],

  comp_power: ["potencia compressor", "potencia do compressor"],
  fan_power: ["potencia ventilador", "potencia ventiladores"],
  total_power: ["potencia total"],
  cop: ["cop"],
  cop_carnot: ["cop carnot"],
  global_cop: ["cop global"],

  voltage: ["tensao", "voltagem", "voltage"],
  comp_current: ["corrente compressor", "corrente do compressor"],
  fan_current: ["corrente ventilador"],
  est_current: ["corrente estimada", "corrente total estimada"],
  start_current: ["corrente de partida", "corrente partida"],

  fluid_charge: ["carga de fluido", "carga refrigerante", "carga de refrigerante"],
  drain_water: ["agua de dreno", "vazao agua dreno", "agua de dreno l/h"],
  drain_diameter: ["diametro dreno", "o dreno"],
  drain_qty: ["quantidade de drenos", "qtd drenos"],
};

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  // Modelo
  modelo: string | null;
  linha: string | null;
  designacao_hp: string | null;
  gabinete: string | null;
  tipo_gabinete: string | null;
  refrigerante: string | null;
  gwp_ar6: number | null;
  odp_ar6: number | null;
  tipo_degelo: string | null;
  // Compressores
  copeland: string | null;
  bitzer: string | null;
  danfoss_bock: string | null;
  dorin: string | null;
  // Condensador
  condenser: {
    model: string | null;
    tube_in: number | null;
    tube_mm: number | null;
    tube_thickness: number | null;
    geometry: string | null;
    volume: number | null;
    fan: string | null;
    airflow: number | null;
  };
  // Evaporador
  evaporator: {
    model: string | null;
    reheat: string | null;
    tube_in: number | null;
    tube_mm: number | null;
    tube_thickness: number | null;
    geometry: string | null;
    volume: number | null;
    area: number | null;
    qty: number | null;
    fan: string | null;
    airflow: number | null;
  };
  // Performance
  performance: {
    temp_room: number | null;
    hum_room: number | null;
    evap_temp: number | null;
    cond_temp: number | null;
    ext_temp: number | null;
    ext_hum: number | null;
    altitude: number | null;
    evap_capacity: number | null;
    comp_capacity: number | null;
    heat_rejection: number | null;
    mass_flow_h: number | null;
    mass_flow_s: number | null;
    enthalpy_diff: number | null;
    superheat_total: number | null;
    superheat_useful: number | null;
    subcool: number | null;
    subcool_extra: number | null;
    comp_power: number | null;
    fan_power: number | null;
    total_power: number | null;
    cop: number | null;
    cop_carnot: number | null;
    global_cop: number | null;
    voltage: string | null;
    comp_current: number | null;
    fan_current: number | null;
    est_current: number | null;
    start_current: number | null;
    fluid_charge: number | null;
    drain_water: number | null;
    drain_diameter: string | null;
    drain_qty: number | null;
  };
  isValid: boolean;
  validationError?: string;
};

export type ParseResult = {
  sheetName: string;
  totalRows: number;
  validRows: number;
  skippedRows: number;
  uniqueModels: number;
  refrigerants: string[];
  lines: string[];
  headers: string[];
  unmappedHeaders: string[];
  rows: ParsedRow[];
};

function buildHeaderMap(headers: string[]): {
  fieldToCol: Map<string, number>;
  unmapped: string[];
} {
  const fieldToCol = new Map<string, number>();
  const usedCols = new Set<number>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (let i = 0; i < headers.length; i++) {
      const h = norm(headers[i]);
      if (aliases.some((a) => h === a || h.includes(a))) {
        if (!fieldToCol.has(field)) {
          fieldToCol.set(field, i);
          usedCols.add(i);
          break;
        }
      }
    }
  }
  const unmapped = headers
    .map((h, i) => ({ h, i }))
    .filter((x) => !usedCols.has(x.i) && x.h)
    .map((x) => x.h);
  return { fieldToCol, unmapped };
}

function get(row: unknown[], map: Map<string, number>, field: string): unknown {
  const idx = map.get(field);
  if (idx === undefined) return null;
  return row[idx];
}

export async function parseCatalogFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (matrix.length < 2) {
    return {
      sheetName,
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
      uniqueModels: 0,
      refrigerants: [],
      lines: [],
      headers: [],
      unmappedHeaders: [],
      rows: [],
    };
  }

  // Detecta linha de header: primeira linha não-vazia que tem "MODELO"
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, matrix.length); i++) {
    if (matrix[i].some((c) => norm(String(c ?? "")) === "modelo")) {
      headerRowIdx = i;
      break;
    }
  }
  const headers = (matrix[headerRowIdx] as unknown[]).map((c) =>
    String(c ?? "").trim()
  );
  const { fieldToCol, unmapped } = buildHeaderMap(headers);

  const rows: ParsedRow[] = [];
  const modelKey = new Set<string>();
  const refrigerantsSet = new Set<string>();
  const linesSet = new Set<string>();

  for (let i = headerRowIdx + 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.every((c) => c === null || c === undefined || c === "")) continue;

    const modelo = toText(get(r, fieldToCol, "modelo"));
    const refrigerante = toText(get(r, fieldToCol, "refrigerante"));
    const gabinete = toText(get(r, fieldToCol, "gabinete"));
    const linha = toText(get(r, fieldToCol, "linha"));

    const raw: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      if (h) raw[h] = r[idx] ?? null;
    });

    const parsed: ParsedRow = {
      rowNumber: i + 1,
      raw,
      modelo,
      linha,
      designacao_hp: toText(get(r, fieldToCol, "designacao_hp")),
      gabinete,
      tipo_gabinete: toText(get(r, fieldToCol, "tipo_gabinete")),
      refrigerante,
      gwp_ar6: toNumber(get(r, fieldToCol, "gwp_ar6")),
      odp_ar6: toNumber(get(r, fieldToCol, "odp_ar6")),
      tipo_degelo: toText(get(r, fieldToCol, "tipo_degelo")),
      copeland: toText(get(r, fieldToCol, "copeland")),
      bitzer: toText(get(r, fieldToCol, "bitzer")),
      danfoss_bock: toText(get(r, fieldToCol, "danfoss_bock")),
      dorin: toText(get(r, fieldToCol, "dorin")),
      condenser: {
        model: toText(get(r, fieldToCol, "condenser_model")),
        tube_in: toNumber(get(r, fieldToCol, "cond_tube_in")),
        tube_mm: toNumber(get(r, fieldToCol, "cond_tube_mm")),
        tube_thickness: toNumber(get(r, fieldToCol, "cond_tube_thickness")),
        geometry: toText(get(r, fieldToCol, "cond_geometry")),
        volume: toNumber(get(r, fieldToCol, "cond_volume")),
        fan: toText(get(r, fieldToCol, "cond_fan")),
        airflow: toNumber(get(r, fieldToCol, "cond_airflow")),
      },
      evaporator: {
        model: toText(get(r, fieldToCol, "evap_model")),
        reheat: toText(get(r, fieldToCol, "evap_reheat")),
        tube_in: toNumber(get(r, fieldToCol, "evap_tube_in")),
        tube_mm: toNumber(get(r, fieldToCol, "evap_tube_mm")),
        tube_thickness: toNumber(get(r, fieldToCol, "evap_tube_thickness")),
        geometry: toText(get(r, fieldToCol, "evap_geometry")),
        volume: toNumber(get(r, fieldToCol, "evap_volume")),
        area: toNumber(get(r, fieldToCol, "evap_area")),
        qty: toNumber(get(r, fieldToCol, "evap_qty")),
        fan: toText(get(r, fieldToCol, "evap_fan")),
        airflow: toNumber(get(r, fieldToCol, "evap_airflow")),
      },
      performance: {
        temp_room: toNumber(get(r, fieldToCol, "temp_room")),
        hum_room: toNumber(get(r, fieldToCol, "hum_room")),
        evap_temp: toNumber(get(r, fieldToCol, "evap_temp")),
        cond_temp: toNumber(get(r, fieldToCol, "cond_temp")),
        ext_temp: toNumber(get(r, fieldToCol, "ext_temp")),
        ext_hum: toNumber(get(r, fieldToCol, "ext_hum")),
        altitude: toNumber(get(r, fieldToCol, "altitude")),
        evap_capacity: toNumber(get(r, fieldToCol, "evap_capacity")),
        comp_capacity: toNumber(get(r, fieldToCol, "comp_capacity")),
        heat_rejection: toNumber(get(r, fieldToCol, "heat_rejection")),
        mass_flow_h: toNumber(get(r, fieldToCol, "mass_flow_h")),
        mass_flow_s: toNumber(get(r, fieldToCol, "mass_flow_s")),
        enthalpy_diff: toNumber(get(r, fieldToCol, "enthalpy_diff")),
        superheat_total: toNumber(get(r, fieldToCol, "superheat_total")),
        superheat_useful: toNumber(get(r, fieldToCol, "superheat_useful")),
        subcool: toNumber(get(r, fieldToCol, "subcool")),
        subcool_extra: toNumber(get(r, fieldToCol, "subcool_extra")),
        comp_power: toNumber(get(r, fieldToCol, "comp_power")),
        fan_power: toNumber(get(r, fieldToCol, "fan_power")),
        total_power: toNumber(get(r, fieldToCol, "total_power")),
        cop: toNumber(get(r, fieldToCol, "cop")),
        cop_carnot: toNumber(get(r, fieldToCol, "cop_carnot")),
        global_cop: toNumber(get(r, fieldToCol, "global_cop")),
        voltage: toText(get(r, fieldToCol, "voltage")),
        comp_current: toNumber(get(r, fieldToCol, "comp_current")),
        fan_current: toNumber(get(r, fieldToCol, "fan_current")),
        est_current: toNumber(get(r, fieldToCol, "est_current")),
        start_current: toNumber(get(r, fieldToCol, "start_current")),
        fluid_charge: toNumber(get(r, fieldToCol, "fluid_charge")),
        drain_water: toNumber(get(r, fieldToCol, "drain_water")),
        drain_diameter: toText(get(r, fieldToCol, "drain_diameter")),
        drain_qty: toNumber(get(r, fieldToCol, "drain_qty")),
      },
      isValid: true,
    };

    // Validação mínima
    if (!parsed.modelo) {
      parsed.isValid = false;
      parsed.validationError = "Linha sem MODELO";
    } else if (
      parsed.performance.evap_temp === null &&
      parsed.performance.evap_capacity === null
    ) {
      parsed.isValid = false;
      parsed.validationError = "Linha sem temperatura de evaporação nem capacidade";
    } else if (
      parsed.performance.evap_capacity !== null &&
      parsed.performance.evap_capacity <= 0
    ) {
      parsed.isValid = false;
      parsed.validationError = "Capacidade do evaporador <= 0";
    }

    if (parsed.isValid && parsed.modelo) {
      const key = `${parsed.modelo}|${parsed.refrigerante ?? ""}|${parsed.gabinete ?? ""}`;
      modelKey.add(key);
      if (refrigerante) refrigerantsSet.add(refrigerante);
      if (linha) linesSet.add(linha);
    }

    rows.push(parsed);
  }

  const validRows = rows.filter((r) => r.isValid).length;
  return {
    sheetName,
    totalRows: rows.length,
    validRows,
    skippedRows: rows.length - validRows,
    uniqueModels: modelKey.size,
    refrigerants: Array.from(refrigerantsSet).sort(),
    lines: Array.from(linesSet).sort(),
    headers,
    unmappedHeaders: unmapped,
    rows,
  };
}
