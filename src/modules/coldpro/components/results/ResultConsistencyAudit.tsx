import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { fmtColdProChart } from "./chartUtils";

export function ResultConsistencyAudit({ normalized }: { normalized: ColdProNormalizedResult }) {
  const audit = normalized.consistencyAudit;
  const ok = !audit.hasCriticalDivergence && audit.warnings.length === 0;
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className={ok ? "text-primary" : "text-destructive"}>{ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</div>
        <div>
          <h4 className="text-sm font-semibold">Auditoria de consistência</h4>
          <p className="text-xs text-muted-foreground">Fechamento matemático e classificação técnica das cargas.</p>
        </div>
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-3">
        <span>Soma componentes: <b>{fmtColdProChart(audit.componentSumKcalH, 0)} kcal/h</b></span>
        <span>Subtotal validado: <b>{fmtColdProChart(audit.subtotalKcalH, 0)} kcal/h</b></span>
        <span>Total requerido: <b>{fmtColdProChart(audit.requiredKcalH, 0)} kcal/h</b></span>
        <span>Diferença: <b>{fmtColdProChart(audit.deltaComponentVsSubtotalKcalH, 2)} kcal/h</b></span>
        <span>Diferença: <b>{fmtColdProChart(audit.deltaComponentVsSubtotalPercent, 2)}%</b></span>
        <span>Status: <b>{audit.hasCriticalDivergence ? "Divergência crítica" : "Auditável"}</b></span>
      </div>
      {audit.warnings.length ? (
        <div className="mt-3 space-y-2">
          {audit.warnings.map((warning) => <div key={warning} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">{warning}</div>)}
        </div>
      ) : <div className="mt-3 rounded-md bg-primary/5 p-2 text-sm text-primary">Nenhuma divergência crítica encontrada.</div>}
    </div>
  );
}
