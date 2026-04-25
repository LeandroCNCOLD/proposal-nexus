import { BarChart3, Calculator, Gauge, Snowflake } from "lucide-react";
import { fmtColdPro } from "./ColdProFormPrimitives";

function n(value: unknown) {
  return Number(value ?? 0);
}

function LoadBar({ label, value, total }: { label: string; value: unknown; total: number }) {
  const amount = n(value);
  const pct = total > 0 ? Math.max(0, Math.min(100, (amount / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <b className="tabular-nums text-foreground">{fmtColdPro(amount)} kcal/h</b>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, icon }: { label: string; value: unknown; unit: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-foreground">{fmtColdPro(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: { label: string; value: unknown }[] }) {
  const subtotal = rows.reduce((sum, row) => sum + n(row.value), 0);
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{fmtColdPro(subtotal)} kcal/h</span>
      </div>
      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{row.label}</span>
            <b className="tabular-nums">{fmtColdPro(row.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColdProResultCard({ result }: { result: any }) {
  if (!result) return <div className="rounded-xl border border-dashed bg-background p-6 text-sm text-muted-foreground">Nenhum cálculo realizado. Preencha as etapas anteriores e clique em calcular carga térmica.</div>;

  const subtotal = n(result.subtotal_kcal_h);
  const productTotal = n(result.product_kcal_h) + n(result.packaging_kcal_h) + n(result.calculation_breakdown?.respiration_kcal_h) + n(result.tunnel_internal_load_kcal_h);
  const extraTotal = n(result.infiltration_kcal_h) + n(result.people_kcal_h) + n(result.lighting_kcal_h) + n(result.motors_kcal_h) + n(result.fans_kcal_h) + n(result.defrost_kcal_h) + n(result.other_kcal_h);
  const bars = [
    { label: "Ambiente", value: result.transmission_kcal_h },
    { label: "Produtos", value: productTotal },
    { label: "Cargas extras", value: extraTotal },
    { label: "Segurança", value: result.safety_kcal_h },
  ];

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resultado do cálculo</h3>
          <p className="mt-1 text-sm text-muted-foreground">Resumo técnico da carga térmica e distribuição por origem.</p>
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">Fator segurança: {fmtColdPro(result.safety_factor_percent)}%</div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Carga requerida" value={result.total_required_kcal_h} unit="kcal/h" icon={<Calculator className="h-4 w-4" />} />
        <Kpi label="Potência" value={result.total_required_kw} unit="kW" icon={<Gauge className="h-4 w-4" />} />
        <Kpi label="Capacidade" value={result.total_required_tr} unit="TR" icon={<Snowflake className="h-4 w-4" />} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border p-4">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Distribuição de cargas</h4>
          </div>
          <div className="space-y-4">
            {bars.map((bar) => <LoadBar key={bar.label} label={bar.label} value={bar.value} total={n(result.total_required_kcal_h)} />)}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Group title="Ambiente" rows={[{ label: "Transmissão", value: result.transmission_kcal_h }]} />
          <Group title="Produtos" rows={[{ label: "Produto", value: result.product_kcal_h }, { label: "Embalagem", value: result.packaging_kcal_h }, { label: "Respiração", value: result.calculation_breakdown?.respiration_kcal_h }, { label: "Túnel/processo", value: result.tunnel_internal_load_kcal_h }]} />
          <Group title="Cargas extras" rows={[{ label: "Infiltração", value: result.infiltration_kcal_h }, { label: "Pessoas", value: result.people_kcal_h }, { label: "Iluminação", value: result.lighting_kcal_h }, { label: "Motores", value: result.motors_kcal_h }, { label: "Ventiladores", value: result.fans_kcal_h }, { label: "Degelo", value: result.defrost_kcal_h }, { label: "Outras", value: result.other_kcal_h }]} />
          <Group title="Fechamento" rows={[{ label: "Subtotal", value: subtotal }, { label: "Segurança", value: result.safety_kcal_h }, { label: "Total requerido", value: result.total_required_kcal_h }]} />
        </div>
      </div>
    </div>
  );
}
