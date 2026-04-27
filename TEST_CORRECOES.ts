/**
 * TEST_CORRECOES.ts
 * 
 * Teste para validar se as correções aplicadas estão funcionando corretamente
 * 
 * Execute com: npx ts-node TEST_CORRECOES.ts
 */

import {
  ProductThermalProperties,
  calculateProductThermalLoad,
  convertProductPropertiesIfNeeded,
  calculateThermalLoad,
} from "./src/lib/coldpro";

// ============================================================================
// TESTE 1: Validar conversão de unidades
// ============================================================================

console.log("\n=== TESTE 1: Conversão de Unidades ===\n");

const paoDQueijo_kcal: ProductThermalProperties = {
  productId: "pao-queijo-1",
  productName: "Pão de Queijo",
  tempInicial: 25,
  tempCongelamento: -2.83,
  tempFinal: -18,
  cpAT: 2.02,           // kcal/kg·K
  cpAP: 1.12,           // kcal/kg·K
  calorLatente: 146.42, // kcal/kg
  fatorCongelamento: 0.72,
  densidade: 1070,
};

console.log("❌ ANTES (em kcal):");
console.log(`  cpAT: ${paoDQueijo_kcal.cpAT} kcal/kg·K`);
console.log(`  cpAP: ${paoDQueijo_kcal.cpAP} kcal/kg·K`);
console.log(`  calorLatente: ${paoDQueijo_kcal.calorLatente} kcal/kg`);

const paoDQueijo_kJ = convertProductPropertiesIfNeeded(paoDQueijo_kcal, "kcal");

console.log("\n✅ DEPOIS (em kJ):");
console.log(`  cpAT: ${paoDQueijo_kJ.cpAT.toFixed(3)} kJ/kg·K`);
console.log(`  cpAP: ${paoDQueijo_kJ.cpAP.toFixed(3)} kJ/kg·K`);
console.log(`  calorLatente: ${paoDQueijo_kJ.calorLatente.toFixed(3)} kJ/kg`);

// ============================================================================
// TESTE 2: Calcular carga térmica do produto
// ============================================================================

console.log("\n=== TESTE 2: Cálculo de Carga Térmica do Produto ===\n");

const resultado = calculateProductThermalLoad(paoDQueijo_kJ, 1000, 1.9615);

console.log("Resultado do cálculo:");
console.log(`  Q1 (Resfriamento): ${resultado.Q1_resfriamento.toFixed(2)} kJ`);
console.log(`  Q2 (Congelamento): ${resultado.Q2_congelamento.toFixed(2)} kJ`);
console.log(`  Q3 (Subresfriamento): ${resultado.Q3_subresfriamento.toFixed(2)} kJ`);
console.log(`  Q_total: ${resultado.Q_total_kJ.toFixed(2)} kJ`);
console.log(`  Potência: ${resultado.Q_total_kW?.toFixed(2)} kW`);
console.log(`  Energia específica: ${resultado.energiaEspecifica_kJ_kg.toFixed(2)} kJ/kg`);

// Validar se os valores estão razoáveis
const isReasonable = 
  resultado.Q1_resfriamento > 0 &&
  resultado.Q2_congelamento > 0 &&
  resultado.Q3_subresfriamento > 0 &&
  resultado.Q_total_kW! > 20 &&
  resultado.Q_total_kW! < 30;

console.log(`\n${isReasonable ? "✅" : "❌"} Valores razoáveis? ${isReasonable ? "SIM" : "NÃO"}`);

if (!isReasonable) {
  console.log("\n⚠️  AVISO: Os valores não estão na faixa esperada!");
  console.log("   Esperado: Q_total entre 20-30 kW");
  console.log(`   Obtido: ${resultado.Q_total_kW?.toFixed(2)} kW`);
}

// ============================================================================
// TESTE 3: Calcular carga térmica total da câmara
// ============================================================================

