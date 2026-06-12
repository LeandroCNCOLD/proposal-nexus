import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Profile | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

const MANAGER_ROLES: AppRole[] = ["admin", "diretoria", "gerente_comercial"];

export function useIsManager() {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(MANAGER_ROLES);
}

export function useIsAdmin() {
  const { hasRole } = useAuth();
  return hasRole("admin");
}

export function useIsSDR() {
  const { hasRole } = useAuth();
  return hasRole("sdr");
}

export function useIsCloser() {
  const { hasRole } = useAuth();
  return hasRole("vendedor");
}

export function useMyName() {
  const { data } = useProfile();
  const { user } = useAuth();
  return data?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
}

/** Returns the default landing route based on the user's primary role. */
export function defaultRouteForRoles(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/app/admin/usuarios";
  if (roles.includes("gerente_comercial") || roles.includes("diretoria")) return "/app/sdr/war-room";
  if (roles.includes("sdr")) return "/app/sdr/bank";
  if (roles.includes("vendedor")) return "/app/agenda";
  return "/app";
}
