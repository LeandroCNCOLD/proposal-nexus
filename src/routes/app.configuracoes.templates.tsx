import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { FileText, Image as ImageIcon, Star } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
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

  return (
    <>
      <PageHeader
        title="Templates de Proposta"
        subtitle="Modelos padronizados de capa, contracapa, cores e textos fixos. Ao gerar uma proposta, o template padrão é aplicado automaticamente."
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
              <Link
                key={t.id}
                to="/app/configuracoes/templates"
                className="group rounded-xl border bg-card p-5 shadow-[var(--shadow-sm)] transition hover:shadow-md"
              >
                <div className="mb-4 flex h-24 items-center justify-center rounded-lg bg-secondary/40 p-4">
                  {logoUrl ? (
                    <img src={logoUrl} alt={t.name} className="max-h-full max-w-full object-contain" />
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
                  <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{t.description}</p>
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
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
        <strong className="text-foreground">Próxima etapa:</strong> editor completo de
        template (substituir imagens, editar textos das páginas Sobre/Cases/Garantia, criar
        novos templates, marcar como padrão) e redesign fiel ao PDF das 13 páginas geradas.
        O template Padrão CN Cold já está cadastrado e será aplicado em novas propostas.
      </div>
    </>
  );
}
