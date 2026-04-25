import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { calculateProductLoadBreakdown, estimateFreezingTimePlankMin } from "@/features/coldpro/coldpro-calculation.engine";

const A4: [number, number] = [595.28, 841.89];
const M = 36;
const COLORS = {
  primary: rgb(0.05, 0.14, 0.22),
  accent: rgb(0.12, 0.43, 0.65),
  text: rgb(0.12, 0.16, 0.22),
  muted: rgb(0.42, 0.45, 0.5),
  border: rgb(0.82, 0.84, 0.87),
  soft: rgb(0.95, 0.97, 0.98),
  white: rgb(1, 1, 1),
};
const PIE_COLORS = [COLORS.accent, COLORS.primary, rgb(0.29, 0.62, 0.53), rgb(0.84, 0.55, 0.18), rgb(0.55, 0.37, 0.75), rgb(0.77, 0.31, 0.37), rgb(0.39, 0.45, 0.55), rgb(0.18, 0.48, 0.64)];

type Fonts = { regular: PDFFont; bold: PDFFont };
type Ctx = { pdf: PDFDocument; page: PDFPage; fonts: Fonts; y: number; projectName: string; generatedAt: string };

function clean(value: unknown) {
  return String(value ?? "—")
    .replace(/[–—]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/[Δ]/g, "Delta ")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .replace(/[•]/g, "-");
}

function fmt(value: unknown, digits = 2) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number.isFinite(n) ? n : 0);
}

function loadRows(result: any): Array<[string, number]> {
  const rows: Array<[string, number]> = [
    ["Transmissão", Number(result?.transmission_kcal_h ?? 0)],
    ["Produto", Number(result?.product_kcal_h ?? 0)],
    ["Embalagem", Number(result?.packaging_kcal_h ?? 0)],
    ["Infiltração", Number(result?.infiltration_kcal_h ?? 0)],
    ["Pessoas", Number(result?.people_kcal_h ?? 0)],
    ["Iluminação", Number(result?.lighting_kcal_h ?? 0)],
    ["Motores", Number(result?.motors_kcal_h ?? 0)],
    ["Ventiladores", Number(result?.fans_kcal_h ?? 0)],
    ["Degelo", Number(result?.defrost_kcal_h ?? 0)],
    ["Outros", Number(result?.other_kcal_h ?? 0) + Number(result?.tunnel_internal_load_kcal_h ?? 0)],
  ];
  return rows.filter(([, value]) => value > 0);
}

