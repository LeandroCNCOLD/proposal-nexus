import { useMemo } from "react";
import type {
  DocumentPage,
  CoverData,
  ContextData,
  SolutionData,
  ScopeItem,
} from "@/integrations/proposal-editor/types";
import type {
  ProposalTemplate,
  TemplateAsset,
} from "@/integrations/proposal-editor/template.types";
import type { ProposalTable } from "@/features/proposal-editor/proposal-tables.types";
import { getTablesForPage } from "@/features/proposal-editor/proposal-tables.selectors";

interface PreviewState {
  cover_data: CoverData;
  context_data: ContextData;
  solution_data: SolutionData;
  scope_items: ScopeItem[];
  warranty_text: { html?: string; text?: string };
  custom_blocks?: Record<string, unknown>;
  attached_pdf_paths?: string[];
}

interface Props {
  pages: DocumentPage[];
  selectedId: string | null;
  state: PreviewState;
  template: ProposalTemplate | null;
  templateAssets: TemplateAsset[];
  tables: ProposalTable[];
  onSelectPage?: (pageId: string) => void;
}

/**
 * Preview A4 em DOM, fiel à estrutura do ProposalDocumentPdf.
 * Reage em tempo real ao estado local do editor (sem ida ao servidor).
 *
 * - Renderiza páginas visíveis em ordem
 * - Aplica cores do template (primary/accent)
 * - Header/footer simulados em todas as páginas técnicas
 * - Suporta tipos: cover, about, cases/clientes, solution, context, scope,
 *   caracteristicas, equipamento, investimento, impostos, pagamento,
 *   contracapa, attached-pdf, warranty, custom-rich, differentials, impact, nota
 */
