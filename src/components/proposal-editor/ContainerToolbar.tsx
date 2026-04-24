// Toolbar flutuante do bloco "container". Aparece quando um container está
// selecionado e oferece ferramentas para alinhar/distribuir/igualar/estilizar
// os blocos filhos (qualquer bloco cuja bounding-box esteja contida no
// retângulo do container).
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
  Palette,
  Type,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  defaultLayoutFor,
  type DocumentBlock,
  type BlockLayout,
} from "@/integrations/proposal-editor/types";

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Roboto", value: "Roboto, system-ui, sans-serif" },
  { label: "Open Sans", value: "'Open Sans', system-ui, sans-serif" },
  { label: "Montserrat", value: "Montserrat, system-ui, sans-serif" },
  { label: "Poppins", value: "Poppins, system-ui, sans-serif" },
  { label: "Lora (serif)", value: "Lora, Georgia, serif" },
  { label: "Playfair (serif)", value: "'Playfair Display', Georgia, serif" },
  { label: "Mono", value: "ui-monospace, 'JetBrains Mono', monospace" },
];

const TEXT_COLORS = [
  "#0c2340",
  "#1a1a1a",
  "#475569",
  "#94a3b8",
  "#ffffff",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
];

const BG_COLORS = [
  "transparent",
  "#ffffff",
  "#f8fafc",
  "#f1f5f9",
  "#e0f2fe",
  "#dcfce7",
  "#fef3c7",
  "#ffe4e6",
  "#ede9fe",
  "#0c2340",
];

interface Props {
  container: DocumentBlock;
  children: DocumentBlock[];
  onUpdateBlocks: (next: DocumentBlock[]) => void;
  onUpdateContainer: (next: DocumentBlock) => void;
  /** Apaga o container e todos os blocos filhos. */
  onDeleteWithChildren: () => void;
}

/** Lê layout (com defaults) a partir do bloco. */
function getLayout(b: DocumentBlock): BlockLayout {
  return (b.data.layout as BlockLayout | undefined) ?? defaultLayoutFor(b.type);
}

function setLayout(b: DocumentBlock, layout: BlockLayout): DocumentBlock {
  return { ...b, data: { ...b.data, layout } };
}

/** Verifica se a bounding-box do filho está contida na do container. */
export function isInsideContainer(child: DocumentBlock, container: DocumentBlock): boolean {
  if (child.id === container.id) return false;
  if (child.type === "container") return false; // não aninha
  const c = getLayout(container);
  const k = getLayout(child);
  const cx2 = c.x + c.w;
  const cy2 = c.y + c.h;
  const kx2 = k.x + k.w;
  const ky2 = k.y + k.h;
  // Centro do filho dentro do container — tolerância simples.
  const cxK = k.x + k.w / 2;
  const cyK = k.y + k.h / 2;
  if (cxK < c.x || cxK > cx2 || cyK < c.y || cyK > cy2) return false;
  // Ao menos 60% da área dentro
  const ix = Math.max(0, Math.min(kx2, cx2) - Math.max(k.x, c.x));
  const iy = Math.max(0, Math.min(ky2, cy2) - Math.max(k.y, c.y));
  const inter = ix * iy;
  const area = Math.max(1, k.w * k.h);
  return inter / area >= 0.6;
}

