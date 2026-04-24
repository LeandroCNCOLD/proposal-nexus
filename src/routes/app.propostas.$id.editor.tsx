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
import type { ProposalTemplate, TemplateAsset } from "@/integrations/proposal-editor/template.types";
import type { ProposalDynamicContext } from "@/components/proposal-editor/BlockRenderer";
import { PageSidebar } from "@/components/proposal-editor/PageSidebar";
// (Paleta global removida — agora a paleta é contextual por página, dentro de PageSidebar.)
import { ProposalCanvas } from "@/components/proposal-editor/ProposalCanvas";
import { ProposalAttachmentsPanel } from "@/components/proposal-editor/ProposalAttachmentsPanel";
import { ProposalVersionsPanel } from "@/components/proposal-editor/ProposalVersionsPanel";
import { supabase } from "@/integrations/supabase/client";
import { PageSizePicker } from "@/components/proposal-editor/PageSizePicker";
import {
  DEFAULT_PAGE_SIZE,
  resolvePageSize,
  type DocumentPageSize,
} from "@/integrations/proposal-editor/page-sizes";

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
  const genPdf = useServerFn(generateProposalPdf);
  const createVersion = useServerFn(createProposalSendVersion);
  const listTpls = useServerFn(listTemplates);

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-document", id],
    queryFn: () => getDoc({ data: { proposalId: id } }),
  });

  const { data: tplsData } = useQuery({
    queryKey: ["proposal-templates-list"],
    queryFn: () => listTpls(),
  });

  const tplsList = (tplsData ?? {}) as { templates?: Array<{ id: string; name: string; is_default: boolean }> };

  const doc = data?.document;
  const templateId = (doc as { template_id?: string | null } | undefined)?.template_id ?? null;

  // Carrega template + assets para o canvas (chrome A4 + capa pictórica)
  const { data: bundleData } = useQuery({
    queryKey: ["proposal-template-bundle", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const { data: tpl } = await supabase
        .from("proposal_templates")
        .select("*")
        .eq("id", templateId)
        .maybeSingle();
      const { data: assetRows } = await supabase
        .from("proposal_template_assets")
        .select("*")
        .eq("template_id", templateId);
      const assets: TemplateAsset[] = (assetRows ?? []).map((a) => ({
        ...(a as unknown as TemplateAsset),
        url: supabase.storage
          .from("proposal-template-assets")
          .getPublicUrl(a.storage_path).data.publicUrl,
      }));
      return { template: tpl as unknown as ProposalTemplate | null, assets };
    },
    enabled: !!templateId,
  });

  // Carrega contexto dinâmico da proposta para placeholders
  const { data: ctxData } = useQuery({
    queryKey: ["proposal-dynamic-context", id],
    queryFn: async () => {
      const { data: p } = await supabase
        .from("proposals")
        .select("number,client_id,nomus_seller_name,clients(name)")
        .eq("id", id)
        .maybeSingle();
      const clientName =
        (p as { clients?: { name?: string } | null } | null)?.clients?.name ?? null;
      return {
        proposal_number: (p as { number?: string } | null)?.number ?? null,
        client_name: clientName,
        vendedor: (p as { nomus_seller_name?: string } | null)?.nomus_seller_name ?? null,
      } satisfies ProposalDynamicContext;
    },
  });

  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [docFontFamily, setDocFontFamily] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem(`docFont:${id}`)) || "Inter, system-ui, sans-serif",
  );
  const [pageSize, setPageSize] = useState<DocumentPageSize>(() => {
    if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
    try {
      const raw = localStorage.getItem(`pageSize:${id}`);
      if (raw) return JSON.parse(raw) as DocumentPageSize;
    } catch {
      /* ignore */
    }
    return DEFAULT_PAGE_SIZE;
  });
  const { wPx: pageWidthPx, hPx: pageHeightPx } = resolvePageSize(pageSize);
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

  const previewMut = useMutation({
    mutationFn: async () => {
      // Garante que mudanças locais estão salvas antes de gerar
      if (dirty) await saveMut.mutateAsync();
      return genPdf({ data: { proposalId: id, mode: "preview" } });
    },
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener");
      toast.success("Pré-visualização gerada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const versionMut = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMut.mutateAsync();
      return createVersion({ data: { proposalId: id } });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["proposal-send-versions", id] });
      toast.success(`Versão v${res.version_number} gerada`);
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
          <PageSizePicker
            value={pageSize}
            onChange={(next) => {
              setPageSize(next);
              if (typeof window !== "undefined")
                localStorage.setItem(`pageSize:${id}`, JSON.stringify(next));
            }}
          />
          <div className="mr-2 flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Fonte:</span>
            <Select
              value={docFontFamily}
              onValueChange={(v) => {
                setDocFontFamily(v);
                if (typeof window !== "undefined") localStorage.setItem(`docFont:${id}`, v);
              }}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter, system-ui, sans-serif" className="text-xs">Inter (sans)</SelectItem>
                <SelectItem value="Helvetica, Arial, sans-serif" className="text-xs">Helvetica</SelectItem>
                <SelectItem value="Georgia, 'Times New Roman', serif" className="text-xs">Georgia (serif)</SelectItem>
                <SelectItem value="ui-monospace, SFMono-Regular, monospace" className="text-xs">Monospace</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                {(tplsList.templates ?? []).map((t) => (
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => previewMut.mutate()}
            disabled={previewMut.isPending}
          >
            {previewMut.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="mr-1.5 h-3.5 w-3.5" />
            )}
            Pré-visualizar PDF
          </Button>
          <Button
            size="sm"
            onClick={() => versionMut.mutate()}
            disabled={versionMut.isPending}
          >
            {versionMut.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileCheck className="mr-1.5 h-3.5 w-3.5" />
            )}
            Gerar nova versão
          </Button>
        </div>
      </div>

      {/* Layout: sidebar fina + canvas A4 ocupando o resto */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[260px] shrink-0 flex-col border-r bg-background">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PageSidebar
              pages={pages}
              selectedId={selectedId}
              proposalId={id}
              onSelect={setSelectedId}
              onChange={handlePagesChange}
            />
          </div>
          <div className="space-y-3 border-t p-3">
            <ProposalAttachmentsPanel
              proposalId={id}
              onChanged={() => qc.invalidateQueries({ queryKey: ["proposal-document", id] })}
            />
            <ProposalVersionsPanel proposalId={id} />
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <ProposalCanvas
            pages={pages}
            selectedId={selectedId}
            template={bundleData?.template ?? null}
            assets={bundleData?.assets ?? []}
            proposalContext={ctxData ?? {}}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onSelect={setSelectedId}
            onPagesChange={handlePagesChange}
            proposalId={id}
            documentFontFamily={docFontFamily}
            pageWidthPx={pageWidthPx}
            pageHeightPx={pageHeightPx}
          />
        </main>
      </div>
    </div>
  );
}
