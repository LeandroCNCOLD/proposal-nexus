// Moldura A4 fiel ao DOCX da proposta Jolivan: capa pictórica (imagem cover_full
// como fundo), páginas internas com curva azul + logo no topo e rodapé azul.
import { A4_W, A4_H, type PageType } from "@/integrations/proposal-editor/types";
import type { ProposalTemplate, TemplateAsset } from "@/integrations/proposal-editor/template.types";

interface Props {
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  pageType: PageType;
  pageNumber: number;
  totalPages: number;
  /** Imagem de fundo customizada da página (sobrepõe o chrome padrão). */
  backgroundImageUrl?: string;
  backgroundImageFit?: "cover" | "contain";
  /** Esconde o cabeçalho (logo + curva) das páginas de conteúdo. */
  hideHeader?: boolean;
  /** Esconde o rodapé (faixa azul + paginação) das páginas de conteúdo. */
  hideFooter?: boolean;
  /** Sobrescreve o texto do lado esquerdo do rodapé. */
  footerText?: string;
}

function findAsset(assets: TemplateAsset[], kind: string): TemplateAsset | undefined {
  return assets.find((a) => a.asset_kind === kind);
}

export function PageChrome({ template, assets, pageType, pageNumber, totalPages, backgroundImageUrl, backgroundImageFit = "cover", hideHeader, hideFooter, footerText }: Props) {
  const primary = template?.primary_color ?? "#0c2340";
  const accent = template?.accent_color ?? "#2d8a9e";

  // Se a página tem imagem de fundo personalizada, ela domina o A4 (substitui chrome).
  if (backgroundImageUrl) {
    return (
      <div className="pointer-events-none absolute inset-0 bg-white">
        <img
          src={backgroundImageUrl}
          alt=""
          className={`absolute inset-0 h-full w-full ${backgroundImageFit === "contain" ? "object-contain" : "object-cover"}`}
          draggable={false}
        />
      </div>
    );
  }

  if (pageType === "custom-bg") {
    // Página criada para receber imagem de fundo, ainda sem upload.
    return (
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-muted-foreground"
        style={{ background: "repeating-linear-gradient(45deg,#f8fafc,#f8fafc 12px,#eef2f7 12px,#eef2f7 24px)" }}
      >
        <div className="rounded-md border border-dashed bg-white/90 p-4">
          Página com imagem de fundo<br />
          <span className="text-[10px]">Selecione esta página na barra lateral e use <strong>Imagem de fundo</strong> para enviar a arte.</span>
        </div>
      </div>
    );
  }

  if (pageType === "cover") {
    const coverAsset = findAsset(assets, "cover_full");
    return (
      <div className="pointer-events-none absolute inset-0">
        {coverAsset ? (
          <img
            src={coverAsset.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-center text-xs"
            style={{ background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`, color: "#fff" }}
          >
            <div className="rounded-md bg-white/10 p-4 backdrop-blur-sm">
              Faça upload da arte de capa (cover_full) em<br />
              <strong>Configurações → Templates</strong>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (pageType === "contracapa") {
    const backAsset = findAsset(assets, "back_cover");
    const logoAsset = findAsset(assets, "logo");
    return (
      <div className="pointer-events-none absolute inset-0">
        {backAsset ? (
          <img src={backAsset.url} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: primary }}
          >
            {logoAsset ? (
              <img src={logoAsset.url} alt="" className="max-h-32 max-w-[60%] object-contain opacity-90" draggable={false} />
            ) : (
              <span className="text-3xl font-bold text-white opacity-90">
                {template?.empresa_nome ?? "CN Cold"}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Páginas de conteúdo: header branco com curva + logo, rodapé azul
  const logoAsset = findAsset(assets, "logo");
  return (
    <div className="pointer-events-none absolute inset-0 bg-white">
      {/* Curva azul decorativa no topo direito */}
      <svg
        className="pointer-events-none absolute right-0 top-0"
        width={320}
        height={120}
        viewBox="0 0 320 120"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,0 Q160,140 320,0 L320,0 L0,0 Z"
          fill={primary}
          opacity="0.08"
        />
        <path
          d="M120,0 Q220,90 320,30 L320,0 L120,0 Z"
          fill={primary}
        />
      </svg>

      {/* Logo topo-esquerdo */}
      <div className="absolute left-12 top-6 flex items-center gap-2">
        {logoAsset ? (
          <img src={logoAsset.url} alt="" className="h-10 object-contain" draggable={false} />
        ) : (
          <span className="text-base font-bold" style={{ color: primary }}>
            {template?.empresa_nome ?? "CN Cold"}
          </span>
        )}
      </div>

      {/* Rodapé azul */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-12 py-2.5 text-[10px] font-medium text-white"
        style={{ background: primary }}
      >
        <span>{template?.empresa_site ?? template?.empresa_email ?? ""}</span>
        <span>
          {pageNumber} / {totalPages}
        </span>
      </div>
    </div>
  );
}

export const A4_DIMENSIONS = { w: A4_W, h: A4_H };
