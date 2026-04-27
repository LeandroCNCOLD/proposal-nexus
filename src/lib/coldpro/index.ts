/**
 * ColdPro - Motor de Cálculo de Carga Térmica para Túnel de Congelamento
 * 
 * Exporta todas as funções e tipos do sistema de cálculo
 * Baseado em padrões ASHRAE 2022
 * 
 * Versão: 1.0.0
 * Data: 27 de Abril de 2026
 */

// Physics - Cálculos termofísicos
export {
  ProductThermalProperties,
  ThermalLoadResult,
  calculateProductSpecificEnergy,
  calculateProductThermalLoad,
  validateProductProperties,
} from "./physics/productThermal";

// Engines - Motor principal
export {
  EnvironmentConfiguration,
  ThermalLoadBreakdown,
  calculateThermalLoad,
} from "./engines/tunnelEngine";

// Core - Normalização
export {
  NormalizedEnvironmentResult,
  normalizeEnvironmentResult,
  formatNormalizedResult,
  validateNormalizedResult,
} from "./core/environmentResultNormalizer";

// Core - Consolidação
export {
  ProjectThermalResult,
  consolidateProjectResults,
  formatConsolidatedResult,
  exportForIntegration,
} from "./core/projectResultConsolidator";
