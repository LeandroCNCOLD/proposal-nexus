import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings2, Search, AlertTriangle, Calendar, User, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  pullNomusProcesses,
  listAvailableProcessTypes,
  getUserFunnels,
  setUserFunnels,
} from "@/integrations/nomus/process-sync.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/app/crm")({ component: CrmPage });

const DEFAULT_FUNNEL = "Funil de Vendas";

type ProcessRow = {
  id: string;
  nomus_id: string;
  nome: string | null;
  pessoa: string | null;
  tipo: string | null;
  etapa: string | null;
  prioridade: string | null;
  responsavel: string | null;
  proximo_contato: string | null;
  data_criacao: string | null;
  cliente_id: string | null;
};

type FunnelStage = {
  tipo: string;
  etapa: string;
  display_order: number;
  is_won: boolean;
  is_lost: boolean;
  is_hidden: boolean;
};

function priorityVariant(p: string | null): "default" | "destructive" | "secondary" | "outline" {
  const v = (p ?? "").toLowerCase();
  if (v.includes("alta")) return "destructive";
  if (v.includes("média") || v.includes("media")) return "default";
  if (v.includes("baixa")) return "secondary";
  return "outline";
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

function CrmPage() {
  const queryClient = useQueryClient();
  const pull = useServerFn(pullNomusProcesses);
  const listTypes = useServerFn(listAvailableProcessTypes);
  const getFunnels = useServerFn(getUserFunnels);
  const saveFunnels = useServerFn(setUserFunnels);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_FUNNEL);
  const [funnelDrawerOpen, setFunnelDrawerOpen] = useState(false);

  // Tipos disponíveis (descobertos a partir dos processos sincronizados)
  const { data: typesData } = useQuery({
    queryKey: ["crm", "available-types"],
    queryFn: async () => {
      const r = await listTypes();
      if (!r.ok) throw new Error(r.error);
      return r.tipos;
    },
  });

  // Preferências do usuário
  const { data: userFunnelsData } = useQuery({
    queryKey: ["crm", "user-funnels"],
    queryFn: async () => {
      const r = await getFunnels();
      if (!r.ok) throw new Error(r.error);
      return r.funnels;
    },
  });

  // Lista efetiva de funis para mostrar como abas
  const activeFunnels = useMemo(() => {
    if (userFunnelsData && userFunnelsData.length > 0) {
      return userFunnelsData.map((f) => f.tipo);
    }
    // Fallback: se nada configurado, mostra o "Funil de Vendas" (se existir)
    if (typesData?.some((t) => t.tipo.trim() === DEFAULT_FUNNEL)) return [DEFAULT_FUNNEL];
    return typesData?.[0]?.tipo ? [typesData[0].tipo] : [];
  }, [userFunnelsData, typesData]);

  // Garante uma aba ativa válida
  useEffect(() => {
    if (activeFunnels.length && !activeFunnels.includes(activeTab)) {
      setActiveTab(activeFunnels[0]);
    }
  }, [activeFunnels, activeTab]);

  // Processos da aba ativa
  const { data: processes = [], isLoading: loadingProcesses } = useQuery({
    queryKey: ["crm", "processes", activeTab],
    queryFn: async () => {
      if (!activeTab) return [];
      const { data, error } = await supabase
        .from("nomus_processes")
        .select("id, nomus_id, nome, pessoa, tipo, etapa, prioridade, responsavel, proximo_contato, data_criacao, cliente_id")
        .eq("tipo", activeTab)
        .order("data_criacao", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProcessRow[];
    },
    enabled: !!activeTab,
  });

  // Etapas conhecidas para o tipo ativo
  const { data: stages = [] } = useQuery({
    queryKey: ["crm", "stages", activeTab],
    queryFn: async () => {
      if (!activeTab) return [];
      const { data, error } = await supabase
        .from("crm_funnel_stages")
        .select("tipo, etapa, display_order, is_won, is_lost, is_hidden")
        .eq("tipo", activeTab)
        .eq("is_hidden", false)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FunnelStage[];
    },
    enabled: !!activeTab,
  });

  // Botão de sincronização — só do funil ativo, pra caber no timeout do Worker.
  const pullMutation = useMutation({
    mutationFn: async () => {
      const r = await pull({
        data: activeTab ? { tipos: [activeTab], maxItems: 500 } : { maxItems: 500 },
      });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Sincronização concluída: ${r.upserted} processos atualizados.`);
      queryClient.invalidateQueries({ queryKey: ["crm"] });
    },
    onError: (e) => toast.error(`Falha na sincronização: ${e instanceof Error ? e.message : String(e)}`),
  });

  // Filtragem por busca
  const filtered = useMemo(() => {
    if (!search.trim()) return processes;
    const q = search.toLowerCase();
    return processes.filter(
      (p) =>
        p.nome?.toLowerCase().includes(q) ||
        p.pessoa?.toLowerCase().includes(q) ||
        p.responsavel?.toLowerCase().includes(q) ||
        p.nomus_id.includes(q),
    );
  }, [processes, search]);

  // Agrupa por etapa: usa as etapas do cache + qualquer etapa que apareça
  // nos processos mas ainda não foi cadastrada (defensivo)
  const columns = useMemo(() => {
    const knownEtapas = new Set(stages.map((s) => s.etapa));
    const extras = new Set<string>();
    for (const p of filtered) {
      const e = (p.etapa ?? "").trim();
      if (e && !knownEtapas.has(e)) extras.add(e);
    }
    const list: FunnelStage[] = [
      ...stages,
      ...Array.from(extras).map((etapa) => ({
        tipo: activeTab,
        etapa,
        display_order: 999,
        is_won: false,
        is_lost: false,
        is_hidden: false,
      })),
    ];
    return list.map((stage) => ({
      ...stage,
      processes: filtered.filter((p) => (p.etapa ?? "").trim() === stage.etapa),
    }));
  }, [stages, filtered, activeTab]);

  return (
    <>
      <PageHeader
        title="Funil / CRM"
        subtitle="Pipeline espelhado dos processos do Nomus. Arraste o card para mudar de etapa (em breve)."
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, processo, vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 pl-8"
              />
            </div>
            <Sheet open={funnelDrawerOpen} onOpenChange={setFunnelDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="mr-2 h-4 w-4" /> Gerenciar funis
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Funis ativos</SheetTitle>
                </SheetHeader>
                <FunnelManager
                  available={typesData ?? []}
                  selected={(userFunnelsData ?? []).map((f) => f.tipo)}
                  onSave={async (tipos) => {
                    const r = await saveFunnels({
                      data: { tipos: tipos.map((t, i) => ({ tipo: t, display_order: i })) },
                    });
                    if (r.ok) {
                      toast.success("Funis atualizados");
                      queryClient.invalidateQueries({ queryKey: ["crm", "user-funnels"] });
                      setFunnelDrawerOpen(false);
                    } else {
                      toast.error(r.error);
                    }
                  }}
                />
              </SheetContent>
            </Sheet>
            <Button
              size="sm"
              onClick={() => pullMutation.mutate()}
              disabled={pullMutation.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${pullMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar Nomus
            </Button>
          </>
        }
      />

      {activeFunnels.length === 0 ? (
        <EmptyFunnels onSync={() => pullMutation.mutate()} syncing={pullMutation.isPending} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
            {activeFunnels.map((tipo) => (
              <TabsTrigger key={tipo} value={tipo} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {tipo}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeFunnels.map((tipo) => (
            <TabsContent key={tipo} value={tipo} className="mt-0">
              {tipo === activeTab && (
                <KanbanBoard
                  columns={columns}
                  loading={loadingProcesses}
                  emptyState={
                    !loadingProcesses && processes.length === 0 ? (
                      <EmptyProcesses onSync={() => pullMutation.mutate()} syncing={pullMutation.isPending} />
                    ) : null
                  }
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

// ---------------- Componentes ----------------

function KanbanBoard({
  columns,
  loading,
  emptyState,
}: {
  columns: Array<FunnelStage & { processes: ProcessRow[] }>;
  loading: boolean;
  emptyState: React.ReactNode;
}) {
  if (emptyState) return <>{emptyState}</>;
  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando processos…</div>;
  }
  if (columns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma etapa cadastrada para este funil. Sincronize com o Nomus para descobrir as etapas.
      </div>
    );
  }
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.etapa}
          className="flex w-[300px] shrink-0 flex-col rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{col.etapa}</h3>
              {col.is_won && <Badge variant="default" className="bg-emerald-600 text-white">Ganha</Badge>}
              {col.is_lost && <Badge variant="destructive">Perdida</Badge>}
            </div>
            <Badge variant="outline" className="text-xs">{col.processes.length}</Badge>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {col.processes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                Vazio
              </div>
            ) : (
              col.processes.map((p) => <KanbanCard key={p.id} process={p} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanCard({ process: p }: { process: ProcessRow }) {
  const days = daysSince(p.data_criacao);
  const proximo = p.proximo_contato ? new Date(p.proximo_contato) : null;
  const proximoMs = proximo ? proximo.getTime() - Date.now() : null;
  const followupOverdue = proximoMs !== null && proximoMs < 0;
  const followupSoon = proximoMs !== null && proximoMs >= 0 && proximoMs < 3 * 86_400_000;

  return (
    <div className="group rounded-md border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {(p.nome ?? p.pessoa ?? "Sem nome").trim()}
          </p>
          {p.pessoa && p.nome && p.pessoa.trim() !== p.nome.trim() && (
            <p className="truncate text-xs text-muted-foreground">{p.pessoa}</p>
          )}
        </div>
        <Badge variant={priorityVariant(p.prioridade)} className="shrink-0 text-[10px]">
          {p.prioridade ?? "—"}
        </Badge>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {p.responsavel && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="truncate">{p.responsavel}</span>
          </div>
        )}
        {proximo && (
          <div
            className={`flex items-center gap-1 ${
              followupOverdue ? "text-destructive" : followupSoon ? "text-amber-600" : ""
            }`}
          >
            {followupOverdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            <span>Próx. contato: {dateBR(p.proximo_contato)}</span>
          </div>
        )}
        {days !== null && (
          <div className="text-[11px] opacity-70">Criado há {days}d</div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] text-muted-foreground">#{p.nomus_id}</span>
        <Link
          to="/app/crm/$id"
          params={{ id: p.id }}
          className="flex items-center gap-1 text-[11px] text-primary opacity-0 transition group-hover:opacity-100"
        >
          Abrir <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function FunnelManager({
  available,
  selected,
  onSave,
}: {
  available: Array<{ tipo: string; count: number }>;
  selected: string[];
  onSave: (tipos: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setPicked(selected);
  }, [selected]);

  const visible = useMemo(
    () => available.filter((a) => a.tipo.toLowerCase().includes(filter.toLowerCase())),
    [available, filter],
  );

  const toggle = (tipo: string) => {
    setPicked((prev) => (prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]));
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Escolha quais tipos de funil você quer ver no Kanban. A ordem segue a ordem de seleção.
      </p>
      <Input
        placeholder="Filtrar funis..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum funil descoberto ainda. Sincronize com o Nomus primeiro.
          </p>
        ) : (
          visible.map((a) => (
            <label
              key={a.tipo}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-accent"
            >
              <Checkbox checked={picked.includes(a.tipo)} onCheckedChange={() => toggle(a.tipo)} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{a.tipo}</p>
                <p className="text-xs text-muted-foreground">{a.count} processo(s)</p>
              </div>
              {picked.includes(a.tipo) && (
                <Badge variant="outline" className="text-[10px]">
                  #{picked.indexOf(a.tipo) + 1}
                </Badge>
              )}
            </label>
          ))
        )}
      </div>
      <Button onClick={() => onSave(picked)}>Salvar funis ativos</Button>
    </div>
  );
}

function EmptyFunnels({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <h3 className="text-lg font-semibold text-foreground">Nenhum funil ativo</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Sincronize com o Nomus para descobrir os funis disponíveis e selecione quais quer ver aqui.
      </p>
      <Button className="mt-4" onClick={onSync} disabled={syncing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        Sincronizar agora
      </Button>
    </div>
  );
}

function EmptyProcesses({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <h3 className="text-lg font-semibold text-foreground">Nenhum processo neste funil</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Tente sincronizar novamente ou selecione outro funil em "Gerenciar funis".
      </p>
      <Button className="mt-4" onClick={onSync} disabled={syncing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        Sincronizar agora
      </Button>
    </div>
  );
}
