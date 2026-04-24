// Paleta de campos disponíveis. Usuário arrasta um campo e solta no canvas
// para criar automaticamente um bloco configurado (campo dinâmico, caixa,
// tabela, etc.). Use HTML5 Drag & Drop para evitar dependências adicionais.
//
// Exporta dois componentes:
//   - <FieldsPalette/>            paleta global recolhível (compat. legacy)
//   - <InlinePagePalette/>        paleta contextual por tipo de página, com
//                                 botão "Adicionar campos" (busca no catálogo).
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockType, PageType } from "@/integrations/proposal-editor/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface PaletteItem {
  /** Tipo de bloco que será criado ao soltar. */
  blockType: BlockType;
  /** Rótulo exibido na lista. */
  label: string;
  /** Para `dynamic_field`, qual chave de campo usar. */
  fieldKey?: string;
  /** Categoria para agrupamento e filtro. */
  category?: string;
  /** Palavras-chave extras p/ busca. */
  keywords?: string[];
}

interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

/** Catálogo completo de campos arrastáveis. */
export const ALL_PALETTE_GROUPS: PaletteGroup[] = [
  {
    label: "Layout",
    items: [
      { blockType: "container", label: "📦 Caixa / Container", category: "Layout" },
      { blockType: "heading", label: "Título", category: "Layout" },
      { blockType: "rich_text", label: "Texto livre", category: "Layout" },
      { blockType: "image", label: "Imagem", category: "Layout" },
    ],
  },
  {
    label: "Dados da proposta",
    items: [
      { blockType: "dynamic_field", label: "Nº da proposta", fieldKey: "proposal_number", category: "Proposta" },
      { blockType: "dynamic_field", label: "Título do projeto", fieldKey: "proposal_title", category: "Proposta" },
      { blockType: "dynamic_field", label: "Data de emissão", fieldKey: "data_emissao", category: "Proposta" },
      { blockType: "dynamic_field", label: "Validade", fieldKey: "validade", category: "Proposta" },
      { blockType: "dynamic_field", label: "Vendedor responsável", fieldKey: "vendedor", category: "Proposta" },
      { blockType: "proposal_number_box", label: "Caixa Nº da proposta", category: "Proposta" },
      { blockType: "proposal_summary_box", label: "Caixa Resumo da proposta", category: "Proposta" },
    ],
  },
  {
    label: "Cliente",
    items: [
      { blockType: "dynamic_field", label: "Nome do cliente", fieldKey: "client_name", category: "Cliente" },
      { blockType: "client_info_box", label: "Caixa do cliente", category: "Cliente" },
    ],
  },
  {
    label: "Empresa",
    items: [
      { blockType: "dynamic_field", label: "Nome da empresa", fieldKey: "empresa_nome", category: "Empresa" },
      { blockType: "dynamic_field", label: "Telefone", fieldKey: "empresa_telefone", category: "Empresa" },
      { blockType: "dynamic_field", label: "E-mail", fieldKey: "empresa_email", category: "Empresa" },
      { blockType: "dynamic_field", label: "Site", fieldKey: "empresa_site", category: "Empresa" },
      { blockType: "dynamic_field", label: "Cidade", fieldKey: "empresa_cidade", category: "Empresa" },
    ],
  },
  {
    label: "Caixas e listas",
    items: [
      { blockType: "project_info_box", label: "Caixa do projeto", category: "Caixas" },
      { blockType: "responsible_info_box", label: "Caixa do responsável", category: "Caixas" },
      { blockType: "key_value_list", label: "Lista chave/valor", category: "Caixas" },
      { blockType: "included_items", label: "Itens inclusos", category: "Caixas" },
      { blockType: "excluded_items", label: "Itens NÃO inclusos", category: "Caixas" },
      { blockType: "differentials_list", label: "Diferenciais", category: "Caixas" },
      { blockType: "cases_list", label: "Cases", category: "Caixas" },
    ],
  },
  {
    label: "Tabelas",
    items: [
      { blockType: "investment_table", label: "Tabela de investimento", category: "Tabelas", keywords: ["preço", "produto", "item"] },
      { blockType: "tax_table", label: "Tabela de impostos", category: "Tabelas" },
      { blockType: "payment_table", label: "Tabela de pagamento", category: "Tabelas" },
      { blockType: "characteristics_table", label: "Características técnicas", category: "Tabelas" },
      { blockType: "equipments_table", label: "Tabela de equipamentos", category: "Tabelas", keywords: ["produto", "item"] },
      { blockType: "technical_table", label: "Tabela técnica", category: "Tabelas" },
      { blockType: "bank_data", label: "Dados bancários", category: "Tabelas" },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { blockType: "signature", label: "Assinatura", category: "Conteúdo" },
      { blockType: "attached_pdf", label: "PDF anexado", category: "Conteúdo" },
    ],
  },
];

