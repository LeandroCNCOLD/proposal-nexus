// Sidebar fina de páginas — lista, seleciona, reordena, oculta e adiciona páginas.
import { useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
} from "lucide-react";
import {
  ADDABLE_PAGE_TYPES,
  makeDefaultPage,
  type DocumentPage,
  type PageType,
} from "@/integrations/proposal-editor/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useServerFn } from "@tanstack/react-start";
import { uploadInlineImage } from "@/integrations/proposal-editor/inline-images.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  pages: DocumentPage[];
  selectedId: string | null;
  proposalId: string;
  onSelect: (id: string) => void;
  onChange: (next: DocumentPage[]) => void;
}

export function PageSidebar({ pages, selectedId, proposalId, onSelect, onChange }: Props) {
  const sorted = [...pages].sort((a, b) => a.order - b.order);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPageId, setUploadingPageId] = useState<string | null>(null);
  const uploadFn = useServerFn(uploadInlineImage);

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const next = [...sorted];
    const tmp = next[idx];
    next[idx] = next[swap];
    next[swap] = tmp;
    onChange(next.map((p, i) => ({ ...p, order: i })));
  };

  const toggleVisible = (id: string) =>
    onChange(pages.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)));

  const remove = (id: string) => onChange(pages.filter((p) => p.id !== id));

  const addPage = (type: PageType) => {
    const labelEntry = ADDABLE_PAGE_TYPES.find((t) => t.type === type);
    const next = [
      ...sorted,
      makeDefaultPage(type, labelEntry?.label ?? "Página", sorted.length),
    ];
    onChange(next);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Páginas ({sorted.length})
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
            {ADDABLE_PAGE_TYPES.map((t) => (
              <DropdownMenuItem key={t.type} onClick={() => addPage(t.type)}>
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {sorted.map((page, i) => {
          const isSelected = page.id === selectedId;
          return (
            <div
              key={page.id}
              className={cn(
                "group flex items-center gap-1 px-2 py-1.5 text-xs transition",
                isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                !page.visible && "opacity-50",
              )}
            >
              <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
              <button
                type="button"
                className="flex-1 truncate text-left"
                onClick={() => onSelect(page.id)}
                title={page.title}
              >
                <div className="truncate font-medium">{page.title}</div>
                <div className="truncate font-mono text-[9px] text-muted-foreground">
                  {page.type}
                </div>
              </button>
              <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(page.id, -1)}
                  disabled={i === 0}
                  className="p-0.5 hover:text-foreground disabled:opacity-30"
                  title="Mover para cima"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(page.id, 1)}
                  disabled={i === sorted.length - 1}
                  className="p-0.5 hover:text-foreground disabled:opacity-30"
                  title="Mover para baixo"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisible(page.id)}
                  className="p-0.5 hover:text-foreground"
                  title={page.visible ? "Ocultar" : "Mostrar"}
                >
                  {page.visible ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => remove(page.id)}
                  className="p-0.5 text-destructive hover:bg-destructive/10"
                  title="Remover página"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhuma página. Clique em <strong>Adicionar</strong>.
          </div>
        ) : null}
      </div>
    </div>
  );
}
