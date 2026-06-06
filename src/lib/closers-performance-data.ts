import { supabase } from "@/integrations/supabase/client";

export type Agenda = {
  id: string;
  closer_nome: string;
  status: string;
  data_inicio: string;
};
export type Proposal = {
  id: string;
  sales_owner_id: string | null;
  nomus_seller_name: string | null;
  status: string;
  total_value: number | null;
  closed_value: number | null;
  closed_at: string | null;
  created_at: string;
};
export type Meta = {
  id: string;
  closer_nome: string;
  user_id: string | null;
  mes: string;
  meta_reunioes: number;
  meta_propostas: number;
  meta_ganhas: number;
  meta_receita: number;
};
export type Profile = { id: string; full_name: string | null };

export function monthStartISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
export function monthEndISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}
export function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export async function fetchClosersPerfData(mes: string) {
  const start = mes;
  const end = monthEndISO(new Date(mes));

  const [profilesRes, rolesRes, agendaRes, proposalsRes, metasRes, meRes] = await Promise.all([
    supabase.from("profiles").select("id,full_name"),
    supabase.from("user_roles").select("user_id,role").in("role", ["vendedor", "gerente_comercial"]),
    supabase
      .from("crm_agenda")
      .select("id,closer_nome,status,data_inicio")
      .gte("data_inicio", `${start}T00:00:00`)
      .lte("data_inicio", `${end}T23:59:59`),
    supabase
      .from("proposals")
      .select("id,sales_owner_id,nomus_seller_name,status,total_value,closed_value,closed_at,created_at")
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`)
      .eq("is_active", true),
    supabase.from("crm_closer_metas").select("*").eq("mes", start),
    supabase.auth.getUser(),
  ]);

  if (agendaRes.error) throw agendaRes.error;
  if (proposalsRes.error) throw proposalsRes.error;
  if (metasRes.error) throw metasRes.error;

  return {
    profiles: (profilesRes.data ?? []) as Profile[],
    closerIds: new Set((rolesRes.data ?? []).map((r) => r.user_id as string)),
    agenda: (agendaRes.data ?? []) as Agenda[],
    proposals: (proposalsRes.data ?? []) as Proposal[],
    metas: (metasRes.data ?? []) as Meta[],
    me: meRes.data.user?.id ?? null,
  };
}
