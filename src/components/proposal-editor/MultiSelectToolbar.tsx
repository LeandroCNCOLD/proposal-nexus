// Toolbar flutuante que aparece quando 2+ blocos estão selecionados.
// Permite alinhar / distribuir / igualar tamanho / empilhar / excluir em lote
// — independentemente de estarem dentro de um container.
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  StretchHorizontal,
  StretchVertical,
  Maximize2,
  Rows3,
  Columns3,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultLayoutFor,
  type DocumentBlock,
  type BlockLayout,
} from "@/integrations/proposal-editor/types";

interface Props {
  blocks: DocumentBlock[];
  /** Limites de uso (geralmente o tamanho da página). */
  pageW: number;
  pageH: number;
  onUpdateBlocks: (next: DocumentBlock[]) => void;
  onDeleteBlocks: (ids: string[]) => void;
  onClear: () => void;
}

function getLayout(b: DocumentBlock): BlockLayout {
  return (b.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(b.type);
}

function setLayout(b: DocumentBlock, layout: BlockLayout): DocumentBlock {
  return { ...b, data: { ...b.data, layout } };
}

export function MultiSelectToolbar({
  blocks,
  pageW,
  pageH,
  onUpdateBlocks,
  onDeleteBlocks,
  onClear,
}: Props) {
  if (blocks.length < 1) return null;
  const isMulti = blocks.length >= 2;

  // Bounding-box do grupo selecionado (define os "limites" de alinhamento)
  const layouts = blocks.map(getLayout);
  const minX = Math.min(...layouts.map((l) => l.x));
  const minY = Math.min(...layouts.map((l) => l.y));
  const maxX = Math.max(...layouts.map((l) => l.x + l.w));
  const maxY = Math.max(...layouts.map((l) => l.y + l.h));
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  // ---------- Alinhar ----------
  const align = (
    axis: "x" | "y",
    mode: "start" | "center" | "end",
    relativeTo: "selection" | "page" = "selection",
  ) => {
    const baseX = relativeTo === "page" ? 0 : minX;
    const baseY = relativeTo === "page" ? 0 : minY;
    const baseW = relativeTo === "page" ? pageW : bboxW;
    const baseH = relativeTo === "page" ? pageH : bboxH;
    const next = blocks.map((b) => {
      const l = getLayout(b);
      let nx = l.x;
      let ny = l.y;
      if (axis === "x") {
        if (mode === "start") nx = baseX;
        else if (mode === "center") nx = baseX + (baseW - l.w) / 2;
        else nx = baseX + baseW - l.w;
      } else {
        if (mode === "start") ny = baseY;
        else if (mode === "center") ny = baseY + (baseH - l.h) / 2;
        else ny = baseY + baseH - l.h;
      }
      return setLayout(b, { ...l, x: Math.round(nx), y: Math.round(ny) });
    });
    onUpdateBlocks(next);
  };

  // ---------- Distribuir ----------
  const distribute = (axis: "x" | "y") => {
    if (blocks.length < 3) return;
    const sorted = [...blocks].sort((a, b) => {
      const la = getLayout(a);
      const lb = getLayout(b);
      return axis === "x" ? la.x - lb.x : la.y - lb.y;
    });
    const first = getLayout(sorted[0]);
    const last = getLayout(sorted[sorted.length - 1]);
    const startEdge = axis === "x" ? first.x + first.w : first.y + first.h;
    const endEdge = axis === "x" ? last.x : last.y;
    const middle = sorted.slice(1, -1);
    const totalSize = middle.reduce(
      (acc, b) => acc + (axis === "x" ? getLayout(b).w : getLayout(b).h),
      0,
    );
    const space = endEdge - startEdge - totalSize;
    const slot = space / (middle.length + 1);
    let cursor = startEdge + slot;
    const updated: Record<string, DocumentBlock> = {};
    middle.forEach((b) => {
      const l = getLayout(b);
      const nl =
        axis === "x"
          ? { ...l, x: Math.round(cursor) }
          : { ...l, y: Math.round(cursor) };
      updated[b.id] = setLayout(b, nl);
      cursor += (axis === "x" ? l.w : l.h) + slot;
    });
    onUpdateBlocks(blocks.map((b) => updated[b.id] ?? b));
  };

  // ---------- Igualar tamanho ----------
  const equalize = (dim: "w" | "h" | "both") => {
    const maxW = Math.max(...layouts.map((l) => l.w));
    const maxH = Math.max(...layouts.map((l) => l.h));
    const next = blocks.map((b) => {
      const l = getLayout(b);
      return setLayout(b, {
        ...l,
        w: dim === "h" ? l.w : maxW,
        h: dim === "w" ? l.h : maxH,
      });
    });
    onUpdateBlocks(next);
  };

  // ---------- Empilhar ----------
  const stack = (dir: "vertical" | "horizontal", gap = 8) => {
    const sorted = [...blocks].sort((a, b) => {
      const la = getLayout(a);
      const lb = getLayout(b);
      return dir === "vertical" ? la.y - lb.y : la.x - lb.x;
    });
    let cursor = dir === "vertical" ? minY : minX;
    const baseAxis = dir === "vertical" ? minX : minY;
    const updated: Record<string, DocumentBlock> = {};
    sorted.forEach((b) => {
      const l = getLayout(b);
      const nl: BlockLayout =
        dir === "vertical"
          ? { ...l, x: baseAxis, y: Math.round(cursor) }
          : { ...l, x: Math.round(cursor), y: baseAxis };
      updated[b.id] = setLayout(b, nl);
      cursor += (dir === "vertical" ? l.h : l.w) + gap;
    });
    onUpdateBlocks(blocks.map((b) => updated[b.id] ?? b));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 shadow-sm"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        ✦ {blocks.length} {isMulti ? "selecionados" : "selecionado"}
      </span>
      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Alinhar horizontal — sobre a seleção */}
      <ToolBtn title="Alinhar à esquerda" onClick={() => align("x", "start")} disabled={!isMulti}>
        <AlignStartVertical className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Centralizar horizontal" onClick={() => align("x", "center")} disabled={!isMulti}>
        <AlignCenterVertical className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Alinhar à direita" onClick={() => align("x", "end")} disabled={!isMulti}>
        <AlignEndVertical className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Alinhar vertical */}
      <ToolBtn title="Alinhar ao topo" onClick={() => align("y", "start")} disabled={!isMulti}>
        <AlignStartHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Centralizar vertical" onClick={() => align("y", "center")} disabled={!isMulti}>
        <AlignCenterHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Alinhar à base" onClick={() => align("y", "end")} disabled={!isMulti}>
        <AlignEndHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Centralizar na página inteira */}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 text-[10px]"
        title="Centralizar horizontalmente na página"
        onClick={() => align("x", "center", "page")}
      >
        ⇔ pág
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 text-[10px]"
        title="Centralizar verticalmente na página"
        onClick={() => align("y", "center", "page")}
      >
        ⇕ pág
      </Button>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Distribuir */}
      <ToolBtn
        title="Distribuir horizontalmente"
        onClick={() => distribute("x")}
        disabled={blocks.length < 3}
      >
        <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        title="Distribuir verticalmente"
        onClick={() => distribute("y")}
        disabled={blocks.length < 3}
      >
        <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Igualar tamanho */}
      <ToolBtn title="Igualar largura" onClick={() => equalize("w")} disabled={!isMulti}>
        <StretchHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Igualar altura" onClick={() => equalize("h")} disabled={!isMulti}>
        <StretchVertical className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Igualar tamanho (ambos)" onClick={() => equalize("both")} disabled={!isMulti}>
        <Maximize2 className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Empilhar */}
      <ToolBtn title="Empilhar verticalmente" onClick={() => stack("vertical")} disabled={!isMulti}>
        <Rows3 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Empilhar horizontalmente" onClick={() => stack("horizontal")} disabled={!isMulti}>
        <Columns3 className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      <ToolBtn
        title={`Excluir ${blocks.length} bloco(s)`}
        onClick={() => {
          if (
            typeof window !== "undefined" &&
            !window.confirm(`Excluir ${blocks.length} bloco(s) selecionado(s)?`)
          )
            return;
          onDeleteBlocks(blocks.map((b) => b.id));
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </ToolBtn>

      <ToolBtn title="Limpar seleção" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="ml-1 text-[9px] text-muted-foreground">
        Shift+clique para somar
      </span>
    </div>
  );
}

function ToolBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="h-6 w-6 p-0"
    >
      {children}
    </Button>
  );
}
