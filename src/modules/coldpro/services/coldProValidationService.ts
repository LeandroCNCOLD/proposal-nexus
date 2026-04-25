import type { ColdProState } from "../types/coldPro.types";

export function validateColdProState(state: ColdProState) {
  const warnings: string[] = [];
  if (!state.project.name.trim()) warnings.push("Informe o nome do projeto.");
  if (state.dimensions.volumeM3 <= 0) warnings.push("Informe dimensões válidas para calcular o volume.");
  if (!state.surfaces.length) warnings.push("Cadastre ao menos uma superfície para transmissão.");
  if (state.process.operationMode === "continuous" && state.process.productionKgH <= 0) warnings.push("Informe a produção em kg/h para processo contínuo.");
  if (state.process.operationMode === "batch" && state.process.batchMassKg <= 0) warnings.push("Informe a massa do lote para processo em batelada.");
  return warnings;
}
