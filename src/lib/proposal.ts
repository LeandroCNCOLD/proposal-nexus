import type { Database } from "@/integrations/supabase/types";

export type ProposalStatus = Database["public"]["Enums"]["proposal_status"];
export type ProposalTemperature = Database["public"]["Enums"]["proposal_temperature"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  em_elaboracao: "Em elaboração",
  em_revisao_tecnica: "Revisão técnica",
  em_revisao_comercial: "Revisão comercial",
  em_revisao_financeira: "Revisão financeira",
  aguardando_aprovacao: "Aguardando aprovação",
  pronta_para_envio: "Pronta para envio",
  enviada: "Enviada",
  visualizada: "Visualizada",
  aguardando_retorno: "Aguardando retorno",
  em_negociacao: "Em negociação",
  revisao_solicitada: "Revisão solicitada",
  reenviada: "Reenviada",
  ganha: "Ganha",
  perdida: "Perdida",
  vencida: "Vencida",
  prorrogada: "Prorrogada",
  cancelada: "Cancelada",
};

export const STATUS_GROUPS = {
  rascunho: ["rascunho", "em_elaboracao", "em_revisao_tecnica", "em_revisao_comercial", "em_revisao_financeira", "aguardando_aprovacao", "pronta_para_envio"],
  ativa: ["enviada", "visualizada", "aguardando_retorno", "em_negociacao", "revisao_solicitada", "reenviada", "prorrogada"],
  ganha: ["ganha"],
  perdida: ["perdida", "vencida", "cancelada"],
} as const;

export const STATUS_VARIANT: Record<ProposalStatus, "muted" | "info" | "warning" | "success" | "destructive"> = {
  rascunho: "muted",
  em_elaboracao: "muted",
  em_revisao_tecnica: "info",
  em_revisao_comercial: "info",
  em_revisao_financeira: "info",
  aguardando_aprovacao: "warning",
  pronta_para_envio: "info",
  enviada: "info",
  visualizada: "info",
  aguardando_retorno: "warning",
  em_negociacao: "warning",
  revisao_solicitada: "warning",
  reenviada: "info",
  ganha: "success",
  perdida: "destructive",
  vencida: "destructive",
  prorrogada: "info",
  cancelada: "muted",
};

export const TEMPERATURE_LABELS: Record<ProposalTemperature, string> = {
  fria: "Fria",
  morna: "Morna",
  quente: "Quente",
  muito_quente: "Muito quente",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  vendedor: "Vendedor",
  gerente_comercial: "Gerente Comercial",
  engenharia: "Engenharia",
  orcamentista: "Orçamentista",
  diretoria: "Diretoria",
  administrativo: "Administrativo",
  admin: "Administrador",
};

export const ALL_STATUSES = Object.keys(STATUS_LABELS) as ProposalStatus[];
