// Componentes "chrome" do relatório do ColdPro: capa personalizável,
// cabeçalho dinâmico, rodapé com paginação, marca d'água e bloco de
// resumo executivo. Construídos com pdf-lib para rodar no Worker.

import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, degrees } from "pdf-lib";
import { PAGE, statusLabel, templateLabel, type ColdProReportContext, type Theme } from "./coldproReportTheme";

const M = PAGE.margin;
const [W, H] = PAGE.size;

function clean(value: unknown) {
  return String(value ?? "—")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE0E\uFE0F]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/[Δ]/g, "Delta ")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .replace(/[•·]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "-";
}

function fmt(value: unknown, digits = 1) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
}

function dataUrlMime(dataUrl: string): "png" | "jpg" | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,/i);
  if (!m) return null;
  return m[1].toLowerCase().startsWith("png") ? "png" : "jpg";
}

async function embedDataUrl(pdf: PDFDocument, dataUrl: string | null | undefined): Promise<PDFImage | null> {
  if (!dataUrl) return null;
  const mime = dataUrlMime(dataUrl);
  if (!mime) return null;
  const base64 = dataUrl.split(",")[1] ?? "";
  try {
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    return mime === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export type ChromeAssets = {
  logo: PDFImage | null;
  coverImage: PDFImage | null;
};

export async function loadChromeAssets(pdf: PDFDocument, ctx: ColdProReportContext): Promise<ChromeAssets> {
  const [logo, coverImage] = await Promise.all([
    embedDataUrl(pdf, ctx.settings.logo_data_url),
    embedDataUrl(pdf, ctx.cover.image_data_url ?? ctx.settings.cover_image_data_url),
  ]);
  return { logo, coverImage };
}

// ===== CAPA =====
export type ExecutiveSummary = {
  totalLoadKcalH: number;
  totalPowerKw: number;
  totalTr: number;
  selectedEquipment: string | null;
  offeredCapacityKcalH: number;
  marginPercent: number | null;
  techStatus: "ok" | "ajustar" | "pendente";
  environments: number;
};

export function drawCover(
  pdf: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  theme: Theme,
  ctx: ColdProReportContext,
  assets: ChromeAssets,
  summary: ExecutiveSummary,
) {
  const page = pdf.addPage(PAGE.size);

  // Background sólido com banda inferior em cor secundária
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: theme.primary });
  page.drawRectangle({ x: 0, y: 0, width: W, height: 90, color: theme.secondary });

  // Logo (canto superior esquerdo) ou nome da empresa
  if (assets.logo) {
    const maxW = 150;
    const maxH = 50;
    const scale = Math.min(maxW / assets.logo.width, maxH / assets.logo.height);
    page.drawImage(assets.logo, {
      x: M,
      y: H - M - assets.logo.height * scale,
      width: assets.logo.width * scale,
      height: assets.logo.height * scale,
    });
  } else {
    page.drawText(clean(ctx.settings.company_name).toUpperCase(), {
      x: M, y: H - M - 16, size: 14, font: fonts.bold, color: theme.white,
    });
  }

  // Status pill
  const statusText = statusLabel(ctx.status);
  const statusW = fonts.bold.widthOfTextAtSize(statusText, 9) + 18;
  page.drawRectangle({
    x: W - M - statusW, y: H - M - 22, width: statusW, height: 22,
    color: theme.accent,
  });
  page.drawText(statusText, {
    x: W - M - statusW + 9, y: H - M - 16, size: 9, font: fonts.bold, color: theme.white,
  });

  // Eyebrow
  page.drawText("MEMORIAL TÉCNICO · CARGA TÉRMICA", {
    x: M, y: H - 180, size: 10, font: fonts.bold, color: theme.white,
  });
  page.drawRectangle({ x: M, y: H - 188, width: 64, height: 2, color: theme.accent });

  // Título do projeto (wrap manual em até 3 linhas)
  const titleSize = 32;
  const maxTitleW = W - M * 2 - 20;
  const titleLines: string[] = [];
  {
    const words = clean(ctx.cover.project_name).split(/\s+/);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (fonts.bold.widthOfTextAtSize(next, titleSize) <= maxTitleW) line = next;
      else { if (line) titleLines.push(line); line = w; }
    }
    if (line) titleLines.push(line);
  }
  let titleY = H - 220;
  for (const line of titleLines.slice(0, 3)) {
    page.drawText(line, { x: M, y: titleY, size: titleSize, font: fonts.bold, color: theme.white });
    titleY -= titleSize + 6;
  }

  // Subtítulo
  page.drawText("Cálculo de carga térmica e seleção de equipamentos", {
    x: M, y: titleY - 4, size: 12, font: fonts.regular, color: theme.watermark,
  });

  // Imagem opcional de capa (lado direito, abaixo do título)
  if (assets.coverImage) {
    const boxW = 220;
    const boxH = 150;
    const x = W - M - boxW;
    const y = titleY - 180;
    const scale = Math.min(boxW / assets.coverImage.width, boxH / assets.coverImage.height);
    page.drawImage(assets.coverImage, {
      x: x + (boxW - assets.coverImage.width * scale) / 2,
      y: y + (boxH - assets.coverImage.height * scale) / 2,
      width: assets.coverImage.width * scale,
      height: assets.coverImage.height * scale,
    });
  }

  // Bloco de metadados (cliente, local, responsável, data, revisão, template)
  const metaY = 180;
  const metaItems: Array<[string, string]> = [
    ["CLIENTE", ctx.cover.client_name ?? "—"],
    ["LOCAL", ctx.cover.location ?? "—"],
    ["RESPONSÁVEL TÉCNICO", ctx.cover.responsible ?? "—"],
    ["DATA DE GERAÇÃO", ctx.cover.generated_at],
    ["REVISÃO", String(ctx.cover.revision ?? 0).padStart(2, "0")],
    ["FORMATO", templateLabel(ctx.template)],
  ];
  const colW = (W - M * 2) / 3;
  metaItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = M + col * colW;
    const y = metaY - row * 36;
    page.drawText(item[0], { x, y: y + 14, size: 7, font: fonts.bold, color: theme.watermark });
    page.drawText(clean(item[1]).slice(0, 36), { x, y, size: 10, font: fonts.bold, color: theme.white });
  });

  // KPIs no rodapé da capa (sobre banda secundária)
  const kpis: Array<[string, string]> = [
    ["CARGA TOTAL", `${fmt(summary.totalLoadKcalH, 0)} kcal/h`],
    ["POTÊNCIA", `${fmt(summary.totalPowerKw, 1)} kW`],
    ["TR", `${fmt(summary.totalTr, 1)} TR`],
    ["AMBIENTES", String(summary.environments)],
  ];
  const kpiColW = (W - M * 2) / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = M + i * kpiColW;
    page.drawText(kpi[0], { x, y: 60, size: 7, font: fonts.bold, color: theme.watermark });
    page.drawText(kpi[1], { x, y: 38, size: 14, font: fonts.bold, color: theme.white });
  });

  // Rodapé da capa (footer text)
  if (ctx.settings.footer_text) {
    page.drawText(clean(ctx.settings.footer_text), {
      x: M, y: 14, size: 8, font: fonts.regular, color: theme.watermark,
    });
  }
  page.drawText(clean(ctx.cover.generated_at), {
    x: W - M - fonts.regular.widthOfTextAtSize(clean(ctx.cover.generated_at), 8),
    y: 14, size: 8, font: fonts.regular, color: theme.watermark,
  });
}

