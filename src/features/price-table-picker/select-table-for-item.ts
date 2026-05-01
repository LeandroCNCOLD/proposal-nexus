/**
 * Lógica pura de seleção automática da tabela de preço para um item da proposta.
 * Isomórfica (sem dependências de React/Supabase) para ser facilmente testável.
 */

export type ItemPriceTable = {
  id: string;
  name: string;
  ufs: string[];
  icmsPct: number | null;
  unitPrice: number | null;
  currency: string;
  syncedAt: string | null;
  isActive: boolean;
};

export type MatchMethod =
  | "auto_uf_max_icms"
  | "auto_max_icms"
  | "auto_uf_min_icms"
  | "auto_min_icms"
  | "auto_uf_closest_price"
  | "auto_closest_price"
  | "auto_latest"
  | "manual"
  | "nomus_sync";

export type SelectionResult = {
  table: ItemPriceTable;
  method: Exclude<MatchMethod, "manual" | "nomus_sync">;
} | null;

/**
 * Extrai o ICMS do nome de uma tabela. Ex.: "Tabela ICMS 8,8" → 8.8
 */
export function parseIcmsFromName(name: string): number | null {
  const m = name.match(/ICMS\s*([0-9]+(?:[.,][0-9]+)?)/i);
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}

/**
 * Ordena tabelas por proximidade do preço de referência. Em caso de empate
 * exato, desempata por menor ICMS e depois pela mais recente.
 */
function sortByClosestPrice(
  tables: ItemPriceTable[],
  reference: number,
): ItemPriceTable[] {
  return [...tables].sort((a, b) => {
    const da = Math.abs((a.unitPrice ?? Infinity) - reference);
    const db = Math.abs((b.unitPrice ?? Infinity) - reference);
    if (da !== db) return da - db;
    const ai = a.icmsPct ?? Infinity;
    const bi = b.icmsPct ?? Infinity;
    if (ai !== bi) return ai - bi;
    const ad = a.syncedAt ? Date.parse(a.syncedAt) : 0;
    const bd = b.syncedAt ? Date.parse(b.syncedAt) : 0;
    return bd - ad;
  });
}

export function selectTableForItem(
  tables: ItemPriceTable[],
  clientUf: string | null,
  itemUnitPrice: number | null = null,
): SelectionResult {
  const uf = (clientUf ?? "").toUpperCase().trim() || null;
  const active = tables.filter((t) => t.isActive);
  if (active.length === 0) return null;

  const hasReferencePrice =
    typeof itemUnitPrice === "number" && Number.isFinite(itemUnitPrice) && itemUnitPrice > 0;

  // ===== Regra principal: UF + preço mais próximo =====
  if (hasReferencePrice) {
    // 1. UF compatível + tabelas com unitPrice → menor |diff|
    if (uf) {
      const compatibleWithPrice = active.filter(
        (t) => t.ufs.map((u) => u.toUpperCase()).includes(uf) && t.unitPrice != null,
      );
      if (compatibleWithPrice.length > 0) {
        const sorted = sortByClosestPrice(compatibleWithPrice, itemUnitPrice as number);
        return { table: sorted[0], method: "auto_uf_closest_price" };
      }
    }
    // 2. Sem UF compatível, mas há tabelas com unitPrice → menor |diff| global
    const withPrice = active.filter((t) => t.unitPrice != null);
    if (withPrice.length > 0) {
      const sorted = sortByClosestPrice(withPrice, itemUnitPrice as number);
      return { table: sorted[0], method: "auto_closest_price" };
    }
  }

  // ===== Fallbacks (sem preço de referência ou sem unitPrice nas tabelas) =====
  // 3. UF compatível, ordenadas por menor ICMS
  if (uf) {
    const compatible = active.filter((t) => t.ufs.map((u) => u.toUpperCase()).includes(uf));
    if (compatible.length > 0) {
      const sorted = [...compatible].sort(
        (a, b) => (a.icmsPct ?? Infinity) - (b.icmsPct ?? Infinity),
      );
      return { table: sorted[0], method: "auto_uf_min_icms" };
    }
  }

  // 4. Menor ICMS dentre as ativas (UF não coberta)
  const withIcms = active.filter((t) => t.icmsPct != null);
  if (withIcms.length > 0) {
    const sorted = [...withIcms].sort(
      (a, b) => (a.icmsPct ?? Infinity) - (b.icmsPct ?? Infinity),
    );
    return { table: sorted[0], method: "auto_min_icms" };
  }

  // 5. Tabela ativa mais recente (sem ICMS cadastrado)
  const sortedByDate = [...active].sort((a, b) => {
    const ad = a.syncedAt ? Date.parse(a.syncedAt) : 0;
    const bd = b.syncedAt ? Date.parse(b.syncedAt) : 0;
    return bd - ad;
  });
  return { table: sortedByDate[0], method: "auto_latest" };
}
