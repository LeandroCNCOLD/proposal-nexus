import type { DocumentPage } from "@/integrations/proposal-editor/types";

interface Props {
  pages: DocumentPage[];
  selectedId: string | null;
  documentData: {
    cover_data?: Record<string, unknown>;
    context_data?: Record<string, unknown>;
    scope_items?: Array<Record<string, unknown>>;
  };
}

/**
 * Preview placeholder paginado A4. Será substituído pelo render real
 * com @react-pdf/renderer na Etapa 3.
 */
export function EditorPreviewStub({ pages, selectedId, documentData }: Props) {
  const visible = pages.filter((p) => p.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="border-b bg-background px-4 py-2 text-xs text-muted-foreground">
        Preview · {visible.length} {visible.length === 1 ? "página" : "páginas"} visíveis
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {visible.map((page) => (
            <PagePreviewCard
              key={page.id}
              page={page}
              isSelected={selectedId === page.id}
              documentData={documentData}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PagePreviewCard({
  page,
  isSelected,
  documentData,
}: {
  page: DocumentPage;
  isSelected: boolean;
  documentData: Props["documentData"];
}) {
  const cover = documentData.cover_data ?? {};
  const ctx = documentData.context_data ?? {};
  const scope = documentData.scope_items ?? [];

  return (
    <div
      id={`page-${page.id}`}
      className={`relative aspect-[1/1.414] w-full overflow-hidden rounded-lg border bg-white shadow-md transition-all ${
        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <div className="absolute right-3 top-3 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono text-white">
        {page.title}
      </div>

      {page.type === "cover" && (
        <div className="flex h-full flex-col justify-between bg-gradient-to-br from-slate-900 to-slate-700 p-12 text-white">
          <div className="text-2xl font-bold tracking-wide">CN COLD</div>
          <div className="space-y-2">
            <div className="text-3xl font-bold">{(cover.projeto as string) || "Projeto"}</div>
            <div className="text-lg opacity-80">{(cover.cliente as string) || "Cliente"}</div>
            <div className="text-sm opacity-60">
              Proposta {(cover.numero as string) || "—"} · {(cover.data as string) || "—"}
            </div>
          </div>
          <div className="text-xs opacity-60">{(cover.responsavel as string) || ""}</div>
        </div>
      )}

      {page.type === "about" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">Sobre a CN Cold</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Conteúdo institucional fixo da CN Cold. Será editável e renderizado em PDF na Etapa 3.
          </p>
        </div>
      )}

      {page.type === "cases" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">Cases de sucesso</h2>
          <p className="text-sm text-slate-600">Galeria de cases. Editável na Etapa 2.</p>
        </div>
      )}

      {page.type === "solution" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">Nossa solução</h2>
          <p className="text-sm text-slate-600">
            Introdução · Contempla · Diferenciais · Impacto · Conclusão. Editor rich-text na Etapa 2.
          </p>
        </div>
      )}

      {page.type === "context" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">Contextualização</h2>
          <dl className="space-y-2 text-sm">
            <Field label="Razão social" value={ctx.cliente_razao as string} />
            <Field label="Fantasia" value={ctx.fantasia as string} />
            <Field label="CNPJ" value={ctx.cnpj as string} />
            <Field label="Endereço" value={ctx.endereco as string} />
          </dl>
        </div>
      )}

      {page.type === "scope" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">Escopo de fornecimento</h2>
          {scope.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum item. Use "Sincronizar do Nomus" para popular automaticamente.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {scope.slice(0, 8).map((item, i) => (
                <li key={i} className="border-b py-1">
                  <span className="font-medium">{(item.titulo as string) || `Item ${i + 1}`}</span>
                  {item.quantidade ? (
                    <span className="ml-2 text-slate-500">
                      · {String(item.quantidade)} {(item.unidade as string) || ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {page.type === "warranty" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">Garantia</h2>
          <p className="text-sm text-slate-600">Texto editável na Etapa 2.</p>
        </div>
      )}

      {page.type === "custom-rich" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">{page.title}</h2>
          <p className="text-sm text-slate-500">Página em branco para conteúdo livre.</p>
        </div>
      )}

      {page.type === "custom-block" && (
        <div className="p-12 text-slate-800">
          <h2 className="mb-4 text-2xl font-bold">{page.title}</h2>
          <p className="text-sm text-slate-500">Bloco do catálogo (Etapa 5).</p>
        </div>
      )}

      {page.type === "attached-pdf" && (
        <div className="flex h-full flex-col items-center justify-center bg-slate-100 p-12 text-slate-600">
          <div className="text-lg font-semibold">{page.title}</div>
          <div className="mt-2 text-sm">PDF externo será mesclado no documento final.</div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-sm">{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}
