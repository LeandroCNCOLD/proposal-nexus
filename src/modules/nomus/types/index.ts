export type NomusEntity =
  | "clientes"
  | "produtos"
  | "propostas"
  | "processos"
  | "vendedores"
  | "representantes"
  | "pedidos"
  | "notas_fiscais";

export type NomusSyncStatus = "idle" | "running" | "completed" | "failed" | "partial_success";