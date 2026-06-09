import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMarketingLeads, updateMarketingLeadStatus, type MarketingLeadRow } from "@/lib/marketing-leads.functions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/marketing/kanban")({
  component: MarketingKanbanPage,
});

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "novo", label: "Novos", color: "border-blue-300" },
  { key: "em_analise", label: "Em análise", color: "border-purple-300" },
  { key: "tentando_contato", label: "Tentando contato", color: "border-amber-300" },
  { key: "qualificado", label: "Qualificado", color: "border-emerald-300" },
  { key: "convertido", label: "Convertido", color: "border-green-400" },
  { key: "descartado", label: "Descartado", color: "border-gray-300" },
];

function MarketingKanbanPage() {
  const list = useServerFn(listMarketingLeads);
  const update = useServerFn(updateMarketingLeadStatus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "leads", "all"],
    queryFn: () => list({ data: { limit: 500 } }),
    staleTime: 30_000,
  });

  const grouped = new Map<string, MarketingLeadRow[]>();
  COLUMNS.forEach((c) => grouped.set(c.key, []));
  (data ?? []).forEach((l) => grouped.get(l.status)?.push(l));

  async function move(lead: MarketingLeadRow, to: string) {
    if (lead.status === to) return;
    try {
      await update({ data: { id: lead.id, status: to as never } });
      toast.success(`Movido para ${to}`);
      qc.invalidateQueries({ queryKey: ["marketing"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {COLUMNS.map((col) => (
          <div key={col.key} className={`w-72 shrink-0 rounded-lg border-t-4 ${col.color} bg-muted/20 p-2`}>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-xs font-semibold uppercase text-[#0F2D5E]">{col.label}</div>
              <Badge variant="outline">{grouped.get(col.key)?.length ?? 0}</Badge>
            </div>
            <div className="space-y-2">
              {(grouped.get(col.key) ?? []).map((l) => (
                <div key={l.id} className="bg-card border rounded p-2 shadow-sm">
                  <Link to="/app/marketing/leads/$id" params={{ id: l.id }} className="block font-semibold text-sm hover:text-primary">
                    {l.client_name ?? l.contact_name ?? l.lead_code}
                  </Link>
                  {l.contact_name && l.client_name && (
                    <div className="text-[11px] text-muted-foreground">{l.contact_name}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {[l.city, l.state].filter(Boolean).join("/")} · {l.origem}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono">{l.lead_code}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {COLUMNS.filter((c) => c.key !== l.status && c.key !== "convertido").map((c) => (
                      <Button key={c.key} size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => move(l, c.key)}>
                        → {c.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              {(grouped.get(col.key) ?? []).length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-4">vazio</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
