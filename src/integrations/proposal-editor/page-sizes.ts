// Tamanhos de página suportados pelo editor (em mm) e conversão para px @ 96dpi.
// 1 mm = 96 / 25.4 px ≈ 3.7795275591 px

export type PageSizeId = "A4" | "A3" | "A5" | "Letter" | "Legal" | "Custom";
export type PageOrientation = "portrait" | "landscape";

export interface PageSizeMm {
  /** Largura em mm (orientação retrato). */
  w: number;
  /** Altura em mm (orientação retrato). */
  h: number;
}

export const PAGE_SIZES_MM: Record<Exclude<PageSizeId, "Custom">, PageSizeMm> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A5: { w: 148, h: 210 },
  Letter: { w: 216, h: 279 }, // 8.5" x 11"
  Legal: { w: 216, h: 356 },  // 8.5" x 14" (Ofício US)
};

export const PAGE_SIZE_LABELS: Record<PageSizeId, string> = {
  A4: "A4 (210 × 297 mm)",
  A3: "A3 (297 × 420 mm)",
  A5: "A5 (148 × 210 mm)",
  Letter: "Carta (216 × 279 mm)",
  Legal: "Ofício (216 × 356 mm)",
  Custom: "Personalizado",
};

export const MM_TO_PX = 96 / 25.4;

export function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

export function pxToMm(px: number): number {
  return Math.round((px / MM_TO_PX) * 10) / 10;
}

export interface DocumentPageSize {
  id: PageSizeId;
  orientation: PageOrientation;
  /** mm — quando id !== "Custom", são derivados de PAGE_SIZES_MM. */
  widthMm: number;
  heightMm: number;
}

export const DEFAULT_PAGE_SIZE: DocumentPageSize = {
  id: "A4",
  orientation: "portrait",
  widthMm: PAGE_SIZES_MM.A4.w,
  heightMm: PAGE_SIZES_MM.A4.h,
};

export function resolvePageSize(size: DocumentPageSize): { wPx: number; hPx: number } {
  const w = size.orientation === "landscape" ? size.heightMm : size.widthMm;
  const h = size.orientation === "landscape" ? size.widthMm : size.heightMm;
  return { wPx: mmToPx(w), hPx: mmToPx(h) };
}

export function makePageSize(id: PageSizeId, orientation: PageOrientation = "portrait", custom?: PageSizeMm): DocumentPageSize {
  if (id === "Custom") {
    const c = custom ?? { w: 210, h: 297 };
    return { id, orientation, widthMm: c.w, heightMm: c.h };
  }
  const base = PAGE_SIZES_MM[id];
  return { id, orientation, widthMm: base.w, heightMm: base.h };
}
