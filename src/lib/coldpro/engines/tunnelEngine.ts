/**
 * tunnelEngine.ts
 * 
 * Motor principal de cálculo de carga térmica para túnel de congelamento
 * Orquestra o cálculo completo incluindo:
 * - Carga do produto
 * - Carga de respiração
 * - Carga de infiltração
 * - Carga das paredes
 * - Carga de pessoas
 * - Carga de equipamentos
 */

import {
  ProductThermalProperties,
  calculateProductThermalLoad,
  validateProductProperties,
} from "./productThermal";

export interface EnvironmentConfiguration {
  // Identificação
  environmentId: string;
  environmentName: string;

  // Produto
  product: ProductThermalProperties;
  massaPorTurno: number; // kg
  tempoCongelamento: number; // horas

  // Câmara frigorífica
  comprimento: number; // m
  largura: number; // m
  altura: number; // m

  // Condições operacionais
  tempCamara: number; // °C (temperatura da câmara)
  tempExterna: number; // °C (temperatura externa)
  umidadeRelativa: number; // % (0-100)

  // Parâmetros de infiltração
  trocasAr: number; // trocas de ar por dia
  pessoasPorTurno: number;
  equipamentosAuxiliares: number; // kW (iluminação, motores, etc.)
}

export interface ThermalLoadBreakdown {
  // Cargas principais (kW)
  cargaProduto: number;
  cargaRespiracao: number;
  cargaInfiltracao: number;
  cargaParedes: number;
  cargaPessoas: number;
  cargaEquipamentos: number;

  // Total
  cargaTotalCamara: number;

  // Fator de segurança
  fatorSeguranca: number;
  cargaComSeguranca: number;

  // Detalhes
  volumeCamara: number; // m³
  areaParedes: number; // m²
  detalhes: Record<string, any>;
}

/**
 * Calcula a carga de infiltração de ar quente
 * 
 * Fórmula: Q_inf = ρ × V × Cp × ΔT × n / 24
 * onde:
 * - ρ: densidade do ar (~1.2 kg/m³)
 * - V: volume da câmara (m³)
 * - Cp: calor específico do ar (1.006 kJ/kg·K)
 * - ΔT: diferença de temperatura (°C)
 * - n: número de trocas de ar por dia
 */
function calculateInfiltrationLoad(
  volumeCamara: number,
  tempCamara: number,
  tempExterna: number,
  trocasAr: number
): number {
  const densidadeAr = 1.2; // kg/m³
  const cpAr = 1.006; // kJ/kg·K
  const deltaT = Math.abs(tempExterna - tempCamara);

  // Q_inf = ρ × V × Cp × ΔT × n / 24 [kW]
  const Q_infiltracao_kJ_dia =
    (densidadeAr * volumeCamara * cpAr * deltaT * trocasAr) / 24;

  // Converter para kW (dividir por 86.4 para converter kJ/dia para kW)
  return Q_infiltracao_kJ_dia / 86.4;
}

/**
 * Calcula a carga pelas paredes da câmara
 * 
 * Fórmula: Q_paredes = U × A × ΔT
 * onde:
 * - U: coeficiente global de transferência de calor (W/m²·K)
 * - A: área das paredes (m²)
 * - ΔT: diferença de temperatura (°C)
 */
function calculateWallLoad(
  areaParedes: number,
  tempCamara: number,
  tempExterna: number,
  coeficienteU: number = 0.15 // W/m²·K para isolamento típico
): number {
  const deltaT = Math.abs(tempExterna - tempCamara);

  // Q_paredes = U × A × ΔT [W]
  const Q_paredes_W = coeficienteU * areaParedes * deltaT;

  // Converter para kW
  return Q_paredes_W / 1000;
}

/**
 * Calcula a carga de pessoas
 * 
 * Cada pessoa gera aproximadamente 0.1 kW de calor sensível
 */
function calculatePersonLoad(pessoasPorTurno: number): number {
  const calorPorPessoa = 0.1; // kW
  return pessoasPorTurno * calorPorPessoa;
}

/**
 * Calcula a carga térmica total da câmara
 */
export function calculateThermalLoad(
  config: EnvironmentConfiguration
): ThermalLoadBreakdown {
  // Validar propriedades do produto
  const erros = validateProductProperties(config.product);
  if (erros.length > 0) {
    throw new Error(`Propriedades inválidas: ${erros.join(", ")}`);
  }

  // 1. Carga do produto
  const resultadoProduto = calculateProductThermalLoad(
    config.product,
    config.massaPorTurno,
    config.tempoCongelamento
  );

  const cargaProduto = resultadoProduto.Q_total_kW || 0;
  const cargaRespiracao = resultadoProduto.Q_respiracao_kW || 0;

  // 2. Carga de infiltração
  const volumeCamara = config.comprimento * config.largura * config.altura;
  const cargaInfiltracao = calculateInfiltrationLoad(
    volumeCamara,
    config.tempCamara,
    config.tempExterna,
    config.trocasAr
  );

  // 3. Carga das paredes
  // Área das paredes = 2 × (comprimento × altura + largura × altura) + (comprimento × largura)
  const areaParedes =
    2 * (config.comprimento * config.altura + config.largura * config.altura) +
    config.comprimento * config.largura;
  const cargaParedes = calculateWallLoad(
    areaParedes,
    config.tempCamara,
    config.tempExterna
  );

  // 4. Carga de pessoas
  const cargaPessoas = calculatePersonLoad(config.pessoasPorTurno);

  // 5. Carga de equipamentos
  const cargaEquipamentos = config.equipamentosAuxiliares;

  // 6. Carga total
  const cargaTotalCamara =
    cargaProduto +
    cargaRespiracao +
    cargaInfiltracao +
    cargaParedes +
    cargaPessoas +
    cargaEquipamentos;

  // 7. Aplicar fator de segurança (10-20%)
  const fatorSeguranca = 1.15; // 15% de margem
  const cargaComSeguranca = cargaTotalCamara * fatorSeguranca;

  return {
    cargaProduto,
    cargaRespiracao,
    cargaInfiltracao,
    cargaParedes,
    cargaPessoas,
    cargaEquipamentos,
    cargaTotalCamara,
    fatorSeguranca,
    cargaComSeguranca,
    volumeCamara,
    areaParedes,
    detalhes: {
      Q1_resfriamento: resultadoProduto.Q1_resfriamento,
      Q2_congelamento: resultadoProduto.Q2_congelamento,
      Q3_subresfriamento: resultadoProduto.Q3_subresfriamento,
      energiaEspecifica: resultadoProduto.energiaEspecifica_kJ_kg,
      massaPorTurno: config.massaPorTurno,
      tempoCongelamento: config.tempoCongelamento,
    },
  };
}

/**
 * Exemplo de uso:
 * 
 * const config: EnvironmentConfiguration = {
 *   environmentId: "env-1",
 *   environmentName: "Câmara 1 - Pão de Queijo",
 *   product: paoDQueijo,
 *   massaPorTurno: 1000,
 *   tempoCongelamento: 1.9615,
 *   comprimento: 5.26,
 *   largura: 4.28,
 *   altura: 3.0,
 *   tempCamara: -25,
 *   tempExterna: 35,
 *   umidadeRelativa: 50,
 *   trocasAr: 2,
 *   pessoasPorTurno: 2,
 *   equipamentosAuxiliares: 3,
 * };
 * 
 * const resultado = calculateThermalLoad(config);
 * console.log(resultado);
 */
