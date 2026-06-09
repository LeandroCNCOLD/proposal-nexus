import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMarketingLeads } from "@/lib/marketing-leads.functions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/marketing/leads")({
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
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "leads", status, search],
    queryFn: () => fn({ data: { status: status === "all" ? undefined : (status as never), search: search || undefined } }),
    staleTime: 30_000,
  });
  return (
    <div className="p-6 space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-64">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, contato, e-mail, código…" />
        </div>
        <div className="w-48">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="tentando_contato">Tentando contato</SelectItem>
              <SelectItem value="qualificado">Qualificado</SelectItem>
              <SelectItem value="convertido">Convertido</SelectItem>
              <SelectItem value="descartado">Descartado</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                <th className="text-left px-3 py-2">Empresa</th>
                <th className="text-left px-3 py-2">Contato</th>
                <th className="text-left px-3 py-2">Cidade</th>
                <th className="text-left px-3 py-2">Origem</th>
                <th className="text-left px-3 py-2">Recebido</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-[11px]">
                    <Link to="/app/marketing/leads/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.lead_code}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2">{r.client_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div>{r.contact_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.contact_email ?? ""} {r.contact_phone ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">{[r.city, r.state].filter(Boolean).join("/") || "—"}</td>
                  <td className="px-3 py-2 capitalize">{r.origem}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{new Date(r.received_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {!data?.length && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum lead.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
