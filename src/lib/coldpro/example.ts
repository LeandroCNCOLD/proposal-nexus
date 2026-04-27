/**
 * example.ts
 * 
 * Exemplo completo de uso do motor de cálculo ColdPro
 * 
 * Este arquivo demonstra como usar o motor para calcular
 * carga térmica de um projeto de túnel de congelamento
 */

import {
  ProductThermalProperties,
  EnvironmentConfiguration,
  calculateProductThermalLoad,
  calculateThermalLoad,
  normalizeEnvironmentResult,
  consolidateProjectResults,
  formatConsolidatedResult,
  exportForIntegration,
} from "./index";

/**
 * EXEMPLO 1: Calcular carga térmica de um único produto
 */
export function exemplo1_CalcularCargaProduto() {
  console.log("\n=== EXEMPLO 1: Cálculo de Carga do Produto ===\n");

  // Definir propriedades do Pão de Queijo
  const paoDQueijo: ProductThermalProperties = {
    productId: "pao-queijo-1",
    productName: "Pão de Queijo",
    tempInicial: 25, // °C
    tempCongelamento: -2.83, // °C
    tempFinal: -18, // °C
    cpAT: 2.02, // kJ/kg·K (acima do ponto de congelamento)
    cpAP: 1.12, // kJ/kg·K (abaixo do ponto de congelamento)
    calorLatente: 146.42, // kJ/kg
    fatorCongelamento: 0.72, // CRÍTICO: aplicar fator!
    densidade: 1070, // kg/m³
  };

  // Calcular carga para 1000 kg em 1,9615 horas
  const resultado = calculateProductThermalLoad(paoDQueijo, 1000, 1.9615);

  console.log("Resultado:");
  console.log(`  Q1 (Resfriamento):     ${resultado.Q1_resfriamento.toFixed(2)} kJ`);
  console.log(`  Q2 (Congelamento):     ${resultado.Q2_congelamento.toFixed(2)} kJ`);
  console.log(`  Q3 (Subresfriamento):  ${resultado.Q3_subresfriamento.toFixed(2)} kJ`);
  console.log(`  Q Total:               ${resultado.Q_total_kJ.toFixed(2)} kJ`);
  console.log(`  Potência:              ${resultado.Q_total_kW?.toFixed(2)} kW`);
}

/**
 * EXEMPLO 2: Calcular carga térmica de um ambiente
 */
export function exemplo2_CalcularCargaAmbiente() {
  console.log("\n=== EXEMPLO 2: Cálculo de Carga do Ambiente ===\n");

  const paoDQueijo: ProductThermalProperties = {
    productId: "pao-queijo-1",
    productName: "Pão de Queijo",
    tempInicial: 25,
    tempCongelamento: -2.83,
    tempFinal: -18,
    cpAT: 2.02,
    cpAP: 1.12,
    calorLatente: 146.42,
    fatorCongelamento: 0.72,
    densidade: 1070,
  };

  const config: EnvironmentConfiguration = {
    environmentId: "env-1",
    environmentName: "Câmara 1 - Pão de Queijo",
    product: paoDQueijo,
    massaPorTurno: 1000, // kg
    tempoCongelamento: 1.9615, // horas
    comprimento: 5.26, // m
    largura: 4.28, // m
    altura: 3.0, // m
    tempCamara: -25, // °C
    tempExterna: 35, // °C
    umidadeRelativa: 50, // %
    trocasAr: 2, // trocas de ar por dia
    pessoasPorTurno: 2,
    equipamentosAuxiliares: 3, // kW
  };

  const resultado = calculateThermalLoad(config);

  console.log("Cargas Térmicas:");
  console.log(`  Produto:        ${resultado.cargaProduto.toFixed(2)} kW`);
  console.log(`  Respiração:     ${resultado.cargaRespiracao.toFixed(2)} kW`);
  console.log(`  Infiltração:    ${resultado.cargaInfiltracao.toFixed(2)} kW`);
  console.log(`  Paredes:        ${resultado.cargaParedes.toFixed(2)} kW`);
  console.log(`  Pessoas:        ${resultado.cargaPessoas.toFixed(2)} kW`);
  console.log(`  Equipamentos:   ${resultado.cargaEquipamentos.toFixed(2)} kW`);
  console.log(`  ─────────────────────────`);
  console.log(`  Total (sem seg): ${resultado.cargaTotalCamara.toFixed(2)} kW`);
  console.log(`  Total (com seg): ${resultado.cargaComSeguranca.toFixed(2)} kW (+${Math.round((resultado.fatorSeguranca - 1) * 100)}%)`);
}