function textWidth(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(clean(text), size);
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = clean(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(font, next, size) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function addPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage(A4);
  ctx.y = A4[1] - M - 24;
  ctx.page.drawText("CN ColdPro - Memorial Técnico", { x: M, y: A4[1] - 30, size: 8, font: ctx.fonts.bold, color: COLORS.muted });
  ctx.page.drawText(clean(ctx.projectName).slice(0, 48), { x: A4[0] - M - 220, y: A4[1] - 30, size: 8, font: ctx.fonts.regular, color: COLORS.muted });
  ctx.page.drawLine({ start: { x: M, y: A4[1] - 38 }, end: { x: A4[0] - M, y: A4[1] - 38 }, thickness: 0.5, color: COLORS.border });
}

function ensure(ctx: Ctx, height: number) {
  if (ctx.y - height < M + 28) addPage(ctx);
}

function paragraph(ctx: Ctx, text: string, options: { size?: number; width?: number; color?: RGB; bold?: boolean; gap?: number } = {}) {
  const size = options.size ?? 9;
  const font = options.bold ? ctx.fonts.bold : ctx.fonts.regular;
  const width = options.width ?? A4[0] - M * 2;
  const lines = wrap(font, text, size, width);
  ensure(ctx, lines.length * (size + 3) + (options.gap ?? 6));
  for (const line of lines) {
    ctx.page.drawText(line, { x: M, y: ctx.y, size, font, color: options.color ?? COLORS.text });
    ctx.y -= size + 3;
  }
  ctx.y -= options.gap ?? 6;
}

function heading(ctx: Ctx, text: string, level: 1 | 2 | 3 = 2) {
  const size = level === 1 ? 16 : level === 2 ? 12 : 10;
  ensure(ctx, size + 16);
  ctx.page.drawText(clean(text), { x: M, y: ctx.y, size, font: ctx.fonts.bold, color: COLORS.primary });
  ctx.y -= size + 6;
  if (level !== 3) {
    ctx.page.drawLine({ start: { x: M, y: ctx.y }, end: { x: A4[0] - M, y: ctx.y }, thickness: 0.5, color: COLORS.border });
    ctx.y -= 8;
  }
}

function drawKpis(ctx: Ctx, items: Array<[string, string]>) {
  ensure(ctx, 54);
  const gap = 8;
  const w = (A4[0] - M * 2 - gap * (items.length - 1)) / items.length;
  items.forEach(([label, value], i) => {
    const x = M + i * (w + gap);
    ctx.page.drawRectangle({ x, y: ctx.y - 42, width: w, height: 42, color: COLORS.soft, borderColor: COLORS.border, borderWidth: 0.5 });
    ctx.page.drawText(clean(label).toUpperCase(), { x: x + 8, y: ctx.y - 16, size: 7, font: ctx.fonts.bold, color: COLORS.muted });
    ctx.page.drawText(clean(value), { x: x + 8, y: ctx.y - 34, size: 12, font: ctx.fonts.bold, color: COLORS.primary });
  });
  ctx.y -= 52;
}

function drawKeyGrid(ctx: Ctx, items: Array<[string, string]>, columns = 3) {
  const colW = (A4[0] - M * 2) / columns;
  const rowH = 18;
  ensure(ctx, Math.ceil(items.length / columns) * rowH + 6);
  items.forEach(([label, value], i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = M + col * colW;
    const y = ctx.y - row * rowH;
    ctx.page.drawText(`${clean(label)}:`, { x, y, size: 8, font: ctx.fonts.bold, color: COLORS.muted });
    ctx.page.drawText(clean(value), { x: x + 76, y, size: 8, font: ctx.fonts.regular, color: COLORS.text });
  });
  ctx.y -= Math.ceil(items.length / columns) * rowH + 4;
}

function table(ctx: Ctx, headers: string[], rows: string[][], widths?: number[]) {
  const totalW = A4[0] - M * 2;
  const ws = widths ?? headers.map(() => 1 / headers.length);
  const rowH = 18;
  ensure(ctx, rowH * (rows.length + 1) + 8);
  let x = M;
  headers.forEach((h, i) => {
    const w = totalW * ws[i];
    ctx.page.drawRectangle({ x, y: ctx.y - rowH + 4, width: w, height: rowH, color: COLORS.soft, borderColor: COLORS.border, borderWidth: 0.5 });
    ctx.page.drawText(clean(h).slice(0, 28), { x: x + 4, y: ctx.y - 8, size: 7.5, font: ctx.fonts.bold, color: COLORS.primary });
    x += w;
  });
  ctx.y -= rowH;
  rows.forEach((row) => {
    ensure(ctx, rowH + 4);
    x = M;
    row.forEach((cell, i) => {
      const w = totalW * ws[i];
      ctx.page.drawRectangle({ x, y: ctx.y - rowH + 4, width: w, height: rowH, borderColor: COLORS.border, borderWidth: 0.5 });
      ctx.page.drawText(clean(cell).slice(0, 42), { x: x + 4, y: ctx.y - 8, size: 7.5, font: ctx.fonts.regular, color: COLORS.text });
      x += w;
    });
    ctx.y -= rowH;
  });
  ctx.y -= 8;
}

function barChart(ctx: Ctx, result: any) {
  const rows = loadRows(result);
  if (!rows.length) return;
  const max = Math.max(...rows.map(([, value]) => value));
  ensure(ctx, rows.length * 15 + 12);
  rows.forEach(([label, value]) => {
    ctx.page.drawText(clean(label), { x: M, y: ctx.y, size: 7.5, font: ctx.fonts.regular, color: COLORS.muted });
    ctx.page.drawRectangle({ x: M + 88, y: ctx.y - 1, width: 265, height: 7, color: COLORS.soft });
    ctx.page.drawRectangle({ x: M + 88, y: ctx.y - 1, width: Math.max(4, (value / max) * 265), height: 7, color: COLORS.accent });
    ctx.page.drawText(`${fmt(value, 0)} kcal/h`, { x: M + 366, y: ctx.y, size: 7.5, font: ctx.fonts.bold, color: COLORS.text });
    ctx.y -= 14;
  });
  ctx.y -= 4;
}

function loadOfferChart(ctx: Ctx, requiredKcalH: number, offeredKcalH: number) {
  if (requiredKcalH <= 0 && offeredKcalH <= 0) return;
  const max = Math.max(1, requiredKcalH, offeredKcalH);
  ensure(ctx, 44);
  [["Carga requerida", requiredKcalH, COLORS.primary], ["Carga ofertada", offeredKcalH, COLORS.accent]].forEach(([label, value, color], index) => {
    const y = ctx.y - index * 17;
    ctx.page.drawText(clean(label), { x: M, y, size: 8, font: ctx.fonts.bold, color: COLORS.muted });
    ctx.page.drawRectangle({ x: M + 96, y: y - 1, width: 250, height: 8, color: COLORS.soft });
    ctx.page.drawRectangle({ x: M + 96, y: y - 1, width: Math.max(4, (Number(value) / max) * 250), height: 8, color: color as RGB });
    ctx.page.drawText(`${fmt(value, 0)} kcal/h`, { x: M + 360, y, size: 8, font: ctx.fonts.bold, color: COLORS.text });
  });
  ctx.y -= 44;
}

function projectLineChart(ctx: Ctx, environments: any[], results: any[]) {
  const points = environments.map((env: any, index: number) => ({ index, label: clean(env.name).slice(0, 10), value: Number(results.find((r: any) => r.environment_id === env.id)?.total_required_kcal_h ?? 0) })).filter((point) => point.value > 0);
  if (points.length < 2) return;
  ensure(ctx, 130);
  const x0 = M + 20;
  const y0 = ctx.y - 96;
  const w = A4[0] - M * 2 - 40;
  const h = 72;
  const max = Math.max(...points.map((p) => p.value));
  ctx.page.drawText("Linha de carga requerida por ambiente", { x: M, y: ctx.y, size: 8, font: ctx.fonts.bold, color: COLORS.primary });
  ctx.page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0 + w, y: y0 }, thickness: 0.6, color: COLORS.border });
  ctx.page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0, y: y0 + h }, thickness: 0.6, color: COLORS.border });
  points.forEach((point, i) => {
    const x = x0 + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
    const y = y0 + (point.value / max) * h;
    if (i > 0) {
      const prev = points[i - 1];
      const px = x0 + ((i - 1) / (points.length - 1)) * w;
      const py = y0 + (prev.value / max) * h;
      ctx.page.drawLine({ start: { x: px, y: py }, end: { x, y }, thickness: 1.4, color: COLORS.accent });
    }
    ctx.page.drawCircle({ x, y, size: 3.2, color: COLORS.primary });
    ctx.page.drawText(point.label, { x: x - 14, y: y0 - 14, size: 6.5, font: ctx.fonts.regular, color: COLORS.muted });
    ctx.page.drawText(fmt(point.value, 0), { x: x - 16, y: y + 7, size: 6.5, font: ctx.fonts.bold, color: COLORS.text });
  });
  ctx.y -= 122;
}

