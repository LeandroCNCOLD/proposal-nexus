import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/gestao")({
  component: GestaoLayout,
});

function GestaoLayout() {
  const { roles, loading } = useAuth();
  const allowed = roles.some((r) => ["admin", "diretoria", "gerente_comercial"].includes(r));
  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-[#0F2D5E]">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Esta área é exclusiva para admin, diretoria e gerente comercial.
        </p>
        <Link to="/app" className="text-sm text-primary underline mt-3 inline-block">Voltar</Link>
      </div>
    );
  }
  return <Outlet />;
}
