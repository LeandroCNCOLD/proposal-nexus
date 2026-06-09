import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSellerProposalsFor } from "@/hooks/use-seller-proposals-for";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRightLeft, Phone, FileText, Calendar, ExternalLink, Thermometer, DollarSign, Users, Unlock } from "lucide-react";
import { brl, dateBR, dateTimeBR } from "@/lib/format";
import { STATUS_LABELS, TEMPERATURE_LABELS } from "@/lib/proposal";
import { TransferProposalDialog } from "@/components/manager/TransferProposalDialog";
import { TransferLeadDialog } from "@/components/manager/TransferLeadDialog";
import { useServerFn } from "@tanstack/react-start";
import { releaseMarketingLead } from "@/lib/marketing-leads.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/app/gestao/carteiras/$userId")({
  component: UserWalletPage,
});

function UserWalletPage() {
  const { userId } = Route.useParams();

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const { data: proposals = [], isLoading: lp } = useSellerProposalsFor(userId);

  const { data: leads = [] } = useQuery({
    queryKey: ["sdr-leads-for", userId],
    queryFn: async () => {
      const { data } = await supabase.from("sdr_leads")
        .select("id, lead_code, client_name, value, temperature, sdr_status, last_contact_at, next_contact_at, locked_by_sdr_id")
        .eq("sdr_id", userId)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const qc = useQueryClient();
  const release = useServerFn(releaseMarketingLead);
  const { data: mktLeads = [] } = useQuery({
    queryKey: ["mkt-leads-for", userId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase.from("marketing_leads" as never)
        .select("id, lead_code, client_name, contact_name, contact_phone, contact_email, segmento, mensagem, status, locked_at, lock_expires_at, received_at, origem_detalhe")
        .eq("locked_by_sdr_id" as never, userId as never)
        .gt("lock_expires_at" as never, nowIso as never)
        .order("locked_at" as never, { ascending: false });
      return (data ?? []) as Array<{ id: string; lead_code: string; client_name: string | null; contact_name: string | null; contact_phone: string | null; contact_email: string | null; segmento: string | null; mensagem: string | null; status: string; locked_at: string | null; lock_expires_at: string | null; received_at: string; origem_detalhe: Record<string, unknown> | null }>;
    },
  });


  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const since = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - Number(period)); return d.toISOString();
  }, [period]);

  const { data: activity = [] } = useQuery({
    queryKey: ["user-activity", userId, period],
    queryFn: async () => {
      const [calls, notes, events] = await Promise.all([
        supabase.from("crm_call_logs").select("id, call_date, call_time, result, observation, channel, temperature_after, pipeline_id, duration_min, meeting_booked")
          .eq("sdr_id", userId).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
        supabase.from("crm_notes").select("id, body, created_at, pipeline_id").eq("created_by", userId)
          .gte("created_at", since).order("created_at", { ascending: false }).limit(200),
        supabase.from("proposal_timeline_events").select("id, event_type, description, created_at, proposal_id")
          .eq("user_id", userId).gte("created_at", since).order("created_at", { ascending: false }).limit(200),
      ]);

      // Resolve lead and proposal references for context labels
      const leadIds = Array.from(new Set([
        ...(calls.data ?? []).map((c) => c.pipeline_id),
        ...(notes.data ?? []).map((n) => n.pipeline_id),
      ].filter(Boolean) as string[]));
      const propIds = Array.from(new Set((events.data ?? []).map((e) => e.proposal_id).filter(Boolean) as string[]));

      const [leadsRes, propsRes] = await Promise.all([
        leadIds.length
          ? supabase.from("sdr_leads").select("id, lead_code, client_name").in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
        propIds.length
          ? supabase.from("proposals").select("id, number, title, total_value, status, clients(name, trade_name)").in("id", propIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const leadById = new Map((leadsRes.data ?? []).map((l: any) => [l.id, l]));
      const propById = new Map((propsRes.data ?? []).map((p: any) => [p.id, p]));

      const merged = [
        ...((calls.data ?? []).map((c) => {
          const lead = c.pipeline_id ? leadById.get(c.pipeline_id) : null;
          const parts = [
            c.result ?? "Sem resultado",
            c.duration_min ? `${c.duration_min} min` : null,
            c.temperature_after ? `Temp.: ${c.temperature_after}` : null,
            c.meeting_booked ? "Reunião agendada" : null,
            c.observation ? `“${c.observation}”` : null,
          ].filter(Boolean).join(" · ");
          return {
            kind: "call" as const, id: c.id, ts: `${c.call_date}T${c.call_time ?? "00:00"}`,
            title: `Ligação · ${c.channel}`,
            detail: parts,
            ref: c.pipeline_id,
            refKind: "lead" as const,
            refLabel: lead ? `${lead.lead_code} — ${lead.client_name}` : null,
          };
        })),
        ...((notes.data ?? []).map((n) => {
          const lead = n.pipeline_id ? leadById.get(n.pipeline_id) : null;
          return {
            kind: "note" as const, id: n.id, ts: n.created_at, title: "Nota",
            detail: n.body ?? "",
            ref: n.pipeline_id,
            refKind: "lead" as const,
            refLabel: lead ? `${lead.lead_code} — ${lead.client_name}` : null,
          };
        })),
        ...((events.data ?? []).map((e) => {
          const p: any = e.proposal_id ? propById.get(e.proposal_id) : null;
          const cliente = p?.clients?.trade_name || p?.clients?.name || null;
          const label = p ? `${p.number} — ${p.title}${cliente ? ` (${cliente})` : ""}` : null;
          return {
            kind: "timeline" as const, id: e.id, ts: e.created_at,
            title: e.event_type,
            detail: e.description ?? "",
            ref: e.proposal_id,
            refKind: "proposal" as const,
            refLabel: label,
            refStatus: p?.status as string | undefined,
            refValue: p?.total_value as number | undefined,
          };
        })),
      ];
      return merged.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
    },
  });

  const [transferProp, setTransferProp] = useState<string | null>(null);
  const [transferLead, setTransferLead] = useState<string | null>(null);

  const name = profile?.full_name ?? profile?.email ?? userId;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/app/gestao/carteiras" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">{name}</h1>
        <p className="text-sm text-muted-foreground">{profile?.email}</p>
      </div>

      <Tabs defaultValue="proposals">
        <TabsList>
          <TabsTrigger value="proposals">Propostas ({proposals.length})</TabsTrigger>
          <TabsTrigger value="leads">Leads SDR ({leads.length})</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="mt-4 space-y-2">
          {lp ? <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div> :
            proposals.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem propostas.</div> :
            proposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
                <Link to="/app/propostas/$id" params={{ id: p.id }} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{p.number}</span>
                    <span className="font-semibold text-sm truncate">{p.title}</span>
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[p.status as keyof typeof STATUS_LABELS] ?? p.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {p.clients?.trade_name || p.clients?.name || "—"}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs flex-wrap">
                    <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" />{brl(Number(p.total_value ?? 0))}</span>
                    {p.temperature && <span className="inline-flex items-center gap-1"><Thermometer className="h-3 w-3" />{TEMPERATURE_LABELS[p.temperature as keyof typeof TEMPERATURE_LABELS] ?? p.temperature}</span>}
                    {p.next_followup_at && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{dateBR(p.next_followup_at)}</span>}
                  </div>
                </Link>
                <Button size="sm" variant="outline" onClick={() => setTransferProp(p.id)}>
                  <ArrowRightLeft className="h-3 w-3 mr-1" /> Transferir
                </Button>
              </div>
            ))
          }
        </TabsContent>

        <TabsContent value="leads" className="mt-4 space-y-2">
          {leads.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem leads.</div> :
            leads.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{l.lead_code}</span>
                    <span className="font-semibold text-sm truncate">{l.client_name}</span>
                    <Badge variant="outline" className="text-[10px]">{l.sdr_status}</Badge>
                    {l.temperature && <Badge variant="secondary" className="text-[10px]">{l.temperature}</Badge>}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{brl(Number(l.value ?? 0))}</span>
                    {l.last_contact_at && <span>Último: {dateBR(l.last_contact_at)}</span>}
                    {l.next_contact_at && <span>Próximo: {dateBR(l.next_contact_at)}</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTransferLead(l.id)}>
                  <ArrowRightLeft className="h-3 w-3 mr-1" /> Transferir
                </Button>
              </div>
            ))
          }
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-3">
          <div className="flex gap-2">
            {(["7","30","90"] as const).map((d) => (
              <Button key={d} size="sm" variant={period === d ? "default" : "outline"} onClick={() => setPeriod(d)}>
                {d} dias
              </Button>
            ))}
          </div>
          {activity.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">Sem atividade no período.</div> :
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={`${a.kind}-${a.id}`} className="rounded-md border bg-card p-3 text-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {a.kind === "call" && <Phone className="h-3 w-3" />}
                    {a.kind === "note" && <FileText className="h-3 w-3" />}
                    {a.kind === "timeline" && <ExternalLink className="h-3 w-3" />}
                    <span className="font-semibold uppercase tracking-wide">{a.title}</span>
                    <span className="ml-auto">{dateTimeBR(a.ts)}</span>
                  </div>
                  {a.refLabel && a.ref && (
                    a.refKind === "proposal" ? (
                      <Link
                        to="/app/propostas/$id"
                        params={{ id: a.ref }}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" /> {a.refLabel}
                        {"refStatus" in a && a.refStatus && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {STATUS_LABELS[a.refStatus as keyof typeof STATUS_LABELS] ?? a.refStatus}
                          </Badge>
                        )}
                        {"refValue" in a && typeof a.refValue === "number" && a.refValue > 0 && (
                          <span className="ml-1 font-mono tabular-nums text-muted-foreground">{brl(a.refValue)}</span>
                        )}
                      </Link>
                    ) : (
                      <Link
                        to="/app/sdr/leads/$id"
                        params={{ id: a.ref }}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Users className="h-3 w-3" /> {a.refLabel}
                      </Link>
                    )
                  )}
                  {a.detail && <div className="mt-1 whitespace-pre-wrap text-foreground/90">{a.detail}</div>}
                </div>
              ))}
            </div>
          }
        </TabsContent>
      </Tabs>

      {transferProp && (
        <TransferProposalDialog
          open={!!transferProp}
          onOpenChange={(v) => !v && setTransferProp(null)}
          proposalId={transferProp}
          kind="sales"
        />
      )}
      {transferLead && (
        <TransferLeadDialog
          open={!!transferLead}
          onOpenChange={(v) => !v && setTransferLead(null)}
          leadId={transferLead}
        />
      )}
    </div>
  );
}