function temperatureCurveChart(ctx: Ctx, env: any) {
  const tin = Number(env.external_temp_c ?? 0);
  const tout = Number(env.internal_temp_c ?? 0);
  if (!Number.isFinite(tin) || !Number.isFinite(tout) || tin === tout) return;
  ensure(ctx, 92);
  const x0 = M + 12;
  const y0 = ctx.y - 70;
  const w = A4[0] - M * 2 - 24;
  const h = 44;
  const points = [[0, tin], [0.35, tin - (tin - tout) * 0.45], [0.7, tin - (tin - tout) * 0.82], [1, tout]] as Array<[number, number]>;
  const maxT = Math.max(tin, tout);
  const minT = Math.min(tin, tout);
  ctx.page.drawText("Curva técnica de temperatura até o setpoint", { x: M, y: ctx.y, size: 8, font: ctx.fonts.bold, color: COLORS.primary });
  ctx.page.drawLine({ start: { x: x0, y: y0 }, end: { x: x0 + w, y: y0 }, thickness: 0.5, color: COLORS.border });
  ctx.page.drawText(`${fmt(tin)} °C externo`, { x: x0, y: y0 + h + 4, size: 7, font: ctx.fonts.bold, color: COLORS.muted });
  ctx.page.drawText(`${fmt(tout)} °C alvo`, { x: x0 + w - 52, y: y0 - 12, size: 7, font: ctx.fonts.bold, color: COLORS.muted });
  points.forEach(([t, temp], i) => {
    const x = x0 + t * w;
    const y = y0 + ((temp - minT) / Math.max(1, maxT - minT)) * h;
    if (i > 0) {
      const [pt, ptemp] = points[i - 1];
      ctx.page.drawLine({ start: { x: x0 + pt * w, y: y0 + ((ptemp - minT) / Math.max(1, maxT - minT)) * h }, end: { x, y }, thickness: 1.2, color: COLORS.accent });
    }
    ctx.page.drawCircle({ x, y, size: 2.6, color: COLORS.primary });
  });
  ctx.y -= 86;
}

