import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { brl } from "@/lib/format";
import { getProcessDetail } from "@/integrations/nomus/process-enrichment.functions";
import { OverviewTab } from "@/components/crm/OverviewTab";
import { ProposalsTab } from "@/components/crm/ProposalsTab";
import { FollowupTab } from "@/components/crm/FollowupTab";
import { ActivityTab } from "@/components/crm/ActivityTab";
import { AttachmentsTab } from "@/components/crm/AttachmentsTab";
import { NomusTab } from "@/components/crm/NomusTab";

export const Route = createFileRoute("/app/crm/$id")({ component: CrmDetailPage });

function CrmDetailPage() {
  const { id } = Route.useParams();
  const fetchDetail = useServerFn(getProcessDetail);

  const { data, isLoading } = useQuery({
    queryKey: ["crm", "process", id],
    queryFn: async () => {
      const r = await fetchDetail({ data: { id } });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">Processo não encontrado.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/app/crm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao funil</Link>
        </Button>
      </div>
    );
  }

  const p = data.process;
  const totalProposals = data.clientProposals.length;
  const totalValue = data.clientProposals.reduce((s: number, x: any) => s + (x.valor_total ?? 0), 0);
  const ageDays = p.data_criacao
    ? Math.floor((Date.now() - new Date(p.data_criacao).getTime()) / 86_400_000)
    : null;
  const proxOverdue = p.proximo_contato && new Date(p.proximo_contato).getTime() < Date.now();

  return (
    <>
      <PageHeader
        title={(p.nome ?? p.pessoa ?? `Processo #${p.nomus_id}`) as string}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/crm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao funil</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{p.tipo ?? "—"}</Badge>
        <Badge>{p.etapa ?? "—"}</Badge>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{brl(totalValue)}</span>
        <span className="text-muted-foreground">
          · {totalProposals} proposta{totalProposals !== 1 ? "s" : ""}
        </span>
        {ageDays !== null && <span className="text-muted-foreground">· idade {ageDays}d</span>}
        {proxOverdue && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" /> Contato vencido
          </span>
        )}
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="proposals">Propostas ({totalProposals})</TabsTrigger>
          <TabsTrigger value="followup">
            Follow-up ({data.followups.filter((f: any) => !f.done_at).length})
          </TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
          <TabsTrigger value="attachments">Anexos</TabsTrigger>
          <TabsTrigger value="nomus">Nomus</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab detail={data} refetchKey={id} /></TabsContent>
        <TabsContent value="proposals"><ProposalsTab detail={data} refetchKey={id} /></TabsContent>
        <TabsContent value="followup"><FollowupTab detail={data} refetchKey={id} /></TabsContent>
        <TabsContent value="activity"><ActivityTab detail={data} refetchKey={id} /></TabsContent>
        <TabsContent value="attachments"><AttachmentsTab detail={data} /></TabsContent>
        <TabsContent value="nomus"><NomusTab detail={data} /></TabsContent>
      </Tabs>
    </>
  );
}
