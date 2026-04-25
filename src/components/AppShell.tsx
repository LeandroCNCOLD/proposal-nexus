import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, Users, Building2, Wrench, Swords,
  Sparkles, FileBarChart, FileCheck2, FolderUp, Settings, LogOut,
  Search, Bell, Snowflake, ChevronDown, CheckSquare, PlugZap, Database,
  LayoutTemplate, Kanban, Thermometer,
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
import { cn } from "@/lib/utils";

const NAV = [
  { group: "Operação", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/app/crm", label: "Funil / CRM", icon: Kanban },
    { to: "/app/propostas", label: "Propostas", icon: FileText },
    { to: "/app/propostas/pedidos-nf", label: "Pedidos & NF", icon: FileCheck2 },
    { to: "/app/tarefas", label: "Tarefas & Follow-up", icon: CheckSquare },
  ]},
  { group: "Cadastros", items: [
    { to: "/app/clientes", label: "Clientes", icon: Users },
    { to: "/app/concorrentes", label: "Concorrentes", icon: Building2 },
    { to: "/app/equipamentos", label: "Equipamentos", icon: Wrench },
    { to: "/app/coldpro", label: "ColdPro", icon: Thermometer },
    { to: "/app/coldpro/catalogo", label: "Catálogo ColdPro", icon: Database },
  ]},
  { group: "Inteligência", items: [
    { to: "/app/seletor", label: "Seletor Técnico", icon: Sparkles },
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
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppNavigationSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex h-10 items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Snowflake className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold tracking-tight">CN Cold</div>
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
      <SidebarFooter className="border-t border-sidebar-border p-3 text-[11px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
        v0.1 · CNCode platform
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const primaryRole = roles[0];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-background">
      <AppNavigationSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
          <div className="flex min-h-16 items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6">
          <SidebarTrigger className="h-9 w-9 shrink-0" />
          <div className="relative hidden max-w-xl flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar propostas, clientes, equipamentos..." className="pl-9 bg-secondary/50 border-transparent focus:bg-card" />
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
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-secondary">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initial}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <div className="text-xs font-medium leading-tight">{user?.email}</div>
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
        <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-8">{children}</main>
      </div>
      </div>
    </SidebarProvider>
  );
}
