import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Loader2, Sparkles, RotateCcw, Eye, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getProposalDocument,
  upsertProposalDocument,
  setProposalDocumentTemplate,
  autoFillFromNomus,
  generateProposalPdf,
  createProposalSendVersion,
} from "@/integrations/proposal-editor/server.functions";
import { listTemplates } from "@/integrations/proposal-editor/template.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentPage } from "@/integrations/proposal-editor/types";
import { PageSidebar } from "@/components/proposal-editor/PageSidebar";
import { ProposalCanvas } from "@/components/proposal-editor/ProposalCanvas";
import { ProposalAttachmentsPanel } from "@/components/proposal-editor/ProposalAttachmentsPanel";

export const Route = createFileRoute("/app/propostas/$id/editor")({
  component: ProposalEditorPage,
});

function ProposalEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getDoc = useServerFn(getProposalDocument);
  const saveDoc = useServerFn(upsertProposalDocument);
  const setTpl = useServerFn(setProposalDocumentTemplate);
  const autoFill = useServerFn(autoFillFromNomus);
  const listTpls = useServerFn(listTemplates);

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-document", id],
    queryFn: () => getDoc({ data: { proposalId: id } }),
  });

  const { data: tplsData } = useQuery({
    queryKey: ["proposal-templates-list"],
    queryFn: () => listTpls(),
  });

  const doc = data?.document;
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    if (hydratedFor.current === doc.id) return;
    hydratedFor.current = doc.id;
    const ps = (doc.pages as unknown as DocumentPage[]) ?? [];
    setPages(ps);
    if (!selectedId && ps.length > 0) setSelectedId(ps[0].id);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveDoc({
        data: {
          proposalId: id,
          patch: { pages: pages as unknown as never[] },
        },
      }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["proposal-document", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fillMut = useMutation({
    mutationFn: (overwrite: boolean) =>
      autoFill({ data: { proposalId: id, overwriteManualFields: overwrite } }),
    onSuccess: (res) => {
      hydratedFor.current = null;
      qc.invalidateQueries({ queryKey: ["proposal-document", id] });
      const tablesMsg =
        res.tablesUpdated.length > 0
          ? ` · ${res.tablesUpdated.length} tabela(s) atualizada(s)`
          : "";
      toast.success(`Sincronizado · ${res.filledFromNomus} itens do Nomus${tablesMsg}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tplMut = useMutation({
    mutationFn: (templateId: string) =>
      setTpl({ data: { proposalId: id, templateId, applyPagesConfig: true } }),
    onSuccess: () => {
      hydratedFor.current = null;
      qc.invalidateQueries({ queryKey: ["proposal-document", id] });
      toast.success("Template aplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // auto-save
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveMut.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, dirty]);

  const handlePagesChange = (next: DocumentPage[]) => {
    setPages(next);
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/app/propostas/$id", params: { id } })}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          <div className="text-sm">
            <div className="font-semibold">Editor de Proposta</div>
            <div className="text-xs text-muted-foreground">
              {dirty || saveMut.isPending
                ? "Salvando…"
                : doc?.last_edited_at
                  ? `Salvo às ${new Date(doc.last_edited_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                  : "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-2 flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Template:</span>
            <Select
              value={doc?.template_id ?? ""}
              onValueChange={(v) => v && tplMut.mutate(v)}
              disabled={tplMut.isPending}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Escolher template…" />
              </SelectTrigger>
              <SelectContent>
                {(tplsData?.templates ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.name}
                    {t.is_default ? " (padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fillMut.mutate(false)}
            disabled={fillMut.isPending}
          >
            {fillMut.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Sincronizar do Nomus
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => fillMut.mutate(true)}
            disabled={fillMut.isPending}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reprocessar
          </Button>
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={!dirty || saveMut.isPending}
          >
            {saveMut.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Layout: sidebar fina + canvas A4 ocupando o resto */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[260px] shrink-0 flex-col border-r bg-background">
          <div className="flex-1 overflow-hidden">
            <PageSidebar
              pages={pages}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={handlePagesChange}
            />
          </div>
          <div className="border-t p-3">
            <ProposalAttachmentsPanel
              proposalId={id}
              onChanged={() => qc.invalidateQueries({ queryKey: ["proposal-document", id] })}
            />
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <ProposalCanvas
            pages={pages}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPagesChange={handlePagesChange}
          />
        </main>
      </div>
    </div>
  );
}
