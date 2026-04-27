import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { dateTimeBR } from "@/lib/format";
import { addFollowup, markFollowupDone } from "@/integrations/nomus/process-enrichment.functions";

export function FollowupTab({ detail, refetchKey }: { detail: any; refetchKey: string }) {
  const qc = useQueryClient();
  const add = useServerFn(addFollowup);
  const done = useServerFn(markFollowupDone);

  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");

  const addMut = useMutation({
    mutationFn: async () => {
      if (!when) throw new Error("Informe a data");
      const r = await add({ data: { process_id: detail.process.id, scheduled_for: new Date(when).toISOString(), note: note || undefined } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Follow-up agendado");
      setWhen("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["crm", "process", refetchKey] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const doneMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await done({ data: { id } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Marcado como feito");
      qc.invalidateQueries({ queryKey: ["crm", "process", refetchKey] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Agendar próximo contato</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[200px_1fr_auto]">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Input placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => addMut.mutate()} disabled={addMut.isPending}>Agendar</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <h3 className="text-sm font-semibold">Histórico</h3>
        </div>
        {detail.followups.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum follow-up registrado.</p>
        ) : (
          <div className="divide-y divide-border">
            {detail.followups.map((f: any) => {
              const overdue = !f.done_at && new Date(f.scheduled_for).getTime() < Date.now();
              return (
                <div key={f.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{dateTimeBR(f.scheduled_for)}</span>
                      {f.done_at ? (
                        <Badge variant="secondary">Feito {dateTimeBR(f.done_at)}</Badge>
                      ) : overdue ? (
                        <Badge variant="destructive">Atrasado</Badge>
                      ) : (
                        <Badge variant="outline">Agendado</Badge>
                      )}
                    </div>
                    {f.note && <p className="mt-1 text-xs text-muted-foreground">{f.note}</p>}
                  </div>
                  {!f.done_at && (
                    <Button size="sm" variant="outline" onClick={() => doneMut.mutate(f.id)}>
                      Marcar feito
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