// ===== HEADER + FOOTER (aplicados após o conteúdo, com numeração total) =====
export function applyHeaderFooterAndWatermark(
  pdf: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  theme: Theme,
  ctx: ColdProReportContext,
  assets: ChromeAssets,
) {
  const pages = pdf.getPages();
  const total = pages.length;
  const wmEnabled = ctx.watermark.enabled && !!(ctx.watermark.text ?? "").trim();
  const wmText = clean(ctx.watermark.text ?? statusLabel(ctx.status));

  pages.forEach((page, i) => {
    const isCover = i === 0;
    const num = i + 1;

    // Marca d'água em todas as páginas se habilitada (inclusive capa? no capa fica feio — pula capa)
    if (wmEnabled && !isCover) {
      const size = 90;
      const textW = fonts.bold.widthOfTextAtSize(wmText, size);
      page.drawText(wmText, {
        x: (W - textW * 0.7) / 2,
        y: H / 2 - 30,
        size,
        font: fonts.bold,
        color: theme.watermark,
        opacity: 0.35,
        rotate: degrees(-30),
      });
    }

    if (isCover) return;

    // ---- Cabeçalho dinâmico ----
    const headerY = H - 24;
    // Logo pequeno à esquerda (ou nome da empresa)
    if (assets.logo) {
      const maxH = 18;
      const scale = maxH / assets.logo.height;
      page.drawImage(assets.logo, {
        x: M,
        y: headerY - maxH + 4,
        width: assets.logo.width * scale,
        height: maxH,
      });
    } else {
      page.drawText(clean(ctx.settings.company_name).toUpperCase(), {
        x: M, y: headerY, size: 8, font: fonts.bold, color: theme.primary,
      });
    }

    // Centro: cliente + projeto
    const center = `${ctx.cover.client_name ? clean(ctx.cover.client_name) + " · " : ""}${clean(ctx.cover.project_name)}`.slice(0, 70);
    const centerW = fonts.regular.widthOfTextAtSize(center, 8);
    page.drawText(center, {
      x: (W - centerW) / 2, y: headerY, size: 8, font: fonts.regular, color: theme.muted,
    });

    // Direita: revisão
    const rev = `Rev. ${String(ctx.cover.revision ?? 0).padStart(2, "0")}`;
    const revW = fonts.bold.widthOfTextAtSize(rev, 8);
    page.drawText(rev, {
      x: W - M - revW, y: headerY, size: 8, font: fonts.bold, color: theme.primary,
    });

    page.drawLine({
      start: { x: M, y: headerY - 6 },
      end: { x: W - M, y: headerY - 6 },
      thickness: 0.6, color: theme.border,
    });

    // ---- Rodapé dinâmico ----
    page.drawLine({
      start: { x: M, y: 30 }, end: { x: W - M, y: 30 },
      thickness: 0.5, color: theme.border,
    });

    // Esquerda: status + responsável
    const left = `${statusLabel(ctx.status)} · ${clean(ctx.cover.responsible ?? ctx.settings.default_responsible ?? "—")}`;
    page.drawText(left.slice(0, 70), { x: M, y: 18, size: 7, font: fonts.regular, color: theme.muted });

    // Centro: data
    const dateText = clean(ctx.cover.generated_at);
    const dateW = fonts.regular.widthOfTextAtSize(dateText, 7);
    page.drawText(dateText, { x: (W - dateW) / 2, y: 18, size: 7, font: fonts.regular, color: theme.muted });

    // Direita: paginação
    const pageText = `Página ${num} de ${total}`;
    const pageW = fonts.bold.widthOfTextAtSize(pageText, 7);
    page.drawText(pageText, { x: W - M - pageW, y: 18, size: 7, font: fonts.bold, color: theme.primary });
  });
}

