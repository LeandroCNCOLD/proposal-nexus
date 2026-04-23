import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Pause, Play } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateProposalPdf } from "@/integrations/proposal-editor/server.functions";

interface Props {
  proposalId: string;
  /** Versão usada para forçar re-render (auto-incrementa quando o estado muda). */
  version: number;
  /** Tempo de debounce em ms antes de gerar nova prévia. */
  debounceMs?: number;
}

/** Decodifica base64 em Uint8Array sem usar Buffer (compatível com browser). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Prévia do PDF que reusa o renderer do servidor (`generateProposalPdf` com mode=preview-inline).
 * Garante 100% de fidelidade com o PDF final.
 *
 * Otimizações:
 *  - Debounce maior (1500ms) para acumular edições
 *  - mode=preview-inline retorna base64 direto, sem upload + signed URL + fetch externo
 *  - Cancela geração anterior via gen counter (descarta resposta antiga)
 *  - Toggle "auto-atualizar" para pausar regeneração durante edições intensas
 */
export function ProposalPreviewLive({ proposalId, version, debounceMs = 1500 }: Props) {
  const genPdf = useServerFn(generateProposalPdf);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [manualTick, setManualTick] = useState(0);
  const genRef = useRef(0);

  const effectiveVersion = autoUpdate ? version : manualTick;

  useEffect(() => {
    // Pula primeira render quando não há nada para mostrar e auto desligado
    if (!autoUpdate && manualTick === 0 && !url) return;

    const myGen = ++genRef.current;
    let createdBlobUrl: string | null = null;

    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await genPdf({ data: { proposalId, mode: "preview-inline" } });
        // Descarta se uma geração mais nova já começou
        if (myGen !== genRef.current) return;

        let blob: Blob;
        if (res.contentBase64) {
          const bytes = base64ToBytes(res.contentBase64);
          blob = new Blob([bytes.buffer as ArrayBuffer], { type: res.mime ?? "application/pdf" });
        } else if (res.url) {
          const pdfRes = await fetch(res.url);
          if (!pdfRes.ok) throw new Error(`HTTP ${pdfRes.status}`);
          blob = await pdfRes.blob();
        } else {
          throw new Error("Resposta sem PDF");
        }
        if (myGen !== genRef.current) return;

        const blobUrl = URL.createObjectURL(blob);
        createdBlobUrl = blobUrl;
        setUrl((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return blobUrl;
        });
      } catch (e) {
        if (myGen === genRef.current) {
          setError(e instanceof Error ? e.message : "Falha ao gerar prévia");
        }
      } finally {
        if (myGen === genRef.current) setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(t);
      // Marca esta geração como obsoleta
      if (myGen === genRef.current) genRef.current++;
      if (createdBlobUrl) {
        // não revoga aqui — o blob pode estar em uso pelo iframe; será revogado na próxima atualização
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, effectiveVersion, debounceMs]);

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
            <>Prévia A4 ao vivo {!autoUpdate && <span className="text-amber-600">(pausada)</span>}</>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setAutoUpdate((v) => !v)}
            title={autoUpdate ? "Pausar atualização automática" : "Retomar atualização automática"}
          >
            {autoUpdate ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
            {autoUpdate ? "Pausar" : "Auto"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setManualTick((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Atualizar
          </Button>
          {url ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => window.open(url, "_blank", "noopener")}
            >
              Nova aba
            </Button>
          ) : null}
        </div>
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
