import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { dateBR, daysBetween } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tarefas")({ component: TasksPage });

function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => (await supabase.from("proposal_tasks")
      .select("*, proposals(id, number, title)")
      .order("due_date", { ascending: true, nullsFirst: false })).data ?? [],
  });

  const toggle = async (id: string, done: boolean) => {
    const { error } = await supabase.from("proposal_tasks").update({
      status: done ? "concluida" : "pendente",
      completed_at: done ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const pending = tasks.filter((t) => t.status !== "concluida");
  const done = tasks.filter((t) => t.status === "concluida");

  return (
    <>
      <PageHeader title="Tarefas & Follow-up" subtitle={`${pending.length} pendentes · ${done.length} concluídas`} />
      {tasks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-card/50 p-12 text-center text-sm text-muted-foreground">
          Nenhuma tarefa ainda. Tarefas são criadas a partir das propostas.
        </div>
      ) : (
        <div className="space-y-2">
          {[...pending, ...done].map((t) => {
            const overdue = t.due_date && t.status !== "concluida" && daysBetween(t.due_date) > 0;
            return (
              <div key={t.id} className={cn(
                "flex items-start gap-3 rounded-lg border bg-card p-4 shadow-[var(--shadow-sm)]",
                overdue && "border-destructive/40"
              )}>
                <Checkbox checked={t.status === "concluida"} onCheckedChange={(c) => toggle(t.id, !!c)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium", t.status === "concluida" && "line-through text-muted-foreground")}>{t.title}</div>
                  {t.proposals && (
                    <Link to="/app/propostas/$id" params={{ id: (t.proposals as any).id }} className="text-xs text-primary hover:underline">
                      {(t.proposals as any).number} — {(t.proposals as any).title}
                    </Link>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Prazo: {dateBR(t.due_date)}</span>
                    {overdue && <span className="font-semibold text-destructive">Vencida</span>}
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase">{t.priority}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
