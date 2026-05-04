/**
 * Serviço de Perfil de Câmara Fria
 * Analisa o risco de formação de gelo, calcula janelas de degelo necessárias
 * e avalia o impacto na máquina (downtime).
 */

import { calculatePsychrometricInfiltrationKW } from "../../physics/airflowModel";

export interface ChamberProfileInput {
  environment_type: "cold_room" | "freezer_room" | "antechamber" | "blast_freezer" | "cooling_tunnel" | "seed_storage" | "climatized_room";
  setpoint_c: number;
  defrost_type: "electrical" | "hot_gas" | "air" | "water" | "none";
  defrost_cycles_per_day: number;
  defrost_duration_minutes: number;
}

export interface IceRiskAnalysis {
  risk_level: "low" | "medium" | "high" | "critical";
  frost_accumulation_kg_h: number;
  latent_load_pct: number;
  recommended_defrost_cycles: number;
  machine_downtime_hours_per_day: number;
  warnings: string[];
}

export class ChamberProfileService {
  /**
   * Avalia o risco de gelo em um passo de tempo específico,
   * baseado na infiltração psicrométrica (sensível vs latente).
   */
  static analyzeIceRiskStep(
    extTemp: number,
    extRh: number,
    intTemp: number,
    intRh: number,
    infiltrationFlowM3H: number
  ): { latentLoadKw: number; sensibleLoadKw: number; frostKgH: number } {
    
    if (infiltrationFlowM3H <= 0 || intTemp > 5) {
      return { latentLoadKw: 0, sensibleLoadKw: 0, frostKgH: 0 };
    }

    // Usar o modelo psicrométrico existente para separar sensível e latente
    const psychro = calculatePsychrometricInfiltrationKW({
      externalTemperatureC: extTemp,
      externalRelativeHumidityPct: extRh,
      internalTemperatureC: intTemp,
      internalRelativeHumidityPct: intRh,
      infiltrationFlowM3H: infiltrationFlowM3H,
      atmosphericPressureKPa: 101.325 // Padrão ao nível do mar
    });

    // Se a temperatura interna for menor que 0, a umidade condensada vira gelo
    // Calor latente de sublimação (vapor -> gelo) é aprox. 2838 kJ/kg
    // 1 kW = 1 kJ/s = 3600 kJ/h
    // Então: kg/h = (latentLoadKw * 3600) / 2838
    let frostKgH = 0;
    if (intTemp <= 0 && psychro.latentKW > 0) {
      frostKgH = (psychro.latentKW * 3600) / 2838;
    }

    return {
      latentLoadKw: psychro.latentKW,
      sensibleLoadKw: psychro.sensibleKW,
      frostKgH: frostKgH
    };
  }

  /**
   * Analisa o perfil global da câmara baseado na configuração de degelo e tipo.
   */
  static evaluateChamberProfile(
    input: ChamberProfileInput,
    totalFrostKgDay: number,
    totalInfiltrationLoadKcalDay: number,
    totalLatentLoadKcalDay: number
  ): IceRiskAnalysis {
    const warnings: string[] = [];
    const downtimeHours = (input.defrost_cycles_per_day * input.defrost_duration_minutes) / 60;
    
    const latentPct = totalInfiltrationLoadKcalDay > 0 
      ? (totalLatentLoadKcalDay / totalInfiltrationLoadKcalDay) * 100 
      : 0;

    let risk: "low" | "medium" | "high" | "critical" = "low";
    let recCycles = input.defrost_cycles_per_day;

    // Lógica de avaliação de risco
    if (input.setpoint_c <= 0) {
      if (totalFrostKgDay > 50) {
        risk = "critical";
        warnings.push("Acúmulo CRÍTICO de gelo projetado (>50kg/dia). Bloqueio severo do evaporador iminente.");
        recCycles = Math.max(recCycles, 6);
      } else if (totalFrostKgDay > 20) {
        risk = "high";
        warnings.push("Alto risco de formação de gelo. Verifique a proteção das portas.");
        recCycles = Math.max(recCycles, 4);
      } else if (totalFrostKgDay > 5) {
        risk = "medium";
        recCycles = Math.max(recCycles, 3);
      }
      
      if (input.defrost_type === "none" || input.defrost_type === "air") {
        warnings.push("Câmara negativa exige degelo forçado (elétrico ou gás quente).");
        risk = "critical";
      }
      
      if (input.defrost_cycles_per_day < recCycles) {
        warnings.push(`Frequência de degelo insuficiente. Recomendado: ${recCycles} ciclos/dia.`);
      }
    } else if (input.setpoint_c > 0 && input.setpoint_c < 5) {
      if (latentPct > 40) {
        risk = "medium";
        warnings.push("Alta carga latente em câmara de resfriados. Risco de condensação excessiva.");
      }
    }

    return {
      risk_level: risk,
      frost_accumulation_kg_h: totalFrostKgDay / 24,
      latent_load_pct: Math.round(latentPct),
      recommended_defrost_cycles: recCycles,
      machine_downtime_hours_per_day: downtimeHours,
      warnings
    };
  }
  
  /**
   * Verifica se a máquina está em degelo num dado timestamp
   */
  static isMachineInDefrost(
    timestamp: string, 
    cyclesPerDay: number, 
    durationMinutes: number
  ): boolean {
    if (cyclesPerDay <= 0 || durationMinutes <= 0) return false;
    
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    const intervalMinutes = (24 * 60) / cyclesPerDay;
    
    for (let i = 0; i < cyclesPerDay; i++) {
      const defrostStart = i * intervalMinutes;
      const defrostEnd = defrostStart + durationMinutes;
      
      if (timeInMinutes >= defrostStart && timeInMinutes < defrostEnd) {
        return true;
      }
    }
    
    return false;
  }
}
