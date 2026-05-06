// Testes de regressão de transparência dos blocos do Editor de Propostas CN COLD.
// Executar com: bun src/integrations/proposal-editor/transparent-layout.test.ts
import {
  defaultLayoutFor,
  makeDefaultBlocksForPage,
  normalizeTransparentLayout,
  TRANSPARENT_BLOCK_STYLE,
  type BlockType,
  type BlockLayout,
} from "./types";
import { layoutToBoxStyle, layoutToPdfBoxStyle } from "./box-style";
import { CN_COLD_SNIPPETS } from "@/features/proposal-snippets/cn-cold-snippets";

let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("✗", msg);
  }
}

const TYPES: BlockType[] = [
  "heading",
  "rich_text",
  "image",
  "dynamic_field",
  "client_info_box",
  "project_info_box",
  "responsible_info_box",
  "proposal_number_box",
  "proposal_summary_box",
  "investment_table",
  "tax_table",
  "payment_table",
  "characteristics_table",
  "equipments_table",
  "technical_table",
  "key_value_list",
  "included_items",
  "excluded_items",
  "differentials_list",
  "cases_list",
  "bank_data",
  "signature",
  "attached_pdf",
  "container",
];

// 1) defaultLayoutFor — todo tipo é transparente
for (const t of TYPES) {
  const l = defaultLayoutFor(t);
  assert(l.bgMode === "none", `${t} default bgMode === "none"`);
  assert(l.background === "transparent", `${t} default background === "transparent"`);
  assert((l.borderWidth ?? 0) === 0, `${t} default borderWidth === 0`);
  assert((l.bgOpacity ?? 0) === 0, `${t} default bgOpacity === 0`);
}

// 2) makeDefaultBlocksForPage — capa e pagamento não injetam fundo branco
for (const pageType of ["cover", "context", "pagamento", "contracapa"] as const) {
  const blocks = makeDefaultBlocksForPage(pageType);
  for (const b of blocks) {
    const layout = b.data?.layout as BlockLayout | undefined;
    if (!layout) continue;
    assert(
      layout.background !== "white" && layout.background !== "muted",
      `página ${pageType} bloco ${b.type} sem background legado`,
    );
  }
}

// 3) Snippets CN COLD nascem transparentes
for (const s of CN_COLD_SNIPPETS) {
  const blocks = s.build(120, 816);
  for (const b of blocks) {
    const layout = b.data?.layout as BlockLayout | undefined;
    if (!layout) continue;
    assert(
      (layout.bgMode ?? "none") === "none" && layout.background !== "white",
      `snippet ${s.id} bloco transparente`,
    );
  }
}

// 4) layoutToBoxStyle({ bgMode: "none" }) -> sem fundo, sem borda
{
  const css = layoutToBoxStyle({ x: 0, y: 0, w: 100, h: 100, bgMode: "none" });
  assert(!css.background, "layoutToBoxStyle bgMode none sem background");
  assert(!css.border, "layoutToBoxStyle bgMode none sem border");
}

// 5) layoutToPdfBoxStyle({ bgMode: "none" }) -> sem backgroundColor
{
  const pdf = layoutToPdfBoxStyle({ x: 0, y: 0, w: 100, h: 100, bgMode: "none" });
  assert(!pdf.backgroundColor, "layoutToPdfBoxStyle bgMode none sem backgroundColor");
  assert(!pdf.borderWidth, "layoutToPdfBoxStyle bgMode none sem border");
}

// 6) Fallback legado: sem bgMode + background "white" -> NÃO gera fundo no PDF
{
  const pdf = layoutToPdfBoxStyle({
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    background: "white",
  });
  assert(
    !pdf.backgroundColor,
    "layoutToPdfBoxStyle legacy white não vira backgroundColor branco",
  );
}

// 7) normalizeTransparentLayout — normaliza legacy white para transparente
{
  const out = normalizeTransparentLayout({
    x: 10,
    y: 20,
    w: 100,
    h: 50,
    background: "white",
  });
  assert(out.background === "transparent", "normalize white -> transparent");
  assert(out.bgMode === "none", "normalize white -> bgMode none");
  assert(out.x === 10 && out.y === 20, "normalize preserva posição");
}

// 8) normalizeTransparentLayout — preserva customização manual (bgMode solid)
{
  const out = normalizeTransparentLayout({
    x: 0,
    y: 0,
    w: 100,
    h: 50,
    bgMode: "solid",
    bgColor: "#ff0000",
    bgOpacity: 80,
  });
  assert(out.bgMode === "solid", "normalize preserva bgMode solid manual");
  assert(out.bgColor === "#ff0000", "normalize preserva bgColor manual");
}

// 9) Constante exportada
assert(TRANSPARENT_BLOCK_STYLE.bgMode === "none", "TRANSPARENT_BLOCK_STYLE.bgMode === none");
assert(TRANSPARENT_BLOCK_STYLE.background === "transparent", "TRANSPARENT_BLOCK_STYLE.background === transparent");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
