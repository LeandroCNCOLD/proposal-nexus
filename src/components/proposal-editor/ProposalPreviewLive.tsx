import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateProposalPdf } from "@/integrations/proposal-editor/server.functions";

interface Props {
  proposalId: string;
  /** Versão usada para forçar re-render (auto-incrementa quando o estado muda). */
  version: number;
  /** Tempo de debounce em ms antes de gerar nova prévia. */
  debounceMs?: number;
}

/**
 * Prévia do PDF que reusa o renderer do servidor (`generateProposalPdf` com mode=preview).
 * Garante 100% de fidelidade com o PDF final, com debounce automático.
 */
export function ProposalPreviewLive({ proposalId, version, debounceMs = 1500 }: Props) {
  const genPdf = useServerFn(generateProposalPdf);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await genPdf({ data: { proposalId, mode: "preview" } });
        if (!cancelled) setUrl(res.url);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao gerar prévia");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [proposalId, version, debounceMs, genPdf]);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex items-center justify-between border-b bg-background px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Gerando prévia…
            </>
          ) : error ? (
            <span className="text-destructive">Erro: {error}</span>
          ) : (
            <>Prévia A4 ao vivo</>
          )}
        </div>
        {url ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => window.open(url, "_blank", "noopener")}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Abrir em nova aba
          </Button>
        ) : null}
      </div>
      <div className="flex-1 bg-slate-200">
        {url ? (
          <iframe
            key={url}
            src={url}
            title="Prévia da proposta"
            className="h-full w-full border-0"
          />
        ) : !loading && !error ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Edite o documento para gerar a prévia.
          </div>
        ) : null}
      </div>
    </div>
  );
}
