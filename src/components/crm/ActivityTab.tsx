import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dateTimeBR } from "@/lib/format";
import { addNote } from "@/integrations/nomus/process-enrichment.functions";

export function ActivityTab({ detail, refetchKey }: { detail: any; refetchKey: string }) {
  const qc = useQueryClient();
  const add = useServerFn(addNote);
  const [body, setBody] = useState("");

  const addMut = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error("Escreva algo");
      const r = await add({ data: { process_id: detail.process.id, body: body.trim() } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Nota adicionada");
      setBody("");
      qc.invalidateQueries({ queryKey: ["crm", "process", refetchKey] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  // Timeline combinada (notas + mudanças de etapa + follow-ups concluídos)
  const events = [
    ...detail.notes.map((n: any) => ({ kind: "note" as const, at: n.created_at, body: n.body })),
    ...detail.stageChanges.map((s: any) => ({
      kind: "stage" as const,
      at: s.changed_at,
      body: `Etapa: ${s.from_etapa ?? "—"} → ${s.to_etapa}`,
    })),
    ...detail.followups
      .filter((f: any) => f.done_at)
      .map((f: any) => ({ kind: "followup" as const, at: f.done_at, body: `Follow-up concluído${f.note ? ": " + f.note : ""}` })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Adicionar nota</h3>
        <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="O que aconteceu?" />
        <Button className="mt-2" onClick={() => addMut.mutate()} disabled={addMut.isPending}>
          Adicionar nota
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3">
          <h3 className="text-sm font-semibold">Timeline</h3>
        </div>
        {events.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sem atividade registrada ainda.</p>
        ) : (
          <ol className="divide-y divide-border">
            {events.map((e, i) => (
              <li key={i} className="p-3">
                <p className="text-xs text-muted-foreground">
                  {dateTimeBR(e.at)} · {e.kind === "note" ? "Nota" : e.kind === "stage" ? "Mudança de etapa" : "Follow-up"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{e.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
