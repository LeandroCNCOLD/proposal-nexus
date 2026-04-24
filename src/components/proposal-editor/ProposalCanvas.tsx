// Canvas A4 do Page Builder. Renderiza cada página como um "papel" e seus
// blocos editáveis inline. Toolbar para adicionar bloco no fim de cada página.
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import {
  makeBlock,
  type BlockType,
  type DocumentBlock,
  type DocumentPage,
} from "@/integrations/proposal-editor/types";
import { BlockRenderer } from "./BlockRenderer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  pages: DocumentPage[];
  selectedId: string | null;
  onPagesChange: (next: DocumentPage[]) => void;
  onSelect: (id: string) => void;
}

const ADDABLE_BLOCKS: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Título" },
  { type: "rich_text", label: "Texto livre" },
  { type: "image", label: "Imagem" },
  { type: "key_value_list", label: "Lista chave/valor" },
  { type: "included_items", label: "Itens inclusos" },
  { type: "excluded_items", label: "Itens NÃO inclusos" },
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

export function ProposalCanvas({ pages, selectedId, onPagesChange, onSelect }: Props) {
  const sorted = [...pages].sort((a, b) => a.order - b.order).filter((p) => p.visible);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // scroll to selected
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
  };

  const addBlock = (pageId: string, type: BlockType) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const newBlock = makeBlock(type, defaultDataFor(type), { order: page.blocks.length });
    updatePage(pageId, { blocks: [...page.blocks, newBlock] });
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-slate-100 p-6">
      {sorted.map((page) => (
        <div
          key={page.id}
          ref={(el) => {
            pageRefs.current[page.id] = el;
          }}
          className={cn(
            "mx-auto mb-6 w-full max-w-[860px] rounded-xl border bg-white shadow-sm transition",
            page.id === selectedId && "ring-2 ring-primary",
          )}
          onClick={() => onSelect(page.id)}
        >
          <div className="flex items-center justify-between border-b px-6 py-3">
            <input
              value={page.title}
              onChange={(e) => updatePage(page.id, { title: e.target.value })}
              className="border-none bg-transparent text-lg font-semibold focus:outline-none focus:ring-0"
              placeholder="Título da página…"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="font-mono text-[10px] text-muted-foreground">{page.type}</span>
          </div>
          <div className="space-y-3 px-6 py-6">
            {page.blocks
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  onChange={(next) => updateBlock(page.id, next)}
                  onDelete={() => deleteBlock(page.id, block.id)}
                />
              ))}
            <div className="pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full border-dashed text-xs text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar bloco
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
                  {ADDABLE_BLOCKS.map((b) => (
                    <DropdownMenuItem key={b.type} onClick={() => addBlock(page.id, b.type)}>
                      {b.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ))}
      {sorted.length === 0 ? (
        <div className="mx-auto max-w-[860px] rounded-xl border border-dashed bg-background p-12 text-center text-sm text-muted-foreground">
          Nenhuma página visível. Adicione uma página na barra lateral.
        </div>
      ) : null}
    </div>
  );
}

function defaultDataFor(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "heading":
      return { text: "Novo título", level: 2 };
    case "rich_text":
      return { html: "" };
    case "image":
      return { url: null };
    case "key_value_list":
      return { items: [{ label: "", value: "" }] };
    case "included_items":
    case "excluded_items":
      return { items: [] };
    case "attached_pdf":
      return { paths: [] };
    default:
      return {};
  }
}
