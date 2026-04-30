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

export function selectTableForItem(
  tables: ItemPriceTable[],
  clientUf: string | null,
): SelectionResult {
  const uf = (clientUf ?? "").toUpperCase().trim() || null;
  const active = tables.filter((t) => t.isActive);
  if (active.length === 0) return null;

  // 1. Compatíveis com a UF do cliente, ordenadas por ICMS desc
  if (uf) {
    const compatible = active.filter((t) => t.ufs.includes(uf));
    if (compatible.length > 0) {
      const sorted = [...compatible].sort(
        (a, b) => (b.icmsPct ?? -Infinity) - (a.icmsPct ?? -Infinity),
      );
      return { table: sorted[0], method: "auto_uf_max_icms" };
    }
  }

  // 2. Fallback: maior ICMS dentre as ativas (UF não coberta)
  const withIcms = active.filter((t) => t.icmsPct != null);
  if (withIcms.length > 0) {
    const sorted = [...withIcms].sort(
      (a, b) => (b.icmsPct ?? -Infinity) - (a.icmsPct ?? -Infinity),
    );
    return { table: sorted[0], method: "auto_max_icms" };
  }

  // 3. Fallback: tabela ativa mais recente (sem ICMS cadastrado)
  const sortedByDate = [...active].sort((a, b) => {
    const ad = a.syncedAt ? Date.parse(a.syncedAt) : 0;
    const bd = b.syncedAt ? Date.parse(b.syncedAt) : 0;
    return bd - ad;
  });
  return { table: sortedByDate[0], method: "auto_latest" };
}
