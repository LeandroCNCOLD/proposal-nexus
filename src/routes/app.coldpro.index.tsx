import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Edit2, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useColdProProjects, useCreateColdProProject, useDeleteColdProProject, useLinkColdProProjectToProposal, useColdProLinkableProposals, useUpdateColdProProject } from "@/features/coldpro/use-coldpro";

export const Route = createFileRoute("/app/coldpro/")({ component: ColdProIndexPage });

function ColdProIndexPage() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useColdProProjects();
  const { data: proposals = [] } = useColdProLinkableProposals();
  const createProject = useCreateColdProProject();
  const updateProject = useUpdateColdProProject("");
  const linkProject = useLinkColdProProjectToProposal();
  const deleteProject = useDeleteColdProProject();
  const [name, setName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState("");
  const [linkingId, setLinkingId] = React.useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = React.useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    const project = await createProject.mutateAsync({ name, application_type: "cold_room" });
    navigate({ to: "/app/coldpro/$id", params: { id: project.id } });
  }

  async function handleRename(project: any) {
    const nextName = editingName.trim();
    if (!nextName) return;
    await updateProject.mutateAsync({ id: project.id, name: nextName });
    setEditingId(null);
    toast.success("Projeto atualizado.");
  }

  async function handleLink(project: any) {
    await linkProject.mutateAsync({ id: project.id, proposal_id: selectedProposalId || null });
    setLinkingId(null);
    toast.success(selectedProposalId ? "Projeto vinculado à proposta." : "Vínculo removido.");
  }

  async function handleDelete(project: any) {
    if (!window.confirm(`Excluir o projeto "${project.name}" e seus cálculos?`)) return;
    await deleteProject.mutateAsync(project.id);
    toast.success("Projeto excluído.");
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">CN ColdPro</h1>
        <p className="text-sm text-muted-foreground">Cálculo térmico e dimensionamento de sistemas de refrigeração.</p>
      </div>

      <div className="rounded-2xl border bg-background p-4">
        <h2 className="mb-3 text-base font-semibold">Novo projeto térmico</h2>
        <div className="flex gap-2">
          <input className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" placeholder="Ex: Câmara de congelados - Cliente X" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={handleCreate} disabled={createProject.isPending}><Plus className="h-4 w-4" />Criar</button>
        </div>
      </div>

      <div className="rounded-2xl border bg-background">
        <div className="border-b p-4 font-semibold">Projetos</div>
        {isLoading ? <div className="p-4 text-sm text-muted-foreground">Carregando...</div> : projects.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum projeto criado.</div> : (
          <div className="divide-y">
            {projects.map((project: any) => {
              const linkedProposal = proposals.find((proposal: any) => proposal.id === project.proposal_id);
              const isEditing = editingId === project.id;
              const isLinking = linkingId === project.id;
              return (
                <div key={project.id} className="flex flex-col gap-3 p-4 hover:bg-muted/50 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex max-w-xl gap-2">
                        <input className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={() => handleRename(project)} disabled={updateProject.isPending}>Salvar</button>
                        <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-muted-foreground">Status: {project.status} · Revisão {project.revision}{linkedProposal ? ` · Proposta: ${linkedProposal.number ?? linkedProposal.title ?? "vinculada"}` : ""}</div>
                      </>
                    )}
                    {isLinking && (
                      <div className="mt-3 flex max-w-2xl gap-2">
                        <select className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" value={selectedProposalId} onChange={(e) => setSelectedProposalId(e.target.value)}>
                          <option value="">Sem vínculo</option>
                          {proposals.map((proposal: any) => <option key={proposal.id} value={proposal.id}>{proposal.number ? `${proposal.number} — ` : ""}{proposal.title}</option>)}
                        </select>
                        <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={() => handleLink(project)} disabled={linkProject.isPending}>Vincular</button>
                        <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setLinkingId(null)}>Cancelar</button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate({ to: "/app/coldpro/$id", params: { id: project.id } })}>Abrir</button>
                    <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" onClick={() => { setEditingId(project.id); setEditingName(project.name ?? ""); }}><Edit2 className="h-4 w-4" />Editar</button>
                    <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" onClick={() => { setLinkingId(project.id); setSelectedProposalId(project.proposal_id ?? ""); }}><Link2 className="h-4 w-4" />Vincular à proposta</button>
                    <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-destructive" onClick={() => handleDelete(project)} disabled={deleteProject.isPending}><Trash2 className="h-4 w-4" />Excluir</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}