/**
 * Capa 2 — cover_institutional_cn_cold.
 * Página institucional com texto da CN Cold, imagem de fábrica, seção
 * "Por que escolher a CN Cold?", imagem da linha de equipamentos e
 * slogan/frase institucional.
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentBlock } from "@/integrations/proposal-editor/types";
import type { ProposalTemplate } from "@/integrations/proposal-editor/template.types";
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";
import { CN_COLD_PRIMARY, CN_COLD_PRIMARY_DARK, resolveCoverFooter } from "./use-cover-defaults";

interface Props {
  block: DocumentBlock;
  setData: (patch: Record<string, unknown>) => void;
  locked?: boolean;
  template: ProposalTemplate | null;
  documentContext?: ProposalDocumentContext | null;
}

const DEFAULT_PARAGRAPHS = [
  "A CN Cold é especializada em sistemas de refrigeração industrial, com mais de duas décadas de experiência projetando, fabricando e instalando soluções térmicas para os mais diversos setores.",
  "Atuamos da engenharia conceitual à manutenção pós-venda, entregando equipamentos com alta eficiência energética e conformidade técnica.",
];

const DEFAULT_REASONS = [
  "Engenharia própria com cálculo termodinâmico certificado",
  "Fabricação nacional com controle total de qualidade",
  "Equipe técnica especializada em instalação e comissionamento",
  "Assistência técnica em todo território nacional",
];

export function CoverInstitutionalCnCold({ block, setData, locked, template, documentContext }: Props) {
  const data = block.data ?? {};
  const footer = resolveCoverFooter(data, documentContext);
  const primary = (data.primary_color as string) || template?.primary_color || CN_COLD_PRIMARY;
  const title = (data.title as string) ?? "Sobre a CN Cold";
  const slogan = (data.slogan as string) ?? "Engenharia que resfria. Confiança que aquece.";
  const paragraphs: string[] = Array.isArray(data.paragraphs) ? (data.paragraphs as string[]) : DEFAULT_PARAGRAPHS;
  const reasons: string[] = Array.isArray(data.reasons) ? (data.reasons as string[]) : DEFAULT_REASONS;
  const images: { url: string; caption?: string }[] = Array.isArray(data.images)
    ? (data.images as { url: string; caption?: string }[])
    : [];
  const factoryImg = images[0]?.url || (data.background_image as string) || "";
  const equipImg = images[1]?.url || "";

  const setParagraph = (i: number, v: string) => {
    const next = [...paragraphs];
    next[i] = v;
    setData({ paragraphs: next });
  };
  const setReason = (i: number, v: string) => {
    const next = [...reasons];
    next[i] = v;
    setData({ reasons: next });
  };
  const setImage = (i: number, url: string) => {
    const next = images.length > 0 ? [...images] : [{ url: "" }, { url: "" }];
    while (next.length <= i) next.push({ url: "" });
    next[i] = { ...next[i], url };
    setData({ images: next });
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-white"
      style={{ fontFamily: "Inter, sans-serif" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* faixa topo */}
      <div className="h-2" style={{ background: `linear-gradient(90deg, ${primary}, #1e90ff)` }} />

      <div className="grid h-[calc(100%-88px)] grid-cols-12 gap-6 p-10">
        {/* Coluna esquerda: título + parágrafos */}
        <div className="col-span-7 flex flex-col">
          <Input
            value={title}
            disabled={locked}
            onChange={(e) => setData({ title: e.target.value })}
            className="h-auto border-none bg-transparent p-0 text-[34px] font-bold tracking-tight shadow-none focus-visible:ring-0"
            style={{ color: primary }}
          />
          <div className="mt-2 h-1 w-16" style={{ background: primary }} />

          <div className="mt-6 space-y-3">
            {paragraphs.map((p, i) => (
              <Textarea
                key={i}
                value={p}
                disabled={locked}
                onChange={(e) => setParagraph(i, e.target.value)}
                className="min-h-[60px] resize-none border-none bg-transparent p-0 text-[13px] leading-relaxed text-slate-700 shadow-none focus-visible:ring-0"
              />
            ))}
            {!locked ? (
              <button
                type="button"
                onClick={() => setData({ paragraphs: [...paragraphs, ""] })}
                className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-700"
              >
                + parágrafo
              </button>
            ) : null}
          </div>

          {/* Por que escolher? */}
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div
              className="text-[16px] font-bold uppercase tracking-wider"
              style={{ color: primary }}
            >
              Por que escolher a CN Cold?
            </div>
            <ul className="mt-3 space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-slate-700">
                  <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: primary }} />
                  <Textarea
                    value={r}
                    disabled={locked}
                    onChange={(e) => setReason(i, e.target.value)}
                    className="min-h-[24px] resize-none border-none bg-transparent p-0 text-[12px] leading-snug text-slate-700 shadow-none focus-visible:ring-0"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Coluna direita: imagens */}
        <div className="col-span-5 flex flex-col gap-4">
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100 shadow-md">
            {factoryImg ? (
              <img src={factoryImg} alt="Fábrica CN Cold" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Imagem da fábrica
              </div>
            )}
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-slate-100 shadow-md">
            {equipImg ? (
              <img src={equipImg} alt="Equipamentos" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Linha de equipamentos
              </div>
            )}
          </div>
          {!locked ? (
            <div className="space-y-1">
              <Input
                value={factoryImg}
                placeholder="URL imagem fábrica"
                onChange={(e) => setImage(0, e.target.value)}
                className="h-6 text-[10px]"
              />
              <Input
                value={equipImg}
                placeholder="URL imagem equipamentos"
                onChange={(e) => setImage(1, e.target.value)}
                className="h-6 text-[10px]"
              />
            </div>
          ) : null}

          {/* Slogan */}
          <div
            className="mt-auto rounded-lg p-4 text-center text-[14px] font-semibold italic text-white"
            style={{ background: `linear-gradient(135deg, ${primary}, ${CN_COLD_PRIMARY_DARK})` }}
          >
            <Input
              value={slogan}
              disabled={locked}
              onChange={(e) => setData({ slogan: e.target.value })}
              className="h-auto border-none bg-transparent p-0 text-center text-[14px] font-semibold italic text-white shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
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
