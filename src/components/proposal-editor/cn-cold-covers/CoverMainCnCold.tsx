/**
 * Capa 1 — cover_main_cn_cold.
 * Layout azul institucional CN Cold com logo, título "PROPOSTA TÉCNICA E
 * COMERCIAL", caixa branca de identificação (cliente / projeto / nº / data /
 * responsável), grid lateral de imagens decorativas e rodapé com contatos.
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentBlock } from "@/integrations/proposal-editor/types";
import type { ProposalTemplate } from "@/integrations/proposal-editor/template.types";
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";
import {
  CN_COLD_PRIMARY,
  CN_COLD_PRIMARY_DARK,
  resolveCoverFooter,
  resolveCoverIdentity,
} from "./use-cover-defaults";

interface Props {
  block: DocumentBlock;
  setData: (patch: Record<string, unknown>) => void;
  locked?: boolean;
  template: ProposalTemplate | null;
  documentContext?: ProposalDocumentContext | null;
}

export function CoverMainCnCold({ block, setData, locked, template, documentContext }: Props) {
  const data = block.data ?? {};
  const ident = resolveCoverIdentity(data, documentContext);
  const footer = resolveCoverFooter(data, documentContext);
  const primary = (data.primary_color as string) || template?.primary_color || CN_COLD_PRIMARY;
  const logo = (data.logo_url as string) || template?.logo_url || "";
  const bgImage = (data.background_image as string) || "";
  const images: { url: string }[] = Array.isArray(data.images) ? (data.images as { url: string }[]) : [];
  const title = (data.title as string) ?? "PROPOSTA TÉCNICA E COMERCIAL";
  const subtitle = (data.subtitle as string) ?? "Soluções em Refrigeração Industrial";

  return (
    <div
      className="relative h-full w-full overflow-hidden text-white"
      style={{
        background: bgImage
          ? `linear-gradient(135deg, ${primary}ee, ${CN_COLD_PRIMARY_DARK}cc), url(${bgImage}) center/cover`
          : `linear-gradient(135deg, ${primary}, ${CN_COLD_PRIMARY_DARK})`,
        fontFamily: "Inter, sans-serif",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Faixa superior decorativa */}
      <div
        className="absolute inset-x-0 top-0 h-2"
        style={{ background: "linear-gradient(90deg,#1e90ff,#00bcd4,#1e90ff)" }}
      />

      {/* Logo + faixa título */}
      <div className="flex items-start justify-between p-10">
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="logo" className="h-14 w-auto object-contain" />
          ) : (
            <div className="flex h-14 w-32 items-center justify-center rounded border border-white/30 text-xs opacity-60">
              LOGO
            </div>
          )}
        </div>
        <div className="text-right text-[11px] uppercase tracking-[0.25em] opacity-70">
          {ident.proposal_number ? `Nº ${ident.proposal_number}` : "Proposta"}
        </div>
      </div>

      {/* Título principal */}
      <div className="px-10">
        <Input
          value={title}
          disabled={locked}
          onChange={(e) => setData({ title: e.target.value })}
          className="h-auto border-none bg-transparent p-0 text-[42px] font-bold leading-tight tracking-tight text-white shadow-none focus-visible:ring-0"
        />
        <Input
          value={subtitle}
          disabled={locked}
          onChange={(e) => setData({ subtitle: e.target.value })}
          className="mt-2 h-auto border-none bg-transparent p-0 text-[18px] font-light text-white/80 shadow-none focus-visible:ring-0"
        />
        <div className="mt-3 h-1 w-24 bg-cyan-400" />
      </div>

      {/* Caixa branca de identificação + grid lateral de imagens */}
      <div className="mt-8 grid grid-cols-12 gap-6 px-10">
        <div className="col-span-8 rounded-lg bg-white/95 p-6 text-slate-900 shadow-2xl">
          <Field label="Cliente" value={ident.client_name} />
          <Field label="Projeto" value={ident.proposal_title} />
          <Field label="Nº da Proposta" value={ident.proposal_number} />
          <Field label="Data" value={ident.proposal_date} />
          <Field label="Responsável Comercial" value={ident.vendedor} />
        </div>
        <div className="col-span-4 grid grid-cols-1 gap-3">
          {[0, 1, 2].map((i) => {
            const url = images[i]?.url;
            return (
              <div
                key={i}
                className="aspect-[4/3] overflow-hidden rounded-md border border-white/20 bg-white/10"
              >
                {url ? (
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] uppercase opacity-50">
                    Imagem {i + 1}
                  </div>
                )}
                {!locked ? (
                  <Input
                    value={url ?? ""}
                    placeholder="URL da imagem"
                    onChange={(e) => {
                      const next = [...images];
                      next[i] = { url: e.target.value };
                      setData({ images: next });
                    }}
                    className="mt-1 h-6 border-white/20 bg-white/10 text-[10px] text-white placeholder:text-white/40"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rodapé */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-6 px-10 py-5 text-[11px]"
        style={{ background: CN_COLD_PRIMARY_DARK }}
      >
        <div className="flex flex-wrap gap-4 opacity-90">
          {footer.telefone ? <span>📞 {footer.telefone}</span> : null}
          {footer.email ? <span>✉ {footer.email}</span> : null}
          {footer.site ? <span>🌐 {footer.site}</span> : null}
          {footer.cidade ? <span>📍 {footer.cidade}</span> : null}
        </div>
        <div className="text-[10px] uppercase tracking-widest opacity-60">CN Cold</div>
      </div>

      {/* editor de URLs auxiliares (logo / bg) — só no editor */}
      {!locked ? (
        <div className="absolute right-2 top-2 z-10 w-64 space-y-1 rounded bg-black/40 p-2 text-[10px]">
          <Input
            value={logo}
            placeholder="URL do logo"
            onChange={(e) => setData({ logo_url: e.target.value })}
            className="h-6 border-white/20 bg-white/10 text-[10px] text-white placeholder:text-white/40"
          />
          <Input
            value={bgImage}
            placeholder="URL imagem de fundo"
            onChange={(e) => setData({ background_image: e.target.value })}
            className="h-6 border-white/20 bg-white/10 text-[10px] text-white placeholder:text-white/40"
          />
        </div>
      ) : null}
    </div>
  );

  function Field({ label, value }: { label: string; value: string | null }) {
    return (
      <div className="border-b border-slate-200 py-2 last:border-b-0">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </div>
        <div className="text-[15px] font-medium text-slate-900">{value || "—"}</div>
      </div>
    );
  }
}
