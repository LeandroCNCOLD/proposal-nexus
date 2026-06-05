import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const label = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="hidden md:flex items-center gap-2 ml-auto">
      <span className="font-mono text-xl font-bold tabular-nums text-[#0F2D5E]">{label}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-xs font-semibold text-white">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> Ao vivo
      </span>
    </div>
  );
}
import {
  LayoutDashboard, FileText, Users, Building2, Wrench, Swords,
  FileBarChart, FileCheck2, FolderUp, Settings, LogOut,
  Search, Bell, Snowflake, ChevronDown, CheckSquare, PlugZap, Database,
  LayoutTemplate, Kanban, Thermometer, PackageSearch,
  Zap, Flame, BarChart2, Briefcase, Calendar,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/proposal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { group: "SDR — Pré-Venda", items: [
    { to: "/app/sdr/bank", label: "Banco de Leads", icon: Database },
    { to: "/app/sdr/wallet", label: "Minha Carteira", icon: Briefcase },
    { to: "/app/sdr/war-room", label: "War Room — Reunião Diária", icon: Zap },
    { to: "/app/sdr/hot-deals", label: "Hot Leads", icon: Flame },
    { to: "/app/sdr/sdr-performance", label: "Desempenho dos SDRs", icon: BarChart2 },
    { to: "/app/sdr/scripts", label: "Scripts de Ligação", icon: FileText },
  ]},
  { group: "Operação", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/app/crm", label: "Funil / CRM", icon: Kanban },
    { to: "/app/agenda", label: "Agenda", icon: Calendar },
    { to: "/app/propostas", label: "Propostas", icon: FileText },
    { to: "/app/propostas/pedidos-nf", label: "Pedidos & NF", icon: FileCheck2 },
    { to: "/app/tarefas", label: "Tarefas & Follow-up", icon: CheckSquare },
  ]},
  { group: "Cadastros", items: [
    { to: "/app/clientes", label: "Clientes", icon: Users },
    { to: "/app/concorrentes", label: "Concorrentes", icon: Building2 },
    { to: "/app/equipamentos", label: "Equipamentos", icon: Wrench },
    { to: "/app/coldpro", label: "ColdPro", icon: Thermometer },
    { to: "/app/coldpro/produtos", label: "Produtos Ashrae", icon: PackageSearch },
    { to: "/app/coldpro/catalogo", label: "Catálogo ColdPro", icon: Database },
  ]},
  { group: "Inteligência", items: [
    { to: "/app/competitiva", label: "Head-to-Head", icon: Swords },
    { to: "/app/documentos", label: "Documentos & IA", icon: FolderUp },
    { to: "/app/relatorios", label: "Relatórios", icon: FileBarChart },
  ]},
  { group: "Sistema", items: [
    { to: "/app/aprovacoes", label: "Aprovações", icon: FileCheck2 },
    { to: "/app/configuracoes/templates", label: "Templates de Proposta", icon: LayoutTemplate },
    { to: "/app/configuracoes/nomus", label: "Integração Nomus", icon: PlugZap },
    { to: "/app/configuracoes/api-nomus", label: "Catálogo API Nomus", icon: Database },
    { to: "/app/configuracoes", label: "Configurações", icon: Settings, exact: true },
  ]},
];

function NavItem({ to, label, icon: Icon, exact }: { to: string; label: string; icon: any; exact?: boolean }) {
  const { pathname } = useLocation();
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link to={to}>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppNavigationSidebar() {
  return (
    <Sidebar collapsible="icon" className="app-sidebar border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <div className="flex h-9 items-center gap-2 px-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[image:var(--gradient-primary)] shadow-[var(--shadow-sm)]">
            <Snowflake className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <div className="truncate text-[13px] font-semibold tracking-tight">CN Cold</div>
            <div className="truncate text-[10px] uppercase tracking-widest text-sidebar-foreground/50">Sales Intelligence</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-1">
        {NAV.map((g) => (
          <SidebarGroup key={g.group}>
            <SidebarGroupLabel>{g.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => <NavItem key={it.to} {...it} />)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 text-[10px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
        v0.1 · CNCode platform
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const primaryRole = roles[0];

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <SidebarProvider>
      <div className="app-shell flex min-h-screen w-full overflow-x-hidden bg-background">
      <AppNavigationSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topbar sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
          <div className="flex min-h-12 items-center gap-2 px-2 py-1 sm:px-3">
          <SidebarTrigger className="h-7 w-7 shrink-0" />
          <div className="relative hidden max-w-xl flex-1 sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar propostas, clientes, equipamentos..." className="compact-input h-8 border-transparent bg-secondary/50 pl-8 focus:bg-card" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <Snowflake className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold tracking-tight">CN Cold</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">Sales Intelligence</div>
            </div>
          </div>
          <LiveClock />
          <Button variant="ghost" size="icon" className="relative h-7 w-7">
            <Bell className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5 hover:bg-secondary">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initial}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <div className="text-xs font-medium leading-tight">{displayName}</div>
                  <div className="text-[10px] text-muted-foreground">{primaryRole ? ROLE_LABELS[primaryRole] : "Sem perfil"}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/app/configuracoes" })}>
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        <main className="app-main min-w-0 flex-1">{children}</main>
      </div>
      </div>
    </SidebarProvider>
  );
}
