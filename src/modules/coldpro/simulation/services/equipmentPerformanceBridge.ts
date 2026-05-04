/**
 * BRIDGE DE PERFORMANCE DE EQUIPAMENTOS
 * Integra as curvas polinomiais do ColdPro com o simulador dinâmico.
 * Consulta a capacidade real do equipamento em cada passo de tempo.
 */

import { evaluatePolynomial } from "@/features/coldpro/performance-polynomial";
import type { PerformancePolynomialCurve } from "@/features/coldpro/performance-polynomial";
import type { EquipmentPolynomialModel, EquipmentPerformanceResult } from "../types/coldRoomSimulation.types";

interface PerformanceBridgeInput {
  /** Temperatura interna da câmara (°C) */
  room_temperature_c: number;
  /** Temperatura externa / ambiente do condensador (°C) */
  external_temperature_c: number;
  /** Temperatura de evaporação estimada (°C) */
  evaporating_temperature_c?: number;
  /** Temperatura de condensação estimada (°C) */
  condensing_temperature_c?: number;
  /** Curva polinomial já ajustada (do performance-polynomial.ts) */
  polynomial_curve?: PerformancePolynomialCurve | null;
  /** Modelo de equipamento com coeficientes brutos (fallback) */
  equipment_model?: EquipmentPolynomialModel | null;
  /** Capacidade nominal para cálculo de utilização (kcal/h) */
  nominal_capacity_kcal_h?: number;
}

/**
 * Estima a temperatura de evaporação baseada na temperatura da câmara.
 * Regra prática: T_evap = T_câmara - DT_evaporador (tipicamente 8-12°C)
 */
function estimateEvapTemp(roomTemp: number): number {
  const dt = roomTemp > 0 ? 10 : 8; // diferencial menor para câmaras negativas
  return roomTemp - dt;
}

/**
 * Estima a temperatura de condensação baseada na temperatura externa.
 * Regra prática: T_cond = T_externa + DT_condensador (tipicamente 12-18°C)
 */
function estimateCondTemp(externalTemp: number): number {
  return externalTemp + 15;
}

/**
 * Avalia a performance do equipamento usando a curva polinomial do ColdPro.
 * Se não houver curva, usa o modelo nominal com degradação por temperatura.
 */
export function evaluateEquipmentPerformance(input: PerformanceBridgeInput): EquipmentPerformanceResult {
  const warnings: string[] = [];

  const evapTemp = input.evaporating_temperature_c ?? estimateEvapTemp(input.room_temperature_c);
  const condTemp = input.condensing_temperature_c ?? estimateCondTemp(input.external_temperature_c);

  const curveInput = {
    temperature_room_c: input.room_temperature_c,
    evaporation_temp_c: evapTemp,
    condensation_temp_c: condTemp,
  };

  let capacityKcalH: number | null = null;
  let powerKw: number | null = null;
  let copValue: number | null = null;

  // Tentar usar a curva polinomial ajustada (fonte primária)
  if (input.polynomial_curve) {
    const curve = input.polynomial_curve;

    // Verificar se está dentro da faixa válida
    if (input.equipment_model) {
      const [evapMin, evapMax] = input.equipment_model.valid_evap_temp_range_c;
      const [condMin, condMax] = input.equipment_model.valid_cond_temp_range_c;

      if (evapTemp < evapMin || evapTemp > evapMax) {
        warnings.push(`Temperatura de evaporação ${evapTemp.toFixed(1)}°C fora da faixa válida [${evapMin}, ${evapMax}]°C`);
      }
      if (condTemp < condMin || condTemp > condMax) {
        warnings.push(`Temperatura de condensação ${condTemp.toFixed(1)}°C fora da faixa válida [${condMin}, ${condMax}]°C`);
      }
    }

    capacityKcalH = evaluatePolynomial(curve.capacity, curveInput);
    powerKw = evaluatePolynomial(curve.power, curveInput);
    copValue = evaluatePolynomial(curve.cop, curveInput);
  }

  // Fallback: modelo nominal com degradação linear por temperatura
  if (capacityKcalH === null || capacityKcalH <= 0) {
    const nominal = input.nominal_capacity_kcal_h ?? input.equipment_model?.nominal_capacity_kcal_h ?? 10000;
    // Degradação: -2% por °C acima de 35°C no condensador
    const condDegradation = Math.max(0, (condTemp - 35) * 0.02);
    // Degradação: -1.5% por °C abaixo de -10°C no evaporador
    const evapDegradation = Math.max(0, (-10 - evapTemp) * 0.015);
    capacityKcalH = nominal * (1 - condDegradation - evapDegradation);
    warnings.push("Curva polinomial não disponível — usando modelo nominal com degradação estimada");
  }

  if (powerKw === null || powerKw <= 0) {
    const nominalPower = input.equipment_model?.nominal_power_kw ?? (capacityKcalH / 860 / 2.5);
    powerKw = nominalPower * (1 + Math.max(0, (condTemp - 35) * 0.015));
  }

  if (copValue === null || copValue <= 0) {
    copValue = powerKw > 0 ? (capacityKcalH / 860) / powerKw : 2.5;
  }

  const nominalCap = input.nominal_capacity_kcal_h ?? input.equipment_model?.nominal_capacity_kcal_h ?? capacityKcalH;
  const utilizationPct = nominalCap > 0 ? (capacityKcalH / nominalCap) * 100 : 100;

  if (utilizationPct > 95) {
    warnings.push(`Equipamento operando a ${utilizationPct.toFixed(1)}% da capacidade — risco de sobrecarga`);
  }

  return {
    cooling_capacity_kcal_h: Math.max(0, capacityKcalH),
    electrical_power_kw: Math.max(0, powerKw),
    cop: Math.max(0.5, Math.min(copValue, 6.0)),
    evaporating_temperature_c: evapTemp,
    condensing_temperature_c: condTemp,
    utilization_pct: Math.min(utilizationPct, 120),
    warnings,
  };
}
