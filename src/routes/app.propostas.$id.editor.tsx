import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw, Save, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getProposalDocument,
  upsertProposalDocument,
  autoFillFromNomus,
  generateProposalPdf,
} from "@/integrations/proposal-editor/server.functions";
import type {
  DocumentPage,
  CoverData,
  ContextData,
  SolutionData,
  ScopeItem,
} from "@/integrations/proposal-editor/types";
import { EditorPagePanel } from "@/components/proposal-editor/EditorPagePanel";
import { EditorPreviewStub } from "@/components/proposal-editor/EditorPreviewStub";
import {
  BlockEditorPanel,
  type DocumentEditState,
} from "@/components/proposal-editor/BlockEditorPanel";

export const Route = createFileRoute("/app/propostas/$id/editor")({
  component: ProposalEditorPage,
});

function ProposalEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getDoc = useServerFn(getProposalDocument);
  const saveDoc = useServerFn(upsertProposalDocument);
  const autoFill = useServerFn(autoFillFromNomus);
  const genPdf = useServerFn(generateProposalPdf);

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-document", id],
    queryFn: () => getDoc({ data: { proposalId: id } }),
  });

  const doc = data?.document;
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [state, setState] = useState<DocumentEditState>({
    cover_data: {},
    solution_data: {},
    context_data: {},
    scope_items: [],
    warranty_text: {},
    manually_edited_fields: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const hydratedFor = useRef<string | null>(null);

  // Hidrata estado quando o doc chega (ou quando troca de proposta)
  useEffect(() => {
    if (!doc) return;
    if (hydratedFor.current === doc.id) return;
    hydratedFor.current = doc.id;
    const ps = (doc.pages as unknown as DocumentPage[]) ?? [];
    setPages(ps);
    setState({
      cover_data: (doc.cover_data ?? {}) as CoverData,
      solution_data: (doc.solution_data ?? {}) as SolutionData,
      context_data: (doc.context_data ?? {}) as ContextData,
      scope_items: (doc.scope_items ?? []) as unknown as ScopeItem[],
      warranty_text: (doc.warranty_text ?? {}) as { html?: string; text?: string },
      manually_edited_fields: doc.manually_edited_fields ?? [],
    });
    if (!selectedId && ps.length > 0) setSelectedId(ps[0].id);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveDoc({
        data: {
          proposalId: id,
          patch: {
            pages: pages as unknown as never[],
            cover_data: state.cover_data as Record<string, unknown>,
            solution_data: state.solution_data as Record<string, unknown>,
            context_data: state.context_data as Record<string, unknown>,
            scope_items: state.scope_items as unknown as Array<Record<string, unknown>>,
            warranty_text: state.warranty_text as Record<string, unknown>,
            manually_edited_fields: state.manually_edited_fields,
          },
        },
      }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["proposal-document", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fillMut = useMutation({
    mutationFn: () => autoFill({ data: { proposalId: id } }),
    onSuccess: (res) => {
      // força re-hidratação
      hydratedFor.current = null;
      qc.invalidateQueries({ queryKey: ["proposal-document", id] });
      toast.success(`Sincronizado · ${res.filledFromNomus} itens do Nomus`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-save debounce 2s
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveMut.mutate(), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, state, dirty]);

  const handlePagesChange = (next: DocumentPage[]) => {
    setPages(next);
    setDirty(true);
  };

  const handleStateChange = (
    patch: Partial<DocumentEditState>,
    editedKeys?: string[],
  ) => {
    setState((prev) => {
      const merged = { ...prev, ...patch };
      if (editedKeys && editedKeys.length > 0) {
        const set = new Set(prev.manually_edited_fields);
        editedKeys.forEach((k) => set.add(k));
        merged.manually_edited_fields = Array.from(set);
      }
      return merged;
    });
    setDirty(true);
  };

  const handlePageContentChange = (pageId: string, patch: Partial<DocumentPage>) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, ...patch } : p)));
    setDirty(true);
  };

  const documentData = useMemo(
    () => ({
      cover_data: state.cover_data as Record<string, unknown>,
      context_data: state.context_data as Record<string, unknown>,
      scope_items: state.scope_items as unknown as Array<Record<string, unknown>>,
    }),
    [state.cover_data, state.context_data, state.scope_items],
  );

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null;

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
          <Button
            size="sm"
            variant="outline"
            onClick={() => fillMut.mutate()}
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
            variant="outline"
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
          <Button size="sm" disabled title="Disponível na Etapa 3">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Visualizar PDF
          </Button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar esquerda */}
        <aside className="flex w-[40%] min-w-[360px] max-w-[520px] flex-col border-r bg-background">
          <div className="h-[35%] min-h-[200px] border-b">
            <EditorPagePanel
              pages={pages}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={handlePagesChange}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedPage ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {selectedPage.title}
                  </h3>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {selectedPage.type}
                  </span>
                </div>
                <BlockEditorPanel
                  page={selectedPage}
                  state={state}
                  onChange={handleStateChange}
                  onPageContentChange={handlePageContentChange}
                />
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Selecione uma página para editar.
              </div>
            )}
          </div>
        </aside>

        {/* Preview direita */}
        <main className="flex-1 overflow-hidden">
          <EditorPreviewStub
            pages={pages}
            selectedId={selectedId}
            documentData={documentData}
          />
        </main>
      </div>
    </div>
  );
}
