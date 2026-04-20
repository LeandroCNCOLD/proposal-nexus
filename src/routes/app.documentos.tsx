import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { FolderUp } from "lucide-react";

export const Route = createFileRoute("/app/documentos")({
  component: () => (
    <>
      <PageHeader title="Documentos & IA Documental" subtitle="Módulo em construção" />
      <div className="rounded-xl border-2 border-dashed bg-card/50 p-12 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <FolderUp className="h-7 w-7 text-primary-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Upload de propostas, catálogos e anexos</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Extração automática via IA, vínculo com propostas/concorrentes/equipamentos. Tabela `documents` pronta.</p>
      </div>
    </>
  ),
});
