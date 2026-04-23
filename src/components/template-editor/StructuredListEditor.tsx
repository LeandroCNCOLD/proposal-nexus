import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

export interface FieldDef<T> {
  key: keyof T;
  label: string;
  type?: "text" | "textarea";
  placeholder?: string;
  rows?: number;
}

interface Props<T extends Record<string, unknown>> {
  items: T[];
  fields: FieldDef<T>[];
  onChange: (items: T[]) => void;
  emptyItem: () => T;
  /** Renderiza o título do bloco a partir do item (ex.: o campo "titulo"). */
  itemTitle?: (item: T, index: number) => string;
  addLabel?: string;
}

export function StructuredListEditor<T extends Record<string, unknown>>({
  items,
  fields,
  onChange,
  emptyItem,
  itemTitle,
  addLabel = "Adicionar item",
}: Props<T>) {
  const updateItem = (index: number, patch: Partial<T>) => {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Nenhum item ainda. Clique em "{addLabel}" para começar.
        </div>
      ) : (
        items.map((item, idx) => (
          <div key={idx} className="rounded-md border p-3 space-y-3 bg-card">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">
                #{idx + 1} {itemTitle ? `· ${itemTitle(item, idx) || "(sem título)"}` : ""}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              {fields.map((f) => {
                const value = (item[f.key] as string | undefined) ?? "";
                return (
                  <div key={String(f.key)} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        rows={f.rows ?? 3}
                        value={value}
                        placeholder={f.placeholder}
                        onChange={(e) =>
                          updateItem(idx, { [f.key]: e.target.value } as Partial<T>)
                        }
                      />
                    ) : (
                      <Input
                        value={value}
                        placeholder={f.placeholder}
                        onChange={(e) =>
                          updateItem(idx, { [f.key]: e.target.value } as Partial<T>)
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, emptyItem()])}
      >
        <Plus className="mr-1 h-4 w-4" /> {addLabel}
      </Button>
    </div>
  );
}
