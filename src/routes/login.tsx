import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Snowflake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  if (!authLoading && user) return <Navigate to="/app" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    navigate({ to: "/app" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: fullName || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro realizado! Você já pode entrar.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-[image:var(--gradient-primary)] p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 backdrop-blur">
            <Snowflake className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight">CN Cold</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">Sales Intelligence</div>
          </div>
        </Link>
        <div>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Onde comercial,<br />engenharia e diretoria<br />
            <span className="opacity-70">decidem juntos.</span>
          </h2>
          <p className="mt-6 max-w-md text-base opacity-80">
            Plataforma operacional e estratégica para gestão de propostas, equipamentos
            e inteligência competitiva.
          </p>
        </div>
        <div className="text-xs opacity-50">© CNCode · CN Cold platform</div>
      </div>

      {/* Auth panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[image:var(--gradient-primary)]">
              <Snowflake className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="text-sm font-semibold">CN Cold</div>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <h1 className="text-2xl font-semibold tracking-tight">Acesse sua conta</h1>
              <p className="mt-1 text-sm text-muted-foreground">Use suas credenciais corporativas.</p>
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pwd">Senha</Label>
                  <Input id="login-pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <h1 className="text-2xl font-semibold tracking-tight">Criar nova conta</h1>
              <p className="mt-1 text-sm text-muted-foreground">Você entra como Vendedor por padrão. Um admin pode ajustar seu perfil depois.</p>
              <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">Nome completo</Label>
                  <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">E-mail</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-pwd">Senha</Label>
                  <Input id="su-pwd" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
