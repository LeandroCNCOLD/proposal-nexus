import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatCurrency } from "@/lib/utils";
import { useCoberturaGeral } from "../hooks/use-cobertura";

export function CoberturaCarteiraMini() {
  const { data } = useCoberturaGeral();
  if (!data) return null;

  const pct = Number(data.pct_ativa ?? 0);
  const segPct = {
    ativa: Number(data.pct_ativa ?? 0),
    fria: Number(data.pct_fria ?? 0),
    sem: Number(data.pct_sem_cobertura ?? 0),
    nunca: Number(data.pct_nunca_contatada ?? 0),
  };
  const pctColor = pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";
  const valorDescoberto =
    Number(data.valor_frio) + Number(data.valor_sem_cobertura) + Number(data.valor_nunca_contatado);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <Link to="/app/cobertura" className="font-semibold text-sm hover:underline">
            Cobertura de Carteira
          </Link>
          <div className={`text-3xl font-bold ${pctColor}`}>{pct.toFixed(1)}%</div>
        </div>

        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
          <div style={{ width: `${segPct.ativa}%` }} className="bg-green-500" />
          <div style={{ width: `${segPct.fria}%` }} className="bg-yellow-500" />
          <div style={{ width: `${segPct.sem}%` }} className="bg-orange-500" />
          <div style={{ width: `${segPct.nunca}%` }} className="bg-red-500" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Sem SDR</div>
            <div className="font-semibold">{data.sem_cobertura}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Nunca contatados</div>
            <div className="font-semibold">{data.nunca_contatadas}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Valor descoberto</div>
            <div className="font-semibold">{formatCurrency(valorDescoberto)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Alta prior. desc.</div>
            <div className="font-semibold">{data.alta_prioridade_descoberta}</div>
          </div>
        </div>

        {pct < 50 && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Cobertura crítica abaixo de 50%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CoberturaCarteiraMini;
