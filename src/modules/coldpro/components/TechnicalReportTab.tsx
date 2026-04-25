import type { ColdProResult, ColdProState } from "../types/coldPro.types";
import { Section } from "./formBits";

export function TechnicalReportTab({ state, result }: { state: ColdProState; result: ColdProResult }) {
  return <Section title="Relatório Técnico"><div className="prose prose-sm max-w-none dark:prose-invert"><h3>{state.project.name}</h3><p>Aplicação: {state.project.applicationMode}. Temperaturas de projeto: interna {state.project.internalTempC}°C e externa {state.project.externalTempC}°C.</p><p>Carga térmica base: {result.baseTotalKw.toFixed(2)} kW. Carga corrigida: {result.correctedTotalKw.toFixed(2)} kW, equivalente a {result.totalKcalH.toFixed(0)} kcal/h e {result.totalTr.toFixed(2)} TR.</p><h4>Memória de cálculo</h4><pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(result.calculationMemory, null, 2)}</pre></div></Section>;
}
