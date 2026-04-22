import { Info } from "lucide-react";

interface Props {
  title: string;
  description: string;
}

/**
 * Marcador para blocos cujo conteúdo é institucional/fixo (Sobre a CN Cold,
 * Cases). A edição de imagens/copy desses blocos virá em etapa posterior.
 */
export function StaticBlockNotice({ title, description }: Props) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-sm">
          <div className="font-semibold">{title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
