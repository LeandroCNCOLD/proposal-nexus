import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMarketingLeads, claimMarketingLead } from "@/lib/marketing-leads.functions";
import { enqueueRemarketing } from "@/lib/remarketing.functions";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Hand, Mail } from "lucide-react";

export const Route = createFileRoute("/app/marketing/leads")({
  component: MarketingLeadsListPage,
});

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-800",
  em_analise: "bg-purple-100 text-purple-800",
  tentando_contato: "bg-amber-100 text-amber-800",
  qualificado: "bg-emerald-100 text-emerald-800",
  convertido: "bg-green-200 text-green-900",
  descartado: "bg-gray-200 text-gray-700",
};

function MarketingLeadsListPage() {
  const fn = useServerFn(listMarketingLeads);
  const claim = useServerFn(claimMarketingLead);
  const enqueue = useServerFn(enqueueRemarketing);
  const qc = useQueryClient();
  const { user, hasAnyRole } = useAuth();
  const isManager = hasAnyRole(["admin", "diretoria", "gerente_comercial", "marketing"]);
  const [tab, setTab] = useState<"ativos" | "arquivados">("ativos");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const effectiveStatus = tab === "arquivados" ? "descartado" : (status === "all" ? undefined : status);
  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "leads", tab, status, search],
    queryFn: () => fn({ data: { status: effectiveStatus as never, search: search || undefined } }),
    staleTime: 30_000,
  });

  const now = Date.now();
  const visible = (data ?? []).filter((r) => {
    if (tab === "ativos" && r.status === "descartado") return false;
    if (isManager) return true;
    const exp = r.lock_expires_at ? new Date(r.lock_expires_at).getTime() : 0;
    const lockedByOther = r.locked_by_sdr_id && r.locked_by_sdr_id !== user?.id && exp > now;
    return !lockedByOther;
  });

  async function onClaim(id: string) {
    try { await claim({ data: { lead_id: id } }); toast.success("Lead na sua carteira"); qc.invalidateQueries({ queryKey: ["marketing"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onRemarketing(id: string, reason: string | null) {
    try {
      await enqueue({ data: { source: "marketing", lead_id: id, reason } });
      toast.success("Enviado para fila de remarketing");
      qc.invalidateQueries({ queryKey: ["remarketing"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab("ativos")}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "ativos" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >Ativos</button>
        <button
          type="button"
          onClick={() => setTab("arquivados")}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "arquivados" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >Arquivados (descartados)</button>
        <Link to="/app/marketing/remarketing" className="ml-auto text-xs text-primary hover:underline">
          Fila de remarketing →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-64">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, contato, e-mail, código…" />
        </div>
        {tab === "ativos" && (
          <div className="w-48">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (exceto descartado)</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="tentando_contato">Tentando contato</SelectItem>
                <SelectItem value="qualificado">Qualificado</SelectItem>
                <SelectItem value="convertido">Convertido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando…</div>
      ) : (
        <div className="rounded-md border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Empresa / Contato</th>
                <th className="text-left px-3 py-2">Cidade</th>
                <th className="text-left px-3 py-2">Segmento</th>
                <th className="text-left px-3 py-2">Pedido do cliente</th>
                <th className="text-left px-3 py-2">Origem</th>
                <th className="text-left px-3 py-2">Recebido</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const exp = r.lock_expires_at ? new Date(r.lock_expires_at).getTime() : 0;
                const lockedByMe = r.locked_by_sdr_id === user?.id && exp > now;
                const lockedByOther = !!r.locked_by_sdr_id && r.locked_by_sdr_id !== user?.id && exp > now;
                const tipo = (r.origem_detalhe as Record<string, unknown> | null)?.["tipo_contato"] as string | undefined;
                const msg = r.mensagem ?? "";
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/20 align-top">
                    <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap">
                      <Link to="/app/marketing/leads/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.lead_code}</Link>
                    </td>
                    <td className="px-3 py-2"><Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.client_name ?? r.contact_name ?? "—"}</div>
                      {r.client_name && r.contact_name && (
                        <div className="text-[11px] text-muted-foreground">{r.contact_name}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        {r.contact_email ? <span>{r.contact_email}</span> : null}
                        {r.contact_email && r.contact_phone ? " · " : ""}
                        {r.contact_phone ? <span>{r.contact_phone}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{[r.city, r.state].filter(Boolean).join("/") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.segmento ?? "—"}</td>
                    <td className="px-3 py-2 text-xs max-w-xs">
                      {msg ? (
                        <span className="line-clamp-2 text-muted-foreground" title={msg}>{msg}</span>
                      ) : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="capitalize">{r.origem}</div>
                      {tipo && <div className="text-[10px] text-muted-foreground">{tipo}</div>}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap">{new Date(r.received_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {lockedByMe ? (
                        <Badge className="bg-emerald-100 text-emerald-800">na minha carteira</Badge>
                      ) : lockedByOther ? (
                        <Badge variant="secondary">com {r.locked_by_sdr_name ?? "outro SDR"}</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => onClaim(r.id)}>
                          <Hand className="w-3.5 h-3.5 mr-1" /> Pegar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Nenhum lead.</td></tr>
              )}
            </tbody>
          </table>
        </div>

      )}
    </div>
  );
}
