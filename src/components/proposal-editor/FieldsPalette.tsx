// Paleta de campos disponíveis. Usuário arrasta um campo e solta no canvas
// para criar automaticamente um bloco configurado (campo dinâmico, caixa,
// tabela, etc.). Use HTML5 Drag & Drop para evitar dependências adicionais.
import { useState } from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockType } from "@/integrations/proposal-editor/types";

export interface PaletteItem {
  /** Tipo de bloco que será criado ao soltar. */
  blockType: BlockType;
  /** Rótulo exibido na lista. */
  label: string;
  /** Para `dynamic_field`, qual chave de campo usar. */
  fieldKey?: string;
}

interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

const GROUPS: PaletteGroup[] = [
  {
    label: "Dados da proposta",
    items: [
      { blockType: "dynamic_field", label: "Nº da proposta", fieldKey: "proposal_number" },
      { blockType: "dynamic_field", label: "Título do projeto", fieldKey: "proposal_title" },
      { blockType: "dynamic_field", label: "Data de emissão", fieldKey: "data_emissao" },
      { blockType: "dynamic_field", label: "Validade", fieldKey: "validade" },
      { blockType: "dynamic_field", label: "Vendedor responsável", fieldKey: "vendedor" },
      { blockType: "proposal_number_box", label: "Caixa Nº da proposta" },
    ],
  },
  {
    label: "Cliente",
    items: [
      { blockType: "dynamic_field", label: "Nome do cliente", fieldKey: "client_name" },
      { blockType: "client_info_box", label: "Caixa do cliente" },
    ],
  },
  {
    label: "Empresa",
    items: [
      { blockType: "dynamic_field", label: "Nome da empresa", fieldKey: "empresa_nome" },
      { blockType: "dynamic_field", label: "Telefone", fieldKey: "empresa_telefone" },
      { blockType: "dynamic_field", label: "E-mail", fieldKey: "empresa_email" },
      { blockType: "dynamic_field", label: "Site", fieldKey: "empresa_site" },
      { blockType: "dynamic_field", label: "Cidade", fieldKey: "empresa_cidade" },
    ],
  },
  {
    label: "Caixas e listas",
    items: [
      { blockType: "project_info_box", label: "Caixa do projeto" },
      { blockType: "responsible_info_box", label: "Caixa do responsável" },
      { blockType: "key_value_list", label: "Lista chave/valor" },
      { blockType: "included_items", label: "Itens inclusos" },
      { blockType: "excluded_items", label: "Itens NÃO inclusos" },
      { blockType: "differentials_list", label: "Diferenciais" },
      { blockType: "cases_list", label: "Cases" },
    ],
  },
  {
    label: "Tabelas",
    items: [
      { blockType: "investment_table", label: "Tabela de investimento" },
      { blockType: "tax_table", label: "Tabela de impostos" },
      { blockType: "payment_table", label: "Tabela de pagamento" },
      { blockType: "characteristics_table", label: "Características técnicas" },
      { blockType: "equipments_table", label: "Tabela de equipamentos" },
      { blockType: "technical_table", label: "Tabela técnica" },
      { blockType: "bank_data", label: "Dados bancários" },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { blockType: "heading", label: "Título" },
      { blockType: "rich_text", label: "Texto livre" },
      { blockType: "image", label: "Imagem" },
      { blockType: "signature", label: "Assinatura" },
      { blockType: "attached_pdf", label: "PDF anexado" },
    ],
  },
];

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

export function FieldsPalette() {
  const [open, setOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
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
          {GROUPS.map((group) => {
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
                      <div
                        key={`${item.blockType}-${item.fieldKey ?? item.label}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "copy";
                          e.dataTransfer.setData(
                            PALETTE_DRAG_MIME,
                            serializePaletteItem(item),
                          );
                          // Fallback para browsers que requerem text/plain
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