console.log("\n=== TESTE 3: Cálculo de Carga Térmica Total da Câmara ===\n");

const config = {
  environmentId: "env-1",
  environmentName: "Câmara 1 - Pão de Queijo",
  product: paoDQueijo_kJ,
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

try {
  const resultadoCamara = calculateThermalLoad(config);

  console.log("Breakdown de cargas:");
  console.log(`  Produto: ${resultadoCamara.cargaProduto.toFixed(2)} kW`);
  console.log(`  Respiração: ${resultadoCamara.cargaRespiracao.toFixed(2)} kW`);
  console.log(`  Infiltração: ${resultadoCamara.cargaInfiltracao.toFixed(2)} kW`);
  console.log(`  Paredes: ${resultadoCamara.cargaParedes.toFixed(2)} kW`);
  console.log(`  Pessoas: ${resultadoCamara.cargaPessoas.toFixed(2)} kW`);
  console.log(`  Equipamentos: ${resultadoCamara.cargaEquipamentos.toFixed(2)} kW`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  TOTAL: ${resultadoCamara.cargaTotalCamara.toFixed(2)} kW`);
  console.log(`  Com segurança (${(resultadoCamara.fatorSeguranca * 100).toFixed(0)}%): ${resultadoCamara.cargaComSeguranca.toFixed(2)} kW`);

  // Validar se a carga do produto é significativa
  const produtoPercentual = (resultadoCamara.cargaProduto / resultadoCamara.cargaTotalCamara) * 100;
  console.log(`\n  Carga do produto: ${produtoPercentual.toFixed(1)}% da carga total`);

  if (produtoPercentual < 10) {
    console.log("  ⚠️  AVISO: Carga do produto muito baixa!");
  } else if (produtoPercentual > 80) {
    console.log("  ⚠️  AVISO: Carga do produto muito alta!");
  } else {
    console.log("  ✅ Carga do produto em faixa razoável");
  }

  // Detalhes adicionais
  console.log(`\nDetalhes do cálculo:`);
  console.log(`  Q1: ${resultadoCamara.detalhes.Q1_resfriamento.toFixed(2)} kJ`);
  console.log(`  Q2: ${resultadoCamara.detalhes.Q2_congelamento.toFixed(2)} kJ`);
  console.log(`  Q3: ${resultadoCamara.detalhes.Q3_subresfriamento.toFixed(2)} kJ`);
  console.log(`  Energia específica: ${resultadoCamara.detalhes.energiaEspecifica.toFixed(2)} kJ/kg`);

  // Validações
  if (resultadoCamara.detalhes.validacoes && resultadoCamara.detalhes.validacoes.length > 0) {
    console.log(`\nValidações e avisos:`);
    resultadoCamara.detalhes.validacoes.forEach((aviso: string) => {
      console.log(`  ${aviso}`);
    });
  }

} catch (error) {
  console.error("❌ ERRO ao calcular carga térmica:");
  console.error(error);
}

// ============================================================================
// RESUMO
// ============================================================================

console.log("\n=== RESUMO DAS CORREÇÕES ===\n");
console.log("✅ Correção 1: Nomes de propriedades corrigidos");
console.log("   - cpAboveKcalKgC → cpAT");
console.log("   - latentHeatKcalKg → calorLatente");
console.log("   - densityKgM3 → densidade");
console.log("");
console.log("✅ Correção 2: Temperatura do produto corrigida");
console.log("   - freezingPointC → tempFinal");
console.log("");
console.log("✅ Correção 3: Função de conversão de unidades adicionada");
console.log("   - convertProductPropertiesIfNeeded()");
console.log("   - Converte de kcal para kJ (fator 4.184)");
console.log("");
console.log("✅ Correção 4: Documentação de unidades adicionada");
console.log("   - Interface ProductThermalProperties com comentários");
console.log("   - Aviso sobre unidades esperadas");
console.log("");
