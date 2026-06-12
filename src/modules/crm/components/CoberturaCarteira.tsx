import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Snowflake,
  UserX,
  AlertTriangle,
  Flame,
  TrendingUp,
  Save,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useIsManager } from "@/hooks/use-profile";
import {
  useCoberturaGeral,
  useCoberturaPorSdr,
  useCoberturaHistorico,
  useLeadsDescobertos,
  useSalvarSnapshot,
  corCobertura,
} from "../hooks/use-cobertura";

function bigColor(pct: number) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

function priorityBadge(p: string | null) {
  if (p === "Alta") return "bg-red-100 text-red-700";
  if (p === "Baixa") return "bg-green-100 text-green-700";
  return "bg-yellow-100 text-yellow-700";
}

function diasSemContato(last: string | null): number | null {
  if (!last) return null;
  const d = new Date(last);
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function ResumoTab() {
  const { data, isLoading } = useCoberturaGeral();
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const pct = Number(data.pct_ativa ?? 0);
  const segPct = {
    ativa: Number(data.pct_ativa ?? 0),
    fria: Number(data.pct_fria ?? 0),
    sem: Number(data.pct_sem_cobertura ?? 0),
    nunca: Number(data.pct_nunca_contatada ?? 0),
  };

  const alertas: { tone: string; text: string }[] = [];
  if (segPct.ativa < 50)
    alertas.push({
      tone: "bg-red-50 border-red-200 text-red-800",
      text: `Cobertura crítica: apenas ${segPct.ativa.toFixed(1)}% da carteira está ativa.`,
    });
  if (data.sem_cobertura > 30)
    alertas.push({
      tone: "bg-orange-50 border-orange-200 text-orange-800",
      text: `${data.sem_cobertura} leads sem SDR responsável.`,
    });
  if (data.nunca_contatadas > 20)
    alertas.push({
      tone: "bg-yellow-50 border-yellow-200 text-yellow-800",
      text: `${data.nunca_contatadas} leads nunca foram contatados.`,
    });
  if (data.alta_prioridade_descoberta > 5)
    alertas.push({
      tone: "bg-red-50 border-red-200 text-red-800",
      text: `${data.alta_prioridade_descoberta} leads de alta prioridade sem cobertura ativa.`,
    });
  if (data.quentes_descobertos > 0)
    alertas.push({
      tone: "bg-orange-50 border-orange-200 text-orange-800",
      text: `${data.quentes_descobertos} leads quentes/muito quentes sem cobertura ativa.`,
    });
  if (segPct.ativa >= 80)
    alertas.push({
      tone: "bg-green-50 border-green-200 text-green-800",
      text: `Meta atingida: ${segPct.ativa.toFixed(1)}% da carteira ativa.`,
    });

  return (
    <div className="space-y-6">
      {/* Big number */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-wide">
              Cobertura ativa da carteira
            </div>
            <div className={`text-7xl font-bold ${bigColor(pct)} my-2`}>
              {pct.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              {data.ativas} de {data.total} leads com contato nos últimos 10 dias
            </div>
          </div>

          {/* Segmented bar */}
          <div className="mt-6 flex h-4 w-full overflow-hidden rounded-full bg-muted">
            <div style={{ width: `${segPct.ativa}%` }} className="bg-green-500" />
            <div style={{ width: `${segPct.fria}%` }} className="bg-yellow-500" />
            <div style={{ width: `${segPct.sem}%` }} className="bg-orange-500" />
            <div style={{ width: `${segPct.nunca}%` }} className="bg-red-500" />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              Ativa {segPct.ativa.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
              Fria {segPct.fria.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              Sem SDR {segPct.sem.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Nunca contatada {segPct.nunca.toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grid cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Snowflake className="h-5 w-5 text-yellow-600" />}
          label="Cobertura fria"
          n={data.frias}
          v={Number(data.valor_frio)}
        />
        <KpiCard
          icon={<UserX className="h-5 w-5 text-orange-600" />}
          label="Sem SDR"
          n={data.sem_cobertura}
          v={Number(data.valor_sem_cobertura)}
        />
        <KpiCard
          icon={<Users className="h-5 w-5 text-red-600" />}
          label="Nunca contatadas"
          n={data.nunca_contatadas}
          v={Number(data.valor_nunca_contatado)}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Alta prior. descoberta"
          n={data.alta_prioridade_descoberta}
          v={Number(data.valor_alta_prioridade_descoberta)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valor em risco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Valor total da carteira" value={formatCurrency(Number(data.valor_total))} bold />
            <Row label="Em cobertura ativa" value={formatCurrency(Number(data.valor_ativo))} color="text-green-700" />
            <Row label="Em cobertura fria" value={formatCurrency(Number(data.valor_frio))} color="text-yellow-700" />
            <Row label="Sem SDR" value={formatCurrency(Number(data.valor_sem_cobertura))} color="text-orange-700" />
            <Row label="Nunca contatadas" value={formatCurrency(Number(data.valor_nunca_contatado))} color="text-red-700" />
            <div className="border-t pt-2 mt-2 flex justify-between">
              <span className="font-semibold">Valor descoberto total</span>
              <span className="font-bold text-red-700">
                {formatCurrency(
                  Number(data.valor_frio) + Number(data.valor_sem_cobertura) + Number(data.valor_nunca_contatado)
                )}
              </span>
            </div>
            {data.media_dias_sem_contato != null && (
              <div className="text-xs text-muted-foreground pt-2">
                Média {data.media_dias_sem_contato}d sem contato · Máx {data.max_dias_sem_contato}d
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Alertas automáticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum alerta no momento.</div>
            ) : (
              alertas.map((a, i) => (
                <div key={i} className={`rounded border px-3 py-2 text-sm ${a.tone}`}>
                  {a.text}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, n, v }: { icon: React.ReactNode; label: string; n: number; v: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          {icon}
        </div>
        <div className="text-3xl font-bold mt-1">{n}</div>
        <div className="text-xs text-muted-foreground">{formatCurrency(v)}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${color ?? ""} ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function PorSdrTab() {
  const { data, isLoading } = useCoberturaPorSdr();
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data || data.length === 0)
    return <div className="text-sm text-muted-foreground">Nenhum SDR com leads na carteira.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {data.map((sdr, i) => {
        const pct = Number(sdr.pct_cobertura ?? 0);
        const cor = corCobertura(pct);
        return (
          <Card key={`${sdr.locked_by_sdr_id ?? "nosdr"}-${i}`}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-[#0F2D5E] text-white flex items-center justify-center font-bold">
                  {(sdr.sdr_nome || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{sdr.sdr_nome}</div>
                    <div className={`text-2xl font-bold ${cor.text}`}>{pct.toFixed(1)}%</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sdr.total_leads} leads · {formatCurrency(Number(sdr.valor_carteira))}
                  </div>
                  <Badge className={`${cor.badge} mt-1 border-0`}>{sdr.status_meta}</Badge>
                </div>
              </div>

              <div className="mt-3 h-2 w-full rounded bg-muted overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, pct)}%`, backgroundColor: cor.bar }}
                  className="h-full"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Ativos: <b className="text-green-700">{sdr.ativos}</b></span>
                <span>Frios: <b className="text-yellow-700">{sdr.frios}</b></span>
                <span>Alta prior. desc.: <b className="text-red-700">{sdr.alta_prioridade_descoberta}</b></span>
                <span>Quentes desc.: <b className="text-orange-700">{sdr.quentes_descobertos}</b></span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DescobertosTab() {
  const { data, isLoading } = useLeadsDescobertos();
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data || data.length === 0)
    return <div className="text-sm text-muted-foreground">Nenhum lead descoberto. 🎉</div>;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="divide-y">
          {data.map((l) => {
            const dias = diasSemContato(l.last_contact_at);
            return (
              <div key={l.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {l.client_name}{" "}
                    <span className="text-xs text-muted-foreground">
                      #{l.proposal_number}
                      {l.state ? ` · ${l.state}` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                    {l.last_contact_at == null ? (
                      <span className="text-red-600 font-semibold">Nunca contatado</span>
                    ) : (
                      <span className={dias != null && dias > 30 ? "text-red-600 font-semibold" : ""}>
                        {dias}d sem contato
                      </span>
                    )}
                    {l.locked_by_sdr_name && <span>SDR: {l.locked_by_sdr_name}</span>}
                    <Badge className={`${priorityBadge(l.priority)} border-0`}>{l.priority ?? "—"}</Badge>
                    {l.temperature && (
                      <span className="text-muted-foreground">{l.temperature}</span>
                    )}
                  </div>
                </div>
                <div className="text-[#0F2D5E] font-bold whitespace-nowrap">
                  {formatCurrency(Number(l.value))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoricoTab() {
  const { data, isLoading } = useCoberturaHistorico(14);
  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!data || data.length === 0)
    return (
      <div className="text-sm text-muted-foreground">
        Nenhum histórico ainda. O snapshot é salvo uma vez por dia.
      </div>
    );

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        {data.map((d) => {
          const pct = Number(d.pct_ativa ?? 0);
          const cor = corCobertura(pct);
          return (
            <div key={d.data} className="flex items-center gap-3">
              <div className="w-20 text-xs text-muted-foreground tabular-nums">
                {new Date(d.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </div>
              <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, pct)}%`, backgroundColor: cor.bar }}
                  className="h-full"
                />
              </div>
              <div className={`w-16 text-right text-sm font-bold ${cor.text}`}>{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function CoberturaCarteira() {
  const isManager = useIsManager();
  const { data: geral } = useCoberturaGeral();
  const snap = useSalvarSnapshot();

  // Auto-save snapshot on first manager visit of the day
  useEffect(() => {
    if (!isManager) return;
    const today = new Date().toISOString().slice(0, 10);
    const k = `cobertura_snapshot_${today}`;
    if (typeof window === "undefined" || window.localStorage.getItem(k)) return;
    snap.mutate(undefined, {
      onSuccess: () => window.localStorage.setItem(k, "1"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[#0F2D5E]" /> Cobertura de Carteira
          </h1>
          <p className="text-sm text-muted-foreground">
            Mede % de leads com contato recente (≤10 dias). Atualiza a cada minuto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {geral?.calculado_em && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(geral.calculado_em).toLocaleTimeString("pt-BR")}
            </span>
          )}
          {isManager && (
            <Button size="sm" onClick={() => snap.mutate()} disabled={snap.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {snap.isPending ? "Salvando..." : "Salvar snapshot de hoje"}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="sdr">Por SDR</TabsTrigger>
          <TabsTrigger value="descobertos">
            Leads descobertos
            {geral && (
              <Badge variant="secondary" className="ml-2">
                {Number(geral.frias) + Number(geral.sem_cobertura) + Number(geral.nunca_contatadas)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo" className="mt-4">
          <ResumoTab />
        </TabsContent>
        <TabsContent value="sdr" className="mt-4">
          <PorSdrTab />
        </TabsContent>
        <TabsContent value="descobertos" className="mt-4">
          <DescobertosTab />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <HistoricoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CoberturaCarteira;
