import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useColdProProjects, useCreateColdProProject } from "@/features/coldpro/use-coldpro";
export const Route = createFileRoute("/app/coldpro/")({ component: ColdProIndexPage });
function ColdProIndexPage() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useColdProProjects();
  const createProject = useCreateColdProProject();
  const [name, setName] = React.useState("");
  async function handleCreate() { if (!name.trim()) return; const project = await createProject.mutateAsync({ name, application_type: "cold_room" }); navigate({ to: "/app/coldpro/$id", params: { id: project.id } }); }
  return <div className="space-y-6 p-6"><div><h1 className="text-2xl font-bold">CN ColdPro</h1><p className="text-sm text-muted-foreground">Cálculo térmico e dimensionamento de sistemas de refrigeração.</p></div><div className="rounded-2xl border bg-background p-4"><h2 className="mb-3 text-base font-semibold">Novo projeto térmico</h2><div className="flex gap-2"><input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Ex: Câmara de congelados - Cliente X" value={name} onChange={(e) => setName(e.target.value)} /><button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={handleCreate} disabled={createProject.isPending}><Plus className="h-4 w-4" />Criar</button></div></div><div className="rounded-2xl border bg-background"><div className="border-b p-4 font-semibold">Projetos</div>{isLoading ? <div className="p-4 text-sm text-muted-foreground">Carregando...</div> : projects.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum projeto criado.</div> : <div className="divide-y">{projects.map((project: any) => <button key={project.id} className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50" onClick={() => navigate({ to: "/app/coldpro/$id", params: { id: project.id } })}><div><div className="font-medium">{project.name}</div><div className="text-xs text-muted-foreground">Status: {project.status} · Revisão {project.revision}</div></div><div className="text-sm text-muted-foreground">Abrir</div></button>)}</div>}</div></div>;
}
