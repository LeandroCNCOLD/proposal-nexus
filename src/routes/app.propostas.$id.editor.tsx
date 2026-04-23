import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw, Save, Loader2, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getProposalDocument,
  upsertProposalDocument,
  autoFillFromNomus,
  generateProposalPdf,
  setProposalDocumentTemplate,
  createProposalSendVersion,
} from "@/integrations/proposal-editor/server.functions";
import { listTemplates, getTemplate } from "@/integrations/proposal-editor/template.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DocumentPage,
  CoverData,
  ContextData,
  SolutionData,
  ScopeItem,
} from "@/integrations/proposal-editor/types";
import { EditorPagePanel } from "@/components/proposal-editor/EditorPagePanel";
import { ProposalPreviewLive } from "@/components/proposal-editor/ProposalPreviewLive";
import { EditorProposalPreview } from "@/components/proposal-editor/preview/EditorProposalPreview";
import { useEditorPreviewData } from "@/components/proposal-editor/preview/use-editor-preview-data";
import { ProposalAttachmentsPanel } from "@/components/proposal-editor/ProposalAttachmentsPanel";
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
  const setTpl = useServerFn(setProposalDocumentTemplate);
  const sendVersion = useServerFn(createProposalSendVersion);
  const listTpls = useServerFn(listTemplates);
  const getTpl = useServerFn(getTemplate);

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-document", id],
    queryFn: () => getDoc({ data: { proposalId: id } }),
  });

  const { data: tplsData } = useQuery({
    queryKey: ["proposal-templates-list"],
    queryFn: () => listTpls(),
  });

  const currentTemplateId = data?.document?.template_id ?? null;
  const { data: tplBundle } = useQuery({
    queryKey: ["proposal-template-bundle", currentTemplateId],
    queryFn: () =>
      getTpl({ data: currentTemplateId ? { templateId: currentTemplateId } : {} }),
    enabled: !!data?.document,
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
  const [previewMode, setPreviewMode] = useState<"dom" | "pdf">("dom");
  const hydratedFor = useRef<string | null>(null);

  // Tabelas estruturadas (para o preview DOM em tempo real)
  const { tables: proposalTables, isLoadingTables } = useEditorPreviewData(id);

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

  const pdfMut = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMut.mutateAsync();
      return genPdf({ data: { proposalId: id, mode: "preview" } });
    },
    onSuccess: (res) => {
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tplMut = useMutation({
    mutationFn: (templateId: string) =>
      setTpl({ data: { proposalId: id, templateId, applyPagesConfig: true } }),
    onSuccess: () => {
      hydratedFor.current = null;
      qc.invalidateQueries({ queryKey: ["proposal-document", id] });
      qc.invalidateQueries({ queryKey: ["proposal-template-bundle"] });
      toast.success("Template aplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMut.mutateAsync();
      return sendVersion({ data: { proposalId: id } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["proposal-document", id] });
      toast.success(`Versão ${res.version.version_number} gerada e congelada`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveMut.mutate(), 2000);
    return () => clearTimeout(t);
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
          <div className="flex items-center gap-1.5 mr-2">
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => pdfMut.mutate()}
            disabled={pdfMut.isPending}
          >
            {pdfMut.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Visualizar PDF
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (confirm("Gerar versão final imutável e congelar este documento como envio?")) {
                sendMut.mutate();
              }
            }}
            disabled={sendMut.isPending}
          >
            {sendMut.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Enviar proposta
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
                  proposalId={id}
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
            <div className="mt-6 border-t pt-4">
              <ProposalAttachmentsPanel
                proposalId={id}
                onChanged={() => qc.invalidateQueries({ queryKey: ["proposal-document", id] })}
              />
            </div>
          </div>
        </aside>

        {/* Preview direita */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-end gap-1 border-b bg-background px-3 py-1.5">
            <span className="mr-1 text-[11px] text-muted-foreground">Preview:</span>
            <Button
              size="sm"
              variant={previewMode === "dom" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setPreviewMode("dom")}
            >
              Estrutural (ao vivo)
            </Button>
            <Button
              size="sm"
              variant={previewMode === "pdf" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setPreviewMode("pdf")}
            >
              PDF real
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            {previewMode === "dom" ? (
              <div className="h-full overflow-y-auto bg-slate-100 p-6">
                {isLoadingTables ? (
                  <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
                    Carregando preview...
                  </div>
                ) : (
                  <EditorProposalPreview
                    proposal={{
                      ...(doc ?? {}),
                      custom_blocks: doc?.custom_blocks,
                      attached_pdf_paths: doc?.attached_pdf_paths,
                    }}
                    document={{
                      pages,
                      cover_data: state.cover_data,
                      context_data: state.context_data,
                      solution_data: state.solution_data,
                      scope_items: state.scope_items,
                      warranty_text: state.warranty_text,
                      custom_blocks: doc?.custom_blocks ?? {},
                      attached_pdf_paths: doc?.attached_pdf_paths ?? [],
                    }}
                    template={tplBundle?.template ?? null}
                    tables={proposalTables}
                    selectedPageId={selectedId}
                  />
                )}
              </div>
            ) : (
              <ProposalPreviewLive
                proposalId={id}
                version={pages.length + JSON.stringify(state).length}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
