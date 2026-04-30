import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  isPercentageSumValid,
  sumPercentages,
  validateInstallments,
  type InstallmentInput,
} from "../financial-math";
import {
  useCreatePaymentPreset,
  useUpdatePaymentPreset,
} from "../use-payment-presets";

type Mode = "create" | "edit";

export interface PresetFormValues {
  id?: string;
  name: string;
  description: string;
  is_active: boolean;
  installments: InstallmentInput[];
}

const EMPTY: PresetFormValues = {
  name: "",
  description: "",
  is_active: true,
  installments: [{ description: "Sinal", percentage: 100, days: 0 }],
};

interface Props {
  open: boolean;
  mode: Mode;
  initial?: PresetFormValues | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (presetId: string) => void;
}

export function PaymentPresetFormDialog({
  open,
  mode,
  initial,
  onOpenChange,
  onSaved,
}: Props) {
  const [values, setValues] = useState<PresetFormValues>(EMPTY);
  const create = useCreatePaymentPreset();
  const update = useUpdatePaymentPreset();

  useEffect(() => {
    if (open) setValues(initial ? { ...initial } : { ...EMPTY });
  }, [open, initial]);

  const totalPct = sumPercentages(values.installments);
  const sumOk = isPercentageSumValid(values.installments);

  const updateInstallment = (idx: number, patch: Partial<InstallmentInput>) => {
    setValues((v) => ({
      ...v,
      installments: v.installments.map((i, k) => (k === idx ? { ...i, ...patch } : i)),
    }));
  };

  const addInstallment = () => {
    setValues((v) => ({
      ...v,
      installments: [
        ...v.installments,
        { description: `Parcela ${v.installments.length + 1}`, percentage: 0, days: 30 },
      ],
    }));
  };

  const removeInstallment = (idx: number) => {
    setValues((v) => ({
      ...v,
      installments: v.installments.filter((_, k) => k !== idx),
    }));
  };

  const handleSubmit = async () => {
    const validation = validateInstallments(values.installments);
    if (!values.name.trim()) {
      toast.error("Informe o nome da condição.");
      return;
    }
    if (!validation.ok) {
      toast.error(validation.errors[0]);
      return;
    }

    try {
      if (mode === "create") {
        const res = await create.mutateAsync({
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          is_active: values.is_active,
          installments: values.installments,
        });
        toast.success("Condição criada.");
        onSaved?.(res.id);
      } else {
        if (!values.id) return;
        await update.mutateAsync({
          id: values.id,
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          is_active: values.is_active,
          installments: values.installments,
        });
        toast.success("Condição atualizada.");
        onSaved?.(values.id);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar condição.");
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova condição de pagamento" : "Editar condição"}
          </DialogTitle>
          <DialogDescription>
            Cadastre as parcelas com percentual e prazo em dias. Soma dos percentuais
            deve fechar 100%.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                placeholder="Ex.: 30/30/20/20"
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={values.is_active}
                onCheckedChange={(c) => setValues((v) => ({ ...v, is_active: c }))}
                id="preset-active"
              />
              <Label htmlFor="preset-active">Ativo</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={2}
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              placeholder="Resumo opcional"
            />
          </div>

          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
              <div className="col-span-5">Descrição</div>
              <div className="col-span-3">Percentual (%)</div>
              <div className="col-span-3">Prazo (dias)</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y">
              {values.installments.map((inst, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                  <Input
                    className="col-span-5"
                    value={inst.description}
                    onChange={(e) =>
                      updateInstallment(idx, { description: e.target.value })
                    }
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={inst.percentage}
                    onChange={(e) =>
                      updateInstallment(idx, {
                        percentage: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    min={0}
                    value={inst.days}
                    onChange={(e) =>
                      updateInstallment(idx, {
                        days: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => removeInstallment(idx)}
                    disabled={values.installments.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
              <Button type="button" variant="outline" size="sm" onClick={addInstallment}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar parcela
              </Button>
              <span
                className={`text-xs font-semibold ${
                  sumOk ? "text-emerald-600" : "text-destructive"
                }`}
              >
                Soma: {totalPct.toFixed(2)}%
              </span>
            </div>
          </div>

          {!sumOk && (
            <Alert variant="destructive">
              <AlertDescription>
                A soma dos percentuais deve ser 100% para salvar.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !sumOk}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
