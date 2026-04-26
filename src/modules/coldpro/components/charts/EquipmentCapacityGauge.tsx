import { fmtChart, surplusStatus } from "./chartData";

type Props = { title: string; requiredKcalH: number; selectedCapacityKcalH: number; surplusPercent: number };

export function EquipmentCapacityGauge({ title, requiredKcalH, selectedCapacityKcalH, surplusPercent }: Props) {
  const status = surplusStatus(surplusPercent);
  const clamped = Math.max(0, Math.min(100, ((surplusPercent + 10) / 50) * 100));
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3"><h4 className="text-sm font-semibold">{title}</h4><p className="text-xs text-muted-foreground">Sobra técnica validada contra a capacidade selecionada.</p></div>
      {requiredKcalH > 0 && selectedCapacityKcalH > 0 ? (
        <div>
          <div className="relative mx-auto h-36 max-w-xs overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-32 rounded-t-full bg-muted" />
            <div className="absolute inset-x-4 bottom-0 h-28 rounded-t-full bg-background" />
            <div className="absolute bottom-0 left-1/2 h-1 w-[45%] origin-left rounded-full bg-primary" style={{ transform: `rotate(${180 + clamped * 1.8}deg)` }} />
            <div className="absolute inset-x-0 bottom-4 text-center"><div className="text-3xl font-bold tabular-nums">{fmtChart(surplusPercent, 1)}%</div><div className="text-xs text-muted-foreground">{status.label}</div></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-muted/30 p-2">Requerida<br /><b>{fmtChart(requiredKcalH, 0)} kcal/h</b></div>
            <div className="rounded-md bg-muted/30 p-2">Selecionada<br /><b>{fmtChart(selectedCapacityKcalH, 0)} kcal/h</b></div>
          </div>
        </div>
      ) : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Selecione um equipamento para avaliar a sobra técnica.</div>}
    </section>
  );
}
