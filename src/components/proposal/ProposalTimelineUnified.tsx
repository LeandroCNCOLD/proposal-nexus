import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText, Send, Calendar, CheckCircle2, RefreshCw, MessageSquare } from "lucide-react";
import { dateTimeBR } from "@/lib/format";
import { useProposalAgenda } from "@/hooks/use-proposal-agenda";
import { useProposalTasks } from "@/hooks/use-proposal-tasks";

type Item = {
  id: string;
  ts: string;
  icon: React.ReactNode;
  title: string;
  meta?: string;
  tone?: "default" | "success" | "info" | "warn";
};

export function ProposalTimelineUnified({
  proposalId,
  proposalNumber,
}: {
  proposalId: string;
  proposalNumber: string | null | undefined;
}) {
  const { data: events = [] } = useQuery({
    queryKey: ["proposal-timeline", proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposal_timeline_events")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: versions = [] } = useQuery({
    queryKey: ["proposal-versions", proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposal_send_versions")
        .select("id, version_number, generated_at")
        .eq("proposal_id", proposalId);
      return data ?? [];
    },
  });
  const { data: sends = [] } = useQuery({
    queryKey: ["proposal-send-events", proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposal_send_events")
        .select("id, channel, recipient, sent_at")
        .eq("proposal_id", proposalId);
      return data ?? [];
    },
  });
  const { data: statusHist = [] } = useQuery({
    queryKey: ["proposal-status-history", proposalId],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposal_status_history")
        .select("id, from_status, to_status, created_at")
        .eq("proposal_id", proposalId);
      return data ?? [];
    },
  });
  const { data: agenda = [] } = useProposalAgenda(proposalNumber);
  const { data: tasks = [] } = useProposalTasks(proposalId);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const e of events) {
      list.push({
        id: `ev-${e.id}`,
        ts: e.created_at,
        icon: <MessageSquare className="h-3 w-3" />,
        title: e.description ?? e.event_type,
      });
    }
    for (const v of versions as any[]) {
      list.push({
        id: `v-${v.id}`,
        ts: v.generated_at,
        icon: <FileText className="h-3 w-3" />,
        title: `PDF gerado — v${v.version_number}`,
        tone: "info",
      });
    }
    for (const s of sends as any[]) {
      list.push({
        id: `s-${s.id}`,
        ts: s.sent_at,
        icon: <Send className="h-3 w-3" />,
        title: `Enviada por ${s.channel}${s.recipient ? ` → ${s.recipient}` : ""}`,
        tone: "info",
      });
    }
    for (const h of statusHist as any[]) {
      list.push({
        id: `h-${h.id}`,
        ts: h.created_at,
        icon: <RefreshCw className="h-3 w-3" />,
        title: `Status: ${h.from_status ?? "—"} → ${h.to_status}`,
        tone: "warn",
      });
    }
    for (const a of agenda) {
      list.push({
        id: `a-${a.id}`,
        ts: a.data_inicio,
        icon: <Calendar className="h-3 w-3" />,
        title: `${a.tipo} — ${new Date(a.data_inicio).toLocaleString("pt-BR")} · ${a.closer_nome}`,
        meta: a.status,
        tone: "info",
      });
    }
    for (const t of tasks) {
      if (t.completed_at) {
        list.push({
          id: `t-${t.id}`,
          ts: t.completed_at,
          icon: <CheckCircle2 className="h-3 w-3" />,
          title: `Tarefa concluída: ${t.title}`,
          tone: "success",
        });
      }
    }
    return list.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [events, versions, sends, statusHist, agenda, tasks]);

  if (items.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Sem eventos registrados.</div>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span
            className={
              "absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card " +
              (it.tone === "success"
                ? "bg-emerald-500 text-white"
                : it.tone === "warn"
                ? "bg-amber-500 text-white"
                : it.tone === "info"
                ? "bg-blue-500 text-white"
                : "bg-primary text-primary-foreground")
            }
          >
            {it.icon}
          </span>
          <div className="text-xs font-medium text-foreground">{it.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {dateTimeBR(it.ts)}
            {it.meta && <span className="rounded bg-muted px-1.5 py-0.5">{it.meta}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