/** Mapeia o tipo de página para os tipos de blocos sugeridos (filtragem). */
const PAGE_SUGGESTED_BLOCKS: Record<PageType, BlockType[]> = {
  cover: [
    "container",
    "heading",
    "rich_text",
    "image",
    "dynamic_field",
    "proposal_number_box",
    "client_info_box",
  ],
  about: ["container", "heading", "rich_text", "image", "differentials_list"],
  cases: ["container", "heading", "cases_list", "image"],
  clientes: ["container", "heading", "included_items", "image"],
  context: [
    "container",
    "heading",
    "client_info_box",
    "project_info_box",
    "responsible_info_box",
    "dynamic_field",
    "rich_text",
  ],
  solution: ["container", "heading", "rich_text", "included_items", "excluded_items", "image"],
  scope: ["container", "heading", "included_items", "excluded_items", "rich_text"],
  caracteristicas: ["container", "heading", "characteristics_table", "rich_text"],
  equipamento: ["container", "heading", "equipments_table", "image", "rich_text"],
  investimento: ["container", "heading", "investment_table", "rich_text"],
  impostos: ["container", "heading", "tax_table", "rich_text"],
  pagamento: ["container", "heading", "payment_table", "bank_data", "rich_text"],
  warranty: ["container", "heading", "rich_text", "key_value_list"],
  "prazo-garantia": ["container", "heading", "rich_text", "key_value_list"],
  contracapa: ["container", "heading", "dynamic_field", "image"],
  differentials: ["container", "heading", "differentials_list", "rich_text"],
  impact: ["container", "heading", "rich_text", "image"],
  nota: ["container", "heading", "rich_text"],
  "custom-rich": ["container", "heading", "rich_text", "image", "dynamic_field"],
  "custom-block": [
    "container",
    "heading",
    "rich_text",
    "image",
    "dynamic_field",
    "key_value_list",
  ],
  "custom-bg": [
    "container",
    "heading",
    "rich_text",
    "image",
    "dynamic_field",
    "client_info_box",
    "project_info_box",
  ],
  "attached-pdf": ["heading", "attached_pdf", "rich_text"],
};

/** MIME usado para reconhecer drops vindos da paleta. */
export const PALETTE_DRAG_MIME = "application/x-proposal-field";

export function serializePaletteItem(item: PaletteItem): string {
  return JSON.stringify(item);
}

