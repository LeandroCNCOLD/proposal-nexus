import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Layers,
  Paperclip,
} from "lucide-react";
import type { DocumentPage, PageType } from "@/integrations/proposal-editor/types";
import { cn } from "@/lib/utils";

interface Props {
  pages: DocumentPage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (pages: DocumentPage[]) => void;
}

const PAGE_ICONS: Record<PageType, typeof FileText> = {
  cover: ImageIcon,
  about: FileText,
  cases: FileText,
  clientes: FileText,
  solution: Layers,
  context: FileText,
  scope: Layers,
  caracteristicas: Layers,
  equipamento: Layers,
  investimento: FileText,
  impostos: FileText,
  pagamento: FileText,
  "prazo-garantia": FileText,
  warranty: FileText,
  contracapa: ImageIcon,
  "custom-rich": FileText,
  "custom-block": Layers,
  "attached-pdf": Paperclip,
};

function SortableRow({
  page,
  selected,
  onSelect,
  onToggleVisible,
  onDelete,
  canDelete,
}: {
  page: DocumentPage;
  selected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const Icon = PAGE_ICONS[page.type];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        "group flex items-center gap-2 rounded-md border bg-card px-2 py-2 text-sm transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
        !page.visible && "opacity-50",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-2 text-left"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{page.title}</span>
      </button>
      <button
        type="button"
        onClick={onToggleVisible}
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        aria-label={page.visible ? "Ocultar" : "Mostrar"}
      >
        {page.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function EditorPagePanel({ pages, selectedId, onSelect, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ordered = [...pages].sort((a, b) => a.order - b.order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((p) => p.id === active.id);
    const newIndex = ordered.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(ordered, oldIndex, newIndex).map((p, i) => ({ ...p, order: i }));
    onChange(reordered);
  };

  const addPage = (type: PageType, title: string) => {
    const newPage: DocumentPage = {
      id: `page-${Date.now()}`,
      type,
      title,
      visible: true,
      order: ordered.length,
      content: {},
    };
    onChange([...ordered, newPage]);
    onSelect(newPage.id);
    setOpen(false);
  };

  const toggleVisible = (id: string) => {
    onChange(ordered.map((p) => (p.id === id ? { ...p, visible: !p.visible } : p)));
  };

  const deletePage = (id: string) => {
    onChange(ordered.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i })));
  };

  // Páginas do template fixo não podem ser removidas (apenas ocultadas)
  const isCorePage = (type: PageType) =>
    ["cover", "about", "cases", "solution", "context", "scope", "warranty"].includes(type);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Páginas
        </h3>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2">
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Bloco do catálogo</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => addPage("custom-block", "Datasheet de equipamento")}>
              Datasheet de equipamento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addPage("custom-block", "Galeria de fotos")}>
              Galeria de fotos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addPage("custom-block", "Cronograma")}>
              Cronograma de instalação
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addPage("custom-block", "Tabela técnica")}>
              Tabela técnica detalhada
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addPage("custom-block", "Memorial descritivo")}>
              Memorial descritivo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => addPage("custom-rich", "Página em branco")}>
              Página em branco (rich-text)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addPage("attached-pdf", "PDF anexado")}>
              Anexar PDF externo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {ordered.map((page) => (
                <SortableRow
                  key={page.id}
                  page={page}
                  selected={selectedId === page.id}
                  onSelect={() => onSelect(page.id)}
                  onToggleVisible={() => toggleVisible(page.id)}
                  onDelete={() => deletePage(page.id)}
                  canDelete={!isCorePage(page.type)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
