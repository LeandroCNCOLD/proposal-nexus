import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyMarketingWallet, releaseMarketingLead, renewMarketingLeadLock, convertMarketingLead } from "@/lib/marketing-leads.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Briefcase, RefreshCw, Undo2, ArrowRightCircle } from "lucide-react";

export const Route = createFileRoute("/app/marketing/wallet")({
  component: MarketingWalletPage,
});

function daysLeft(iso?: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}

function MarketingWalletPage() {
  const list = useServerFn(listMyMarketingWallet);
  const release = useServerFn(releaseMarketingLead);
  const renew = useServerFn(renewMarketingLeadLock);
  const convert = useServerFn(convertMarketingLead);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "wallet"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  async function onRelease(id: string) {
    if (!confirm("Devolver este lead ao Banco de Leads?")) return;
    try { await release({ data: { lead_id: id } }); toast.success("Lead devolvido"); qc.invalidateQueries({ queryKey: ["marketing"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onRenew(id: string) {
    try { await renew({ data: { lead_id: id } }); toast.success("Lock renovado por +7 dias"); qc.invalidateQueries({ queryKey: ["marketing"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function onConvert(id: string) {
    if (!confirm("Converter este lead em Lead Qualificado (SDR)?")) return;
    try {
      const res = await convert({ data: { lead_id: id } });
      toast.success("Lead convertido");
      qc.invalidateQueries({ queryKey: ["marketing"] });
      if (res.sdr_lead_id) navigate({ to: "/app/sdr/leads/$id", params: { id: res.sdr_lead_id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-2 text-[#0F2D5E]">
        <Briefcase className="w-5 h-5" />
        <h2 className="text-lg font-bold">Minha Carteira de Marketing</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Leads que você pegou do banco. O lock é de 7 dias; renove ou devolva quando necessário.
      </p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !data?.length ? (
        <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum lead na sua carteira. Vá ao <Link to="/app/marketing/leads" className="text-primary hover:underline">Banco de Leads de Marketing</Link> e clique em "Pegar pra mim".
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Empresa</th>
                <th className="text-left px-3 py-2">Contato</th>
                <th className="text-left px-3 py-2">Cidade</th>
                <th className="text-left px-3 py-2">Lock expira em</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const left = daysLeft(r.lock_expires_at);
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-[11px]">
                      <Link to="/app/marketing/leads/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.lead_code}</Link>
                    </td>
                    <td className="px-3 py-2">{r.client_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div>{r.contact_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{r.contact_email ?? ""} {r.contact_phone ?? ""}</div>
                    </td>
                    <td className="px-3 py-2">{[r.city, r.state].filter(Boolean).join("/") || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge className={left !== null && left <= 1 ? "bg-red-100 text-red-800" : left !== null && left <= 3 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}>
                        {left === null ? "—" : left === 0 ? "hoje" : `${left}d`}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => onRenew(r.id)} title="Renovar +7 dias">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onRelease(r.id)} title="Devolver ao banco">
                        <Undo2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" onClick={() => onConvert(r.id)} title="Converter em Lead Qualificado (SDR)">
                        <ArrowRightCircle className="w-3.5 h-3.5 mr-1" /> Qualificar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
