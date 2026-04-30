import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  BookmarkPlus,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import {
  computeFinancial,
  isPercentageSumValid,
  sumPercentages,
  validateInstallments,
  type FinancialRateType,
  type InstallmentInput,
} from "@/features/payment-presets/financial-math";
import {
  useProposalFinancial,
  useSaveProposalFinancial,
} from "@/features/payment-presets/use-payment-presets";
import { saveProposalFinancial } from "@/features/payment-presets/proposal-financial.functions";
import { PaymentPresetPicker } from "@/features/payment-presets/components/PaymentPresetPicker";
import { PaymentPresetFormDialog } from "@/features/payment-presets/components/PaymentPresetFormDialog";
import { PaymentPresetManagerDialog } from "@/features/payment-presets/components/PaymentPresetManagerDialog";

interface Props {
  proposalId: string;
  currentTotalValue: number;
}

const DEFAULT_INSTALLMENTS: InstallmentInput[] = [
  { description: "Pagamento à vista", percentage: 100, days: 0 },
];

export function FinancialConditionBlock({ proposalId, currentTotalValue }: Props) {
  const { data, isLoading } = useProposalFinancial(proposalId);
  const save = useSaveProposalFinancial(proposalId);
  // bound to the typed server fn for direct call when refreshing the base
  useServerFn(saveProposalFinancial);

  const [monthlyRate, setMonthlyRate] = useState<number>(0);
  const [rateType, setRateType] = useState<FinancialRateType>("compostos");
  const [installments, setInstallments] = useState<InstallmentInput[]>(DEFAULT_INSTALLMENTS);
  const [presetId, setPresetId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  // Hidrata o estado quando os dados chegam
  useEffect(() => {
    if (!data?.proposal) return;
    const p = data.proposal;
    if (p.monthly_financial_rate_pct != null) setMonthlyRate(Number(p.monthly_financial_rate_pct));
    if (p.financial_rate_type) setRateType(p.financial_rate_type as FinancialRateType);
    if (p.financial_preset_id) setPresetId(p.financial_preset_id);

    const snap = (p.payment_condition_snapshot ?? null) as {
      installments?: InstallmentInput[];
    } | null;
    if (snap?.installments?.length) {
      setInstallments(
        snap.installments.map((i) => ({
          description: i.description,
          percentage: Number(i.percentage),
          days: Number(i.days),
        })),
      );
    }
  }, [data?.proposal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockedOriginal =
    data?.proposal?.original_proposal_amount != null
      ? Number(data.proposal.original_proposal_amount)
      : null;

  // Base de cálculo: valor original travado, ou (na primeira vez) o total atual.
  const baseAmount = lockedOriginal ?? Number(currentTotalValue || 0);

  // Detecta divergência: total_value mudou após travar o valor original
  const totalValueDiverges =
    lockedOriginal != null &&
    Math.abs(Number(currentTotalValue || 0) - lockedOriginal) > 0.009;

  const result = useMemo(
    () =>
      computeFinancial({
        originalAmount: baseAmount,
        monthlyRatePct: monthlyRate,
        type: rateType,
        installments,
      }),
    [baseAmount, monthlyRate, rateType, installments],
  );

  const sumOk = isPercentageSumValid(installments);
  const totalPct = sumPercentages(installments);

  const updateInstallment = (idx: number, patch: Partial<InstallmentInput>) => {
    setInstallments((xs) => xs.map((i, k) => (k === idx ? { ...i, ...patch } : i)));
  };
  const addInstallment = () =>
    setInstallments((xs) => [
      ...xs,
      { description: `Parcela ${xs.length + 1}`, percentage: 0, days: 30 },
    ]);
  const removeInstallment = (idx: number) =>
    setInstallments((xs) => xs.filter((_, k) => k !== idx));

  const handleSave = async (refreshOriginalAmount = false) => {
    const v = validateInstallments(installments);
    if (!v.ok) {
      toast.error(v.errors[0]);
      return;
    }
    if (monthlyRate < 0) {
      toast.error("Taxa não pode ser negativa.");
      return;
    }
    try {
      await save.mutateAsync({
        proposalId,
        monthlyRatePct: monthlyRate,
        rateType,
        installments,
        presetId: presetId ?? null,
        refreshOriginalAmount,
      });
      toast.success("Simulação financeira salva.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)] flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando condição de pagamento...
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          Taxa Financeira e Condição de Pagamento
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <ListChecks className="h-4 w-4 mr-1" /> Selecionar condição
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <BookmarkPlus className="h-4 w-4 mr-1" /> Nova condição
          </Button>
          <Button size="sm" variant="outline" onClick={() => setManagerOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> Editar condições
          </Button>
        </div>
      </div>

      {totalValueDiverges && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>O valor original da proposta mudou</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <span>
              Travado: <b>{brl(lockedOriginal!)}</b> · Atual:{" "}
              <b>{brl(Number(currentTotalValue || 0))}</b>. Deseja atualizar a base da
              taxa financeira?
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={() => handleSave(true)}
              disabled={save.isPending || !sumOk}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar base e recalcular
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Valor original da proposta</Label>
          <Input value={brl(baseAmount)} readOnly className="bg-muted/30" />
        </div>
        <div className="space-y-1.5">
          <Label>Taxa financeira mensal (%)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={monthlyRate}
            onChange={(e) => setMonthlyRate(Math.max(0, parseFloat(e.target.value) || 0))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo de cálculo</Label>
          <RadioGroup
            value={rateType}
            onValueChange={(v) => setRateType(v as FinancialRateType)}
            className="flex gap-4 pt-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="rt-comp" value="compostos" />
              <Label htmlFor="rt-comp" className="font-normal">
                Juros compostos
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="rt-simp" value="simples" />
              <Label htmlFor="rt-simp" className="font-normal">
                Juros simples
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
          <div className="col-span-4">Descrição</div>
          <div className="col-span-2">% da parcela</div>
          <div className="col-span-2">Prazo (dias)</div>
          <div className="col-span-3 text-right">Valor</div>
          <div className="col-span-1" />
        </div>
        <div className="divide-y">
          {installments.map((inst, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
              <Input
                className="col-span-4"
                value={inst.description}
                onChange={(e) => updateInstallment(idx, { description: e.target.value })}
              />
              <Input
                className="col-span-2"
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
                className="col-span-2"
                type="number"
                min={0}
                value={inst.days}
                onChange={(e) =>
                  updateInstallment(idx, { days: parseInt(e.target.value, 10) || 0 })
                }
              />
              <div className="col-span-3 text-right font-mono tabular-nums text-sm">
                {brl(result.installments[idx]?.value ?? 0)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => removeInstallment(idx)}
                disabled={installments.length <= 1}
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
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            A soma dos percentuais deve ser exatamente 100% para salvar.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Prazo médio (PMR)" value={`${result.averageTermDays.toFixed(1)} d`} />
        <Metric label="Fator aplicado" value={`${result.factorPct.toFixed(4)} %`} />
        <Metric label="Valor da taxa" value={brl(result.additionalCost)} />
        <Metric label="Valor final com taxa" value={brl(result.finalAmount)} highlight />
        <Metric label="Diferença %" value={`${result.diffPct.toFixed(2)} %`} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Total das parcelas: <b className="text-foreground">{brl(result.totalInstallments)}</b></span>
        {presetId && <Badge variant="secondary">Origem: preset</Badge>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Button onClick={() => handleSave(false)} disabled={!sumOk || save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar simulação"}
        </Button>
      </div>

      {(data?.history?.length ?? 0) > 0 && (
        <div className="border-t pt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Histórico recente
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data!.history.map((h) => (
              <div key={h.id} className="text-xs flex flex-wrap gap-x-4 text-muted-foreground">
                <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                <span>
                  Taxa: {brl(Number(h.previous_financial_additional_cost ?? 0))} →{" "}
                  <b className="text-foreground">{brl(Number(h.new_financial_additional_cost ?? 0))}</b>
                </span>
                <span>
                  Final: {brl(Number(h.previous_final_amount ?? 0))} →{" "}
                  <b className="text-foreground">{brl(Number(h.new_final_amount ?? 0))}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diálogos */}
      <PaymentPresetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(p) => {
          setPresetId(p.id);
          setInstallments(p.installments);
          toast.success(`Preset "${p.name}" aplicado à proposta.`);
        }}
      />
      <PaymentPresetFormDialog
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
      />
      <PaymentPresetManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        highlight ? "bg-primary/5 border-primary/30" : "bg-muted/20"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
