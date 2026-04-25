import type { ColdProResult } from "../types/coldPro.types";
import { Section } from "./formBits";

function fmt(v: number, d = 2) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v); }
function Kpi({ label, value, unit }: { label: string; value: number; unit: string }) { return <div className="rounded-md border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{fmt(value)}</div><div className="text-xs text-muted-foreground">{unit}</div></div>; }

export function ResultTab({ result }: { result: ColdProResult }) {
  const rows = [
    ["Transmissão", result.transmissionKw], ["Infiltração", result.infiltrationKw], ["Produto", result.productKw], ["Embalagem", result.packagingKw], ["Respiração", result.respirationKw], ["Pessoas", result.peopleKw], ["Iluminação", result.lightingKw], ["Motores", result.motorsKw], ["Pull-down", result.pullDownKw],
  ];
  return <Section title="Resultado"><div className="grid gap-3 md:grid-cols-4"><Kpi label="Carga base" value={result.baseTotalKw} unit="kW" /><Kpi label="Carga corrigida" value={result.correctedTotalKw} unit="kW" /><Kpi label="Total" value={result.totalKcalH} unit="kcal/h" /><Kpi label="Total" value={result.totalTr} unit="TR" /></div>
    <div className="mt-4 overflow-x-auto rounded-md border"><table className="w-full min-w-[640px] text-sm"><tbody>{rows.map(([label, value]) => <tr key={label as string} className="border-b last:border-0"><td className="p-2 text-muted-foreground">{label}</td><td className="p-2 text-right font-medium tabular-nums">{fmt(value as number, 3)} kW</td></tr>)}</tbody></table></div>
    {result.warnings.length ? <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><b>Alertas técnicos</b><ul className="mt-2 list-disc pl-5 text-muted-foreground">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div> : null}
  </Section>;
}
