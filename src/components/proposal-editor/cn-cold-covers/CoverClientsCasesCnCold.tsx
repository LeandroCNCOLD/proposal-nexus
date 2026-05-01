/**
 * Capa 3 — cover_clients_cases_cn_cold.
 * Galeria de cases (1 destaque + grid) e logos de clientes, com nota de
 * uso de marcas e rodapé padrão.
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentBlock } from "@/integrations/proposal-editor/types";
import type { ProposalTemplate } from "@/integrations/proposal-editor/template.types";
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";
import { CN_COLD_PRIMARY, resolveCoverFooter } from "./use-cover-defaults";

interface Case {
  title: string;
  subtitle?: string;
  image_url?: string;
  featured?: boolean;
}

interface Props {
  block: DocumentBlock;
  setData: (patch: Record<string, unknown>) => void;
  locked?: boolean;
  template: ProposalTemplate | null;
  documentContext?: ProposalDocumentContext | null;
}

export function CoverClientsCasesCnCold({ block, setData, locked, template, documentContext }: Props) {
  const data = block.data ?? {};
  const footer = resolveCoverFooter(data, documentContext);
  const primary = (data.primary_color as string) || template?.primary_color || CN_COLD_PRIMARY;
  const title = (data.title as string) ?? "Soluções em Refrigeração Industrial";
  const subtitle =
    (data.subtitle as string) ?? "Engenharia • Fabricação • Instalação • Manutenção";
  const cases: Case[] = Array.isArray(data.cases) ? (data.cases as Case[]) : [];
  const logos: { url: string; name?: string }[] = Array.isArray(data.client_logos)
    ? (data.client_logos as { url: string; name?: string }[])
    : [];

  const featured = cases.find((c) => c.featured) ?? cases[0];
  const others = cases.filter((c) => c !== featured);

  const updateCase = (idx: number, patch: Partial<Case>) => {
    const next = [...cases];
    next[idx] = { ...next[idx], ...patch };
    setData({ cases: next });
  };
  const addCase = () =>
    setData({ cases: [...cases, { title: "Novo case", subtitle: "", image_url: "" }] });
  const addLogo = () => setData({ client_logos: [...logos, { url: "", name: "" }] });

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-50"
      style={{ fontFamily: "Inter, sans-serif" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${primary}, #1e90ff)` }} />

      <div className="px-10 pt-10">
        <Input
          value={title}
          disabled={locked}
          onChange={(e) => setData({ title: e.target.value })}
          className="h-auto border-none bg-transparent p-0 text-[30px] font-bold tracking-tight shadow-none focus-visible:ring-0"
          style={{ color: primary }}
        />
        <Input
          value={subtitle}
          disabled={locked}
          onChange={(e) => setData({ subtitle: e.target.value })}
          className="mt-1 h-auto border-none bg-transparent p-0 text-[14px] font-light text-slate-600 shadow-none focus-visible:ring-0"
        />
        <div className="mt-3 h-1 w-20" style={{ background: primary }} />
      </div>

      <div className="grid grid-cols-12 gap-5 px-10 pt-6">
        {/* Case destaque */}
        <div className="col-span-7 overflow-hidden rounded-lg bg-white shadow-md">
          <div className="aspect-[16/9] bg-slate-200">
            {featured?.image_url ? (
              <img src={featured.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Case em destaque
              </div>
            )}
          </div>
          <div className="p-4">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: primary }}
            >
              Case em Destaque
            </div>
            <Input
              value={featured?.title ?? ""}
              placeholder="Título do case"
              disabled={locked || !featured}
              onChange={(e) =>
                featured && updateCase(cases.indexOf(featured), { title: e.target.value })
              }
              className="mt-1 h-auto border-none bg-transparent p-0 text-[18px] font-bold text-slate-900 shadow-none focus-visible:ring-0"
            />
            <Textarea
              value={featured?.subtitle ?? ""}
              placeholder="Descrição breve"
              disabled={locked || !featured}
              onChange={(e) =>
                featured && updateCase(cases.indexOf(featured), { subtitle: e.target.value })
              }
              className="mt-1 min-h-[40px] resize-none border-none bg-transparent p-0 text-[12px] text-slate-600 shadow-none focus-visible:ring-0"
            />
            {!locked && featured ? (
              <Input
                value={featured.image_url ?? ""}
                placeholder="URL da imagem"
                onChange={(e) =>
                  updateCase(cases.indexOf(featured), { image_url: e.target.value })
                }
                className="mt-2 h-6 text-[10px]"
              />
            ) : null}
          </div>
        </div>

        {/* Grid de outros cases */}
        <div className="col-span-5 grid grid-cols-2 gap-3">
          {others.slice(0, 4).map((c) => {
            const idx = cases.indexOf(c);
            return (
              <div key={idx} className="overflow-hidden rounded-md bg-white shadow-sm">
                <div className="aspect-[4/3] bg-slate-200">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                      Imagem
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <Input
                    value={c.title}
                    placeholder="Título"
                    disabled={locked}
                    onChange={(e) => updateCase(idx, { title: e.target.value })}
                    className="h-auto border-none bg-transparent p-0 text-[11px] font-semibold text-slate-800 shadow-none focus-visible:ring-0"
                  />
                  {!locked ? (
                    <Input
                      value={c.image_url ?? ""}
                      placeholder="URL"
                      onChange={(e) => updateCase(idx, { image_url: e.target.value })}
                      className="mt-1 h-5 text-[9px]"
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          {!locked ? (
            <button
              type="button"
              onClick={addCase}
              className="flex aspect-[4/3] items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-[10px] uppercase tracking-widest text-slate-400 hover:border-slate-500"
            >
              + Case
            </button>
          ) : null}
        </div>
      </div>

      {/* Logos de clientes */}
      <div className="mt-6 px-10">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: primary }}
        >
          Clientes que confiam na CN Cold
        </div>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {logos.map((l, i) => (
            <div
              key={i}
              className="flex aspect-[3/2] items-center justify-center rounded border border-slate-200 bg-white p-2"
            >
              {l.url ? (
                <img src={l.url} alt={l.name ?? ""} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[9px] text-slate-400">{l.name || "logo"}</span>
              )}
            </div>
          ))}
          {!locked ? (
            <button
              type="button"
              onClick={addLogo}
              className="flex aspect-[3/2] items-center justify-center rounded border-2 border-dashed border-slate-300 text-[10px] text-slate-400 hover:border-slate-500"
            >
              + Logo
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[8px] italic text-slate-400">
          Marcas e logotipos exibidos pertencem a seus respectivos titulares e são usados apenas
          para fins ilustrativos.
        </p>
      </div>

      {/* Rodapé */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-6 px-10 py-5 text-[11px] text-white"
        style={{ background: primary }}
      >
        <div className="flex flex-wrap gap-4 opacity-90">
          {footer.telefone ? <span>📞 {footer.telefone}</span> : null}
          {footer.email ? <span>✉ {footer.email}</span> : null}
          {footer.site ? <span>🌐 {footer.site}</span> : null}
          {footer.cidade ? <span>📍 {footer.cidade}</span> : null}
        </div>
        <div className="text-[10px] uppercase tracking-widest opacity-70">CN Cold</div>
      </div>
    </div>
  );
}
