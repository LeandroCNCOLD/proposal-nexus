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

  const processPullDownKw = round(state.process.pullDownKw, 3);
  const internalPullDownKw = round(internal.pullDownKw, 3);
  const pullDownTotalKw = round(internalPullDownKw + processPullDownKw, 3);
  const baseTotalKw = transmission.totalKw + infiltration.totalKw + product.productKw + internal.packagingKw + internal.respirationKw + internal.peopleKw + internal.lightingKw + internal.motorsKw + pullDownTotalKw;
  const correctionFactor = state.internalLoads.safetyFactor * state.internalLoads.defrostFactor * state.internalLoads.fanFactor * state.internalLoads.operationalFactor;
  const correctedTotalKw = baseTotalKw * correctionFactor;
  const totalKcalH = round(kwToKcalH(correctedTotalKw), 0);
  const totalTr = round(kwToTr(correctedTotalKw), 2);

  return {
    transmissionKw: round(transmission.totalKw, 3),
    infiltrationKw: round(infiltration.totalKw, 3),
    productKw: round(product.productKw, 3),
    packagingKw: internal.packagingKw,
    respirationKw: internal.respirationKw,
    peopleKw: internal.peopleKw,
    lightingKw: internal.lightingKw,
    motorsKw: internal.motorsKw,
    pullDownKw: pullDownTotalKw,
    baseTotalKw: round(baseTotalKw, 3),
    correctedTotalKw: round(correctedTotalKw, 3),
    totalKcalH,
    totalTr,
    warnings,
    calculationMemory: {
      generatedAt: new Date().toISOString(),
      auditSummary: {
        objective: "Cálculo de carga térmica ColdPro com memória técnica completa para auditoria externa.",
        standardUnits: "kW, kcal/h e TR",
        rounding: "Resultados principais arredondados para 2 ou 3 casas decimais; memória preserva entradas e subtotais usados.",
      },
      formulas: {
        transmission: "Q = U × A × ΔT, separado em opaco, vidro, porta e solar",
        infiltration: "Q = ρ_ar × V_ar × Cp_ar × ΔT ÷ 3600",
        product: "Q_produto = massa × carga_específica ÷ tempo; congelamento considera sensível acima + latente + sensível abaixo",
        internalLoads: "Pessoas, iluminação, motores, embalagem, respiração e pull-down somados em kW",
        corrections: "Q_corrigida = Q_base × segurança × degelo × ventiladores × operacional",
        conversions: "kcal/h = kW × 1000 × 0,859845; TR = kW ÷ 3,517",
      },
      project: state.project,
      dimensions: state.dimensions,
      steps: [
        {
          id: "transmission",
          title: "1. Transmissão por superfícies",
          formula: "Q = U × A × ΔT",
          resultKw: round(transmission.totalKw, 3),
          inputs: { surfacesCount: state.surfaces.length, internalTempC: state.project.internalTempC, externalTempC: state.project.externalTempC },
          details: transmission,
        },
        {
          id: "infiltration",
          title: "2. Infiltração e renovação de ar",
          formula: "Q = ρ × V × Cp × ΔT ÷ 3600",
          resultKw: round(infiltration.totalKw, 3),
          inputs: state.infiltration,
          details: infiltration,
        },
        {
          id: "product",
          title: "3. Carga do produto/processo",
          formula: state.process.operationMode === "continuous" ? "Q = produção_kg/h × carga_kJ/kg ÷ 3600" : "Q = massa_lote × carga_kJ/kg ÷ tempo_h ÷ 3600",
          resultKw: round(product.productKw, 3),
          inputs: state.process,
          details: product,
        },
        {
          id: "internal-loads",
          title: "4. Cargas internas e complementares",
          formula: "Q_internas = pessoas + iluminação + motores + embalagem + respiração + pull-down",
          resultKw: round(internal.packagingKw + internal.respirationKw + internal.peopleKw + internal.lightingKw + internal.motorsKw + pullDownTotalKw, 3),
          inputs: state.internalLoads,
          details: { ...internal, processPullDownKw, pullDownTotalKw },
        },
        {
          id: "corrections",
          title: "5. Fatores de correção e conversões finais",
          formula: "Q_corrigida = Q_base × Fs × Fd × Fv × Fo",
          resultKw: round(correctedTotalKw, 3),
          inputs: {
            baseTotalKw: round(baseTotalKw, 3),
            safetyFactor: state.internalLoads.safetyFactor,
            defrostFactor: state.internalLoads.defrostFactor,
            fanFactor: state.internalLoads.fanFactor,
            operationalFactor: state.internalLoads.operationalFactor,
            correctionFactor: round(correctionFactor, 4),
          },
          details: { correctedTotalKw: round(correctedTotalKw, 3), totalKcalH, totalTr },
        },
      ],
      totals: {
        baseTotalKw: round(baseTotalKw, 3),
        correctionFactor: round(correctionFactor, 4),
        correctedTotalKw: round(correctedTotalKw, 3),
        totalKcalH,
        totalTr,
      },
      raw: { transmission, infiltration, product, internal },
    },
  };
}
