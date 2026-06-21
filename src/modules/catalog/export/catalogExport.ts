export type CatalogExportProduct = Record<string, unknown>;

type CatalogField = {
  key: string;
  label: string;
  aliases: string[];
};

const CATALOG_FIELDS: CatalogField[] = [
  {
    key: "codigo",
    label: "codigo",
    aliases: ["codigo", "code", "sku", "catalog_variant_key", "id"],
  },
  {
    key: "nome",
    label: "nome",
    aliases: ["nome", "name", "nome_produto", "product_name", "smart_description", "modelo"],
  },
  {
    key: "categoria",
    label: "categoria",
    aliases: ["categoria", "category", "linha", "tipo_gabinete"],
  },
  {
    key: "aplicacao",
    label: "aplicacao",
    aliases: [
      "aplicacao",
      "application",
      "application_summary",
      "application_type",
      "recommended_applications",
    ],
  },
  {
    key: "capacidade",
    label: "capacidade",
    aliases: ["capacidade", "capacity", "evaporator_capacity_kcal_h", "compressor_capacity_kcal_h"],
  },
  {
    key: "unidade_capacidade",
    label: "unidade_capacidade",
    aliases: ["unidade_capacidade", "capacity_unit", "capacityUnit"],
  },
  { key: "refrigerante", label: "refrigerante", aliases: ["refrigerante", "refrigerant"] },
  {
    key: "temperatura_evaporacao",
    label: "temperatura_evaporacao",
    aliases: ["temperatura_evaporacao", "evaporation_temp_c"],
  },
  {
    key: "temperatura_condensacao",
    label: "temperatura_condensacao",
    aliases: ["temperatura_condensacao", "condensation_temp_c"],
  },
  {
    key: "tensao",
    label: "tensao",
    aliases: ["tensao", "voltage", "electrical_configuration", "voltage_value_v"],
  },
  {
    key: "vazao",
    label: "vazao",
    aliases: ["vazao", "airflow_m3_h", "air_flow_m3_h", "mass_flow_kg_h"],
  },
  {
    key: "potencia",
    label: "potencia",
    aliases: ["potencia", "power", "total_power_kw", "compressor_power_kw"],
  },
  { key: "modelo", label: "modelo", aliases: ["modelo", "model"] },
  {
    key: "descricao_tecnica",
    label: "descricao_tecnica",
    aliases: [
      "descricao_tecnica",
      "technical_description",
      "smart_description",
      "commercial_description",
      "notes",
    ],
  },
  { key: "custo", label: "custo", aliases: ["custo", "cost"] },
  { key: "preco", label: "preco", aliases: ["preco", "price"] },
  { key: "status", label: "status", aliases: ["status", "active"] },
  {
    key: "data_atualizacao",
    label: "data_atualizacao",
    aliases: ["data_atualizacao", "updated_at", "updatedAt"],
  },
];

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value))
    return value.filter((item) => item !== null && item !== undefined && item !== "").join(", ");
  if (typeof value === "boolean") return value ? "ativo" : "inativo";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function getNestedValue(source: CatalogExportProduct, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function getFieldValue(product: CatalogExportProduct, field: CatalogField): string {
  for (const alias of field.aliases) {
    const value = getNestedValue(product, alias);
    if (value !== null && value !== undefined && value !== "") return valueToString(value);
  }
  return "";
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[;"\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function exportCatalogToCSV(products: CatalogExportProduct[]): string {
  const header = CATALOG_FIELDS.map((field) => field.label).join(";");
  const rows = products.map((product) =>
    CATALOG_FIELDS.map((field) => csvEscape(getFieldValue(product, field))).join(";"),
  );
  return [header, ...rows].join("\n");
}

export function exportCatalogToXML(products: CatalogExportProduct[]): string {
  const productsXml = products
    .map((product) => {
      const fieldsXml = CATALOG_FIELDS.map((field) => {
        const value = xmlEscape(getFieldValue(product, field));
        return `    <${field.key}>${value}</${field.key}>`;
      }).join("\n");
      return `  <produto>\n${fieldsXml}\n  </produto>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<catalogo>\n${productsXml}\n</catalogo>`;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
