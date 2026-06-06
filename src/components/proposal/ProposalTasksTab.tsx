import { useState } from "react";
import { useProposalTasks, useCreateProposalTask, useUpdateProposalTask, useDeleteProposalTask } from "@/hooks/use-proposal-tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check } from "lucide-react";
import { dateBR } from "@/lib/format";

export function ProposalTasksTab({ proposalId }: { proposalId: string }) {
  const { data: tasks = [] } = useProposalTasks(proposalId);
  const createMut = useCreateProposalTask(proposalId);
  const updateMut = useUpdateProposalTask(proposalId);
  const deleteMut = useDeleteProposalTask(proposalId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"baixa" | "media" | "alta">("media");

  const submit = () => {
    if (!title.trim()) return;
    createMut.mutate(
      { title: title.trim(), description: description || null, due_date: dueDate || null, priority },
      {
        onSuccess: () => {
          setTitle(""); setDescription(""); setDueDate(""); setPriority("media"); setOpen(false);
        },
      }
    );
  };

  const pending = tasks.filter((t) => t.status !== "concluida" && t.status !== "cancelada");
  const done = tasks.filter((t) => t.status === "concluida");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{pending.length} pendentes · {done.length} concluídas</div>
        <Button size="sm" variant={open ? "ghost" : "outline"} onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3 w-3 mr-1" /> {open ? "Fechar" : "Nova tarefa"}
        </Button>
      </div>
      {open && (
        <div className="rounded-md border p-3 space-y-2 bg-secondary/30">
          <Input placeholder="Título da tarefa *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="flex-1" />
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="border rounded px-2 text-sm">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <Button size="sm" onClick={submit} disabled={createMut.isPending || !title.trim()}>Criar tarefa</Button>
        </div>
      )}

      {tasks.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma tarefa.</div>}

      {pending.map((t) => (
        <TaskRow key={t.id} task={t}
          onComplete={() => updateMut.mutate({ id: t.id, patch: { status: "concluida" } })}
          onDelete={() => deleteMut.mutate(t.id)}
        />
      ))}
      {done.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Concluídas</div>
          {done.map((t) => (
            <TaskRow key={t.id} task={t} done
              onComplete={() => {}}
              onDelete={() => deleteMut.mutate(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, done, onComplete, onDelete }: { task: any; done?: boolean; onComplete: () => void; onDelete: () => void }) {
  return (
    <div className={"flex items-start gap-2 rounded-md border p-2 " + (done ? "opacity-60" : "bg-card")}>
      <button
        onClick={onComplete}
        disabled={done}
        className={"mt-0.5 h-4 w-4 rounded border flex items-center justify-center " + (done ? "bg-emerald-500 border-emerald-500 text-white" : "hover:border-primary")}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={"text-sm " + (done ? "line-through" : "font-medium")}>{task.title}</div>
        {task.description && <div className="text-xs text-muted-foreground mt-0.5">{task.description}</div>}
        <div className="flex gap-2 mt-1 flex-wrap items-center">
          {task.due_date && <Badge variant="outline" className="text-[10px]">📅 {dateBR(task.due_date)}</Badge>}
          <Badge variant={task.priority === "alta" ? "destructive" : "secondary"} className="text-[10px]">{task.priority}</Badge>
        </div>
      </div>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDelete}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
