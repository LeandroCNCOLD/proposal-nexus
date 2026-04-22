import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Database, CheckCircle2, AlertCircle, Circle } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes/api-nomus")({
  component: ApiNomusCatalogPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  comercial: "Comercial",
  estoque: "Estoque & Produtos",
  faturamento: "Faturamento",
  financeiro: "Financeiro",
  producao: "Produção",
  cadastro: "Cadastros Gerais",
};

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  validated: { label: "Validado", icon: CheckCircle2, className: "text-emerald-600" },
  to_confirm: { label: "A confirmar", icon: AlertCircle, className: "text-amber-600" },
  unknown: { label: "Não verificado", icon: Circle, className: "text-muted-foreground" },
};

function ApiNomusCatalogPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["nomus-api-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nomus_api_catalog")
        .select("*")
        .order("category", { ascending: true })
        .order("module_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    modules.forEach((m) => m.category && set.add(m.category));
    return Array.from(set);
  }, [modules]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return modules.filter((m) => {
      if (activeCategory !== "all" && m.category !== activeCategory) return false;
      if (!term) return true;
      const haystack = [
        m.module_name,
        m.module_key,
        m.endpoint_path,
        m.description,
        ...(Array.isArray(m.fields) ? (m.fields as string[]) : []),
        ...(m.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [modules, search, activeCategory]);

  const totalUsed = modules.filter((m) => m.is_used_in_app).length;

  return (
    <>
      <PageHeader
        title="Catálogo da API Nomus"
        subtitle="Referência interna de todos os módulos disponíveis na integração com o Nomus ERP."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 mb-6">
        <StatBox icon={Database} label="Módulos catalogados" value={String(modules.length)} />
        <StatBox icon={CheckCircle2} label="Já usados na plataforma" value={String(totalUsed)} />
        <StatBox icon={AlertCircle} label="Categorias" value={String(categories.length)} />
        <StatBox
          icon={Circle}
          label="Endpoints REST"
          value={String(new Set(modules.map((m) => m.endpoint_path)).size)}
        />
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, endpoint, campo ou tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {filtered.length} de {modules.length} módulos
          </p>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {CATEGORY_LABELS[cat] ?? cat}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando catálogo...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum módulo encontrado.</p>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {filtered.map((m) => {
                  const statusMeta = STATUS_META[m.status] ?? STATUS_META.unknown;
                  const StatusIcon = statusMeta.icon;
                  const fields = Array.isArray(m.fields) ? (m.fields as string[]) : [];
                  return (
                    <AccordionItem
                      key={m.id}
                      value={m.id}
                      className="rounded-lg border bg-background px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                          <div className="flex items-center gap-3 text-left">
                            <StatusIcon className={`h-4 w-4 shrink-0 ${statusMeta.className}`} />
                            <div>
                              <div className="font-medium text-sm">{m.module_name}</div>
                              <code className="text-[11px] text-muted-foreground">
                                {m.http_method} {m.endpoint_path}
                              </code>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {m.is_used_in_app && (
                              <Badge variant="secondary" className="text-[10px]">
                                em uso
                              </Badge>
                            )}
                            {m.observed_count != null && (
                              <Badge variant="outline" className="text-[10px]">
                                {m.observed_count} registros
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {fields.length} campos
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {m.description && (
                            <p className="text-sm text-muted-foreground">{m.description}</p>
                          )}

                          {m.tags && m.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {m.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Campos retornados ({fields.length})
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {fields.map((f) => (
                                <code
                                  key={f}
                                  className="rounded bg-muted px-1.5 py-0.5 text-[11px]"
                                >
                                  {f}
                                </code>
                              ))}
                            </div>
                          </div>

                          {m.sample_payload != null && (
                            <div>
                              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Exemplo de payload
                              </h4>
                              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                                {JSON.stringify(m.sample_payload, null, 2)}
                              </pre>
                            </div>
                          )}

                          {m.notes && (
                            <div>
                              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Observações
                              </h4>
                              <p className="text-sm">{m.notes}</p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
