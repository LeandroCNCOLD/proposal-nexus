import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import { usePaymentPresets } from "../use-payment-presets";
import type { InstallmentInput } from "../financial-math";

export interface SelectedPreset {
  id: string;
  name: string;
  description: string | null;
  installments: InstallmentInput[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (preset: SelectedPreset) => void;
}

export function PaymentPresetPicker({ open, onOpenChange, onSelect }: Props) {
  const { data, isLoading } = usePaymentPresets(true);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const handlePick = (presetId: string) => {
    const p = data?.find((pp) => pp.id === presetId);
    if (!p) return;
    setPickedId(presetId);
    onSelect({
      id: p.id,
      name: p.name,
      description: p.description,
      installments: p.installments.map((i) => ({
        description: i.description,
        percentage: Number(i.percentage),
        days: i.days,
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Selecionar condição de pagamento</DialogTitle>
          <DialogDescription>
            Escolha um preset. As parcelas serão copiadas para esta proposta — alterações
            aqui não afetam o preset original.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando presets...
          </div>
        )}

        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhum preset ativo encontrado.
          </div>
        )}

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {data?.map((p) => {
            const totalPct = p.installments.reduce(
              (acc, i) => acc + Number(i.percentage),
              0,
            );
            return (
              <button
                key={p.id}
                onClick={() => handlePick(p.id)}
                className="w-full text-left rounded-md border p-3 hover:bg-accent/40 transition flex items-start gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <Badge variant="secondary">{p.installments.length} parcelas</Badge>
                    <Badge variant="outline">{totalPct.toFixed(0)}%</Badge>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.installments.map((i, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] rounded bg-muted px-1.5 py-0.5"
                      >
                        {Number(i.percentage)}% / {i.days}d
                      </span>
                    ))}
                  </div>
                </div>
                {pickedId === p.id && <Check className="h-4 w-4 text-primary" />}
                <Button size="sm" variant="ghost" type="button">
                  Usar
                </Button>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