// ===== RESUMO EXECUTIVO (página após capa) =====
export function drawExecutiveSummary(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  theme: Theme,
  ctx: ColdProReportContext,
  summary: ExecutiveSummary,
  startY: number,
): number {
  let y = startY;

  // Título grande
  page.drawText("Resumo executivo", { x: M, y, size: 18, font: fonts.bold, color: theme.primary });
  y -= 8;
  page.drawRectangle({ x: M, y: y - 2, width: 48, height: 3, color: theme.accent });
  y -= 18;

  // Descrição curta
  const desc = `Este resumo consolida o resultado técnico do projeto "${clean(ctx.cover.project_name)}" para tomada de decisão rápida. Detalhamento por ambiente nas páginas seguintes.`;
  // wrap simples
  const maxW = W - M * 2;
  const words = clean(desc).split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (fonts.regular.widthOfTextAtSize(next, 9) <= maxW) line = next;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  for (const ln of lines) {
    page.drawText(ln, { x: M, y, size: 9, font: fonts.regular, color: theme.text });
    y -= 12;
  }
  y -= 8;

  // Cards de KPIs (4 cards)
  const cards: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Carga térmica total", value: `${fmt(summary.totalLoadKcalH, 0)} kcal/h`, sub: `${fmt(summary.totalPowerKw, 1)} kW · ${fmt(summary.totalTr, 1)} TR` },
    { label: "Ambientes calculados", value: String(summary.environments), sub: "ambientes refrigerados" },
    { label: "Capacidade ofertada", value: `${fmt(summary.offeredCapacityKcalH, 0)} kcal/h`, sub: summary.selectedEquipment ?? "Equipamento não selecionado" },
    { label: "Margem de sobra", value: summary.marginPercent === null ? "—" : `${fmt(summary.marginPercent, 1)}%`, sub: summary.marginPercent === null ? "Selecionar equipamento" : summary.marginPercent < 0 ? "Insuficiente" : summary.marginPercent < 10 ? "Margem apertada" : summary.marginPercent <= 30 ? "Adequada" : "Sobredimensionado" },
  ];
  const gap = 8;
  const cardW = (W - M * 2 - gap * (cards.length - 1)) / cards.length;
  const cardH = 70;
  cards.forEach((card, i) => {
    const x = M + i * (cardW + gap);
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: theme.soft, borderColor: theme.border, borderWidth: 0.5 });
    page.drawRectangle({ x, y: y - 4, width: cardW, height: 4, color: theme.accent });
    page.drawText(clean(card.label).toUpperCase(), { x: x + 8, y: y - 22, size: 7, font: fonts.bold, color: theme.muted });
    page.drawText(clean(card.value), { x: x + 8, y: y - 44, size: 14, font: fonts.bold, color: theme.primary });
    if (card.sub) {
      page.drawText(clean(card.sub).slice(0, 32), { x: x + 8, y: y - 60, size: 7.5, font: fonts.regular, color: theme.muted });
    }
  });
  y -= cardH + 14;

  // Status técnico - barra colorida
  const statusColors = {
    ok: theme.success,
    ajustar: theme.warning,
    pendente: theme.danger,
  };
  const statusTexts = {
    ok: "TÉCNICO: OK — Seleção dimensionada e dentro da margem técnica.",
    ajustar: "TÉCNICO: AJUSTAR — Margem fora da faixa técnica recomendada (10–30%).",
    pendente: "TÉCNICO: PENDENTE — Faltam dados ou seleção de equipamento.",
  };
  const stColor = statusColors[summary.techStatus];
  const stText = statusTexts[summary.techStatus];
  page.drawRectangle({ x: M, y: y - 26, width: W - M * 2, height: 26, color: stColor });
  page.drawText(stText, { x: M + 12, y: y - 18, size: 9, font: fonts.bold, color: theme.white });
  y -= 36;

  return y;
}

export { clean as cleanText, fmt as fmtNumber };
