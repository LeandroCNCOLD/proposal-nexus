import { calculateCo2Control } from "./co2ControlService";
import { calculateControlledAtmosphere } from "./controlledAtmosphereService";
import { calculateEthyleneProcess } from "./ethyleneProcessService";
import { calculateHumidityControl } from "./seedHumidityControlService";
import { roundAdvanced } from "./psychrometricHumidityService";
import { validateAdvancedProcess } from "./advancedProcessValidationService";

const HUMIDITY_TYPES = new Set(["seed_humidity_control", "humidity_control", "controlled_atmosphere"]);
const ETHYLENE_TYPES = new Set(["banana_ripening", "citrus_degreening", "ethylene_application", "ethylene_removal"]);
const CO2_TYPES = new Set(["potato_co2_control", "co2_scrubbing", "controlled_atmosphere"]);

export function calculateAdvancedProcess(input: any) {
  const type = String(input.advanced_process_type ?? "none");
  const baseWarnings = validateAdvancedProcess(input);
  const humidity = HUMIDITY_TYPES.has(type) ? calculateHumidityControl(input) : null;
  const ethylene = ETHYLENE_TYPES.has(type) ? calculateEthyleneProcess(input) : null;
  const co2 = CO2_TYPES.has(type) ? calculateCo2Control(input) : null;
  const controlledAtmosphere = type === "controlled_atmosphere" ? calculateControlledAtmosphere(input) : null;
  const latentKw = humidity?.total_kw ?? 0;
  const purgeKw = controlledAtmosphere?.co2_control?.purge_thermal_load_kw ?? co2?.purge_thermal_load_kw ?? 0;
  const respirationKw = controlledAtmosphere?.respiration_load_kw ?? 0;
  const totalAdditionalKw = latentKw + purgeKw + respirationKw;
  const warnings = [
    ...baseWarnings,
    ...(humidity?.warnings ?? []),
    ...(ethylene?.warnings ?? []),
    ...(co2?.warnings ?? []),
    ...(controlledAtmosphere?.warnings ?? []),
  ];
  const uniqueWarnings = Array.from(new Set(warnings.filter(Boolean)));

  return {
    status: type === "none" ? "inativo" : uniqueWarnings.some((item) => item.includes("inviável") || item.includes("bloqueado")) ? "revisar" : "calculado",
    advanced_process_type: type,
    total_additional_kw: roundAdvanced(totalAdditionalKw),
    total_additional_kcal_h: roundAdvanced(totalAdditionalKw * 860),
    humidity,
    ethylene,
    co2,
    controlled_atmosphere: controlledAtmosphere,
    warnings: uniqueWarnings,
  };
}
