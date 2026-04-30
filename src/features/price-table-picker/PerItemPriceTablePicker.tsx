import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { ItemPriceTable } from "./select-table-for-item";

export type PerItemPriceTablePickerProps = {
  tables: ItemPriceTable[];
  selectedTableId: string | null;
  clientUf: string | null;
  onPick: (table: ItemPriceTable | null) => void;
  /** Volta para a sugestão automática. */
  onResetAuto?: () => void;
};

export function PerItemPriceTablePicker({
  tables,
  selectedTableId,
  clientUf,
  onPick,
  onResetAuto,
}: PerItemPriceTablePickerProps) {
  const uf = (clientUf ?? "").toUpperCase().trim() || null;

  if (tables.length === 0) {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
        Sem tabela disponível
      </span>
    );
  }

  // ordena: compatíveis com UF primeiro, depois por ICMS desc
  const sorted = [...tables].sort((a, b) => {
    const aUf = uf ? (a.ufs.includes(uf) ? 1 : 0) : 0;
    const bUf = uf ? (b.ufs.includes(uf) ? 1 : 0) : 0;
    if (aUf !== bUf) return bUf - aUf;
    return (b.icmsPct ?? -Infinity) - (a.icmsPct ?? -Infinity);
  });

  const selected = tables.find((t) => t.id === selectedTableId) ?? null;

  // qual é a "maior ICMS dentre as compatíveis com a UF"?
  const compatible = uf ? sorted.filter((t) => t.ufs.includes(uf)) : [];
  const maxIcmsCompatibleId = compatible[0]?.id ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full justify-between gap-1 px-2 text-[11px] font-normal"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">{selected?.name ?? "Selecionar…"}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Filtrar tabelas…" className="h-8" />
          <CommandList>
            <CommandEmpty>Nenhuma tabela encontrada.</CommandEmpty>
            <CommandGroup>
              {sorted.map((t) => {
                const isCompatible = uf ? t.ufs.includes(uf) : false;
                const isMaxIcmsCompatible = t.id === maxIcmsCompatibleId;
                return (
                  <CommandItem
                    key={t.id}
                    value={t.name + " " + t.id}
                    onSelect={() => onPick(t)}
                    className="flex flex-col items-start gap-1 py-2"
                  >
                    <div className="flex w-full items-center gap-2">
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          selected?.id === t.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex-1 truncate text-xs font-medium">
                        {t.name}
                      </span>
                      {t.unitPrice != null && (
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {t.unitPrice.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: t.currency || "BRL",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 pl-5">
                      {uf && isCompatible && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                          UF {uf}
                        </span>
                      )}
                      {uf && !isCompatible && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          Não cobre {uf}
                        </span>
                      )}
                      {t.icmsPct != null && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                          ICMS {t.icmsPct}%
                        </span>
                      )}
                      {isMaxIcmsCompatible && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Maior ICMS
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {onResetAuto && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onResetAuto()}
                    className="text-[11px] text-muted-foreground"
                  >
                    Voltar à sugestão automática
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type MatchMethodChipProps = {
  method: string | null;
  hasTable: boolean;
};

export function MatchMethodChip({ method, hasTable }: MatchMethodChipProps) {
  if (!hasTable) {
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">
        Produto sem tabela
      </span>
    );
  }
  switch (method) {
    case "auto_uf_max_icms":
      return (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
          Sugerida por UF
        </span>
      );
    case "auto_max_icms":
      return (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
          UF não coberta · maior ICMS
        </span>
      );
    case "auto_latest":
      return (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
          Sem ICMS · mais recente
        </span>
      );
    case "manual":
      return (
        <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
          Alterada manualmente
        </span>
      );
    case "nomus_sync":
      return (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Vinda do Nomus
        </span>
      );
    default:
      return null;
  }
}
