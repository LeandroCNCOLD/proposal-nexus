import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Search, Users, Briefcase } from "lucide-react";
import { brl } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/gestao/carteiras/")({
  component: CarteirasPage,
});

type RosterRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
  proposals_open: number;
  pipeline_value: number;
  leads_active: number;
  marketing_active: number;
};

// Hierarchy: which roles a viewer can see
function visibleRolesFor(viewerRoles: string[]): string[] {
  if (viewerRoles.includes("admin") || viewerRoles.includes("diretoria")) {
    return ["vendedor", "sdr", "gerente_comercial", "diretoria", "admin", "marketing"];
  }
  if (viewerRoles.includes("gerente_comercial")) {
    return ["vendedor", "sdr", "gerente_comercial", "marketing"];
  }
  return [];
}

function CarteirasPage() {
  const [q, setQ] = useState("");
  const { roles: viewerRoles } = useAuth();
  const allowedRoles = useMemo(() => visibleRolesFor(viewerRoles), [viewerRoles]);

  const { data: roster = [], isLoading } = useQuery({
    queryKey: ["manager-roster", allowedRoles.join(",")],
    enabled: allowedRoles.length > 0,
    queryFn: async () => {
      const { data: rolesRows } = await supabase.from("user_roles").select("user_id, role")
        .in("role", allowedRoles as never[]);
      const userIds = Array.from(new Set((rolesRows ?? []).map((r) => r.user_id)));
      if (userIds.length === 0) return [] as RosterRow[];
      const nowIso = new Date().toISOString();
      const [{ data: profs }, { data: props }, { data: leads }, { data: mkt }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", userIds),
        supabase.from("proposals").select("sales_owner_id, status, total_value").in("sales_owner_id", userIds),
        supabase.from("sdr_leads").select("sdr_id").in("sdr_id", userIds),
        supabase.from("marketing_leads" as never)
          .select("locked_by_sdr_id, lock_expires_at")
          .in("locked_by_sdr_id" as never, userIds as never)
          .gt("lock_expires_at" as never, nowIso as never),
      ]);
      const profById = new Map((profs ?? []).map((p) => [p.id, p]));
      const rolesByUser = new Map<string, string[]>();
      (rolesRows ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const open = new Set(["rascunho","em_elaboracao","aguardando_aprovacao","enviada","em_negociacao"]);
      const stats = new Map<string, { open: number; value: number }>();
      (props ?? []).forEach((p) => {
        if (!p.sales_owner_id) return;
        const s = stats.get(p.sales_owner_id) ?? { open: 0, value: 0 };
        if (open.has(p.status as string)) { s.open += 1; s.value += Number(p.total_value ?? 0); }
        stats.set(p.sales_owner_id, s);
      });
      const leadCount = new Map<string, number>();
      (leads ?? []).forEach((l) => {
        if (!l.sdr_id) return;
        leadCount.set(l.sdr_id, (leadCount.get(l.sdr_id) ?? 0) + 1);
      });
      const mktCount = new Map<string, number>();
      ((mkt ?? []) as Array<{ locked_by_sdr_id: string | null }>).forEach((m) => {
        if (!m.locked_by_sdr_id) return;
        mktCount.set(m.locked_by_sdr_id, (mktCount.get(m.locked_by_sdr_id) ?? 0) + 1);
      });
      return userIds.map((id) => {
        const p = profById.get(id);
        const s = stats.get(id) ?? { open: 0, value: 0 };
        return {
          user_id: id,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          roles: rolesByUser.get(id) ?? [],
          proposals_open: s.open,
          pipeline_value: s.value,
          leads_active: leadCount.get(id) ?? 0,
          marketing_active: mktCount.get(id) ?? 0,
        } as RosterRow;
      }).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return roster;
    return roster.filter((r) =>
      (r.full_name ?? "").toLowerCase().includes(s) ||
      (r.email ?? "").toLowerCase().includes(s) ||
      r.roles.some((x) => x.includes(s))
    );
  }, [roster, q]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E]">Carteiras da equipe</h1>
          <p className="text-sm text-muted-foreground">
            Visualize a carteira de cada vendedor/SDR, transfira itens e audite atividades.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar pessoa…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma pessoa encontrada.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => (
            <Link
              key={r.user_id}
              to="/app/gestao/carteiras/$userId"
              params={{ userId: r.user_id }}
              className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 hover:border-primary transition"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{r.full_name ?? r.email ?? r.user_id}</span>
                  {r.roles.map((x) => (
                    <Badge key={x} variant="secondary" className="text-[10px] uppercase">{x}</Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{r.email}</div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{r.proposals_open} prop.</span>
                <span className="font-mono tabular-nums">{brl(r.pipeline_value)}</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{r.leads_active} leads</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
