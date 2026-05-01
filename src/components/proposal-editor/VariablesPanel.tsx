/**
 * Painel de Variáveis Dinâmicas — exibido no editor de propostas.
 *
 * - Agrupa variáveis por categoria (Cliente, Proposta, Comercial, Financeiro,
 *   Pagamento, Técnico, Empresa).
 * - Click → copia `{{key}}` para a área de transferência e dispara um
 *   CustomEvent `proposal-editor:insert-variable` que o RichTextEditor escuta
 *   para inserir na posição do cursor.
 * - Drag → arrasta `{{key}}` como text/plain (compatível com TipTap).
 * - Mostra exemplo e (quando houver contexto) o valor resolvido atual.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Search, Variable } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  VARIABLES,
  type VariableCategory,
  type VariableDefinition,
  getVariableValue,
} from "@/features/proposal-variables/variables-catalog";
import type { ProposalDocumentContext } from "@/features/proposal-context/document-context.types";

interface Props {
  context: ProposalDocumentContext | null;
  className?: string;
}

const CATEGORY_ORDER: VariableCategory[] = [
  "Cliente",
  "Proposta",
  "Comercial",
  "Financeiro",
  "Pagamento",
  "Técnico",
  "Empresa",
];

export function VariablesPanel({ context, className }: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<VariableCategory, boolean>>({
    Cliente: false,
    Proposta: false,
    Comercial: true,
    Financeiro: true,
    Pagamento: true,
    Técnico: true,
    Empresa: true,
  });

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (v: VariableDefinition) =>
      !q ||
      v.label.toLowerCase().includes(q) ||
      v.key.toLowerCase().includes(q) ||
      v.example.toLowerCase().includes(q);
    const out: Array<{ category: VariableCategory; items: VariableDefinition[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      const items = VARIABLES.filter((v) => v.category === cat && filter(v));
      if (items.length > 0) out.push({ category: cat, items });
    }
    return out;
  }, [query]);

  const handleInsert = (key: string) => {
    const token = `{{${key}}}`;
    try {
      navigator.clipboard?.writeText(token);
    } catch {
      // ignore
    }
    // Notifica RichTextEditor (foco atual) para inserir no cursor.
    window.dispatchEvent(new CustomEvent("proposal-editor:insert-variable", { detail: { token } }));
    toast.success(`Variável copiada: ${token}`, { duration: 1500 });
  };

  return (
    <div className={cn("flex min-h-0 flex-col rounded border bg-background", className)}>
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Variable className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">Variáveis</span>
        <Badge variant="secondary" className="ml-auto h-4 px-1 text-[10px]">
          {VARIABLES.length}
        </Badge>
      </div>
      <div className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar variável…"
            className="h-7 pl-6 text-xs"
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
          Clique para copiar ou arraste para o texto. Use{" "}
          <code className="rounded bg-muted px-1">{"{{key}}"}</code> em qualquer campo.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Nenhuma variável encontrada.
          </div>
        )}
        {grouped.map(({ category, items }) => {
          const isCollapsed = collapsed[category];
          return (
            <div key={category} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
                className="flex w-full items-center gap-1 bg-muted/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {category}
                <span className="ml-auto text-[10px] font-normal opacity-70">{items.length}</span>
              </button>
              {!isCollapsed && (
                <ul className="divide-y">
                  {items.map((v) => {
                    const value = getVariableValue(v.key, context);
                    const empty = value == null || value === "";
                    return (
                      <li
                        key={v.key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", `{{${v.key}}}`);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => handleInsert(v.key)}
                        className="group cursor-grab px-2 py-1.5 hover:bg-accent/40 active:cursor-grabbing"
                        title={`Inserir {{${v.key}}}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium">{v.label}</span>
                          <Copy className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </div>
                        <code className="block truncate text-[10px] text-muted-foreground">
                          {`{{${v.key}}}`}
                        </code>
                        <div
                          className={cn(
                            "truncate text-[10px]",
                            empty ? "italic text-amber-600" : "text-emerald-700",
                          )}
                          title={empty ? "Sem valor — usará exemplo no PDF" : value!}
                        >
                          {empty ? `ex: ${v.example}` : value}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
