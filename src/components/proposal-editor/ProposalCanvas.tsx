// Canvas A4 do Page Builder. Renderiza cada página como um "papel" com chrome
// fiel ao template (capa pictórica, header com curva azul, rodapé azul) e
// blocos editáveis posicionados absolutamente via react-rnd.
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Rnd } from "react-rnd";
import {
  makeBlock,
  defaultLayoutFor,
  A4_W,
  A4_H,
  type BlockType,
  type DocumentBlock,
  type DocumentPage,
  type BlockLayout,
} from "@/integrations/proposal-editor/types";
import type { ProposalTemplate, TemplateAsset } from "@/integrations/proposal-editor/template.types";
import { BlockRenderer, type ProposalDynamicContext } from "./BlockRenderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageChrome } from "./PageChrome";
import { cn } from "@/lib/utils";

// Handles visíveis (8 pontos: cantos + meios) — só aparecem no bloco selecionado.
const handleBase =
  "block bg-white border-2 border-primary shadow-md rounded-sm pointer-events-auto";
const handleComponents = {
  topLeft: <div className={`${handleBase} h-3 w-3`} />,
  top: <div className={`${handleBase} h-2 w-6`} />,
  topRight: <div className={`${handleBase} h-3 w-3`} />,
  right: <div className={`${handleBase} h-6 w-2`} />,
  bottomRight: <div className={`${handleBase} h-3 w-3`} />,
  bottom: <div className={`${handleBase} h-2 w-6`} />,
  bottomLeft: <div className={`${handleBase} h-3 w-3`} />,
  left: <div className={`${handleBase} h-6 w-2`} />,
};

interface Props {
  pages: DocumentPage[];
  selectedId: string | null;
  template: ProposalTemplate | null;
  assets: TemplateAsset[];
  proposalContext: ProposalDynamicContext;
  selectedBlockId: string | null;
  proposalId: string;
  documentFontFamily?: string;
  onSelectBlock: (id: string | null) => void;
  onPagesChange: (next: DocumentPage[]) => void;
  onSelect: (id: string) => void;
}

const ADDABLE_BLOCKS: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Título" },
  { type: "rich_text", label: "Texto livre" },
  { type: "image", label: "Imagem" },
  { type: "dynamic_field", label: "Campo dinâmico" },
  { type: "proposal_number_box", label: "Caixa Nº da proposta" },
  { type: "client_info_box", label: "Caixa do cliente" },
  { type: "project_info_box", label: "Caixa do projeto" },
  { type: "responsible_info_box", label: "Caixa do responsável" },
  { type: "key_value_list", label: "Lista chave/valor" },
  { type: "included_items", label: "Itens inclusos" },
  { type: "excluded_items", label: "Itens NÃO inclusos" },
  { type: "differentials_list", label: "Lista de diferenciais" },
  { type: "cases_list", label: "Lista de cases" },
  { type: "investment_table", label: "Tabela de investimento" },
  { type: "tax_table", label: "Tabela de impostos" },
  { type: "payment_table", label: "Tabela de pagamento" },
  { type: "characteristics_table", label: "Características técnicas" },
  { type: "equipments_table", label: "Tabela de equipamentos" },
  { type: "technical_table", label: "Tabela técnica genérica" },
  { type: "bank_data", label: "Dados bancários" },
  { type: "signature", label: "Assinatura" },
  { type: "attached_pdf", label: "PDF anexado" },
];

