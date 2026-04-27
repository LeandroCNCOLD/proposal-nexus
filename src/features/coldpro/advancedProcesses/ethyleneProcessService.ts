import { roundAdvanced, toNumber } from "./psychrometricHumidityService";

export function calculateEthyleneProcess(input: any) {
  const chamberVolume = toNumber(input.chamber_volume_m3);
  const ppm = toNumber(input.ethylene_target_ppm);
  const volumeM3 = chamberVolume * ppm / 1_000_000;
  const volumeLiters = volumeM3 * 1000;
  const warnings = ppm > 0 ? ["Etileno é inflamável e não deve ser dosado automaticamente sem sistema de segurança.", "Volume de etileno é estimativa técnica; não é comando automático de dosagem."] : [];
  return {
    target_ppm: roundAdvanced(ppm),
    ethylene_volume_m3: roundAdvanced(volumeM3, 5),
    ethylene_volume_l: roundAdvanced(volumeLiters, 3),
    exposure_time_h: roundAdvanced(toNumber(input.ethylene_exposure_time_h)),
    target_temperature_c: roundAdvanced(toNumber(input.target_temperature_c)),
    target_relative_humidity: roundAdvanced(toNumber(input.target_relative_humidity)),
    renewal_after_application: Boolean(input.ethylene_renewal_after_application),
    warnings,
    memory: { formula_ethylene: "volume_etileno_m3 = volume_camara_m3 × ppm_etileno / 1.000.000" },
  };
}
