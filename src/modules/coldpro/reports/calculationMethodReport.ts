import { COLDPRO_CALCULATION_METHODS } from "../core/calculationMethodRegistry";

export const COLDPRO_FREEZING_TIME_LIMITATION =
  "O tempo estimado é uma aproximação baseada em modelo tipo Plank/ASHRAE. Para pallets compactos, caixas empilhadas ou produtos irregulares, o resultado deve ser tratado como estimativa conservadora e validado em campo.";

export function buildCalculationMethodReport(infiltrationMethod = "simple_air_change", productLoadMethod = "kg/h contínuo ou kg/batelada") {
  return {
    title: "Método de cálculo utilizado",
    methods: {
      transmission: COLDPRO_CALCULATION_METHODS.transmission.formula,
      product: "sensível + latente + sensível",
      productLoad: productLoadMethod,
      packaging: `${COLDPRO_CALCULATION_METHODS.packagingContinuousLoad.formula} / ${COLDPRO_CALCULATION_METHODS.packagingBatchLoad.formula}`,
      infiltration: infiltrationMethod,
      airflow: "Q × 3600 / rho Cp ΔT",
      velocity: "vazão / área livre",
      freezingTime: "ASHRAE/Plank-style estimate",
    },
    limitations: [COLDPRO_FREEZING_TIME_LIMITATION],
  };
}