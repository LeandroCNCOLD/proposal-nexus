import type { AppRole } from "@/lib/proposal";

const FULL_ACCESS_ROLES: AppRole[] = ["admin", "diretoria"];

const MODULE_PATHS_BY_ROLE: Record<AppRole, string[]> = {
  admin: ["*"],
  diretoria: ["*"],
  gerente_comercial: [
    "/app",
    "/app/crm",
    "/app/propostas",
    "/app/propostas/pedidos-nf",
    "/app/tarefas",
    "/app/clientes",
    "/app/concorrentes",
    "/app/competitiva",
    "/app/documentos",
    "/app/relatorios",
    "/app/aprovacoes",
    "/app/configuracoes",
  ],
  vendedor: ["/app", "/app/crm", "/app/propostas", "/app/tarefas", "/app/clientes", "/app/concorrentes", "/app/documentos", "/app/configuracoes"],
  engenharia: ["/app", "/app/propostas", "/app/equipamentos", "/app/coldpro", "/app/coldpro/produtos", "/app/coldpro/catalogo", "/app/documentos", "/app/configuracoes"],
  orcamentista: ["/app", "/app/propostas", "/app/equipamentos", "/app/coldpro", "/app/coldpro/produtos", "/app/coldpro/catalogo", "/app/documentos", "/app/configuracoes"],
  administrativo: ["/app", "/app/propostas/pedidos-nf", "/app/clientes", "/app/documentos", "/app/relatorios", "/app/configuracoes"],
  coldpro: ["/app/coldpro", "/app/coldpro/produtos", "/app/coldpro/catalogo", "/app/configuracoes"],
};

export function getAllowedModulePaths(roles: AppRole[]) {
  if (roles.some((role) => FULL_ACCESS_ROLES.includes(role))) return ["*"];
  return Array.from(new Set(roles.flatMap((role) => MODULE_PATHS_BY_ROLE[role] ?? [])));
}

export function isAppRouteAllowed(pathname: string, roles: AppRole[]) {
  if (roles.length === 0) return true;
  const allowedPaths = getAllowedModulePaths(roles);
  if (allowedPaths.includes("*")) return true;
  return allowedPaths.some((path) => (path === "/app" ? pathname === "/app" : pathname === path || pathname.startsWith(path + "/")));
}

export const MODULE_ACCESS_DESCRIPTION: Record<AppRole, string> = {
  admin: "Acesso total e administração do sistema",
  diretoria: "Acesso total, aprovações e relatórios",
  gerente_comercial: "CRM, propostas, aprovações, relatórios e gestão de usuários",
  vendedor: "CRM, clientes, propostas e tarefas comerciais",
  engenharia: "Engenharia, equipamentos, ColdPro e documentos técnicos",
  orcamentista: "Propostas, orçamentos, equipamentos e ColdPro",
  administrativo: "Pedidos, notas fiscais, clientes, documentos e relatórios",
  coldpro: "Somente módulos ColdPro e configurações da própria conta",
};