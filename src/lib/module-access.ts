import type { AppRole } from "@/lib/proposal";

const FULL_ACCESS_ROLES: AppRole[] = ["admin", "diretoria"];

export type RoleModuleAccess = {
  role: AppRole;
  module_key: string;
  module_path: string;
  allowed: boolean;
};

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
  vendedor: [
    "/app",
    "/app/crm",
    "/app/propostas",
    "/app/tarefas",
    "/app/clientes",
    "/app/concorrentes",
    "/app/documentos",
    "/app/configuracoes",
  ],
  engenharia: [
    "/app",
    "/app/propostas",
    "/app/equipamentos",
    "/app/coldpro",
    "/app/coldpro/produtos",
    "/app/coldpro/catalogo",
    "/app/documentos",
    "/app/configuracoes",
  ],
  orcamentista: [
    "/app",
    "/app/propostas",
    "/app/equipamentos",
    "/app/coldpro",
    "/app/coldpro/produtos",
    "/app/coldpro/catalogo",
    "/app/documentos",
    "/app/configuracoes",
  ],
  administrativo: [
    "/app",
    "/app/propostas/pedidos-nf",
    "/app/clientes",
    "/app/documentos",
    "/app/relatorios",
    "/app/configuracoes",
  ],
  coldpro: ["/app/coldpro", "/app/coldpro/produtos", "/app/coldpro/catalogo", "/app/configuracoes"],
};

export const APP_MODULES = [
  { key: "dashboard", label: "Dashboard", path: "/app" },
  { key: "crm", label: "Funil / CRM", path: "/app/crm" },
  { key: "propostas", label: "Propostas", path: "/app/propostas" },
  { key: "pedidos", label: "Pedidos & NF", path: "/app/propostas/pedidos-nf" },
  { key: "tarefas", label: "Tarefas", path: "/app/tarefas" },
  { key: "clientes", label: "Clientes", path: "/app/clientes" },
  { key: "concorrentes", label: "Concorrentes", path: "/app/concorrentes" },
  { key: "equipamentos", label: "Equipamentos", path: "/app/equipamentos" },
  { key: "coldpro", label: "ColdPro", path: "/app/coldpro" },
  { key: "produtos", label: "Produtos Ashrae", path: "/app/coldpro/produtos" },
  { key: "catalogo", label: "Catálogo ColdPro", path: "/app/coldpro/catalogo" },
  { key: "competitiva", label: "Head-to-Head", path: "/app/competitiva" },
  { key: "documentos", label: "Documentos & IA", path: "/app/documentos" },
  { key: "relatorios", label: "Relatórios", path: "/app/relatorios" },
  { key: "aprovacoes", label: "Aprovações", path: "/app/aprovacoes" },
  { key: "templates", label: "Templates", path: "/app/configuracoes/templates" },
  { key: "nomus", label: "Integração Nomus", path: "/app/configuracoes/nomus" },
  { key: "api_nomus", label: "Catálogo API Nomus", path: "/app/configuracoes/api-nomus" },
  { key: "configuracoes", label: "Configurações", path: "/app/configuracoes" },
] as const;

export function getAllowedModulePaths(roles: AppRole[], moduleAccess?: RoleModuleAccess[]) {
  if (moduleAccess?.length) {
    return Array.from(
      new Set(
        moduleAccess
          .filter((item) => roles.includes(item.role) && item.allowed)
          .map((item) => item.module_path),
      ),
    );
  }
  if (roles.some((role) => FULL_ACCESS_ROLES.includes(role))) return ["*"];
  return Array.from(new Set(roles.flatMap((role) => MODULE_PATHS_BY_ROLE[role] ?? [])));
}

export function isAppRouteAllowed(
  pathname: string,
  roles: AppRole[],
  moduleAccess?: RoleModuleAccess[],
) {
  if (roles.length === 0) return true;
  const allowedPaths = getAllowedModulePaths(roles, moduleAccess);
  if (allowedPaths.includes("*")) return true;
  return allowedPaths.some((path) =>
    path === "/app" ? pathname === "/app" : pathname === path || pathname.startsWith(path + "/"),
  );
}

export function roleCanAccessPath(role: AppRole, path: string, moduleAccess?: RoleModuleAccess[]) {
  return isAppRouteAllowed(path, [role], moduleAccess);
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
