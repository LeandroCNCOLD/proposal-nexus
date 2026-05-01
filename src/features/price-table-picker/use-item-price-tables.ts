import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listPriceTablesForProducts,
  setProposalItemPriceTable,
} from "./price-table-picker.functions";
import {
  selectTableForItem,
  type ItemPriceTable,
  type MatchMethod,
} from "./select-table-for-item";

export type PerItemTablesByProduct = Map<string, ItemPriceTable[]>;

export function useItemPriceTables(opts: {
  proposalId: string;
  clientUf: string | null;
  /** itens da proposta — precisamos do id e do nomus_product_id */
  items: Array<{
    id: string;
    nomusItemId: string | null;
    nomusProductId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    position: number | null;
    priceTableId: string | null;
    priceTableSelectedAt: string | null;
    priceTableMatchMethod: string | null;
  }>;
}) {
  const qc = useQueryClient();
  const fetch = useServerFn(listPriceTablesForProducts);
  const save = useServerFn(setProposalItemPriceTable);

  const productIds = useMemo(
    () =>
      Array.from(
        new Set(opts.items.map((i) => i.nomusProductId).filter((x): x is string => !!x)),
      ),
    [opts.items],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["per-item-price-tables", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const res = await fetch({ data: { nomusProductIds: productIds } });
      const map: PerItemTablesByProduct = new Map();
      for (const r of res.rows) {
        const arr = map.get(r.nomusProductId) ?? [];
        arr.push({
          id: r.priceTableId,
          name: r.name,
          ufs: r.ufs,
          icmsPct: r.icmsPct,
          unitPrice: r.unitPrice,
          currency: r.currency,
          syncedAt: r.syncedAt,
          isActive: r.isActive,
          costs: r.costs,
        });
        map.set(r.nomusProductId, arr);
      }
      return map;
    },
  });

  const tablesByProduct: PerItemTablesByProduct = data ?? new Map();

  const mutation = useMutation({
    mutationFn: async (input: {
      proposalItemId: string;
      item: typeof opts.items[number];
      table: ItemPriceTable | null;
      method: MatchMethod;
      silent?: boolean;
    }) => {
      await save({
        data: {
          proposalItemId: input.proposalItemId,
          proposalId: opts.proposalId,
          nomusItemId: input.item.nomusItemId,
          description: input.item.description,
          quantity: input.item.quantity,
          itemUnitPrice: input.item.unitPrice,
          position: input.item.position,
          priceTableId: input.table?.id ?? null,
          priceTableName: input.table?.name ?? null,
          priceTableUnitPrice: input.table?.unitPrice ?? null,
          matchMethod: input.method as Exclude<MatchMethod, "nomus_sync">,
          costs: input.table?.costs ?? null,
        },
      });
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["nomus-proposal-full"] });
      qc.invalidateQueries({ queryKey: ["proposal-items-local", opts.proposalId] });
      qc.invalidateQueries({ queryKey: ["proposal", opts.proposalId] });
      if (input.method === "manual" && !input.silent) {
        toast.success(
          input.table ? `Tabela alterada: ${input.table.name}` : "Tabela removida",
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    tablesByProduct,
    isLoading,
    /** aplica regra de seleção automática e persiste (silenciosamente). */
    applyAuto: (proposalItemId: string, productId: string | null) => {
      if (!productId) return;
      const item = opts.items.find((i) => i.id === proposalItemId);
      if (!item) return;
      const tables = tablesByProduct.get(productId) ?? [];
      const sel = selectTableForItem(tables, opts.clientUf, item.unitPrice);
      mutation.mutate({
        proposalItemId,
        item,
        table: sel?.table ?? null,
        method: sel?.method ?? "auto_latest",
        silent: true,
      });
    },
    /** Troca manual feita pelo vendedor. */
    applyManual: (proposalItemId: string, table: ItemPriceTable | null) => {
      const item = opts.items.find((i) => i.id === proposalItemId);
      if (!item) return;
      mutation.mutate({ proposalItemId, item, table, method: "manual" });
    },
  };
}
