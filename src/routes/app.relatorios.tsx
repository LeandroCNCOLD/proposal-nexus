import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { FileBarChart } from "lucide-react";

export const Route = createFileRoute("/app/relatorios")({
  component: () => (
    <>
      <PageHeader title="Relatórios & Analytics" subtitle="Módulo em construção" />
      <div className="rounded-xl border-2 border-dashed bg-card/50 p-12 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <FileBarChart className="h-7 w-7 text-primary-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Relatórios consolidados</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Aging, conversão por vendedor, motivos de perda, comparações de preço e prazo, performance por template.</p>
      </div>
    </>
  ),
});
