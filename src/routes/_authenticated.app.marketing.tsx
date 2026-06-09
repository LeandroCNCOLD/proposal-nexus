import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Megaphone, LayoutDashboard, Kanban, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  const { roles, loading } = useAuth();
  const { pathname } = useLocation();
  const allowed = roles.some((r) => ["admin", "diretoria", "gerente_comercial", "marketing", "sdr"].includes(r));
  if (loading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-[#0F2D5E]">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground mt-2">Esta área é exclusiva para o time de marketing, SDR e gestores.</p>
      </div>
    );
  }
  const isManager = roles.some((r) => ["admin", "diretoria", "gerente_comercial"].includes(r));
  const tabs = [
    { to: "/app/marketing", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/app/marketing/kanban", label: "Kanban", icon: Kanban },
    { to: "/app/marketing/leads", label: "Lista de leads", icon: Megaphone },
    { to: "/app/marketing/novo", label: "Novo lead", icon: Plus },
    ...(isManager ? [{ to: "/app/marketing/config", label: "Configurar pontuação", icon: Settings }] : []),
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-[#0F2D5E]">
          <Megaphone className="w-5 h-5" />
          <h1 className="text-lg font-bold">Marketing</h1>
        </div>
        <nav className="mt-3 flex flex-wrap gap-1">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition",
                  active ? "bg-[#0F2D5E] text-white border-[#0F2D5E]" : "bg-muted/40 hover:bg-muted",
                )}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
