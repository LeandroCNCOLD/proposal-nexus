import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FileCheck2, UserCheck, BadgeCheck, ClipboardList } from "lucide-react";
import { ApprovalTimeline, EmptyState } from "@/modules/proposals/components";

export const Route = createFileRoute("/app/aprovacoes")({
  component: () => (
    <>
      <PageHeader title="Workflow de Aprovações" subtitle="Módulo em construção" />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Esteira visual de aprovação</h2>
              <p className="text-sm text-muted-foreground">Placeholder visual; aguardando regras e dados do fluxo definitivo.</p>
            </div>
          </div>
          <ApprovalTimeline
            steps={[
              { id: "triagem", title: "Triagem comercial", responsible: "Comercial", status: "Pendente", tone: "info" },
              { id: "tecnica", title: "Validação técnica", responsible: "Engenharia", status: "Aguardando", tone: "neutral" },
              { id: "diretoria", title: "Aprovação final", responsible: "Diretoria", status: "Aguardando", tone: "neutral" },
            ]}
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-sm)]">
            <h3 className="text-sm font-semibold">Resumo operacional</h3>
            <div className="mt-4 grid gap-3">
              <ApprovalMetric icon={<ClipboardList className="h-4 w-4" />} label="Em análise" value="—" />
              <ApprovalMetric icon={<UserCheck className="h-4 w-4" />} label="Responsável" value="—" />
              <ApprovalMetric icon={<BadgeCheck className="h-4 w-4" />} label="Aprovadas" value="—" />
            </div>
          </div>
          <EmptyState title="Nenhuma aprovação ativa" description="Quando o backend de aprovação estiver definido, as solicitações serão listadas nesta tela." />
        </div>
      </div>
    </>
  ),
});

function ApprovalMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-secondary/20 px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