function stackedLoadChart(ctx: Ctx, result: any) {
  const rows = loadRows(result);
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return;
  ensure(ctx, 48);
  ctx.page.drawText("Barra empilhada percentual da carga térmica", { x: M, y: ctx.y, size: 8, font: ctx.fonts.bold, color: COLORS.primary });
  ctx.y -= 14;
  let x = M;
  const w = A4[0] - M * 2;
  rows.forEach(([label, value], index) => {
    const sw = Math.max(4, (value / total) * w);
    ctx.page.drawRectangle({ x, y: ctx.y - 8, width: sw, height: 12, color: PIE_COLORS[index % PIE_COLORS.length] });
    if (sw > 34) ctx.page.drawText(`${clean(label).slice(0, 8)} ${fmt((value / total) * 100, 0)}%`, { x: x + 3, y: ctx.y - 5, size: 5.6, font: ctx.fonts.bold, color: COLORS.white });
    x += sw;
  });
  ctx.y -= 28;
}

function freezingCurve(ctx: Ctx, breakdown: any) {
  const hours = Math.max(0.1, Number(breakdown?.hours ?? 0));
  const above = Math.max(0, Number(breakdown?.sensible_above_kcal_h ?? 0));
  const latent = Math.max(0, Number(breakdown?.latent_kcal_h ?? 0));
  const below = Math.max(0, Number(breakdown?.sensible_below_kcal_h ?? 0));
  const total = above + latent + below;
  if (total <= 0) return;
  const tAbove = (above / total) * hours;
  const tLatent = (latent / total) * hours;
  const tBelow = (below / total) * hours;
  ensure(ctx, 58);
  ctx.page.drawText("Curva simplificada do processo térmico no tempo", { x: M, y: ctx.y, size: 8, font: ctx.fonts.bold, color: COLORS.primary });
  ctx.y -= 14;
  const totalW = A4[0] - M * 2;
  const segments: Array<[string, number, RGB]> = [["Resfriamento sensível", tAbove, rgb(0.18, 0.48, 0.64)], ["Mudança de estado", tLatent, rgb(0.84, 0.55, 0.18)], ["Sub-resfriamento", tBelow, rgb(0.12, 0.43, 0.65)]];
  let x = M;
  segments.forEach(([label, value, color]) => {
    const w = Math.max(4, (value / hours) * totalW);
    ctx.page.drawRectangle({ x, y: ctx.y - 6, width: w, height: 12, color });
    ctx.page.drawText(`${clean(label)} ${fmt(value, 1)} h`, { x: x + 3, y: ctx.y - 22, size: 6.8, font: ctx.fonts.regular, color: COLORS.text });
    x += w;
  });
  ctx.y -= 42;
}

