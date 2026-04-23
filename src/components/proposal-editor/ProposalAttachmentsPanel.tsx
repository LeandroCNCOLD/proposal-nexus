import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, ArrowUp, ArrowDown, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listProposalAttachments,
  uploadProposalAttachment,
  deleteProposalAttachment,
  reorderProposalAttachments,
} from "@/integrations/proposal-editor/attachments.functions";

interface Props {
  proposalId: string;
  /** Notifica o editor para regenerar a prévia. */
  onChanged?: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ProposalAttachmentsPanel({ proposalId, onChanged }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useServerFn(listProposalAttachments);
  const upload = useServerFn(uploadProposalAttachment);
  const remove = useServerFn(deleteProposalAttachment);
  const reorder = useServerFn(reorderProposalAttachments);

  const queryKey = ["proposal-attachments", proposalId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => list({ data: { proposalId } }),
  });

  const items = data?.items ?? [];

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Apenas arquivos PDF são aceitos.");
      }
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("PDF muito grande (limite 25 MB).");
      }
      const b64 = await fileToBase64(file);
      return upload({
        data: {
          proposalId,
          filename: file.name,
          contentBase64: b64,
          mimeType: file.type || "application/pdf",
        },
      });
    },
    onSuccess: () => {
      toast.success("PDF anexado");
      qc.invalidateQueries({ queryKey });
      onChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (path: string) => remove({ data: { proposalId, path } }),
    onSuccess: () => {
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey });
      onChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: (paths: string[]) => reorder({ data: { proposalId, paths } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      onChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function move(idx: number, dir: -1 | 1) {
    const next = items.map((i) => i.path);
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    reorderMut.mutate(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">PDFs anexados</div>
          <p className="text-xs text-muted-foreground">
            Os PDFs serão concatenados ao final da proposta gerada, na ordem listada.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMut.isPending}
        >
          {uploadMut.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Upload className="mr-1 h-3 w-3" />
          )}
          Anexar PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMut.mutate(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          Nenhum PDF anexado.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li
              key={item.path}
              className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate" title={item.name}>
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground">#{idx + 1}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={idx === 0 || reorderMut.isPending}
                onClick={() => move(idx, -1)}
                title="Mover para cima"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={idx === items.length - 1 || reorderMut.isPending}
                onClick={() => move(idx, 1)}
                title="Mover para baixo"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              {item.url ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => window.open(item.url!, "_blank", "noopener")}
                  title="Abrir"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              ) : null}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={removeMut.isPending}
                onClick={() => {
                  if (confirm(`Remover "${item.name}"?`)) removeMut.mutate(item.path);
                }}
                title="Remover"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
