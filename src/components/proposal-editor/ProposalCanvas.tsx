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
import { PALETTE_DRAG_MIME, parsePaletteItem } from "./FieldsPalette";
import { ContainerToolbar, isInsideContainer } from "./ContainerToolbar";
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
  /** Largura do papel em px (default = A4_W). */
  pageWidthPx?: number;
  /** Altura do papel em px (default = A4_H). */
  pageHeightPx?: number;
  onSelectBlock: (id: string | null) => void;
  onPagesChange: (next: DocumentPage[]) => void;
  onSelect: (id: string) => void;
}

const ADDABLE_BLOCKS: { type: BlockType; label: string }[] = [
  { type: "container", label: "📦 Caixa / Container" },
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
  pageWidthPx,
  pageHeightPx,
  onSelectBlock,
  onPagesChange,
  onSelect,
}: Props) {
  const sorted = [...pages].sort((a, b) => a.order - b.order).filter((p) => p.visible);
  const pageW = pageWidthPx ?? A4_W;
  const pageH = pageHeightPx ?? A4_H;
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

  const reorderBlocks = (
    pageId: string,
    blockId: string,
    mode: "forward" | "backward" | "front" | "back",
  ) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const ordered = [...page.blocks].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((b) => b.id === blockId);
    if (index < 0) return;

    const next = [...ordered];
    const [item] = next.splice(index, 1);

    if (mode === "front") next.push(item);
    else if (mode === "back") next.unshift(item);
    else {
      const targetIndex = mode === "forward" ? Math.min(index + 1, next.length) : Math.max(index - 1, 0);
      next.splice(targetIndex, 0, item);
    }

    updatePage(pageId, {
      blocks: next.map((b, i) => ({ ...b, order: i })),
    });
  };

  /** Atualiza vários blocos de uma página de uma só vez (preserva os demais). */
  const updateManyBlocks = (pageId: string, updated: DocumentBlock[]) => {
    const map = new Map(updated.map((b) => [b.id, b]));
    updatePage(pageId, {
      blocks: (pages.find((p) => p.id === pageId)?.blocks ?? []).map(
        (b) => map.get(b.id) ?? b,
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

  /** Apaga um container e TODOS os blocos cuja bbox está dentro dele. */
  const deleteContainerWithChildren = (pageId: string, containerId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const container = page.blocks.find((b) => b.id === containerId);
    if (!container) return;
    const childIds = new Set(
      page.blocks
        .filter((b) => isInsideContainer(b, container))
        .map((b) => b.id),
    );
    childIds.add(containerId);
    updatePage(pageId, {
      blocks: page.blocks
        .filter((b) => !childIds.has(b.id))
        .map((b, i) => ({ ...b, order: i })),
    });
    if (selectedBlockId && childIds.has(selectedBlockId)) onSelectBlock(null);
  };

  const duplicateBlock = (pageId: string, blockId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const src = page.blocks.find((b) => b.id === blockId);
    if (!src) return;
    const layout = (src.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(src.type);
    const cloned = makeBlock(
      src.type,
      { ...src.data, layout: { ...layout, x: Math.min(layout.x + 20, pageW - layout.w - 10), y: Math.min(layout.y + 20, pageH - layout.h - 10) } },
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

  const handlePageDrop = (
    pageId: string,
    e: React.DragEvent<HTMLDivElement>,
  ) => {
    const raw = e.dataTransfer.getData(PALETTE_DRAG_MIME);
    if (!raw) return;
    const item = parsePaletteItem(raw);
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    // Calcula posição relativa ao papel
    const rect = e.currentTarget.getBoundingClientRect();
    const dropX = Math.max(0, Math.round(e.clientX - rect.left));
    const dropY = Math.max(0, Math.round(e.clientY - rect.top));
    const baseLayout = defaultLayoutFor(item.blockType, page.blocks.length);
    const layout: BlockLayout = {
      ...baseLayout,
      x: Math.min(Math.max(0, dropX - 20), pageW - baseLayout.w - 10),
      y: Math.min(Math.max(0, dropY - 10), pageH - baseLayout.h - 10),
    };
    const data: Record<string, unknown> = { layout };
    if (item.blockType === "dynamic_field" && item.fieldKey) {
      data.fieldKey = item.fieldKey;
      data.label = item.label;
    }
    const newBlock = makeBlock(item.blockType, data, {
      order: page.blocks.length,
    });
    updatePage(pageId, { blocks: [...page.blocks, newBlock] });
    onSelect(pageId);
    onSelectBlock(newBlock.id);
  };

  /** Mantém um layout dentro dos limites de uma bbox (container). */
  const clampToBounds = (l: BlockLayout, bounds: BlockLayout): BlockLayout => {
    const w = Math.max(20, Math.min(l.w, bounds.w));
    const h = Math.max(16, Math.min(l.h, bounds.h));
    const x = Math.min(Math.max(l.x, bounds.x), bounds.x + bounds.w - w);
    const y = Math.min(Math.max(l.y, bounds.y), bounds.y + bounds.h - h);
    return { ...l, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  };

  const handleDragResize = (
    pageId: string,
    block: DocumentBlock,
    next: BlockLayout,
  ) => {
    const prev = (block.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(block.type);
    const widthChanged = prev.w !== next.w;
    const heightChanged = prev.h !== next.h;
    const positionChanged = prev.x !== next.x || prev.y !== next.y;

    // Caso especial: container redimensionado → escala filhos proporcionalmente
    // (posição relativa, tamanho e fontSize). Movimento puro (sem resize) também
    // arrasta os filhos junto, para a caixa funcionar como um grupo.
    if (block.type === "container" && (widthChanged || heightChanged || positionChanged)) {
      const page = pages.find((p) => p.id === pageId);
      if (!page) {
        updateBlock(pageId, { ...block, data: { ...block.data, layout: next } });
        return;
      }
      const children = page.blocks.filter((b) => isInsideContainer(b, block));
      const sx = prev.w > 0 ? next.w / prev.w : 1;
      const sy = prev.h > 0 ? next.h / prev.h : 1;
      const fontScale = Math.min(sx, sy); // mantém legibilidade

      const updatedContainer: DocumentBlock = {
        ...block,
        data: { ...block.data, layout: next },
      };

      const updatedChildren: DocumentBlock[] = children.map((child) => {
        const cl = (child.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(child.type);
        // posição relativa ao container antigo
        const relX = cl.x - prev.x;
        const relY = cl.y - prev.y;
        const scaled: BlockLayout = {
          ...cl,
          x: Math.round(next.x + relX * sx),
          y: Math.round(next.y + relY * sy),
          w: Math.max(20, Math.round(cl.w * sx)),
          h: Math.max(16, Math.round(cl.h * sy)),
        };
        // Garante que o filho fique sempre dentro do container redimensionado
        const newLayout = clampToBounds(scaled, next);
        const nextData: Record<string, unknown> = { ...child.data, layout: newLayout };
        if (widthChanged || heightChanged) {
          const baseFs = (child.data.fontSize as number | undefined) ?? 14;
          const nextFs = Math.max(8, Math.min(96, Math.round(baseFs * fontScale * 10) / 10));
          nextData.fontSize = nextFs;
        }
        return { ...child, data: nextData };
      });

      updateManyBlocks(pageId, [updatedContainer, ...updatedChildren]);
      return;
    }

    // Bloco comum: se ele estava dentro de algum container, mantém preso aos
    // limites desse container (não permite "vazar" para fora).
    if (block.type !== "container") {
      const page = pages.find((p) => p.id === pageId);
      const parent = page?.blocks.find(
        (b) => b.type === "container" && b.id !== block.id && isInsideContainer(block, b),
      );
      if (parent) {
        const bounds = (parent.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(parent.type);
        const clamped = clampToBounds(next, bounds);
        updateBlock(pageId, { ...block, data: { ...block.data, layout: clamped } });
        return;
      }
    }

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
            style={{ width: pageW, height: pageH }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(page.id);
              onSelectBlock(null);
            }}
            onDragOver={(e) => {
              if (Array.from(e.dataTransfer.types).includes(PALETTE_DRAG_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(e) => handlePageDrop(page.id, e)}
          >
            {/* Chrome A4 */}
            <PageChrome
              template={template}
              assets={assets}
              pageType={page.type}
              pageNumber={idx + 1}
              totalPages={sorted.length}
              backgroundImageUrl={page.backgroundImageUrl}
              backgroundImageFit={page.backgroundImageFit}
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
                  const isLockedCoverOverlay = isCover && block.type === "cover_identity";
                  return (
                    <Rnd
                      key={block.id}
                      bounds="parent"
                      size={{ width: layout.w, height: layout.h }}
                      position={{ x: layout.x, y: layout.y }}
                       disableDragging={block.locked || isLockedCoverOverlay}
                       enableResizing={!block.locked && !isLockedCoverOverlay}
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
                         if (isLockedCoverOverlay) return;
                        e.stopPropagation();
                        onSelectBlock(block.id);
                      }}
                      style={{
                         zIndex: isLockedCoverOverlay ? 0 : selected ? 1000 : block.order + 10,
                         pointerEvents: isLockedCoverOverlay ? "none" : "auto",
                      }}
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
                       onBringForward={() => reorderBlocks(page.id, block.id, "forward")}
                       onSendBackward={() => reorderBlocks(page.id, block.id, "backward")}
                       onBringToFront={() => reorderBlocks(page.id, block.id, "front")}
                       onSendToBack={() => reorderBlocks(page.id, block.id, "back")}
                      />
                      {selected && block.type === "container" ? (
                        <ContainerToolbar
                          container={block}
                          children={page.blocks.filter((b) => isInsideContainer(b, block))}
                          onUpdateBlocks={(next) => updateManyBlocks(page.id, next)}
                          onUpdateContainer={(next) => updateBlock(page.id, next)}
                          onDeleteWithChildren={() => deleteContainerWithChildren(page.id, block.id)}
                        />
                      ) : null}
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
          style={{ width: pageW, height: 200 }}
        >
          Nenhuma página visível. Adicione uma página na barra lateral.
        </div>
      ) : null}
    </div>
  );
}
