// Catálogo de módulos e permissões do sistema.
// Use chaves estáveis no formato `modulo.recurso.acao`.

export type PermissionKey = string;

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description?: string;
}

export interface ModuleDef {
  key: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_MODULES: ModuleDef[] = [
  {
    key: "sdr",
    label: "SDR",
    permissions: [
      { key: "sdr.bank.view", label: "Ver banco de leads" },
      { key: "sdr.bank.lock", label: "Pegar lead para minha carteira" },
      { key: "sdr.bank.freeze", label: "Bloquear lead (gestor)" },
      { key: "sdr.bank.assign", label: "Atribuir lead a outro usuário" },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    permissions: [
      { key: "crm.view", label: "Ver CRM" },
      { key: "crm.edit", label: "Editar oportunidades" },
      { key: "crm.delete", label: "Excluir oportunidades" },
    ],
  },
  {
    key: "proposals",
    label: "Propostas",
    permissions: [
      { key: "proposals.view", label: "Ver propostas" },
      { key: "proposals.create", label: "Criar propostas" },
      { key: "proposals.edit", label: "Editar propostas" },
      { key: "proposals.approve", label: "Aprovar propostas" },
      { key: "proposals.delete", label: "Excluir propostas" },
    ],
  },
  {
    key: "coldpro",
    label: "ColdPro",
    permissions: [
      { key: "coldpro.view", label: "Ver projetos" },
      { key: "coldpro.edit", label: "Editar projetos" },
    ],
  },
  {
    key: "nomus",
    label: "Nomus",
    permissions: [
      { key: "nomus.view", label: "Ver integração Nomus" },
      { key: "nomus.sync", label: "Disparar sincronização" },
    ],
  },
  {
    key: "configuracoes",
    label: "Configurações",
    permissions: [
      { key: "configuracoes.view", label: "Ver configurações" },
      { key: "configuracoes.users.manage", label: "Gerenciar usuários" },
      { key: "configuracoes.permissions.manage", label: "Gerenciar permissões" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_MODULES.flatMap(
  (m) => m.permissions.map((p) => p.key),
);

export function getPermissionLabel(key: PermissionKey): string {
  for (const m of PERMISSION_MODULES) {
    const p = m.permissions.find((x) => x.key === key);
    if (p) return p.label;
  }
  return key;
}
