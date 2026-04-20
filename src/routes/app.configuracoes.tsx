import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/proposal";

export const Route = createFileRoute("/app/configuracoes")({ component: SettingsPage });

function SettingsPage() {
  const { user, roles } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
    enabled: !!user,
  });

  return (
    <>
      <PageHeader title="Configurações" subtitle="Sua conta e perfis do sistema" />
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold mb-4">Minha conta</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Nome</dt><dd>{profile?.full_name ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">E-mail</dt><dd>{user?.email}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Perfis</dt>
              <dd className="flex flex-wrap gap-1.5 mt-1">
                {roles.map((r) => <span key={r} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">{ROLE_LABELS[r]}</span>)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-sm font-semibold mb-2">Gestão de perfis</h2>
          <p className="text-xs text-muted-foreground">A gestão de perfis de outros usuários (atribuição de papéis) está disponível para administradores e será implementada em próxima iteração.</p>
        </div>
      </div>
    </>
  );
}
