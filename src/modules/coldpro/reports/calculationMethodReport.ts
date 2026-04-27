import { COLDPRO_CALCULATION_METHODS } from "../core/calculationMethodRegistry";

export const COLDPRO_FREEZING_TIME_LIMITATION =
  "O tempo estimado é uma aproximação baseada em modelo tipo Plank/ASHRAE. Para pallets compactos, caixas empilhadas ou produtos irregulares, o resultado deve ser tratado como estimativa conservadora e validado em campo.";

export function buildCalculationMethodReport(infiltrationMethod = "simple_air_change", productLoadMethod = "kg/h contínuo ou kg/batelada") {
  const packagingFormula = `${COLDPRO_CALCULATION_METHODS.packagingContinuous.formula} / ${COLDPRO_CALCULATION_METHODS.packagingBatch.formula}`;
  return {
    title: "Método de cálculo utilizado",
    methods: {
      transmission: COLDPRO_CALCULATION_METHODS.transmission.formula,
      product: COLDPRO_CALCULATION_METHODS.productCoolingFreezing.formula,
      productLoad: productLoadMethod,
      packaging: packagingFormula,
      infiltration: infiltrationMethod,
      airflow: COLDPRO_CALCULATION_METHODS.airFlowBalance.formula,
      velocity: COLDPRO_CALCULATION_METHODS.airVelocity.formula,
      freezingTime: COLDPRO_CALCULATION_METHODS.freezingTime.formula,
    },
    limitations: [
      COLDPRO_FREEZING_TIME_LIMITATION,
      COLDPRO_CALCULATION_METHODS.airFlowBalance.limitations,
      infiltrationMethod === "simple_air_change" ? COLDPRO_CALCULATION_METHODS.infiltrationSimple.limitations : undefined,
    ].filter(Boolean) as string[],
  };
}