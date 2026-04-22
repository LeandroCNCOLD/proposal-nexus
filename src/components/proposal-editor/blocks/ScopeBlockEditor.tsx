import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { ScopeItem } from "@/integrations/proposal-editor/types";
import { brl } from "@/lib/format";

interface Props {
  value: ScopeItem[];
  onChange: (next: ScopeItem[]) => void;
}

export function ScopeBlockEditor({ value, onChange }: Props) {
  const items = value ?? [];

  const update = (i: number, patch: Partial<ScopeItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    if (patch.quantidade !== undefined || patch.valor_unitario !== undefined) {
      const q = Number(next[i].quantidade ?? 0);
      const u = Number(next[i].valor_unitario ?? 0);
      next[i].valor_total = q * u;
    }
    onChange(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const add = () => {
    onChange([
      ...items,
      {
        id: `scope-${Date.now()}`,
        titulo: "",
        descricao: "",
        quantidade: 1,
        unidade: "un",
        valor_unitario: 0,
        valor_total: 0,
      },
    ]);
  };

  const total = items.reduce((s, it) => s + Number(it.valor_total ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Itens do escopo</Label>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={add}>
          <Plus className="mr-1 h-3 w-3" /> Adicionar item
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={it.id} className="rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
              <Input
                placeholder="Título do item"
                value={it.titulo ?? ""}
                onChange={(e) => update(i, { titulo: e.target.value })}
                className="flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              rows={2}
              placeholder="Descrição"
              value={it.descricao ?? ""}
              onChange={(e) => update(i, { descricao: e.target.value })}
            />
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Qtd</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={it.quantidade ?? 0}
                  onChange={(e) => update(i, { quantidade: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Unidade</Label>
                <Input
                  value={it.unidade ?? ""}
                  onChange={(e) => update(i, { unidade: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Vlr unit.</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={it.valor_unitario ?? 0}
                  onChange={(e) => update(i, { valor_unitario: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Total</Label>
                <Input
                  readOnly
                  className="bg-muted/40"
                  value={brl(it.valor_total ?? 0)}
                />
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            Nenhum item de escopo. Clique em "Adicionar item" ou use "Sincronizar do Nomus".
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Total do escopo
          </span>
          <span className="font-semibold tabular-nums">{brl(total)}</span>
        </div>
      )}
    </div>
  );
}
