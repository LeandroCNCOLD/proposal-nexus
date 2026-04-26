import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Settings2, Search, Filter as FilterIcon } from "lucide-react";
import { toast } from "sonner";
import {
  pullNomusProcesses,
  listAvailableProcessTypes,
  getUserFunnels,
  setUserFunnels,
  createNomusProcess,
} from "@/integrations/nomus/process-sync.functions";
import { getFunnelData } from "@/integrations/nomus/process-enrichment.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { KanbanCardRich, type EnrichedCard } from "@/components/crm/KanbanCardRich";

export const Route = createFileRoute("/app/crm")({ component: CrmPage });

const DEFAULT_FUNNEL = "Funil de Vendas";

type Filters = {
  responsavel: string;
  equipe: string;
  pessoa: string;
  processo: string;
};

type NewProcessPayload = {
  nome: string;
  tipo: string;
  etapa: string;
  responsavel: string;
  reportador: string;
  prioridade?: string;
  equipe?: string;
  origem?: string;
  dataHoraProgramada?: string | null;
};

const EMPTY_FILTERS: Filters = { responsavel: "", equipe: "", pessoa: "", processo: "" };

function CrmPage() {
  const queryClient = useQueryClient();
  const pullProcesses = useServerFn(pullNomusProcesses);
  const listTypes = useServerFn(listAvailableProcessTypes);
  const getFunnels = useServerFn(getUserFunnels);
  const saveFunnels = useServerFn(setUserFunnels);
  const fetchFunnel = useServerFn(getFunnelData);
  const createProcess = useServerFn(createNomusProcess);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_FUNNEL);
  const [funnelDrawerOpen, setFunnelDrawerOpen] = useState(false);
  const [newProcessOpen, setNewProcessOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const { data: typesData } = useQuery({
    queryKey: ["crm", "available-types"],
    queryFn: async () => {
      const r = await listTypes();
      if (!r.ok) throw new Error(r.error);
      return r.tipos;
    },
  });

  const { data: userFunnelsData } = useQuery({
    queryKey: ["crm", "user-funnels"],
    queryFn: async () => {
      const r = await getFunnels();
      if (!r.ok) throw new Error(r.error);
      return r.funnels;
    },
  });

  const activeFunnels = useMemo(() => {
    if (userFunnelsData && userFunnelsData.length > 0) {
      return userFunnelsData.map((f) => f.tipo);
    }
    if (typesData?.some((t) => t.tipo.trim() === DEFAULT_FUNNEL)) return [DEFAULT_FUNNEL];
    return typesData?.[0]?.tipo ? [typesData[0].tipo] : [];
  }, [userFunnelsData, typesData]);

  useEffect(() => {
    if (activeFunnels.length && !activeFunnels.includes(activeTab)) {
      setActiveTab(activeFunnels[0]);
    }
  }, [activeFunnels, activeTab]);

  // Funil enriquecido (servidor agrega tudo)
  const filtersForServer = useMemo(() => {
    const out: Partial<Filters> = {};
    if (filters.responsavel.trim()) out.responsavel = filters.responsavel.trim();
    if (filters.equipe.trim()) out.equipe = filters.equipe.trim();
    if (filters.pessoa.trim()) out.pessoa = filters.pessoa.trim();
    if (filters.processo.trim()) out.processo = filters.processo.trim();
    return out;
  }, [filters]);

  const { data: funnelData, isLoading: loadingFunnel, isError: funnelError } = useQuery({
    queryKey: ["crm", "funnel", activeTab, filtersForServer],
    queryFn: async () => {
      if (!activeTab) return { stages: [] as Array<any> };
      const r = await fetchFunnel({ data: { tipo: activeTab, filters: filtersForServer } });
      if (!r.ok) throw new Error(r.error);
      return { stages: r.stages };
    },
    enabled: !!activeTab,
    staleTime: 60_000,
    retry: false,
    throwOnError: false,
  });

  // Busca livre client-side (rápida, sobre o resultado já carregado)
  const stages = useMemo(() => {
    if (!funnelData) return [];
    if (!search.trim()) return funnelData.stages;
    const q = search.toLowerCase();
    return funnelData.stages.map((s: any) => ({
      ...s,
      processes: s.processes.filter(
        (p: EnrichedCard) =>
          p.nome?.toLowerCase().includes(q) ||
          p.pessoa?.toLowerCase().includes(q) ||
          p.responsavel?.toLowerCase().includes(q) ||
          p.nomus_id.includes(q) ||
          p.proposta_numero?.toLowerCase().includes(q),
      ),
    }));
  }, [funnelData, search]);

  const pullMutation = useMutation({
    mutationFn: async () => {
      const tipoAtivo = activeTab?.trim();
      if (!tipoAtivo) throw new Error("Selecione um funil antes de sincronizar.");
      const result = await pullProcesses({ data: { tipos: [tipoAtivo] } });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (r) => {
      const status = r.done ? "concluído" : "parcial";
      toast.success(`Funil "${activeTab}" ${status}: ${r.matched ?? 0} do funil encontrados neste lote, ${r.upserted ?? 0} atualizados.`);
      queryClient.invalidateQueries({ queryKey: ["crm"] });
    },
    onError: (e) => toast.error(`Falha na sincronização: ${e instanceof Error ? e.message : String(e)}`),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: NewProcessPayload) => {
      const result = await createProcess({ data: payload });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Processo criado no Nomus.");
      setNewProcessOpen(false);
      queryClient.invalidateQueries({ queryKey: ["crm"] });
    },
    onError: (e) => toast.error(`Falha ao criar processo: ${e instanceof Error ? e.message : String(e)}`),
  });

  const activeFilterCount = Object.values(filtersForServer).filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Funil / CRM"
        subtitle="Pipeline espelhado dos processos do Nomus, enriquecido com propostas e métricas."
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, processo, proposta…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 pl-8"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <FilterIcon className="mr-2 h-4 w-4" /> Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3">
                <h4 className="text-sm font-semibold">Filtros</h4>
                <div className="space-y-2">
                  <Label className="text-xs">Responsável</Label>
                  <Input
                    value={filters.responsavel}
                    onChange={(e) => setFilters({ ...filters, responsavel: e.target.value })}
                    placeholder="Ex: Rafael"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Equipe</Label>
                  <Input
                    value={filters.equipe}
                    onChange={(e) => setFilters({ ...filters, equipe: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Pessoa / Cliente</Label>
                  <Input
                    value={filters.pessoa}
                    onChange={(e) => setFilters({ ...filters, pessoa: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Processo (nome ou ID)</Label>
                  <Input
                    value={filters.processo}
                    onChange={(e) => setFilters({ ...filters, processo: e.target.value })}
                  />
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Limpar filtros
                </Button>
              </PopoverContent>
            </Popover>
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
            <Dialog open={newProcessOpen} onOpenChange={setNewProcessOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Novo processo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo processo no Nomus</DialogTitle>
                </DialogHeader>
                <NewProcessForm
                  defaultTipo={activeTab || DEFAULT_FUNNEL}
                  stages={funnelData?.stages?.map((s: any) => s.etapa) ?? []}
                  saving={createMutation.isPending}
                  onSubmit={(payload: NewProcessPayload) => createMutation.mutate(payload)}
                />
              </DialogContent>
            </Dialog>
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
                <KanbanBoardRich
                  stages={stages}
                  loading={loadingFunnel}
                  error={funnelError}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}

// ---------------- Kanban ----------------

function KanbanBoardRich({
  stages,
  loading,
  error,
}: {
  stages: Array<{
    etapa: string;
    is_won?: boolean;
    is_lost?: boolean;
    color?: string | null;
    count: number;
    totalValue: number;
    proposalCount: number;
    avgTicket: number;
    processes: EnrichedCard[];
  }>;
  loading: boolean;
  error?: boolean;
}) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando processos…</div>;
  }
  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {error ? "Não foi possível carregar o funil agora. Tente atualizar novamente." : "Nenhum processo encontrado. Sincronize com o Nomus ou ajuste os filtros."}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((col) => {
        const accent = col.is_won
          ? "border-t-emerald-500"
          : col.is_lost
            ? "border-t-rose-500"
            : "border-t-primary/40";
        return (
          <div
            key={col.etapa}
            className={`flex w-[290px] shrink-0 flex-col rounded-md border border-border border-t-2 ${accent} bg-muted/20`}
          >
            <div className="border-b border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate text-[13px] font-semibold uppercase tracking-wide text-foreground">
                  {col.etapa}
                </h3>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
                  {col.count}
                </Badge>
              </div>
              <p className="mt-1 text-[12px] font-bold text-emerald-700 dark:text-emerald-400">
                {brl(col.totalValue)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {col.proposalCount > 0
                  ? `${col.proposalCount} proposta${col.proposalCount > 1 ? "s" : ""} · ticket ${brl(col.avgTicket)}`
                  : "sem propostas vinculadas"}
              </p>
            </div>
            <div className="flex max-h-[calc(100vh-260px)] flex-col gap-2 overflow-y-auto p-2">
              {col.processes.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/50 p-4 text-center text-[11px] text-muted-foreground">
                  Vazio
                </div>
              ) : (
                col.processes.map((p) => <KanbanCardRich key={p.id} card={p} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Funnel manager ----------------

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
      <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
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

function NewProcessForm({
  defaultTipo,
  stages,
  saving,
  onSubmit,
}: {
  defaultTipo: string;
  stages: string[];
  saving: boolean;
  onSubmit: (payload: NewProcessPayload) => void;
}) {
  const defaultEtapa = stages[0] ?? "Orçamento";
  const [form, setForm] = useState<NewProcessPayload>({
    nome: "",
    tipo: defaultTipo,
    etapa: defaultEtapa,
    responsavel: "",
    reportador: "",
    prioridade: "Baixa",
    equipe: "",
    origem: "",
    dataHoraProgramada: "",
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, tipo: defaultTipo, etapa: stages[0] ?? prev.etapa }));
  }, [defaultTipo, stages]);

  const update = (key: keyof NewProcessPayload, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ ...form, dataHoraProgramada: form.dataHoraProgramada || null });
      }}
    >
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Input value={form.tipo} onChange={(e) => update("tipo", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Etapa</Label>
          <Select value={form.etapa} onValueChange={(value) => update("etapa", value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from(new Set([form.etapa, ...stages].filter(Boolean))).map((stage) => (
                <SelectItem key={stage} value={stage}>{stage}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Responsável</Label>
          <Input value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Reportador</Label>
          <Input value={form.reportador} onChange={(e) => update("reportador", e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={form.prioridade} onValueChange={(value) => update("prioridade", value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Baixa">Baixa</SelectItem>
              <SelectItem value="Média">Média</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data programada</Label>
          <Input type="datetime-local" value={form.dataHoraProgramada ?? ""} onChange={(e) => update("dataHoraProgramada", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Equipe</Label>
          <Input value={form.equipe ?? ""} onChange={(e) => update("equipe", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Origem</Label>
          <Input value={form.origem ?? ""} onChange={(e) => update("origem", e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Criando…" : "Criar processo"}
      </Button>
    </form>
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
