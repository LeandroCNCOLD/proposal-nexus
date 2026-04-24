import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/app/crm/$id")({
  component: CrmDetailPage,
});

function CrmDetailPage() {
  const { id } = Route.useParams();

  const { data: process, isLoading } = useQuery({
    queryKey: ["crm", "process", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_processes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!process) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">Processo não encontrado.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/app/crm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao funil</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={(process.nome ?? process.pessoa ?? `Processo #${process.nomus_id}`) as string}
        subtitle={`Tipo: ${process.tipo ?? "—"} · Etapa: ${process.etapa ?? "—"}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/crm"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao funil</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          <h3 className="mb-2 font-semibold text-foreground">Dados do processo</h3>
          <Field label="Cliente" value={process.pessoa} />
          <Field label="Responsável" value={process.responsavel} />
          <Field label="Reportador" value={process.reportador} />
          <Field label="Equipe" value={process.equipe} />
          <Field label="Origem" value={process.origem} />
          <Field label="Prioridade">
            <Badge variant="outline">{process.prioridade ?? "—"}</Badge>
          </Field>
          <Field label="Próximo contato" value={dateBR(process.proximo_contato)} />
          <Field label="Criado em" value={dateBR(process.data_criacao)} />
          <Field label="ID Nomus" value={`#${process.nomus_id}`} />
        </div>

        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 font-semibold text-foreground">Descrição (Nomus)</h3>
          {process.descricao ? (
            <div
              className="prose prose-sm max-w-none text-foreground"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: process.descricao }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sem descrição.</p>
          )}
          <p className="mt-6 rounded-md border border-dashed border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            Timeline rica (notas, atividades, mudanças de etapa) e edição bidirecional serão liberadas na próxima fase.
          </p>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/40 pb-1 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children ?? (value || "—")}</span>
    </div>
  );
}
