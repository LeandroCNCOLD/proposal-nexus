import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Star, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FullPageImageUploader } from "@/components/template-editor/FullPageImageUploader";
import { StructuredListEditor } from "@/components/template-editor/StructuredListEditor";
import {
  getTemplate,
  updateTemplate,
  setDefaultTemplate,
} from "@/integrations/proposal-editor/template.functions";
import type {
  ProposalTemplate,
  TemplateBancario,
  TemplateCaseItem,
  TemplateDiferencial,
  TemplateGarantiaItem,
} from "@/integrations/proposal-editor/template.types";

export const Route = createFileRoute("/app/configuracoes/templates/$id")({
  component: TemplateEditorPage,
});

function TemplateEditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["proposal-template", id],
    queryFn: () => getTemplate({ data: { templateId: id } }),
  });

  const [form, setForm] = useState<ProposalTemplate | null>(null);

  useEffect(() => {
    if (data?.template) setForm(data.template);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<ProposalTemplate>) =>
      updateTemplate({ data: { templateId: id, patch: patch as never } }),
    onSuccess: () => {
      toast.success("Template salvo");
      qc.invalidateQueries({ queryKey: ["proposal-template", id] });
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: () => setDefaultTemplate({ data: { templateId: id } }),
    onSuccess: () => {
      toast.success("Template marcado como padrão");
      qc.invalidateQueries({ queryKey: ["proposal-template", id] });
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando template…
      </div>
    );
  }

  const update = <K extends keyof ProposalTemplate>(key: K, value: ProposalTemplate[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = () => {
    saveMutation.mutate({
      name: form.name,
      description: form.description,
      primary_color: form.primary_color,
      accent_color: form.accent_color,
      accent_color_2: form.accent_color_2,
      empresa_nome: form.empresa_nome,
      empresa_cidade: form.empresa_cidade,
      empresa_telefone: form.empresa_telefone,
      empresa_email: form.empresa_email,
      empresa_site: form.empresa_site,
      capa_titulo: form.capa_titulo,
      capa_subtitulo: form.capa_subtitulo,
      capa_tagline: form.capa_tagline,
      sobre_titulo: form.sobre_titulo,
      sobre_paragrafos: form.sobre_paragrafos,
      cases_titulo: form.cases_titulo,
      cases_subtitulo: form.cases_subtitulo,
      clientes_titulo: form.clientes_titulo,
      clientes_lista: form.clientes_lista,
      garantia_texto: form.garantia_texto,
      prazo_entrega_padrao: form.prazo_entrega_padrao,
      validade_padrao_dias: form.validade_padrao_dias,
    });
  };

  return (
    <>
      <PageHeader
        title={form.name}
        subtitle="Editor de template de proposta"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/configuracoes/templates">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Link>
            </Button>
            {!form.is_default && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDefaultMutation.mutate()}
                disabled={setDefaultMutation.isPending}
              >
                <Star className="mr-1 h-4 w-4" /> Marcar como padrão
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        }
      />

      {form.is_default && (
        <Badge className="mb-4 gap-1 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">
          <Star className="h-3 w-3 fill-current" /> Template padrão atual
        </Badge>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="brand">Marca</TabsTrigger>
          <TabsTrigger value="cover">Capa</TabsTrigger>
          <TabsTrigger value="about">Sobre</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="warranty">Garantia</TabsTrigger>
          <TabsTrigger value="assets">Imagens</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Nome do template</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Prazo de entrega padrão</Label>
                <Input
                  value={form.prazo_entrega_padrao ?? ""}
                  onChange={(e) => update("prazo_entrega_padrao", e.target.value)}
                  placeholder="Ex.: 30 dias úteis"
                />
              </div>
              <div className="space-y-2">
                <Label>Validade padrão (dias)</Label>
                <Input
                  type="number"
                  value={form.validade_padrao_dias ?? ""}
                  onChange={(e) =>
                    update("validade_padrao_dias", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="brand" className="mt-4 space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Cores</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {(["primary_color", "accent_color", "accent_color_2"] as const).map((key) => (
                <div key={key} className="space-y-2">
                  <Label className="capitalize">{key.replace(/_/g, " ")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={form[key]}
                      onChange={(e) => update(key, e.target.value)}
                      className="h-10 w-16 p-1"
                    />
                    <Input value={form[key]} onChange={(e) => update(key, e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Dados da empresa</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.empresa_nome}
                  onChange={(e) => update("empresa_nome", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={form.empresa_cidade}
                  onChange={(e) => update("empresa_cidade", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.empresa_telefone}
                  onChange={(e) => update("empresa_telefone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  value={form.empresa_email}
                  onChange={(e) => update("empresa_email", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Site</Label>
                <Input
                  value={form.empresa_site}
                  onChange={(e) => update("empresa_site", e.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Cabeçalho e rodapé das páginas internas</h3>
            <p className="text-xs text-muted-foreground">
              Estas faixas aparecem no topo e na base de todas as páginas de conteúdo
              (depois de Capa, Sobre e Clientes). Quando você envia uma imagem, ela
              substitui a faixa azul padrão.
            </p>
            <FullPageImageUploader
              templateId={id}
              assetKind="header_banner"
              title="Faixa de cabeçalho"
              description="Imagem horizontal exibida no topo de cada página interna (54px de altura). Use uma faixa larga em PNG/JPG."
              current={data?.assets?.find((a) => a.asset_kind === "header_banner")}
              aspect="banner"
            />
            <FullPageImageUploader
              templateId={id}
              assetKind="footer_banner"
              title="Faixa de rodapé"
              description="Imagem horizontal exibida na base de cada página interna (48px de altura). Quando ausente, é usado o rodapé azul com telefone, site, e-mail e cidade."
              current={data?.assets?.find((a) => a.asset_kind === "footer_banner")}
              aspect="banner"
            />
          </Card>
        </TabsContent>

        <TabsContent value="cover" className="mt-4 space-y-4">
          <FullPageImageUploader
            templateId={id}
            assetKind="cover_full"
            title="Imagem da capa (página inteira)"
            description="Envie a arte completa da capa em A4. Quando presente, ela substitui o layout dinâmico — os campos abaixo (título, subtítulo, tagline) ficam ignorados no PDF."
            current={data?.assets?.find((a) => a.asset_kind === "cover_full")}
          />
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Layout dinâmico (usado quando não há imagem de capa)</h3>
            <div className="space-y-2">
              <Label>Título da capa</Label>
              <Input
                value={form.capa_titulo ?? ""}
                onChange={(e) => update("capa_titulo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input
                value={form.capa_subtitulo ?? ""}
                onChange={(e) => update("capa_subtitulo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input
                value={form.capa_tagline ?? ""}
                onChange={(e) => update("capa_tagline", e.target.value)}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="mt-4 space-y-4">
          <FullPageImageUploader
            templateId={id}
            assetKind="about_full"
            title="Imagem da página Sobre / Apresentação"
            description="Envie a arte completa da página Sobre em A4. Quando presente, substitui o layout dinâmico desta seção no PDF."
            current={data?.assets?.find((a) => a.asset_kind === "about_full")}
          />
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Layout dinâmico (usado quando não há imagem)</h3>
            <div className="space-y-2">
              <Label>Título da seção "Sobre"</Label>
              <Input
                value={form.sobre_titulo ?? ""}
                onChange={(e) => update("sobre_titulo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Parágrafos (um por linha)</Label>
              <Textarea
                rows={10}
                value={(form.sobre_paragrafos ?? []).join("\n\n")}
                onChange={(e) =>
                  update(
                    "sobre_paragrafos",
                    e.target.value.split(/\n\n+/).map((s) => s.trim()).filter(Boolean),
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Separe os parágrafos com uma linha em branco.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-4 space-y-4">
          <FullPageImageUploader
            templateId={id}
            assetKind="clients_full"
            title="Imagem da página Clientes / Cases"
            description="Envie a arte completa da página de Clientes/Cases em A4. Quando presente, substitui o layout dinâmico desta seção no PDF."
            current={data?.assets?.find((a) => a.asset_kind === "clients_full")}
          />
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Layout dinâmico (usado quando não há imagem)</h3>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={form.clientes_titulo ?? ""}
                onChange={(e) => update("clientes_titulo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Lista de clientes (um por linha)</Label>
              <Textarea
                rows={12}
                value={(form.clientes_lista ?? []).join("\n")}
                onChange={(e) =>
                  update(
                    "clientes_lista",
                    e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  )
                }
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="warranty" className="mt-4 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="space-y-2">
              <Label>Texto da garantia</Label>
              <Textarea
                rows={10}
                value={form.garantia_texto ?? ""}
                onChange={(e) => update("garantia_texto", e.target.value)}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="mt-4 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Imagens do template</h3>
              <span className="text-xs text-muted-foreground">
                {data?.assets?.length ?? 0} imagens
              </span>
            </div>
            {data?.assets && data.assets.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {data.assets.map((asset) => (
                  <div key={asset.id} className="rounded-lg border p-2">
                    <div className="flex h-32 items-center justify-center rounded bg-secondary/30 overflow-hidden">
                      <img
                        src={asset.url}
                        alt={asset.label ?? asset.asset_kind}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="mt-2 text-xs">
                      <div className="font-medium truncate">{asset.label ?? asset.asset_kind}</div>
                      <div className="text-muted-foreground">{asset.asset_kind}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                Nenhuma imagem cadastrada para este template.
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Upload e substituição de imagens será adicionado na próxima etapa.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/configuracoes/templates" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para templates
        </Button>
      </div>
    </>
  );
}
