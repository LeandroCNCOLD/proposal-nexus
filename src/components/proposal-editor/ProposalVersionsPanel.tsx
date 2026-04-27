// Painel de histórico de versões geradas (proposal_send_versions).
// Exibe lista compacta com download/abertura em nova aba.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Download, FileText, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listProposalSendVersions,
  getProposalSendVersionUrl,
} from "@/integrations/proposal-editor/server.functions";

type Props = {
  proposalId: string;
};

type VersionRow = {
  id: string;
  version_number: number;
  generated_at: string;
  is_current: boolean;
  notes: string | null;
  metadata: Record<string, unknown> | null;
};

export function ProposalVersionsPanel({ proposalId }: Props) {
  const listFn = useServerFn(listProposalSendVersions);
  const urlFn = useServerFn(getProposalSendVersionUrl);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["proposal-send-versions", proposalId],
    queryFn: () => listFn({ data: { proposalId } }),
  });

  const handleOpen = async (versionId: string) => {
    try {
      const res = await urlFn({ data: { versionId } });
      window.open(res.url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const versions = (data?.versions ?? []) as VersionRow[];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Versões geradas
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhuma versão gerada ainda.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-md border bg-card px-2 py-1.5 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">v{v.version_number}</span>
                    {v.is_current ? (
                      <Badge variant="default" className="h-4 px-1 text-[10px]">
                        atual
                      </Badge>
                    ) : null}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {new Date(v.generated_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => handleOpen(v.id)}
                title="Abrir PDF"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
