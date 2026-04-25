import { toNumber } from "./psychrometricHumidityService";

export function validateAdvancedProcess(input: any) {
  const warnings = ["Os cálculos são estimativas de engenharia e devem ser validados conforme projeto específico."];
  const type = String(input.advanced_process_type ?? "none");
  if (type !== "none" && toNumber(input.chamber_volume_m3) <= 0) warnings.push("Informe o volume da câmara para validar o processo especial.");
  if (["banana_ripening", "citrus_degreening", "ethylene_application", "ethylene_removal"].includes(type) && toNumber(input.ethylene_target_ppm) <= 0) warnings.push("Informe o ppm alvo de etileno para calcular a estimativa teórica.");
  if (["potato_co2_control", "co2_scrubbing", "controlled_atmosphere"].includes(type) && toNumber(input.co2_limit_percent) <= 0) warnings.push("Informe o limite máximo de CO₂ para calcular a purga mínima.");
  return warnings;
}