export function ProposalCanvas({
  pages,
  selectedId,
  template,
  assets,
  proposalContext,
  selectedBlockId,
  proposalId,
  documentFontFamily,
  onSelectBlock,
  onPagesChange,
  onSelect,
}: Props) {
  const sorted = [...pages].sort((a, b) => a.order - b.order).filter((p) => p.visible);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selectedId) return;
    const el = pageRefs.current[selectedId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  const updatePage = (pageId: string, patch: Partial<DocumentPage>) => {
    onPagesChange(pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)));
  };

  const updateBlock = (pageId: string, next: DocumentBlock) => {
    updatePage(pageId, {
      blocks: (pages.find((p) => p.id === pageId)?.blocks ?? []).map((b) =>
        b.id === next.id ? next : b,
      ),
    });
  };

  const deleteBlock = (pageId: string, blockId: string) => {
    updatePage(pageId, {
      blocks: (pages.find((p) => p.id === pageId)?.blocks ?? [])
        .filter((b) => b.id !== blockId)
        .map((b, i) => ({ ...b, order: i })),
    });
    if (selectedBlockId === blockId) onSelectBlock(null);
  };

  const duplicateBlock = (pageId: string, blockId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const src = page.blocks.find((b) => b.id === blockId);
    if (!src) return;
    const layout = (src.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(src.type);
    const cloned = makeBlock(
      src.type,
      { ...src.data, layout: { ...layout, x: Math.min(layout.x + 20, A4_W - layout.w - 10), y: Math.min(layout.y + 20, A4_H - layout.h - 10) } },
      { title: src.title, source: src.source, order: page.blocks.length },
    );
    updatePage(pageId, { blocks: [...page.blocks, cloned] });
  };

  const addBlock = (pageId: string, type: BlockType) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const layout = defaultLayoutFor(type, page.blocks.length);
    const newBlock = makeBlock(type, { layout }, { order: page.blocks.length });
    updatePage(pageId, { blocks: [...page.blocks, newBlock] });
  };

  const handleDragResize = (
    pageId: string,
    block: DocumentBlock,
    next: BlockLayout,
  ) => {
    updateBlock(pageId, { ...block, data: { ...block.data, layout: next } });
  };

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-slate-200 p-6"
      style={{
        // CSS vars do template
        ["--tpl-primary" as string]: template?.primary_color ?? "#0c2340",
        ["--tpl-accent" as string]: template?.accent_color ?? "#2d8a9e",
        ["--tpl-accent-2" as string]: template?.accent_color_2 ?? "#5cbdb9",
        fontFamily: documentFontFamily || "Inter, system-ui, sans-serif",
      }}
      onClick={() => onSelectBlock(null)}
    >
      {sorted.map((page, idx) => {
        const isCover = page.type === "cover";
        const isContracapa = page.type === "contracapa";
        return (
          <div
            key={page.id}
            ref={(el) => {
              pageRefs.current[page.id] = el;
            }}
            className={cn(
              "relative mx-auto mb-8 overflow-hidden bg-white shadow-lg ring-1 ring-black/10 transition",
              page.id === selectedId && "ring-2 ring-primary",
            )}
            style={{ width: A4_W, height: A4_H }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(page.id);
              onSelectBlock(null);
            }}
          >
            {/* Chrome A4 */}
            <PageChrome
              template={template}
              assets={assets}
              pageType={page.type}
              pageNumber={idx + 1}
              totalPages={sorted.length}
            />

            {/* Camada de blocos posicionados absolutamente */}
            <div className="absolute inset-0">
              {page.blocks
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((block) => {
                  const layout =
                    (block.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(block.type);
                  const selected = selectedBlockId === block.id;
                  return (
                    <Rnd
                      key={block.id}
                      bounds="parent"
                      size={{ width: layout.w, height: layout.h }}
                      position={{ x: layout.x, y: layout.y }}
                      disableDragging={block.locked}
                      enableResizing={!block.locked}
                      minWidth={60}
                      minHeight={30}
                      resizeHandleComponent={selected ? handleComponents : undefined}
                      onDragStop={(_e, d) =>
                        handleDragResize(page.id, block, { ...layout, x: Math.round(d.x), y: Math.round(d.y) })
                      }
                      onResizeStop={(_e, _dir, ref, _delta, position) =>
                        handleDragResize(page.id, block, {
                          ...layout,
                          w: parseInt(ref.style.width, 10),
                          h: parseInt(ref.style.height, 10),
                          x: Math.round(position.x),
                          y: Math.round(position.y),
                        })
                      }
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onSelectBlock(block.id);
                      }}
                      style={{ zIndex: selected ? 40 : 10 }}
                    >
                      <BlockRenderer
                        block={block}
                        selected={selected}
                        template={template}
                        assets={assets}
                        proposalContext={proposalContext}
                        proposalId={proposalId}
                        onChange={(next) => updateBlock(page.id, next)}
                        onDelete={() => deleteBlock(page.id, block.id)}
                        onDuplicate={() => duplicateBlock(page.id, block.id)}
                      />
                    </Rnd>
                  );
                })}
            </div>

            {/* Toolbar inferior — adicionar bloco */}
            {!isCover && !isContracapa ? (
              <div
                className="absolute bottom-12 left-1/2 z-30 -translate-x-1/2"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-dashed bg-white/95 text-[11px] shadow-sm"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Adicionar bloco
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="max-h-[60vh] overflow-y-auto">
                    {ADDABLE_BLOCKS.map((b) => (
                      <DropdownMenuItem key={b.type} onClick={() => addBlock(page.id, b.type)}>
                        {b.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        );
      })}
      {sorted.length === 0 ? (
        <div
          className="mx-auto mb-8 flex items-center justify-center rounded-md border border-dashed bg-background text-sm text-muted-foreground"
          style={{ width: A4_W, height: 200 }}
        >
          Nenhuma página visível. Adicione uma página na barra lateral.
        </div>
      ) : null}
    </div>
  );
}
