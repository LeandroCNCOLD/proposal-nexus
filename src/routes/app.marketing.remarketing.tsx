import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listRemarketingQueue, updateRemarketingItem, removeRemarketingItem } from "@/lib/remarketing.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Check, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/marketing/remarketing")({
  component: RemarketingQueuePage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_campanha: "Em campanha",
  concluido: "Concluído",
  descartado: "Descartado",
};
const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800",
  em_campanha: "bg-blue-100 text-blue-800",
  concluido: "bg-emerald-100 text-emerald-800",
  descartado: "bg-gray-200 text-gray-700",
};

function RemarketingQueuePage() {
  const list = useServerFn(listRemarketingQueue);
  const update = useServerFn(updateRemarketingItem);
  const remove = useServerFn(removeRemarketingItem);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["remarketing", "queue", status, source, search],
    queryFn: () => list({ data: {
      status: status === "all" ? undefined : (status as never),
      source: source === "all" ? undefined : (source as never),
      search: search || undefined,
    } }),
    staleTime: 30_000,
  });

  async function setStatusFor(id: string, newStatus: "em_campanha" | "concluido" | "descartado") {
    try {
      await update({ data: { id, status: newStatus } });
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["remarketing"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onRemove(id: string) {
    if (!confirm("Remover da fila?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["remarketing"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="p-6 space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">Fila de Remarketing</h1>
        <p className="text-sm text-muted-foreground">Leads arquivados encaminhados para campanhas futuras de e-mail marketing/nutrição.</p>
      </div>
      <div className="flex flex-wrap gap-2 items-end bg-muted/30 p-3 rounded-md">
        <div className="w-64">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, contato, código…" />
        </div>
        <div className="w-44">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_campanha">Em campanha</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="descartado">Descartado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="text-xs text-muted-foreground">Origem</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="sdr">Banco SDR</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="rounded-md border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Origem</th>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Empresa / Contato</th>
                <th className="text-left px-3 py-2">Cidade</th>
                <th className="text-left px-3 py-2">Motivo</th>
                <th className="text-left px-3 py-2">Campanha</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Adicionado em</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20 align-top">
                  <td className="px-3 py-2 text-xs uppercase">{r.source}</td>
                  <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">{r.lead_code ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.client_name ?? r.contact_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.contact_email ?? ""}{r.contact_email && r.contact_phone ? " · " : ""}{r.contact_phone ?? ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{[r.city, r.state].filter(Boolean).join("/") || "—"}</td>
                  <td className="px-3 py-2 text-xs max-w-xs">
                    <span className="line-clamp-2" title={r.reason ?? ""}>{r.reason ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.campaign_name ?? "—"}</td>
                  <td className="px-3 py-2"><Badge className={STATUS_COLORS[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                    {r.status === "pendente" && (
                      <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "em_campanha")}>
                        <Play className="w-3.5 h-3.5 mr-1" /> Iniciar
                      </Button>
                    )}
                    {r.status === "em_campanha" && (
                      <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "concluido")}>
                        <Check className="w-3.5 h-3.5 mr-1" /> Concluir
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onRemove(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!(data ?? []).length && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Nenhum item na fila.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