/**
 * EXEMPLO 3: Normalizar resultado para UI
 */
export function exemplo3_NormalizarResultado() {
  console.log("\n=== EXEMPLO 3: Normalizar Resultado ===\n");

  const paoDQueijo: ProductThermalProperties = {
    productId: "pao-queijo-1",
    productName: "Pão de Queijo",
    tempInicial: 25,
    tempCongelamento: -2.83,
    tempFinal: -18,
    cpAT: 2.02,
    cpAP: 1.12,
    calorLatente: 146.42,
    fatorCongelamento: 0.72,
    densidade: 1070,
  };

  const config: EnvironmentConfiguration = {
    environmentId: "env-1",
    environmentName: "Câmara 1 - Pão de Queijo",
    product: paoDQueijo,
    massaPorTurno: 1000,
    tempoCongelamento: 1.9615,
    comprimento: 5.26,
    largura: 4.28,
    altura: 3.0,
    tempCamara: -25,
    tempExterna: 35,
    umidadeRelativa: 50,
    trocasAr: 2,
    pessoasPorTurno: 2,
    equipamentosAuxiliares: 3,
  };

  const resultado = calculateThermalLoad(config);
  const normalizado = normalizeEnvironmentResult(resultado, config.environmentId, config.environmentName);

  console.log(formatNormalizedResult(normalizado));
}

/**
 * EXEMPLO 4: Consolidar múltiplos ambientes em projeto
 */
export function exemplo4_ConsolidarProjeto() {
  console.log("\n=== EXEMPLO 4: Consolidar Projeto ===\n");

  const paoDQueijo: ProductThermalProperties = {
    productId: "pao-queijo-1",
    productName: "Pão de Queijo",
    tempInicial: 25,
    tempCongelamento: -2.83,
    tempFinal: -18,
    cpAT: 2.02,
    cpAP: 1.12,
    calorLatente: 146.42,
    fatorCongelamento: 0.72,
    densidade: 1070,
  };

  // Criar 2 ambientes
  const ambientes = [];

  for (let i = 1; i <= 2; i++) {
    const config: EnvironmentConfiguration = {
      environmentId: `env-${i}`,
      environmentName: `Câmara ${i} - Pão de Queijo`,
      product: paoDQueijo,
      massaPorTurno: 1000 * i,
      tempoCongelamento: 1.9615,
      comprimento: 5.26,
      largura: 4.28,
      altura: 3.0,
      tempCamara: -25,
      tempExterna: 35,
      umidadeRelativa: 50,
      trocasAr: 2,
      pessoasPorTurno: 2,
      equipamentosAuxiliares: 3,
    };

    const resultado = calculateThermalLoad(config);
    const normalizado = normalizeEnvironmentResult(resultado, config.environmentId, config.environmentName);
    ambientes.push(normalizado);
  }

  // Consolidar projeto
  const projetoConsolidado = consolidateProjectResults("proj-1", "Projeto ColdPro - Pão de Queijo", ambientes);

  console.log(formatConsolidatedResult(projetoConsolidado));

  // Exportar para integração
  const exportacao = exportForIntegration(projetoConsolidado);
  console.log("\nDados para integração com Nomus:");
  console.log(JSON.stringify(exportacao, null, 2));
}

/**
 * Executar todos os exemplos
 */
export function executarTodosExemplos() {
  exemplo1_CalcularCargaProduto();
  exemplo2_CalcularCargaAmbiente();
  exemplo3_NormalizarResultado();
  exemplo4_ConsolidarProjeto();
}
