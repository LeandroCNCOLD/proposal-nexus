import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getScoreWeights, updateScoreWeights, type ScoreWeights } from "@/lib/marketing-leads.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/app/marketing/config")({
  component: ConfigScorePage,
});

function ConfigScorePage() {
  const { roles } = useAuth();
  const isManager = roles.some((r) => ["admin", "diretoria", "gerente_comercial"].includes(r));
  const get = useServerFn(getScoreWeights);
  const upd = useServerFn(updateScoreWeights);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["score-weights"], queryFn: () => get({ data: undefined as never }) });
  const [w, setW] = useState<ScoreWeights | null>(null);
  useEffect(() => { if (data) setW(data); }, [data]);

  if (!isManager) return <div className="p-6 text-muted-foreground">Apenas gestores.</div>;
  if (!w) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  async function save() {
    try {
      await upd({ data: w! });
      toast.success("Pesos atualizados");
      qc.invalidateQueries({ queryKey: ["score-weights"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const num = (k: keyof ScoreWeights, label: string, hint?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.5" value={String(w![k])}
        onChange={(e) => setW({ ...w!, [k]: Number(e.target.value) } as ScoreWeights)} />
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F2D5E]">Pesos de pontuação dos SDRs</h1>
        <p className="text-sm text-muted-foreground">Configurável só por gestores. Define como cada ação vira pontos no painel diário.</p>
      </div>

      <section className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Trilha de Marketing (qualificação)</h2>
        <div className="grid grid-cols-2 gap-4">
          {num("mkt_triado", "Lead triado", "Conta apenas se houver decisão registrada.")}
          {num("mkt_qualificado", "Qualificado", "Só pontua se não reverter em 48h.")}
          {num("mkt_sla_bonus", "Bônus 1ª resposta dentro do SLA")}
          {num("mkt_descarte_sem_motivo", "Descarte sem motivo (penalidade)")}
          <div className="space-y-1">
            <Label className="text-xs">SLA de marketing (minutos)</Label>
            <Input type="number" min={1} max={1440} value={String(w.sla_mkt_minutos)}
              onChange={(e) => setW({ ...w, sla_mkt_minutos: Number(e.target.value) })} />
          </div>
        </div>
      </section>

      <section className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Trilha de Carteira SDR (conversão)</h2>
        <div className="grid grid-cols-2 gap-4">
          {num("sdr_tratativa", "Tratativa registrada")}
          {num("sdr_reuniao_agendada", "Reunião agendada")}
          {num("sdr_handoff_aceito", "Handoff aceito por vendedor")}
        </div>
      </section>

      <section className="bg-card border rounded-lg p-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Ranking visível para o SDR</div>
          <div className="text-xs text-muted-foreground">Mostra a posição no ranking do dia para gamificação.</div>
        </div>
        <Switch checked={w.ranking_visivel_sdr} onCheckedChange={(v) => setW({ ...w, ranking_visivel_sdr: v })} />
      </section>

      <div className="flex justify-end">
        <Button onClick={save}>Salvar pesos</Button>
      </div>
    </div>
  );
}
