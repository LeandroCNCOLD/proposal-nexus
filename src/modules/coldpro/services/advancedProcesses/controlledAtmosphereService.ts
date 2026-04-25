import { roundAdvanced, toNumber } from "./psychrometricHumidityService";
import { calculateCo2Control } from "./co2ControlService";

export function calculateControlledAtmosphere(input: any) {
  const warnings = ["Atmosfera controlada exige sensores, alarmes e intertravamentos."];
  const o2 = toNumber(input.o2_target_percent);
  const co2 = toNumber(input.co2_target_percent);
  if (o2 > 0 && o2 < 19.5) warnings.push("O₂ baixo oferece risco de asfixia.");
  if (co2 >= 1) warnings.push("CO₂ elevado oferece risco a pessoas.");
  const respirationKw = toNumber(input.product_mass_kg) * toNumber(input.respiration_rate_w_kg) / 1000;
  const co2Control = calculateCo2Control(input);
  return {
    o2_target_percent: roundAdvanced(o2, 3),
    co2_target_percent: roundAdvanced(co2, 3),
    respiration_load_kw: roundAdvanced(respirationKw),
    respiration_load_kcal_h: roundAdvanced(respirationKw * 860),
    scrubber_enabled: Boolean(input.scrubber_enabled),
    air_renewal_m3_h: roundAdvanced(toNumber(input.air_renewal_m3_h)),
    co2_control: co2Control,
    warnings: [...warnings, ...co2Control.warnings],
    memory: { formula_respiration: "Q_respiração_kW = massa_produto_kg × taxa_respiração_W_kg / 1000" },
  };
}
