import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "vendedor" | "sdr" | "gerente_comercial" | "diretoria" | "admin" | string;
};

export function useTeamRoster(role?: TeamMember["role"]) {
  return useQuery({
    queryKey: ["team-roster", role ?? "all"],
    queryFn: async () => {
      let q = supabase.from("user_roles").select("user_id, role");
      if (role) q = q.eq("role", role as never);
      const { data: rolesRows, error } = await q;
      if (error) throw error;
      const ids = Array.from(new Set((rolesRows ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [] as TeamMember[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      return (rolesRows ?? []).map((r) => {
        const p = byId.get(r.user_id);
        return {
          user_id: r.user_id,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          role: r.role,
        } as TeamMember;
      });
    },
  });
}