function drawProductThermalDetails(ctx: Ctx, products: any[], env: any) {
  if (!products.length) return;
  heading(ctx, "Propriedades térmicas e mudança de estado dos produtos", 3);
  for (const product of products) {
    const b = calculateProductLoadBreakdown(product);
    const phaseTimeMin = estimateFreezingTimePlankMin({
      thicknessM: product.characteristic_thickness_m,
      densityKgM3: product.density_kg_m3,
      thermalConductivityFrozenWMK: product.thermal_conductivity_frozen_w_m_k,
      freezingTempC: product.initial_freezing_temp_c,
      latentHeatKcalKg: product.latent_heat_kcal_kg,
      frozenWaterFraction: b.frozen_water_fraction,
      airTempC: env.internal_temp_c,
      convectiveCoefficientWM2K: product.default_convective_coefficient_w_m2_k,
    });
    paragraph(ctx, `${product.product_name} - base ${fmt(b.mass_kg_day, 0)} kg em ${fmt(b.hours, 1)} h (${fmt(b.hourly_movement_kg, 1)} kg/h). Fonte: ${b.source}.`, { size: 8.2, bold: true, gap: 2 });
    drawKeyGrid(ctx, [
      ["Cp antes congel.", `${fmt(b.cp_above_kcal_kg_c, 3)} kcal/kg°C | ${fmt(b.cp_above_kj_kg_k, 2)} kJ/kgK`],
      ["Cp após congel.", `${fmt(b.cp_below_kcal_kg_c, 3)} kcal/kg°C | ${fmt(b.cp_below_kj_kg_k, 2)} kJ/kgK`],
      ["Calor latente", `${fmt(b.latent_heat_kcal_kg, 2)} kcal/kg | ${fmt(b.latent_heat_kj_kg, 1)} kJ/kg`],
      ["Água total", product.water_content_percent != null ? `${fmt(product.water_content_percent, 1)}%` : "—"],
      ["Água congelável", product.freezable_water_content_percent != null ? `${fmt(product.freezable_water_content_percent, 1)}%` : "—"],
      ["Fração congelada", `${fmt(Number(b.frozen_water_fraction) * 100, 1)}%`],
      ["T entrada", `${fmt(product.inlet_temp_c)} °C`],
      ["T congelamento", product.initial_freezing_temp_c != null ? `${fmt(product.initial_freezing_temp_c)} °C` : "—"],
      ["T final", `${fmt(product.outlet_temp_c)} °C`],
      ["Tempo mudança estado", phaseTimeMin ? `${fmt(phaseTimeMin / 60, 1)} h estimadas` : `${fmt((Number(b.latent_kcal_h) / Math.max(1, Number(b.total_kcal_h))) * Number(b.hours), 1)} h proporcionais`],
    ], 2);
    table(ctx, ["Etapa", "Carga produzida", "Energia"], [
      ["Antes do congelamento", `${fmt(b.sensible_above_kcal_h, 0)} kcal/h`, `${fmt(Number(b.sensible_above_kcal_h) * Number(b.hours), 0)} kcal`],
      ["Mudança de estado / latente", `${fmt(b.latent_kcal_h, 0)} kcal/h`, `${fmt(Number(b.latent_kcal_h) * Number(b.hours), 0)} kcal`],
      ["Após congelamento", `${fmt(b.sensible_below_kcal_h, 0)} kcal/h`, `${fmt(Number(b.sensible_below_kcal_h) * Number(b.hours), 0)} kcal`],
    ], [0.46, 0.27, 0.27]);
    freezingCurve(ctx, b);
  }
}

function pieChart(ctx: Ctx, result: any) {
  const rows = loadRows(result);
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  if (!rows.length || total <= 0) return;
  ensure(ctx, 118);
  const cx = M + 58;
  const cy = ctx.y - 58;
  let start = -90;
  rows.forEach(([_, value], index) => {
    const angle = (value / total) * Math.PI * 2;
    const end = start + (angle * 180) / Math.PI;
    const large = end - start > 180 ? 1 : 0;
    const sx = cx + 48 * Math.cos((start * Math.PI) / 180);
    const sy = cy + 48 * Math.sin((start * Math.PI) / 180);
    const ex = cx + 48 * Math.cos((end * Math.PI) / 180);
    const ey = cy + 48 * Math.sin((end * Math.PI) / 180);
    ctx.page.drawSvgPath(`M ${cx} ${cy} L ${sx} ${sy} A 48 48 0 ${large} 1 ${ex} ${ey} Z`, { color: PIE_COLORS[index % PIE_COLORS.length] });
    start = end;
  });
  rows.forEach(([label, value], index) => {
    const y = ctx.y - 12 - index * 12;
    ctx.page.drawRectangle({ x: M + 135, y: y - 1, width: 7, height: 7, color: PIE_COLORS[index % PIE_COLORS.length] });
    ctx.page.drawText(`${clean(label)} - ${fmt((value / total) * 100, 1)}%`, { x: M + 148, y, size: 8, font: ctx.fonts.regular, color: COLORS.text });
  });
  ctx.y -= 118;
}