export function ProposalPreviewA4({
  pages,
  selectedId,
  state,
  template,
  templateAssets,
  tables,
  onSelectPage,
}: Props) {
  const visible = useMemo(
    () => pages.filter((p) => p.visible).sort((a, b) => a.order - b.order),
    [pages],
  );

  const palette = useMemo(
    () => ({
      primary: template?.primary_color || "#0F172A",
      accent: template?.accent_color || "#3B82F6",
      accent2: template?.accent_color_2 || "#1E40AF",
    }),
    [template],
  );

  const assetByKind = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const a of templateAssets) map[a.asset_kind] = a.url;
    return map;
  }, [templateAssets]);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="border-b bg-background px-4 py-2 text-xs text-muted-foreground">
        Preview A4 (DOM) · {visible.length}{" "}
        {visible.length === 1 ? "página" : "páginas"} · ao vivo
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {visible.map((page, idx) => (
            <PageSheet
              key={page.id}
              page={page}
              pageNumber={idx + 1}
              isSelected={selectedId === page.id}
              state={state}
              template={template}
              palette={palette}
              assetByKind={assetByKind}
              tables={tables}
              onClick={() => onSelectPage?.(page.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============= Página A4 =============

type Palette = { primary: string; accent: string; accent2: string };

function PageSheet({
  page,
  pageNumber,
  isSelected,
  state,
  template,
  palette,
  assetByKind,
  tables,
  onClick,
}: {
  page: DocumentPage;
  pageNumber: number;
  isSelected: boolean;
  state: PreviewState;
  template: ProposalTemplate | null;
  palette: Palette;
  assetByKind: Record<string, string | undefined>;
  tables: ProposalTable[];
  onClick: () => void;
}) {
  const fullByType: Record<string, string | undefined> = {
    cover: assetByKind.cover_full,
    about: assetByKind.about_full,
    cases: assetByKind.clients_full,
    clientes: assetByKind.clients_full,
  };
  const fullImageSrc = fullByType[page.type];

  // Páginas com imagem A4 inteira: render bleed-to-edge
  if (fullImageSrc) {
    return (
      <PageFrame isSelected={isSelected} onClick={onClick} title={page.title}>
        <img
          src={fullImageSrc}
          alt={page.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </PageFrame>
    );
  }

  if (page.type === "cover") {
    return (
      <PageFrame isSelected={isSelected} onClick={onClick} title={page.title}>
        <CoverContent state={state} palette={palette} template={template} />
      </PageFrame>
    );
  }

  // Páginas com header/footer
  const pageTables = getTablesForPage(tables, page.id, page.type);

  return (
    <PageFrame isSelected={isSelected} onClick={onClick} title={page.title}>
      <div className="flex h-full flex-col">
        <Header palette={palette} template={template} pageTitle={page.title} logoUrl={assetByKind.logo} bannerUrl={assetByKind.header_banner} />
        <div className="flex-1 overflow-hidden px-10 py-4">
          <PageTitle title={page.title} palette={palette} />
          <PageBody
            page={page}
            state={state}
            tables={pageTables}
            palette={palette}
          />
        </div>
        <Footer palette={palette} template={template} pageNumber={pageNumber} bannerUrl={assetByKind.footer_banner} />
      </div>
    </PageFrame>
  );
}

function PageFrame({
  children,
  isSelected,
  onClick,
  title,
}: {
  children: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative aspect-[1/1.414] w-full cursor-pointer overflow-hidden rounded-lg border bg-white shadow-md outline-none transition-all hover:shadow-lg ${
        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <div className="absolute right-3 top-3 z-10 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-white">
        {title}
      </div>
      {children}
    </div>
  );
}

// ============= Header / Footer =============

function Header({
  palette,
  template,
  pageTitle,
  logoUrl,
  bannerUrl,
}: {
  palette: Palette;
  template: ProposalTemplate | null;
  pageTitle: string;
  logoUrl?: string;
  bannerUrl?: string;
}) {
  if (bannerUrl) {
    return (
      <div className="relative h-[58px] shrink-0">
        <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 flex h-full items-end justify-between px-10 pb-1 text-white">
          <div className="text-[8px] uppercase tracking-widest opacity-90">{template?.empresa_nome ?? "CN COLD"}</div>
          <div className="text-[8px] uppercase tracking-widest opacity-90">{pageTitle}</div>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex h-[58px] shrink-0 items-end justify-between px-10 pb-2"
      style={{ borderBottom: `2px solid ${palette.accent}` }}
    >
      <div className="flex items-center gap-2">
        {logoUrl ? <img src={logoUrl} alt="logo" className="h-6" /> : null}
        <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: palette.primary }}>
          {template?.empresa_nome ?? "CN COLD"}
        </div>
      </div>
      <div className="text-[8px] uppercase tracking-widest" style={{ color: palette.primary }}>
        {pageTitle}
      </div>
    </div>
  );
}

function Footer({
  palette,
  template,
  pageNumber,
  bannerUrl,
}: {
  palette: Palette;
  template: ProposalTemplate | null;
  pageNumber: number;
  bannerUrl?: string;
}) {
  if (bannerUrl) {
    return (
      <div className="relative h-[42px] shrink-0">
        <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 flex h-full items-center justify-between px-10 text-[8px] text-white">
          <span>{template?.empresa_site ?? ""}</span>
          <span>Página {pageNumber}</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex h-[42px] shrink-0 items-center justify-between px-10 text-[8px]"
      style={{ borderTop: `1px solid ${palette.accent}`, color: palette.primary }}
    >
      <span>{template?.empresa_site ?? ""}</span>
      <span>{template?.empresa_telefone ?? ""}</span>
      <span>Página {pageNumber}</span>
    </div>
  );
}

function PageTitle({ title, palette }: { title: string; palette: Palette }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold" style={{ color: palette.primary }}>
        {title}
      </h2>
      <div className="mt-1 h-[2px] w-12" style={{ background: palette.accent }} />
    </div>
  );
}

// ============= Capa =============

function CoverContent({
  state,
  palette,
  template,
}: {
  state: PreviewState;
  palette: Palette;
  template: ProposalTemplate | null;
}) {
  const cover = state.cover_data ?? {};
  return (
    <div
      className="flex h-full flex-col justify-between p-12 text-white"
      style={{
        background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent2})`,
      }}
    >
      <div className="text-xl font-bold tracking-widest opacity-90">
        {template?.empresa_nome ?? "CN COLD"}
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.3em] opacity-70">
          {template?.capa_tagline ?? "Proposta comercial"}
        </div>
        <div className="text-3xl font-bold leading-tight">
          {cover.projeto || template?.capa_titulo || "Projeto"}
        </div>
        <div className="text-base opacity-80">{cover.cliente || "Cliente"}</div>
        <div className="text-xs opacity-60">
          Proposta {cover.numero || "—"} · {cover.data || "—"}
        </div>
      </div>
      <div className="text-[10px] opacity-60">
        {cover.responsavel ? `Responsável: ${cover.responsavel}` : ""}
      </div>
    </div>
  );
}

// ============= Corpo da página por tipo =============

function PageBody({
  page,
  state,
  tables,
  palette,
}: {
  page: DocumentPage;
  state: PreviewState;
  tables: ProposalTable[];
  palette: Palette;
}) {
  const ctx = state.context_data ?? {};
  const sol = state.solution_data ?? {};
  const scope = state.scope_items ?? [];
  const customBlocks = (state.custom_blocks ?? {}) as Record<string, string | undefined>;

  switch (page.type) {
    case "about":
      return (
        <Prose>
          Conteúdo institucional. Use o painel à esquerda para personalizar
          parágrafos, diferenciais e cases.
        </Prose>
      );
    case "cases":
    case "clientes":
      return <Prose>Galeria de cases / clientes do template.</Prose>;
    case "solution":
      return (
        <div className="space-y-2 text-[10px] leading-relaxed text-slate-700">
          {sol.intro ? <p>{sol.intro}</p> : <Empty>Adicione a introdução da solução.</Empty>}
          {sol.contempla && sol.contempla.length > 0 ? (
            <BulletList items={sol.contempla} title="Contempla" palette={palette} />
          ) : null}
          {sol.diferenciais && sol.diferenciais.length > 0 ? (
            <BulletList items={sol.diferenciais} title="Diferenciais" palette={palette} />
          ) : null}
          {sol.impacto && sol.impacto.length > 0 ? (
            <BulletList items={sol.impacto} title="Impacto" palette={palette} />
          ) : null}
          {sol.conclusao ? <p className="italic">{sol.conclusao}</p> : null}
        </div>
      );
    case "context":
      return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px]">
          <Field label="Razão social" value={ctx.cliente_razao} />
          <Field label="Fantasia" value={ctx.fantasia} />
          <Field label="CNPJ" value={ctx.cnpj} />
          <Field label="Endereço" value={ctx.endereco} />
        </dl>
      );
    case "scope":
      return scope.length === 0 ? (
        <Empty>Sincronize do Nomus ou adicione itens.</Empty>
      ) : (
        <ul className="space-y-1 text-[10px]">
          {scope.slice(0, 14).map((item, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between border-b py-1"
              style={{ borderColor: `${palette.accent}30` }}
            >
              <span className="font-medium">{item.titulo || `Item ${i + 1}`}</span>
              {item.quantidade ? (
                <span className="text-slate-500">
                  {item.quantidade} {item.unidade ?? ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      );
    case "caracteristicas":
    case "equipamento":
    case "investimento":
    case "impostos":
    case "pagamento":
      return <TablesView tables={tables} palette={palette} />;
    case "contracapa":
      return (
        <div className="space-y-3 text-[10px] text-slate-700">
          <Section title="Prazo de entrega" palette={palette}>
            {customBlocks.prazo_entrega_texto ?? <Empty>Defina o prazo no painel.</Empty>}
          </Section>
          <Section title="Garantia" palette={palette}>
            {state.warranty_text?.text || state.warranty_text?.html?.replace(/<[^>]+>/g, "") || (
              <Empty>Edite o texto de garantia.</Empty>
            )}
          </Section>
          <Section title="Observações finais" palette={palette}>
            {customBlocks.nota_final_texto ?? <Empty>Sem observação.</Empty>}
          </Section>
        </div>
      );
    case "attached-pdf":
      return (
        <div className="space-y-2 text-[10px]">
          <p className="text-slate-600">Anexos vinculados a esta proposta:</p>
          {(state.attached_pdf_paths ?? []).length === 0 ? (
            <Empty>Nenhum anexo. Use o painel “Anexos” para adicionar.</Empty>
          ) : (
            <ul className="list-decimal space-y-1 pl-4">
              {(state.attached_pdf_paths ?? []).map((p) => (
                <li key={p} className="break-all text-slate-700">
                  {p.split("/").pop()}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "warranty":
    case "prazo-garantia":
      return (
        <Prose>
          {state.warranty_text?.text ||
            state.warranty_text?.html?.replace(/<[^>]+>/g, "") ||
            "Edite o texto de garantia no painel ao lado."}
        </Prose>
      );
    case "custom-rich":
      return (
        <div
          className="prose prose-sm max-w-none text-[10px] text-slate-700"
          dangerouslySetInnerHTML={{
            __html: (page.content?.html as string) || "<p><em>Página em branco.</em></p>",
          }}
        />
      );
    case "differentials":
      return <Prose>Diferenciais (do template).</Prose>;
    case "impact": {
      const items = (page.content?.items as Array<{ kpi?: string; valor?: string; descricao?: string }> | undefined) ?? [];
      return items.length === 0 ? (
        <Empty>Sem KPIs configurados.</Empty>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {items.map((it, i) => (
            <div key={i} className="rounded border p-3" style={{ borderColor: `${palette.accent}40` }}>
              <div className="text-base font-bold" style={{ color: palette.primary }}>
                {it.valor || "—"}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{it.kpi}</div>
              {it.descricao ? <div className="mt-1 text-[9px] text-slate-600">{it.descricao}</div> : null}
            </div>
          ))}
        </div>
      );
    }
    case "nota":
      return <Prose>{(page.content?.text as string) || "Adicione o texto da nota."}</Prose>;
    case "custom-block":
      return <Empty>Bloco do catálogo (rendered no PDF).</Empty>;
    default:
      return <Empty>Tipo de página: {page.type}</Empty>;
  }
}

// ============= Render de tabelas =============

function TablesView({ tables, palette }: { tables: ProposalTable[]; palette: Palette }) {
  if (tables.length === 0) {
    return <Empty>Nenhuma tabela vinculada. Adicione no painel à esquerda.</Empty>;
  }
  return (
    <div className="space-y-3">
      {tables.map((t) => (
        <TableBlock key={t.id} table={t} palette={palette} />
      ))}
    </div>
  );
}

function TableBlock({ table, palette }: { table: ProposalTable; palette: Palette }) {
  const columns = (table.settings?.columns ?? []) as Array<{
    key: string;
    label: string;
    align?: "left" | "right" | "center";
    type?: string;
    width?: number;
    computed?: boolean;
  }>;
  const rows = table.rows ?? [];

  const fmt = (v: unknown, type?: string) => {
    if (v == null || v === "") return "—";
    if (type === "currency") {
      const n = Number(v);
      if (Number.isNaN(n)) return String(v);
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    if (type === "number") {
      const n = Number(v);
      return Number.isNaN(n) ? String(v) : n.toLocaleString("pt-BR");
    }
    return String(v);
  };

  return (
    <div>
      {table.title ? (
        <div className="mb-1 text-[10px] font-semibold" style={{ color: palette.primary }}>
          {table.title}
        </div>
      ) : null}
      {table.subtitle ? (
        <div className="mb-1 text-[9px] text-slate-500">{table.subtitle}</div>
      ) : null}
      <div className="overflow-hidden rounded border text-[9px]" style={{ borderColor: `${palette.accent}40` }}>
        <table className="w-full table-fixed">
          {columns.length > 0 && table.settings?.show_header !== false ? (
            <thead>
              <tr style={{ background: palette.primary, color: "white" }}>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-2 py-1 text-left font-semibold"
                    style={{ textAlign: c.align ?? "left" }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-2 py-2 text-center text-slate-400">
                  Sem linhas
                </td>
              </tr>
            ) : (
              rows.slice(0, 12).map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-white" : ""}
                  style={i % 2 ? { background: `${palette.accent}10` } : undefined}
                >
                  {columns.map((c) => {
                    let cellValue: unknown = row[c.key];
                    if (c.computed && c.key === "valor_total") {
                      cellValue =
                        Number(row.quantidade ?? 0) * Number(row.valor_unitario ?? 0);
                    }
                    return (
                      <td
                        key={c.key}
                        className="px-2 py-1"
                        style={{ textAlign: c.align ?? "left" }}
                      >
                        {fmt(cellValue, c.type)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {rows.length > 12 ? (
          <div className="border-t bg-slate-50 px-2 py-1 text-center text-[8px] text-slate-500">
            + {rows.length - 12} linha(s) ocultas no preview
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============= Helpers visuais =============

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-[8px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd>{value || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] leading-relaxed text-slate-700">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] italic text-slate-400">{children}</p>;
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: Palette;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: palette.accent2 }}
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function BulletList({
  items,
  title,
  palette,
}: {
  items: string[];
  title: string;
  palette: Palette;
}) {
  return (
    <div>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: palette.accent2 }}>
        {title}
      </div>
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
