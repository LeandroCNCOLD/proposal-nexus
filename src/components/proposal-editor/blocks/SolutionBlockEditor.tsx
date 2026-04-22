import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { SolutionData } from "@/integrations/proposal-editor/types";
import { RichTextEditor } from "../RichTextEditor";

interface Props {
  value: SolutionData;
  onChange: (next: SolutionData, editedKey?: keyof SolutionData) => void;
}

export function SolutionBlockEditor({ value, onChange }: Props) {
  const set = <K extends keyof SolutionData>(k: K, v: SolutionData[K]) =>
    onChange({ ...value, [k]: v }, k);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Introdução</Label>
        <RichTextEditor
          minimal
          placeholder="Apresente brevemente a solução proposta…"
          value={value.intro ?? ""}
          onChange={(html) => set("intro", html)}
        />
      </div>

      <ListField
        label="O que contempla"
        items={value.contempla ?? []}
        onChange={(items) => set("contempla", items)}
      />
      <ListField
        label="Diferenciais"
        items={value.diferenciais ?? []}
        onChange={(items) => set("diferenciais", items)}
      />
      <ListField
        label="Impacto / benefícios"
        items={value.impacto ?? []}
        onChange={(items) => set("impacto", items)}
      />

      <div className="space-y-1">
        <Label className="text-xs">Conclusão</Label>
        <RichTextEditor
          minimal
          placeholder="Encerre reforçando o valor entregue…"
          value={value.conclusao ?? ""}
          onChange={(html) => set("conclusao", html)}
        />
      </div>
    </div>
  );
}

function ListField({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="mr-1 h-3 w-3" /> Adicionar
        </Button>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-xs text-muted-foreground">Nenhum item.</div>
        )}
      </div>
    </div>
  );
}
