import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Clock, Activity, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/app/configuracoes/nomus/status")({ component: StatusPage });

const ENTITY_LABELS: Record<string, string> = {
  clientes: "Clientes",
  produtos: "Produtos / Equipamentos",
  condicoes_pagamento: "Condições de pagamento",
  vendedores: "Vendedores",
  representantes: "Representantes",
  propostas: "Propostas",
  pedidos: "Pedidos de venda",
  notas_fiscais: "Notas Fiscais",
  tabelas_preco: "Tabelas de Preço",
};

const ENTITY_KEYS = Object.keys(ENTITY_LABELS);

type SyncLog = {
  id: string;
  entity: string | null;
  operation: string | null;
  status: string | null;
  http_status: number | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
};

type SyncState = {
  entity: string;
  last_synced_at: string | null;
  running: boolean | null;
  last_error: string | null;
  total_synced: number | null;
  updated_at: string | null;
};

function formatDateTime(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

function formatRelative(s: string | null | undefined) {
  if (!s) return "nunca";
  const diff = Date.now() - new Date(s).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function formatDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function StatusPage() {
  const { data: state = [] } = useQuery({
    queryKey: ["nomus_sync_state_status"],
    queryFn: async () =>
      ((await supabase.from("nomus_sync_state").select("*")).data ?? []) as SyncState[],
    refetchInterval: 5000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["nomus_sync_log_status"],
    queryFn: async () =>
      ((await supabase
        .from("nomus_sync_log")
        .select("id, entity, operation, status, http_status, duration_ms, error, created_at")
        .order("created_at", { ascending: false })
        .limit(500)).data ?? []) as SyncLog[],
    refetchInterval: 5000,
  });

  const stateByEntity = useMemo(
    () => Object.fromEntries(state.map((s) => [s.entity, s])),
    [state]
  );

  const perEntity = useMemo(() => {
    const since24h = Date.now() - 24 * 60 * 60 * 1000;
    return ENTITY_KEYS.map((key) => {
      const entLogs = logs.filter((l) => l.entity === key);
      const lastLog = entLogs[0];
      const recent = entLogs.filter((l) => new Date(l.created_at).getTime() >= since24h);
      const successCount = recent.filter((l) => l.status === "success").length;
      const errorCount = recent.filter((l) => l.status === "error").length;
      const lastError = entLogs.find((l) => l.status === "error");
      const st = stateByEntity[key];

      let level: "ok" | "warn" | "error" | "idle" = "idle";
      if (lastLog) {
        if (lastLog.status === "error") level = "error";
        else if (errorCount > 0) level = "warn";
        else level = "ok";
      }

      return {
        key,
        label: ENTITY_LABELS[key],
        state: st,
        lastLog,
        lastError,
        successCount,
        errorCount,
        avgDuration:
          recent.length > 0
            ? Math.round(
                recent.reduce((acc, l) => acc + (l.duration_ms ?? 0), 0) / recent.length
              )
            : null,
        totalRecent: recent.length,
        level,
      };
    });
  }, [logs, stateByEntity]);

  const totals = useMemo(() => {
    const since24h = Date.now() - 24 * 60 * 60 * 1000;
    const recent = logs.filter((l) => new Date(l.created_at).getTime() >= since24h);
    return {
      ok: perEntity.filter((e) => e.level === "ok").length,
      warn: perEntity.filter((e) => e.level === "warn").length,
      error: perEntity.filter((e) => e.level === "error").length,
      idle: perEntity.filter((e) => e.level === "idle").length,
      lastSync: logs[0]?.created_at ?? null,
      successes24h: recent.filter((l) => l.status === "success").length,
      errors24h: recent.filter((l) => l.status === "error").length,
    };
  }, [logs, perEntity]);

  const recentErrors = logs.filter((l) => l.status === "error").slice(0, 15);

  return (
    <>
      <PageHeader
        title="Status da Integração Nomus"
        subtitle="Visão por módulo: última execução, duração, registros e erros"
        actions={
          <Link to="/app/configuracoes/nomus">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para configuração
            </Button>
          </Link>
        }
      />

      <div className="space-y-6">
        {/* Cards de visão geral */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <OverviewCard
            label="Módulos OK"
            value={totals.ok}
            icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          />
          <OverviewCard
            label="Com aviso / erro"
            value={totals.warn + totals.error}
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            sub={`${totals.error} com erro · ${totals.warn} com aviso · ${totals.idle} sem execução`}
          />
          <OverviewCard
            label="Última sincronização"
            value={formatRelative(totals.lastSync)}
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            sub={formatDateTime(totals.lastSync)}
          />
          <OverviewCard
            label="Últimas 24h"
            value={`${totals.successes24h} OK`}
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
            sub={`${totals.errors24h} erro(s)`}
          />
        </div>

        {/* Grid por módulo */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {perEntity.map((m) => (
            <ModuleCard key={m.key} module={m} />
          ))}
        </div>

        {/* Erros recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Erros recentes (todos os módulos)</CardTitle>
          </CardHeader>
          <CardContent>
            {recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum erro registrado nos logs recentes.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentErrors.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDateTime(l.created_at)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ENTITY_LABELS[l.entity ?? ""] ?? l.entity ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">{l.operation ?? "—"}</TableCell>
                      <TableCell className="text-xs">{l.http_status ?? "—"}</TableCell>
                      <TableCell className="text-xs">{formatDuration(l.duration_ms)}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-md truncate">
                        {l.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OverviewCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function ModuleCard({
  module: m,
}: {
  module: ReturnType<typeof useModulesType>[number];
}) {
  const dotClass =
    m.level === "ok"
      ? "bg-green-500"
      : m.level === "warn"
      ? "bg-amber-500"
      : m.level === "error"
      ? "bg-red-500"
      : "bg-muted-foreground/40";

  const StatusIcon =
    m.level === "ok"
      ? CheckCircle2
      : m.level === "warn"
      ? AlertTriangle
      : m.level === "error"
      ? XCircle
      : Clock;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden />
            {m.label}
          </span>
          {m.state?.running ? (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Rodando
            </Badge>
          ) : (
            <StatusIcon
              className={`h-4 w-4 ${
                m.level === "ok"
                  ? "text-green-600"
                  : m.level === "warn"
                  ? "text-amber-600"
                  : m.level === "error"
                  ? "text-red-600"
                  : "text-muted-foreground"
              }`}
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Última execução" value={formatRelative(m.lastLog?.created_at ?? m.state?.last_synced_at)} />
        <Row label="Quando" value={formatDateTime(m.lastLog?.created_at ?? m.state?.last_synced_at ?? null)} muted />
        <Row label="Duração (última)" value={formatDuration(m.lastLog?.duration_ms ?? null)} />
        <Row label="Duração média (24h)" value={formatDuration(m.avgDuration)} />
        <Row label="Execuções (24h)" value={`${m.totalRecent} (${m.successCount} OK / ${m.errorCount} erro)`} />
        <Row label="Total sincronizado" value={String(m.state?.total_synced ?? 0)} />
        {m.lastError ? (
          <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <div className="font-medium">Último erro ({formatRelative(m.lastError.created_at)})</div>
            <div className="mt-1 break-words">{m.lastError.error ?? "Sem mensagem"}</div>
          </div>
        ) : null}
        <div className="pt-2">
          <Link to="/app/configuracoes/nomus">
            <Button size="sm" variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-3 w-3" />
              Ir para sincronização
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs ${muted ? "text-muted-foreground" : "font-medium"}`}>{value}</span>
    </div>
  );
}

// Type helper so ModuleCard pode tipar corretamente sem expor o map.
function useModulesType() {
  return [] as Array<{
    key: string;
    label: string;
    state: SyncState | undefined;
    lastLog: SyncLog | undefined;
    lastError: SyncLog | undefined;
    successCount: number;
    errorCount: number;
    avgDuration: number | null;
    totalRecent: number;
    level: "ok" | "warn" | "error" | "idle";
  }>;
}