export function parsePaletteItem(raw: string): PaletteItem | null {
  try {
    const v = JSON.parse(raw) as PaletteItem;
    if (!v || typeof v.blockType !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

/** Lista plana de todos os itens da paleta (com dedup por chave). */
export const ALL_PALETTE_ITEMS: PaletteItem[] = ALL_PALETTE_GROUPS.flatMap(
  (g) => g.items,
);

function paletteKey(item: PaletteItem): string {
  return `${item.blockType}-${item.fieldKey ?? item.label}`;
}

/** Item arrastável (handle de drag + label). */
function DraggableItem({ item }: { item: PaletteItem }) {
  return (
    <div
      key={paletteKey(item)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData(PALETTE_DRAG_MIME, serializePaletteItem(item));
        e.dataTransfer.setData("text/plain", item.label);
      }}
      className={cn(
        "flex cursor-grab items-center gap-1.5 rounded px-2 py-1 text-[11px] hover:bg-muted active:cursor-grabbing",
      )}
      title="Arraste para o canvas"
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{item.label}</span>
    </div>
  );
}

/* ============================================================ */
/*  PALETA INLINE — contextual por página                        */
/* ============================================================ */

interface InlinePagePaletteProps {
  pageType: PageType;
  pageTitle: string;
}

export function InlinePagePalette({ pageType, pageTitle }: InlinePagePaletteProps) {
  const [open, setOpen] = useState(true);

  const suggestedTypes = PAGE_SUGGESTED_BLOCKS[pageType] ?? [];
  const suggestedItems = useMemo<PaletteItem[]>(() => {
    // Inclui qualquer item cujo blockType está sugerido para esta página.
    return ALL_PALETTE_ITEMS.filter((it) => suggestedTypes.includes(it.blockType));
  }, [suggestedTypes]);

  // Agrupa por categoria preservando ordem do catálogo
  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    suggestedItems.forEach((it) => {
      const k = it.category ?? "Outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    });
    return Array.from(map.entries());
  }, [suggestedItems]);

  return (
    <div className="border-t bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40"
      >
        <span className="flex items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Campos · {pageTitle}
        </span>
        <span className="text-[9px] font-normal opacity-60">
          {suggestedItems.length} sugeridos
        </span>
      </button>
      {open ? (
        <div className="max-h-[35vh] overflow-y-auto pb-2">
          <p className="px-3 py-1 text-[10px] leading-tight text-muted-foreground">
            Arraste para o canvas. Campos abaixo são os mais usados nesta página.
          </p>
          <div className="space-y-1">
            {grouped.map(([cat, items]) => (
              <div key={cat} className="px-1">
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {cat}
                </div>
                <div className="space-y-px">
                  {items.map((it) => (
                    <DraggableItem key={paletteKey(it)} item={it} />
                  ))}
                </div>
              </div>
            ))}
            {suggestedItems.length === 0 ? (
              <p className="px-3 py-2 text-[10px] text-muted-foreground">
                Nenhum campo sugerido. Clique em <strong>Adicionar campos</strong>.
              </p>
            ) : null}
          </div>
          <div className="mt-2 px-3">
            <AddMoreFieldsButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================ */
/*  Diálogo "Adicionar campos" — busca no catálogo completo      */
/* ============================================================ */

function AddMoreFieldsButton() {
  const [openDlg, setOpenDlg] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo<PaletteItem[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ALL_PALETTE_ITEMS;
    return ALL_PALETTE_ITEMS.filter((it) => {
      const hay = [
        it.label,
        it.blockType,
        it.fieldKey ?? "",
        it.category ?? "",
        ...(it.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [q]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    filtered.forEach((it) => {
      const k = it.category ?? "Outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <Dialog open={openDlg} onOpenChange={setOpenDlg}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full justify-center text-[11px]"
        >
          <Plus className="mr-1 h-3 w-3" />
          Adicionar campos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Catálogo de campos</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar campo (ex.: cliente, tabela, imagem)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Arraste qualquer item para o canvas (a janela permanece aberta para você adicionar
            vários).
          </p>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {cat}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((it) => (
                    <DraggableItem key={paletteKey(it)} item={it} />
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum campo encontrado.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ */
/*  Paleta global legacy (mantida para compat)                    */
/* ============================================================ */

export function FieldsPalette() {
  const [open, setOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Layout: true,
    "Dados da proposta": true,
    Cliente: true,
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="border-t bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40"
      >
        <span>Campos disponíveis</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {open ? (
        <div className="max-h-[40vh] overflow-y-auto pb-2">
          <p className="px-3 py-1 text-[10px] leading-tight text-muted-foreground">
            Arraste um campo para dentro da página para inseri-lo.
          </p>
          {ALL_PALETTE_GROUPS.map((group) => {
            const isOpen = openGroups[group.label] ?? false;
            return (
              <div key={group.label} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-1 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 hover:text-foreground"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {group.label}
                </button>
                {isOpen ? (
                  <div className="space-y-px pl-2 pr-1">
                    {group.items.map((item) => (
                      <DraggableItem key={paletteKey(item)} item={item} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
