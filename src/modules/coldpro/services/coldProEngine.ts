import type { ColdProResult, ColdProState } from "../types/coldPro.types";
import { kwToKcalH, kwToTr } from "../utils/conversions";
import { round } from "../utils/numbers";
import { calculateTransmissionLoad } from "./transmissionLoadService";
import { calculateInfiltrationLoad } from "./infiltrationLoadService";
import { calculateProductLoad } from "./productLoadService";
import { calculateInternalLoads } from "./internalLoadsService";
import { validateColdProState } from "./coldProValidationService";

export function calculateColdPro(state: ColdProState): ColdProResult {
  const warnings = validateColdProState(state);
  const transmission = calculateTransmissionLoad(state.surfaces, state.project);
  const infiltration = calculateInfiltrationLoad(state.infiltration);
  const product = calculateProductLoad(state.process, state.project.applicationMode);
  const internal = calculateInternalLoads(state.internalLoads);
  warnings.push(...product.warnings);

  const baseTotalKw = transmission.totalKw + infiltration.totalKw + product.productKw + internal.packagingKw + internal.respirationKw + internal.peopleKw + internal.lightingKw + internal.motorsKw + internal.pullDownKw + state.process.pullDownKw;
  const correctedTotalKw = baseTotalKw * state.internalLoads.safetyFactor * state.internalLoads.defrostFactor * state.internalLoads.fanFactor * state.internalLoads.operationalFactor;

  return {
    transmissionKw: round(transmission.totalKw, 3),
    infiltrationKw: round(infiltration.totalKw, 3),
    productKw: round(product.productKw, 3),
    packagingKw: internal.packagingKw,
    respirationKw: internal.respirationKw,
    peopleKw: internal.peopleKw,
    lightingKw: internal.lightingKw,
    motorsKw: internal.motorsKw,
    pullDownKw: round(internal.pullDownKw + state.process.pullDownKw, 3),
    baseTotalKw: round(baseTotalKw, 3),
    correctedTotalKw: round(correctedTotalKw, 3),
    totalKcalH: round(kwToKcalH(correctedTotalKw), 0),
    totalTr: round(kwToTr(correctedTotalKw), 2),
    warnings,
    calculationMemory: {
      formulas: {
        transmission: "Q = U × A × ΔT, separado em opaco, vidro, porta e solar",
        infiltration: "Q = densidade_ar × volume_ar × Cp_ar × ΔT",
        product: "Resfriamento sensível ou congelamento com sensível + latente + sensível abaixo",
        corrections: "Q_corrigida = Q_base × segurança × degelo × ventiladores × operacional",
      },
      project: state.project,
      dimensions: state.dimensions,
      transmission,
      infiltration,
      product,
      internal,
    },
  };
}
