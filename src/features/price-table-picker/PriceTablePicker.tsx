import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  listEquipmentPriceTables,
  setProposalPriceTable,
} from "./price-table-picker.functions";

export type EquipmentPriceTable = {
  id: string;
  name: string;
  ufs: string[];
  icmsPct: number | null;
  currency: string;
};

type Props = {
  proposalId: string;
  clientUf?: string | null;
  /** Tabela já escolhida e salva na proposta local. */
  selectedPriceTableId?: string | null;
  /** Callback chamado quando a tabela ativa muda (após auto-default ou seleção). */
  onSelected?: (table: EquipmentPriceTable | null) => void;
};

export function PriceTablePicker({ proposalId, clientUf, selectedPriceTableId, onSelected }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listEquipmentPriceTables);
  const save = useServerFn(setProposalPriceTable);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["equipment-price-tables"],
    queryFn: () => list(),
  });

  const uf = (clientUf ?? "").toUpperCase().trim() || null;

  // Tabelas elegíveis = cobrem a UF do cliente
  const eligibleIds = useMemo(() => {
    if (!uf) return new Set<string>();
    return new Set(tables.filter((t) => (t.ufs ?? []).includes(uf)).map((t) => t.id));
  }, [tables, uf]);

  // Default: maior ICMS dentre as elegíveis (ou nada se UF desconhecida/sem cobertura)
  const defaultId = useMemo(() => {
    const eligibles = tables.filter((t) => eligibleIds.has(t.id));
    if (eligibles.length === 0) return null;
    const sorted = [...eligibles].sort((a, b) => (b.icmsPct ?? -Infinity) - (a.icmsPct ?? -Infinity));
    return sorted[0]?.id ?? null;
  }, [tables, eligibleIds]);

  const activeId = selectedPriceTableId ?? null;
  const activeTable = tables.find((t) => t.id === activeId) ?? null;

  // Auto-aplicar default quando ainda não há escolha
  const autoSave = useMutation({
    mutationFn: async (priceTableId: string) => {
      const t = tables.find((x) => x.id === priceTableId);
      await save({
        data: {
          proposalId,
          priceTableId,
          priceTableName: t?.name ?? null,
        },
      });
      return t ?? null;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
      onSelected?.(t);
    },
  });

  useEffect(() => {
    if (isLoading) return;
    if (activeId) {
      onSelected?.(activeTable);
      return;
    }
    if (defaultId) {
      autoSave.mutate(defaultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, activeId, defaultId]);

  const manualSave = useMutation({
    mutationFn: async (priceTableId: string) => {
      const t = tables.find((x) => x.id === priceTableId) ?? null;
      await save({
        data: {
          proposalId,
          priceTableId,
          priceTableName: t?.name ?? null,
        },
      });
      return t;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
      onSelected?.(t);
      toast.success("Tabela de preço atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando tabelas…</div>;
  }

  if (tables.length === 0) {
    return <div className="text-sm text-muted-foreground">Nenhuma tabela de equipamentos cadastrada.</div>;
  }

  const noUfCoverage = uf && eligibleIds.size === 0;

  return (
    <div className="space-y-1.5">
      <Select value={activeId ?? undefined} onValueChange={(v) => manualSave.mutate(v)}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue placeholder="Selecionar tabela…" />
        </SelectTrigger>
        <SelectContent>
          {tables.map((t) => {
            const eligible = uf ? eligibleIds.has(t.id) : true;
            return (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  <span>{t.name}</span>
                  {uf && eligible && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                      Cobre {uf}
                    </span>
                  )}
                  {uf && !eligible && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      Não cobre {uf}
                    </span>
                  )}
                  {t.id === defaultId && (
                    <Check className="h-3 w-3 text-primary" aria-label="Padrão" />
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {noUfCoverage && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Nenhuma tabela cadastrada cobre o estado <strong>{uf}</strong> do cliente. Selecione manualmente.
          </span>
        </div>
      )}

      {activeTable?.icmsPct != null && (
        <div className="text-[11px] text-muted-foreground">
          ICMS desta tabela: <strong>{activeTable.icmsPct}%</strong>
          {activeTable.id === defaultId && uf && " · padrão (maior ICMS para a UF)"}
        </div>
      )}
    </div>
  );
}
