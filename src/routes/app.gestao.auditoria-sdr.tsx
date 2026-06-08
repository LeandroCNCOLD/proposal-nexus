import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateTimeBR } from "@/lib/format";
import { Phone, FileText, Search } from "lucide-react";

export const Route = createFileRoute("/app/gestao/auditoria-sdr")({
  component: SdrAuditPage,
});

function SdrAuditPage() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [q, setQ] = useState("");
  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - Number(period)); return d.toISOString();
  }, [period]);

  const { data: calls = [] } = useQuery({
    queryKey: ["audit-calls", period],
    queryFn: async () => {
      const { data } = await supabase.from("crm_call_logs")
        .select("id, sdr_name, call_date, call_time, channel, result, observation, temperature_after, meeting_booked, pipeline_id")
        .gte("created_at", since).order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return calls;
    return calls.filter((c) =>
      (c.sdr_name ?? "").toLowerCase().includes(s) ||
      (c.observation ?? "").toLowerCase().includes(s) ||
      (c.result ?? "").toLowerCase().includes(s)
    );
  }, [calls, q]);

  const exportCsv = () => {
    const rows = [
      ["SDR","Data","Hora","Canal","Resultado","Obs","Temp após","Reunião"],
      ...filtered.map((c) => [c.sdr_name, c.call_date, c.call_time ?? "", c.channel, c.result ?? "", (c.observation ?? "").replace(/\n/g," "), c.temperature_after ?? "", c.meeting_booked ? "Sim" : "Não"]),
    ];
    const csv = rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `auditoria-sdr-${period}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">Auditoria SDR</h1>
        <p className="text-sm text-muted-foreground">Ligações e contatos registrados por cada SDR no período.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["7","30","90"] as const).map((d) => (
          <Button key={d} size="sm" variant={period === d ? "default" : "outline"} onClick={() => setPeriod(d)}>{d} dias</Button>
        ))}
        <div className="relative w-72 ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar SDR, observação…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? <div className="text-center text-sm text-muted-foreground py-12">Sem ligações no período.</div> :
          filtered.map((c) => (
            <div key={c.id} className="rounded-md border bg-card p-3 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span className="font-semibold">{c.sdr_name}</span>
                <span>· {c.channel}</span>
                <span className="ml-auto">{c.call_date} {c.call_time ?? ""}</span>
              </div>
              <div className="mt-1"><span className="font-medium">{c.result ?? "—"}</span> · Temp: {c.temperature_after ?? "—"} {c.meeting_booked && <span className="ml-2 text-green-700">Reunião marcada</span>}</div>
              {c.observation && <div className="mt-1 whitespace-pre-wrap text-foreground/90">{c.observation}</div>}
            </div>
          ))
        }
      </div>
    </div>
  );
}
