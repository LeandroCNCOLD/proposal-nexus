import { Label } from "@/components/ui/label";
import { RichTextEditor } from "../RichTextEditor";

interface Props {
  value: { html?: string; text?: string };
  onChange: (next: { html?: string; text?: string }) => void;
}

export function WarrantyBlockEditor({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Termos de garantia</Label>
      <RichTextEditor
        placeholder="Descreva os termos de garantia…"
        value={value.html ?? ""}
        onChange={(html) => onChange({ html })}
      />
      <p className="text-[11px] text-muted-foreground">
        Use formatação para destacar prazos, exclusões e condições.
      </p>
    </div>
  );
}