export function ContainerToolbar({
  container,
  children,
  onUpdateBlocks,
  onUpdateContainer,
  onDeleteWithChildren,
}: Props) {
  const cLayout = getLayout(container);
  const padding = (container.data.padding as number | undefined) ?? 12;
  const gap = (container.data.gap as number | undefined) ?? 8;
  const innerX = cLayout.x + padding;
  const innerY = cLayout.y + padding;
  const innerW = Math.max(0, cLayout.w - padding * 2);
  const innerH = Math.max(0, cLayout.h - padding * 2);

  const setContainerData = (patch: Record<string, unknown>) => {
    onUpdateContainer({ ...container, data: { ...container.data, ...patch } });
  };

  // ---------- Alinhar ----------
  const alignChildren = (
    axis: "x" | "y",
    mode: "start" | "center" | "end",
  ) => {
    if (children.length === 0) return;
    const next = children.map((b) => {
      const l = getLayout(b);
      let nx = l.x;
      let ny = l.y;
      if (axis === "x") {
        if (mode === "start") nx = innerX;
        else if (mode === "center") nx = innerX + (innerW - l.w) / 2;
        else nx = innerX + innerW - l.w;
      } else {
        if (mode === "start") ny = innerY;
        else if (mode === "center") ny = innerY + (innerH - l.h) / 2;
        else ny = innerY + innerH - l.h;
      }
      return setLayout(b, { ...l, x: Math.round(nx), y: Math.round(ny) });
    });
    onUpdateBlocks(next);
  };

  // ---------- Distribuir ----------
  const distributeChildren = (axis: "x" | "y") => {
    if (children.length < 3) return;
    const sorted = [...children].sort((a, b) => {
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
    onUpdateBlocks(children.map((b) => updated[b.id] ?? b));
  };

  // ---------- Igualar tamanho ----------
  const equalize = (dim: "w" | "h" | "both") => {
    if (children.length < 2) return;
    const layouts = children.map(getLayout);
    const maxW = Math.max(...layouts.map((l) => l.w));
    const maxH = Math.max(...layouts.map((l) => l.h));
    const next = children.map((b) => {
      const l = getLayout(b);
      const nl: BlockLayout = {
        ...l,
        w: dim === "h" ? l.w : maxW,
        h: dim === "w" ? l.h : maxH,
      };
      return setLayout(b, nl);
    });
    onUpdateBlocks(next);
  };

  // ---------- Empilhar (stack) ----------
  const stack = (dir: "vertical" | "horizontal") => {
    if (children.length === 0) return;
    const sorted = [...children].sort((a, b) => {
      const la = getLayout(a);
      const lb = getLayout(b);
      return dir === "vertical" ? la.y - lb.y : la.x - lb.x;
    });
    let cursor = dir === "vertical" ? innerY : innerX;
    const updated: Record<string, DocumentBlock> = {};
    sorted.forEach((b) => {
      const l = getLayout(b);
      const nl: BlockLayout =
        dir === "vertical"
          ? { ...l, x: innerX, y: Math.round(cursor), w: innerW }
          : { ...l, x: Math.round(cursor), y: innerY, h: innerH };
      updated[b.id] = setLayout(b, nl);
      cursor += (dir === "vertical" ? nl.h : nl.w) + gap;
    });
    onUpdateBlocks(children.map((b) => updated[b.id] ?? b));
  };

  // ---------- Estilo aplicado aos filhos ----------
  const applyChildStyle = (patch: Partial<BlockLayout>) => {
    const next = children.map((b) => {
      const l = getLayout(b);
      return setLayout(b, { ...l, ...patch });
    });
    onUpdateBlocks(next);
  };

  const applyChildFont = (fontFamily: string) => {
    const next = children.map((b) => ({
      ...b,
      data: { ...b.data, fontFamily },
    }));
    onUpdateBlocks(next);
  };

  return (
    <div
      className="absolute -top-12 left-0 z-50 flex flex-wrap items-center gap-1 rounded-md border bg-background px-1.5 py-1 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        📦 Caixa · {children.length} {children.length === 1 ? "item" : "itens"}
      </span>
      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Alinhar horizontal */}
      <ToolBtn title="Alinhar à esquerda" onClick={() => alignChildren("x", "start")}>
        <AlignStartVertical className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Centralizar horizontal" onClick={() => alignChildren("x", "center")}>
        <AlignCenterVertical className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Alinhar à direita" onClick={() => alignChildren("x", "end")}>
        <AlignEndVertical className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Alinhar vertical */}
      <ToolBtn title="Alinhar ao topo" onClick={() => alignChildren("y", "start")}>
        <AlignStartHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Centralizar vertical" onClick={() => alignChildren("y", "center")}>
        <AlignCenterHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Alinhar à base" onClick={() => alignChildren("y", "end")}>
        <AlignEndHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Distribuir */}
      <ToolBtn
        title="Distribuir horizontal"
        onClick={() => distributeChildren("x")}
        disabled={children.length < 3}
      >
        <AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        title="Distribuir vertical"
        onClick={() => distributeChildren("y")}
        disabled={children.length < 3}
      >
        <AlignVerticalDistributeCenter className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Igualar tamanho */}
      <ToolBtn title="Igualar largura" onClick={() => equalize("w")} disabled={children.length < 2}>
        <StretchHorizontal className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Igualar altura" onClick={() => equalize("h")} disabled={children.length < 2}>
        <StretchVertical className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        title="Igualar tamanho"
        onClick={() => equalize("both")}
        disabled={children.length < 2}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Empilhar */}
      <ToolBtn title="Empilhar verticalmente (largura plena)" onClick={() => stack("vertical")}>
        <Rows3 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Empilhar horizontalmente (altura plena)" onClick={() => stack("horizontal")}>
        <Columns3 className="h-3.5 w-3.5" />
      </ToolBtn>

      <span className="mx-0.5 text-muted-foreground/40">|</span>

      {/* Estilo de texto dos filhos */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[10px]"
            title="Cor do texto dos itens"
          >
            <Type className="h-3.5 w-3.5" /> Texto
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px]">Cor do texto</DropdownMenuLabel>
          <div className="grid grid-cols-6 gap-1 p-2">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => applyChildStyle({ color: c })}
                className="h-5 w-5 rounded border border-border"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px]">Tamanho do texto</DropdownMenuLabel>
          <div className="flex gap-1 p-2">
            {[0.85, 1, 1.15, 1.3, 1.6].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => applyChildStyle({ fontScale: s })}
                className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              >
                {s}x
              </button>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px]">Alinhamento do texto</DropdownMenuLabel>
          <div className="flex gap-1 p-2">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => applyChildStyle({ align: a })}
                className="flex-1 rounded border px-1 py-0.5 text-[10px] hover:bg-muted"
              >
                {a === "left" ? "⟸" : a === "center" ? "⇔" : "⟹"}
              </button>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px]">Família da fonte</DropdownMenuLabel>
          {FONT_FAMILIES.map((f) => (
            <DropdownMenuItem
              key={f.value}
              onClick={() => applyChildFont(f.value)}
              className="text-xs"
              style={{ fontFamily: f.value }}
            >
              {f.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Estilo do container */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-[10px]"
            title="Aparência da caixa"
          >
            <Palette className="h-3.5 w-3.5" /> Caixa
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-[10px]">Cor de fundo</DropdownMenuLabel>
          <div className="grid grid-cols-5 gap-1 p-2">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setContainerData({ backgroundColor: c })}
                className="h-6 w-full rounded border border-border"
                style={{
                  background:
                    c === "transparent"
                      ? "repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%) 50% / 8px 8px"
                      : c,
                }}
                title={c}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px]">Borda (cor / espessura)</DropdownMenuLabel>
          <div className="flex items-center gap-1 p-2">
            <Input
              type="color"
              value={(container.data.borderColor as string | undefined) ?? "#cbd5e1"}
              onChange={(e) => setContainerData({ borderColor: e.target.value })}
              className="h-7 w-10 p-0.5"
            />
            <Input
              type="number"
              min={0}
              max={6}
              value={(container.data.borderWidth as number | undefined) ?? 1}
              onChange={(e) =>
                setContainerData({ borderWidth: Number(e.target.value) || 0 })
              }
              className="h-7 w-14 text-xs"
            />
            <span className="text-[10px] text-muted-foreground">px</span>
          </div>
          <DropdownMenuLabel className="text-[10px]">
            Cantos arredondados / Padding / Gap
          </DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1 p-2">
            <label className="flex flex-col text-[9px] text-muted-foreground">
              Raio
              <Input
                type="number"
                min={0}
                max={40}
                value={(container.data.radius as number | undefined) ?? 8}
                onChange={(e) => setContainerData({ radius: Number(e.target.value) || 0 })}
                className="h-7 text-xs"
              />
            </label>
            <label className="flex flex-col text-[9px] text-muted-foreground">
              Padding
              <Input
                type="number"
                min={0}
                max={60}
                value={padding}
                onChange={(e) => setContainerData({ padding: Number(e.target.value) || 0 })}
                className="h-7 text-xs"
              />
            </label>
            <label className="flex flex-col text-[9px] text-muted-foreground">
              Gap
              <Input
                type="number"
                min={0}
                max={40}
                value={gap}
                onChange={(e) => setContainerData({ gap: Number(e.target.value) || 0 })}
                className="h-7 text-xs"
              />
            </label>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
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
