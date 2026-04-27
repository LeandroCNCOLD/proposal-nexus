import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Image as ImageIcon,
  Star,
  Pencil,
  Copy,
  MoreVertical,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  duplicateTemplate,
  setDefaultTemplate,
} from "@/integrations/proposal-editor/template.functions";

export const Route = createFileRoute("/app/configuracoes/templates/")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["proposal-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_templates")
        .select("*, proposal_template_assets(id, asset_kind, storage_path, label)")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (templateId: string) => duplicateTemplate({ data: { templateId } }),
    onSuccess: ({ templateId }) => {
      toast.success("Template duplicado");
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
      navigate({ to: "/app/configuracoes/templates/$id", params: { id: templateId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (templateId: string) => setDefaultTemplate({ data: { templateId } }),
    onSuccess: () => {
      toast.success("Template marcado como padrão");
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createNewMutation = useMutation({
    mutationFn: async () => {
      // Duplica o template padrão como base para um novo
      const def = templates?.find((t) => t.is_default) ?? templates?.[0];
      if (!def) throw new Error("Nenhum template base encontrado");
      return duplicateTemplate({ data: { templateId: def.id } });
    },
    onSuccess: ({ templateId }) => {
      toast.success("Novo template criado");
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
      navigate({ to: "/app/configuracoes/templates/$id", params: { id: templateId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Templates de Proposta"
        subtitle="Modelos padronizados de capa, contracapa, cores e textos fixos. Ao gerar uma proposta, o template padrão é aplicado automaticamente."
        actions={
          <Button
            size="sm"
            onClick={() => createNewMutation.mutate()}
            disabled={createNewMutation.isPending || isLoading}
          >
            {createNewMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Novo template
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando templates…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates?.map((t) => {
            const logoAsset = t.proposal_template_assets?.find(
              (a: { asset_kind: string }) => a.asset_kind === "logo",
            );
            const logoUrl = logoAsset
              ? supabase.storage
                  .from("proposal-template-assets")
                  .getPublicUrl(logoAsset.storage_path).data.publicUrl
              : null;
            const pages = (t.pages_config as Array<{ visible: boolean }>) ?? [];
            const visibleCount = pages.filter((p) => p.visible).length;

            return (
              <div
                key={t.id}
                className="group rounded-xl border bg-card p-5 shadow-[var(--shadow-sm)] transition hover:shadow-md"
              >
                <Link
                  to="/app/configuracoes/templates/$id"
                  params={{ id: t.id }}
                  className="block"
                >
                  <div className="mb-4 flex h-24 items-center justify-center rounded-lg bg-secondary/40 p-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={t.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{t.name}</h3>
                    {t.is_default && (
                      <Badge className="gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
                        <Star className="h-3 w-3 fill-current" /> Padrão
                      </Badge>
                    )}
                  </div>
                  {t.description && (
                    <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {visibleCount} páginas
                    </span>
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      {t.proposal_template_assets?.length ?? 0} imagens
                    </span>
                    <span
                      className="ml-auto inline-block h-3 w-3 rounded-full border"
                      style={{ backgroundColor: t.primary_color }}
                      title={`Cor primária: ${t.primary_color}`}
                    />
                  </div>
                </Link>

                <div className="mt-4 flex items-center gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" asChild className="flex-1">
                    <Link to="/app/configuracoes/templates/$id" params={{ id: t.id }}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => duplicateMutation.mutate(t.id)}
                    disabled={duplicateMutation.isPending}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Duplicar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!t.is_default && (
                        <DropdownMenuItem onClick={() => setDefaultMutation.mutate(t.id)}>
                          <Star className="mr-2 h-4 w-4" /> Marcar como padrão
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => duplicateMutation.mutate(t.id)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