async function drawEquipmentImage(ctx: Ctx, selection: any, x: number, y: number) {
  const source = selection?.equipment_image_data_url as string | undefined;
  if (!source) return false;
  const match = source.match(/^data:(image\/(png|jpe?g));base64,(.+)$/i);
  if (!match) return false;
  const bytes = Uint8Array.from(Buffer.from(match[3], "base64"));
  const image = match[1].includes("png") ? await ctx.pdf.embedPng(bytes) : await ctx.pdf.embedJpg(bytes);
  const scale = Math.min(120 / image.width, 78 / image.height);
  ctx.page.drawImage(image, { x, y, width: image.width * scale, height: image.height * scale });
  return true;
}

export async function buildColdProMemorialPdfBuffer({ project, environments, results, selections, products, generatedAt, generatedBy, aiAnalysis }: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const ctx: Ctx = { pdf, page: pdf.addPage(A4), fonts, y: A4[1] - 76, projectName: project?.name ?? "Projeto", generatedAt };

  ctx.page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: COLORS.primary });
  ctx.page.drawText("CN COLDPRO - MEMORIAL TÉCNICO", { x: M + 14, y: A4[1] - 96, size: 10, font: fonts.bold, color: rgb(0.61, 0.74, 0.84) });
  wrap(fonts.bold, project?.name ?? "Projeto", 30, A4[0] - M * 2 - 28).forEach((line) => {
    ctx.page.drawText(line, { x: M + 14, y: ctx.y, size: 30, font: fonts.bold, color: COLORS.white });
    ctx.y -= 38;
  });
  ctx.page.drawText("Cálculo de carga térmica, premissas auditáveis e seleção de equipamentos", { x: M + 14, y: ctx.y - 4, size: 12, font: fonts.regular, color: rgb(0.81, 0.88, 0.93) });
  const totals = environments.reduce((acc: any, env: any) => {
    const r = results.find((x: any) => x.environment_id === env.id);
    acc.kcal += Number(r?.total_required_kcal_h ?? 0); acc.kw += Number(r?.total_required_kw ?? 0); acc.tr += Number(r?.total_required_tr ?? 0);
    return acc;
  }, { kcal: 0, kw: 0, tr: 0 });
  ctx.y = 205;
  drawKpis(ctx, [["Carga total", `${fmt(totals.kcal, 0)} kcal/h`], ["Potência", `${fmt(totals.kw)} kW`], ["TR", `${fmt(totals.tr)} TR`]]);
  ctx.page.drawText(`Aplicação: ${clean(project?.application_type)}   Revisão: ${project?.revision ?? 0}   Gerado em: ${clean(generatedAt)}`, { x: M + 14, y: 74, size: 9, font: fonts.regular, color: rgb(0.81, 0.88, 0.93) });

  addPage(ctx);
  heading(ctx, "Resumo do projeto", 1);
  paragraph(ctx, "Este documento consolida a versão completa do memorial de cálculo: premissas informadas para cada ambiente, cálculo de carga térmica por componente, gráficos de distribuição, resultado do dimensionamento e equipamento selecionado.");
  drawKpis(ctx, [["Ambientes", String(environments.length)], ["Carga total", `${fmt(totals.kcal, 0)} kcal/h`], ["Potência", `${fmt(totals.kw)} kW`], ["TR", `${fmt(totals.tr)} TR`]]);
  heading(ctx, "Lista de ambientes", 2);
  table(ctx, ["#", "Ambiente", "Tipo", "Volume", "Tint", "Carga"], environments.map((env: any, idx: number) => {
    const r = results.find((x: any) => x.environment_id === env.id);
    return [String(idx + 1), env.name, env.environment_type, `${fmt(env.volume_m3)} m3`, `${fmt(env.internal_temp_c)} °C`, `${fmt(r?.total_required_kcal_h, 0)} kcal/h`];
  }), [0.08, 0.32, 0.18, 0.14, 0.12, 0.16]);
  heading(ctx, "Visão geral da carga térmica", 2);
  paragraph(ctx, "Tecnicamente, a carga térmica foi consolidada pelas parcelas de transmissão, produto/processo, infiltração, ocupação, iluminação, motores, ventiladores, degelo e demais cargas internas, acrescidas do fator de segurança configurado. Comercialmente, este resultado orienta a seleção de equipamentos com capacidade suficiente para atender a operação diária com margem de sobra auditável.");
  const aggregateResult = results.reduce((acc: any, result: any) => { for (const [key, value] of Object.entries(result ?? {})) if (key.endsWith("_kcal_h")) acc[key] = Number(acc[key] ?? 0) + Number(value ?? 0); return acc; }, {});
  pieChart(ctx, aggregateResult);
  stackedLoadChart(ctx, aggregateResult);
  projectLineChart(ctx, environments, results);

  heading(ctx, "Memória de cálculo por ambiente", 1);
  for (const [idx, env] of environments.entries()) {
    const result = results.find((r: any) => r.environment_id === env.id);
    const selection = selections.find((s: any) => s.environment_id === env.id);
    const envProducts = products.filter((p: any) => p.environment_id === env.id);
    ensure(ctx, 90);
    ctx.page.drawRectangle({ x: M, y: ctx.y - 22, width: A4[0] - M * 2, height: 22, color: COLORS.primary });
    ctx.page.drawText(`${idx + 1}. ${clean(env.name)}`, { x: M + 8, y: ctx.y - 15, size: 10, font: fonts.bold, color: COLORS.white });
    ctx.y -= 32;
    heading(ctx, "1. Premissas de cálculo do ambiente", 3);
    drawKeyGrid(ctx, [["Solicitado", env.name], ["Tipo", env.environment_type], ["Dimensões", `${fmt(env.length_m)} x ${fmt(env.width_m)} x ${fmt(env.height_m)} m`], ["Volume", `${fmt(env.volume_m3)} m3`], ["Temp. requerida", `${fmt(env.internal_temp_c)} °C`], ["Condição externa", `${fmt(env.external_temp_c)} °C`], ["UR interna", `${fmt(env.relative_humidity_percent)}%`], ["Painel", `${fmt(env.wall_thickness_mm)} mm`], ["Portas", `${fmt(env.door_openings_per_day)}/dia`], ["Compressor", `${fmt(env.compressor_runtime_hours_day)} h/dia`]], 2);
    if (envProducts.length) {
      table(ctx, ["Produto", "kg/dia", "T entrada", "T final", "Tempo"], envProducts.map((p: any) => [p.product_name, fmt(p.mass_kg_day), `${fmt(p.inlet_temp_c)} °C`, `${fmt(p.outlet_temp_c)} °C`, `${fmt(p.process_time_h)} h`]), [0.36, 0.16, 0.16, 0.16, 0.16]);
      drawProductThermalDetails(ctx, envProducts, env);
    }
    if (result) {
      heading(ctx, "2. Cálculo executado", 3);
      paragraph(ctx, "O cálculo considera as trocas térmicas pela envoltória, a retirada de calor do produto e embalagem, a entrada de ar por infiltração e as cargas internas informadas para o ambiente.", { size: 8.5, gap: 4 });
      temperatureCurveChart(ctx, env);
      barChart(ctx, result);
      stackedLoadChart(ctx, result);
      table(ctx, ["Componente", "Carga"], [["Transmissão", result.transmission_kcal_h], ["Produto", result.product_kcal_h], ["Embalagem", result.packaging_kcal_h], ["Infiltração", result.infiltration_kcal_h], ["Pessoas", result.people_kcal_h], ["Iluminação", result.lighting_kcal_h], ["Motores", result.motors_kcal_h], ["Ventiladores", result.fans_kcal_h], ["Degelo", result.defrost_kcal_h], ["Outros", result.other_kcal_h]].map(([l, v]) => [String(l), `${fmt(v, 0)} kcal/h`]), [0.68, 0.32]);
      const inf = result.calculation_breakdown?.infiltration_technical;
      const deg = result.calculation_breakdown?.defrost_suggestion;
      if (inf) table(ctx, ["Memória técnica de infiltração, umidade e gelo", "Valor"], [["Região / UR externa", `${inf.regionDescription ?? inf.regionUsed} / ${fmt(inf.externalRH)}%`], ["UR interna adotada", `${fmt(inf.internalRH)}%`], ["Ar por porta", `${fmt(inf.doorInfiltrationM3Day, 0)} m³/dia`], ["Ar contínuo", `${fmt(inf.continuousInfiltrationM3Day, 0)} m³/dia`], ["Carga sensível", `${fmt(inf.sensibleKcalH, 0)} kcal/h`], ["Carga latente", `${fmt(inf.latentKcalH, 0)} kcal/h`], ["Δ umidade", `${fmt(inf.deltaHumidityGM3)} g/m³`], ["Gelo formado", `${fmt(inf.iceKgDay)} kg/dia`], ["Degelo sugerido", `${fmt(deg?.defrostKcalH, 0)} kcal/h`]], [0.58, 0.42]);
      heading(ctx, "3. Resultado do dimensionamento", 3);
      drawKpis(ctx, [["Subtotal", `${fmt(result.subtotal_kcal_h, 0)} kcal/h`], ["Segurança", `${fmt(result.safety_kcal_h, 0)} kcal/h`], ["Carga requerida", `${fmt(result.total_required_kcal_h, 0)} kcal/h`]]);
      paragraph(ctx, `Resultado final: ${fmt(result.total_required_kcal_h, 0)} kcal/h - ${fmt(result.total_required_kw)} kW - ${fmt(result.total_required_tr)} TR.`, { bold: true, gap: 2 });
    }
    if (selection) {
      heading(ctx, "Equipamento selecionado", 3);
      if (result) {
        const offered = Number(selection.capacity_total_kcal_h ?? 0);
        const required = Number(result.total_required_kcal_h ?? 0);
        const margin = required > 0 ? ((offered - required) / required) * 100 : 0;
        loadOfferChart(ctx, required, offered);
        paragraph(ctx, `Comparativo da câmara: carga requerida de ${fmt(required, 0)} kcal/h versus carga ofertada de ${fmt(offered, 0)} kcal/h. Margem operacional calculada: ${fmt(margin, 1)}%.`, { size: 8.5, bold: true, gap: 4 });
      }
      ensure(ctx, 96);
      table(ctx, ["Modelo", "Qtd.", "Cap. unit.", "Cap. total", "Sobra"], [[selection.model, fmt(selection.quantity), `${fmt(selection.capacity_unit_kcal_h, 0)} kcal/h`, `${fmt(selection.capacity_total_kcal_h, 0)} kcal/h`, `${fmt(selection.surplus_percent)}%`]], [0.34, 0.1, 0.18, 0.2, 0.18]);
      const imageY = ctx.y - 84;
      ctx.page.drawRectangle({ x: A4[0] - M - 136, y: imageY - 6, width: 136, height: 92, color: COLORS.soft, borderColor: COLORS.border, borderWidth: 0.5 });
      const ok = await drawEquipmentImage(ctx, selection, A4[0] - M - 128, imageY + 2);
      if (!ok) ctx.page.drawText("Foto do equipamento não cadastrada", { x: A4[0] - M - 126, y: imageY + 38, size: 7.5, font: fonts.regular, color: COLORS.muted });
      drawKeyGrid(ctx, [["Vazão total", `${fmt(selection.air_flow_total_m3_h, 0)} m3/h`], ["Trocas/h", fmt(selection.air_changes_hour)], ["Potência", selection.total_power_kw ? `${fmt(selection.total_power_kw)} kW` : "—"], ["COP", selection.cop ? fmt(selection.cop) : "—"]], 2);
    }
  }

  if (aiAnalysis) {
    addPage(ctx);
    heading(ctx, "Laudo final de análise técnica", 1);
    paragraph(ctx, "Análise gerada por IA a partir das premissas, cargas calculadas, propriedades térmicas dos produtos e seleção de equipamentos do memorial.", { size: 8.5, color: COLORS.muted });
    for (const block of String(aiAnalysis).split(/\n{2,}/).filter(Boolean)) paragraph(ctx, block, { size: 9, gap: 6 });
  }

  const pageCount = pdf.getPageCount();
  pdf.getPages().forEach((page, i) => {
    if (i === 0) return;
    page.drawLine({ start: { x: M, y: 30 }, end: { x: A4[0] - M, y: 30 }, thickness: 0.5, color: COLORS.border });
    page.drawText(`CN ColdPro - Memorial gerado em ${clean(generatedAt)}${generatedBy ? ` - por ${clean(generatedBy)}` : ""}`, { x: M, y: 18, size: 7, font: fonts.regular, color: COLORS.muted });
    page.drawText(`Página ${i + 1} de ${pageCount}`, { x: A4[0] - M - 70, y: 18, size: 7, font: fonts.regular, color: COLORS.muted });
  });
  return pdf.save();
}