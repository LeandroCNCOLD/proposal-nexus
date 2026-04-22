import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "../RichTextEditor";

interface Props {
  title: string;
  content: { html?: string };
  onTitleChange: (next: string) => void;
  onContentChange: (next: { html?: string }) => void;
}

export function CustomRichBlockEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Título da página</Label>
        <Input value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Conteúdo</Label>
        <RichTextEditor
          placeholder="Escreva o conteúdo desta página…"
          value={content.html ?? ""}
          onChange={(html) => onContentChange({ html })}
        />
      </div>
    </div>
  );
}
