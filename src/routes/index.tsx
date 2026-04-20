import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Snowflake, ArrowRight, BarChart3, FileText, Wrench, Swords, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/app" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Snowflake className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">CN Cold</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sales Intelligence</div>
          </div>
        </div>
        <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
      </header>

      <section className="mx-auto max-w-5xl px-8 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-[var(--shadow-sm)]">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Plataforma operacional ativa
        </div>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-6xl">
          Inteligência comercial e<br />
          <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
            engenharia de propostas
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Operação completa de propostas, banco técnico de equipamentos, inteligência competitiva
          e IA aplicada — em uma única plataforma.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg" className="bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Link to="/login">Acessar plataforma <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: BarChart3, t: "Dashboard", d: "Funil completo" },
            { icon: FileText, t: "Propostas", d: "Workflow + SLA" },
            { icon: Wrench, t: "Equipamentos", d: "Banco técnico" },
            { icon: Swords, t: "Competitiva", d: "Head-to-head" },
            { icon: Sparkles, t: "IA", d: "Insights & resumos" },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border bg-card p-5 text-left shadow-[var(--shadow-sm)]">
              <f.icon className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold">{f.t}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{f.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
