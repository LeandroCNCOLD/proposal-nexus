import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw, PlugZap, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  nomusTestConnection,
  nomusSyncClients,
  nomusSyncProducts,
  nomusSyncPaymentTerms,
  nomusSyncSellers,
  nomusSyncRepresentatives,
  nomusSyncProposalsFull,
  nomusSyncPedidos,
  nomusSyncInvoices,
} from "@/integrations/nomus/server.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/app/configuracoes/nomus")({ component: NomusPage });

type SyncFnResult = { ok: true; count: number; skipped?: number; unmatched?: number } | { ok: false; error: string };

function NomusPage() {
  const qc = useQueryClient();
  const test = useServerFn(nomusTestConnection);
  const syncClients = useServerFn(nomusSyncClients);
  const syncProducts = useServerFn(nomusSyncProducts);
  const syncPaymentTerms = useServerFn(nomusSyncPaymentTerms);
  const syncSellers = useServerFn(nomusSyncSellers);
  const syncRepresentatives = useServerFn(nomusSyncRepresentatives);
  const syncProposalsFull = useServerFn(nomusSyncProposalsFull);
  const syncPedidos = useServerFn(nomusSyncPedidos);
  const syncInvoices = useServerFn(nomusSyncInvoices);
  const ENTITIES = [
    { key: "clientes", label: "Clientes", run: syncClients },
    { key: "produtos", label: "Produtos / Equipamentos", run: syncProducts },
    { key: "condicoes_pagamento", label: "Condições de pagamento", run: syncPaymentTerms },
    { key: "vendedores", label: "Vendedores", run: syncSellers },
    { key: "representantes", label: "Representantes", run: syncRepresentatives },
    { key: "propostas", label: "Propostas (ERP → CN COLD)", run: syncProposalsFull },
    { key: "pedidos", label: "Pedidos de venda", run: syncPedidos },
    { key: "notas_fiscais", label: "Notas Fiscais", run: syncInvoices },
  ];
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["nomus_settings"],
    queryFn: async () => (await supabase.from("nomus_settings").select("*").maybeSingle()).data,
  });

  const { data: state = [] } = useQuery({
    queryKey: ["nomus_sync_state"],
    queryFn: async () => (await supabase.from("nomus_sync_state").select("*")).data ?? [],
    refetchInterval: 3000,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["nomus_sync_log"],
    queryFn: async () =>
      (await supabase.from("nomus_sync_log").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
    refetchInterval: 5000,
  });

  const stateByEntity = Object.fromEntries((state ?? []).map((s) => [s.entity, s]));

  const updateSettings = async (patch: Partial<{ base_url: string; is_enabled: boolean; auto_push_proposals: boolean; auto_push_followups: boolean; auto_create_pedido_on_won: boolean; auto_create_local_proposal: boolean }>) => {
    if (!settings) return;
    const { error } = await supabase.from("nomus_settings").update(patch).eq("id", settings.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["nomus_settings"] });
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const res = await test({});
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste");
    } finally {
      setTesting(false);
    }
  };

  const runSync = async (key: string, label: string, fn: () => Promise<SyncFnResult>) => {
    setSyncing(key);
    try {
      const res = await fn();
      if (res.ok) {
        const extras: string[] = [];
        if (res.skipped && res.skipped > 0) extras.push(`${res.skipped} ignorado(s)`);
        if (res.unmatched && res.unmatched > 0) extras.push(`${res.unmatched} sem match local`);
        toast.success(`${label}: ${res.count} sincronizados${extras.length ? ` (${extras.join(", ")})` : ""}`);
      } else {
        toast.error(`${label}: ${res.error ?? "Falha na sincronização"}`);
      }
      qc.invalidateQueries({ queryKey: ["nomus_sync_state"] });
      qc.invalidateQueries({ queryKey: ["nomus_sync_log"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Integração Nomus"
        subtitle="Sincronize clientes, produtos, condições de pagamento e propostas com o ERP"
        actions={
          <Button onClick={onTest} disabled={testing} variant="outline">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Testar conexão
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings */}
        <section className="lg:col-span-1 space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold">Configuração</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">URL base (apenas referência)</Label>
              <Input
                placeholder="https://empresa.nomus.com.br/empresa/rest"
                defaultValue={settings?.base_url ?? ""}
                onBlur={(e) => updateSettings({ base_url: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                A URL real e a chave estão guardadas como secrets do servidor (NOMUS_BASE_URL / NOMUS_API_KEY).
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label className="text-sm">Integração ativa</Label>
              <Switch
                checked={settings?.is_enabled ?? false}
                onCheckedChange={(v) => updateSettings({ is_enabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Push automático de propostas</Label>
              <Switch
                checked={settings?.auto_push_proposals ?? true}
                onCheckedChange={(v) => updateSettings({ auto_push_proposals: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Push automático de follow-ups</Label>
              <Switch
                checked={settings?.auto_push_followups ?? true}
                onCheckedChange={(v) => updateSettings({ auto_push_followups: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Gerar Pedido ao ganhar</Label>
              <Switch
                checked={settings?.auto_create_pedido_on_won ?? true}
                onCheckedChange={(v) => updateSettings({ auto_create_pedido_on_won: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Criar proposta local automaticamente</Label>
              <Switch
                checked={settings?.auto_create_local_proposal ?? true}
                onCheckedChange={(v) => updateSettings({ auto_create_local_proposal: v })}
              />
            </div>
          </div>
        </section>

        {/* Entities */}
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold">Entidades</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENTITIES.map((ent) => {
              const st = stateByEntity[ent.key] as
                | { running?: boolean; last_synced_at?: string | null; total_synced?: number; last_error?: string | null }
                | undefined;
              const isRunning = syncing === ent.key || !!st?.running;
              const hasError = !!st?.last_error;
              return (
                <div key={ent.key} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold truncate">{ent.label}</div>
                        {isRunning ? (
                          <Badge variant="secondary" className="gap-1">
                            <Activity className="h-3 w-3 animate-pulse" /> rodando
                          </Badge>
                        ) : hasError ? (
                          <Badge variant="destructive">erro</Badge>
                        ) : st?.last_synced_at ? (
                          <Badge variant="outline" className="text-primary border-primary/40">ok</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {st?.last_synced_at
                          ? `Último sync: ${new Date(st.last_synced_at).toLocaleString("pt-BR")}`
                          : "Nunca sincronizado"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total sincronizado: <span className="font-medium text-foreground">{st?.total_synced ?? 0}</span>
                      </div>
                      {hasError && (
                        <div className="text-xs text-destructive mt-1.5 break-words" title={st?.last_error ?? undefined}>
                          {st?.last_error}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRunning}
                      onClick={() => runSync(ent.key, ent.label, () => ent.run({}) as Promise<SyncFnResult>)}
                    >
                      {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Logs */}
      <div className="mt-6 rounded-xl border bg-card shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-semibold">Últimas chamadas</h2>
          <span className="text-xs text-muted-foreground">{logs.length} registros</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>Direção</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Duração</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma chamada ainda.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{l.entity}</TableCell>
                  <TableCell className="text-xs">{l.operation}</TableCell>
                  <TableCell className="text-xs">{l.direction}</TableCell>
                  <TableCell className="text-xs">
                    {l.status === "success" ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <CheckCircle2 className="h-3 w-3" /> {l.http_status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive" title={l.error ?? undefined}>
                        <AlertCircle className="h-3 w-3" /> {l.status} {l.http_status ?? ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right">{l.duration_ms ?? "—"} ms</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
