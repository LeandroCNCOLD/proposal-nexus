import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl, dateBR } from "@/lib/format";
import { linkProposalManually, unlinkProposal } from "@/integrations/nomus/process-enrichment.functions";

export function ProposalsTab({ detail, refetchKey }: { detail: any; refetchKey: string }) {
  const qc = useQueryClient();
  const link = useServerFn(linkProposalManually);
  const unlink = useServerFn(unlinkProposal);

  const linkMut = useMutation({
    mutationFn: async (nomus_proposal_id: string) => {
      const r = await link({ data: { process_id: detail.process.id, nomus_proposal_id, is_primary: false } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Proposta vinculada");
      qc.invalidateQueries({ queryKey: ["crm", "process", refetchKey] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const unlinkMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await unlink({ data: { id } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["crm", "process", refetchKey] });
    },
  });

  const linkedIds = new Set(detail.manualLinks.map((l: any) => l.nomus_proposal_id).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <h3 className="text-sm font-semibold">Propostas do cliente no Nomus</h3>
          <p className="text-xs text-muted-foreground">
            Match automático por nome do cliente. Vincule manualmente para fixar a relação.
          </p>
        </div>
        {detail.clientProposals.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma proposta encontrada para este cliente.</p>
        ) : (
          <div className="divide-y divide-border">
            {detail.clientProposals.map((pr: any) => {
              const isLinked = linkedIds.has(pr.id);
              const link = detail.manualLinks.find((l: any) => l.nomus_proposal_id === pr.id);
              return (
                <div key={pr.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{pr.numero ?? `#${pr.nomus_id}`}</p>
                      {pr.status_nomus && <Badge variant="outline" className="text-[10px]">{pr.status_nomus}</Badge>}
                      {isLinked && <Badge className="text-[10px]">Vinculada</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pr.vendedor_nome ?? "—"} · Emissão {dateBR(pr.data_emissao)} · Validade {dateBR(pr.validade)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {brl(pr.valor_total)}
                  </p>
                  {isLinked ? (
                    <Button size="sm" variant="ghost" onClick={() => link && unlinkMut.mutate(link.id)}>
                      Desvincular
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => linkMut.mutate(pr.id)}>
                      Vincular
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
