import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { getMyPermissions } from "@/lib/permissions.functions";

export function usePermissions() {
  const { user } = useAuth();
  const fetchPerms = useServerFn(getMyPermissions);
  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id],
    queryFn: () => fetchPerms(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const set = new Set(data ?? []);
  return {
    isLoading,
    permissions: data ?? [],
    has: (key: string) => set.has(key),
    hasAny: (keys: string[]) => keys.some((k) => set.has(k)),
  };
}

export function usePermission(key: string) {
  const { has, isLoading } = usePermissions();
  return { allowed: has(key), isLoading };
}
