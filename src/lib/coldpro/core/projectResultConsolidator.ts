/**
 * projectResultConsolidator.ts
 * 
 * Consolida resultados de múltiplos ambientes em um resultado final de projeto
 * Este é o ponto ideal para integração com sistemas externos (Nomus, etc.)
 */

import { NormalizedEnvironmentResult } from "./environmentResultNormalizer";

export interface ProjectThermalResult {
  // Identificação do projeto
  projectId: string;
  projectName: string;

  // Ambientes
  ambientes: NormalizedEnvironmentResult[];

  // Cargas totais do projeto (kW)
  cargasTotais: {
    produto: number;
    respiracao: number;
    infiltracao: number;
    paredes: number;
    pessoas: number;
    equipamentos: number;
    semSeguranca: number;
    comSeguranca: number;
  };

  // Estatísticas
  estatisticas: {
    quantidadeAmbientes: number;
    cargaMedia: number;
    cargaMaxima: number;
    cargaMinima: number;
    percentualSeguranca: number;
  };

  // Validação
  valido: boolean;
  avisos: string[];
  erros: string[];

  // Metadata
  timestamp: string;
  versao: string;
}

/**
 * Consolida resultados de múltiplos ambientes
 * 
 * @param projectId ID do projeto
 * @param projectName Nome do projeto
 * @param ambientes Array de resultados normalizados
 * @returns Resultado consolidado do projeto
 */
export function consolidateProjectResults(
  projectId: string,
  projectName: string,
  ambientes: NormalizedEnvironmentResult[]
): ProjectThermalResult {
  const avisos: string[] = [];
  const erros: string[] = [];
  let valido = true;

  // Validar entrada
  if (!ambientes || ambientes.length === 0) {
    erros.push("Nenhum ambiente fornecido");
    valido = false;
  }

  // Somar cargas de todos os ambientes
  const cargasTotais = {
    produto: 0,
    respiracao: 0,
    infiltracao: 0,
    paredes: 0,
    pessoas: 0,
    equipamentos: 0,
    semSeguranca: 0,
    comSeguranca: 0,
  };

  const cargas: number[] = [];

  ambientes.forEach((ambiente) => {
    // Validar ambiente
    if (!ambiente.valido) {
      avisos.push(`Ambiente "${ambiente.environmentName}" contém erros`);
    }

    // Somar cargas
    cargasTotais.produto += ambiente.cargas.produto.valor;
    cargasTotais.respiracao += ambiente.cargas.respiracao.valor;
    cargasTotais.infiltracao += ambiente.cargas.infiltracao.valor;
    cargasTotais.paredes += ambiente.cargas.paredes.valor;
    cargasTotais.pessoas += ambiente.cargas.pessoas.valor;
    cargasTotais.equipamentos += ambiente.cargas.equipamentos.valor;
    cargasTotais.semSeguranca += ambiente.totais.semSeguranca.valor;
    cargasTotais.comSeguranca += ambiente.totais.comSeguranca.valor;

    cargas.push(ambiente.totais.semSeguranca.valor);
  });

  // Arredondar para 2 casas decimais
  const arredondar = (valor: number): number => {
    return Math.round(valor * 100) / 100;
  };

  // Calcular estatísticas
  const cargaMedia = cargas.length > 0 ? cargas.reduce((a, b) => a + b, 0) / cargas.length : 0;
  const cargaMaxima = cargas.length > 0 ? Math.max(...cargas) : 0;
  const cargaMinima = cargas.length > 0 ? Math.min(...cargas) : 0;
  const percentualSeguranca = cargas.length > 0
    ? Math.round(((cargasTotais.comSeguranca - cargasTotais.semSeguranca) / cargasTotais.semSeguranca) * 100)
    : 0;

  // Validações finais
  if (cargasTotais.semSeguranca <= 0) {
    erros.push("Carga total do projeto deve ser positiva");
    valido = false;
  }

  if (cargasTotais.produto < cargasTotais.semSeguranca * 0.2) {
    avisos.push(
      "Carga do produto é menor que 20% da carga total. Verificar dados de entrada."
    );
  }

  if (cargasTotais.semSeguranca > 1000) {
    avisos.push(
      "Carga total muito alta (> 1000 kW). Considerar múltiplos compressores."
    );
  }

  return {
    projectId,
    projectName,
    ambientes,

    cargasTotais: {
      produto: arredondar(cargasTotais.produto),
      respiracao: arredondar(cargasTotais.respiracao),
      infiltracao: arredondar(cargasTotais.infiltracao),
      paredes: arredondar(cargasTotais.paredes),
      pessoas: arredondar(cargasTotais.pessoas),
      equipamentos: arredondar(cargasTotais.equipamentos),
      semSeguranca: arredondar(cargasTotais.semSeguranca),
      comSeguranca: arredondar(cargasTotais.comSeguranca),
    },

    estatisticas: {
      quantidadeAmbientes: ambientes.length,
      cargaMedia: arredondar(cargaMedia),
      cargaMaxima: arredondar(cargaMaxima),
      cargaMinima: arredondar(cargaMinima),
      percentualSeguranca,
    },

    valido,
    avisos,
    erros,

    timestamp: new Date().toISOString(),
    versao: "1.0.0",
  };
}

/**
 * Formata resultado consolidado para exibição
 */
export function formatConsolidatedResult(result: ProjectThermalResult): string {
  let output = `\n${"=".repeat(70)}\n`;
  output += `RESULTADO FINAL - CÁLCULO DE CARGA TÉRMICA DO PROJETO\n`;
  output += `Projeto: ${result.projectName}\n`;
  output += `Data: ${new Date(result.timestamp).toLocaleString("pt-BR")}\n`;
  output += `${"=".repeat(70)}\n\n`;

  // Resumo de ambientes
  output += `AMBIENTES PROCESSADOS: ${result.estatisticas.quantidadeAmbientes}\n`;
  output += `${"-".repeat(70)}\n`;
  result.ambientes.forEach((amb, idx) => {
    output += `${idx + 1}. ${amb.environmentName}: ${amb.totais.comSeguranca.valor.toFixed(2)} kW\n`;
  });
  output += `${"-".repeat(70)}\n\n`;

  // Cargas totais
  output += `CARGAS TÉRMICAS TOTAIS DO PROJETO:\n`;
  output += `${"-".repeat(70)}\n`;
  output += `Produto:        ${result.cargasTotais.produto.toFixed(2)} kW\n`;
  output += `Respiração:     ${result.cargasTotais.respiracao.toFixed(2)} kW\n`;
  output += `Infiltração:    ${result.cargasTotais.infiltracao.toFixed(2)} kW\n`;
  output += `Paredes:        ${result.cargasTotais.paredes.toFixed(2)} kW\n`;
  output += `Pessoas:        ${result.cargasTotais.pessoas.toFixed(2)} kW\n`;
  output += `Equipamentos:   ${result.cargasTotais.equipamentos.toFixed(2)} kW\n`;
  output += `${"-".repeat(70)}\n`;
  output += `SEM SEGURANÇA:  ${result.cargasTotais.semSeguranca.toFixed(2)} kW\n`;
  output += `COM SEGURANÇA:  ${result.cargasTotais.comSeguranca.toFixed(2)} kW (+${result.estatisticas.percentualSeguranca}%)\n`;
  output += `${"-".repeat(70)}\n\n`;

  // Estatísticas
  output += `ESTATÍSTICAS:\n`;
  output += `${"-".repeat(70)}\n`;
  output += `Carga Média:    ${result.estatisticas.cargaMedia.toFixed(2)} kW\n`;
  output += `Carga Máxima:   ${result.estatisticas.cargaMaxima.toFixed(2)} kW\n`;
  output += `Carga Mínima:   ${result.estatisticas.cargaMinima.toFixed(2)} kW\n`;
  output += `${"-".repeat(70)}\n\n`;

  // Status
  output += `STATUS: ${result.valido ? "✓ VÁLIDO" : "✗ INVÁLIDO"}\n`;

  if (result.avisos.length > 0) {
    output += `\nAVISOS:\n`;
    result.avisos.forEach((aviso) => {
      output += `  ⚠ ${aviso}\n`;
    });
  }

  if (result.erros.length > 0) {
    output += `\nERROS:\n`;
    result.erros.forEach((erro) => {
      output += `  ✗ ${erro}\n`;
    });
  }

  output += `${"=".repeat(70)}\n\n`;

  return output;
}

/**
 * Exporta resultado para integração com Nomus ou outro sistema
 * 
 * Este é o ponto de integração com sistemas externos
 */
export function exportForIntegration(
  result: ProjectThermalResult
): Record<string, any> {
  return {
    project: {
      id: result.projectId,
      name: result.projectName,
      timestamp: result.timestamp,
    },
    thermal_loads: {
      product_kW: result.cargasTotais.produto,
      respiration_kW: result.cargasTotais.respiracao,
      infiltration_kW: result.cargasTotais.infiltracao,
      walls_kW: result.cargasTotais.paredes,
      people_kW: result.cargasTotais.pessoas,
      equipment_kW: result.cargasTotais.equipamentos,
      total_without_safety_kW: result.cargasTotais.semSeguranca,
      total_with_safety_kW: result.cargasTotais.comSeguranca,
      safety_factor_percent: result.estatisticas.percentualSeguranca,
    },
    environments: result.ambientes.map((amb) => ({
      id: amb.environmentId,
      name: amb.environmentName,
      total_load_kW: amb.totais.comSeguranca.valor,
    })),
    statistics: {
      number_of_environments: result.estatisticas.quantidadeAmbientes,
      average_load_kW: result.estatisticas.cargaMedia,
      max_load_kW: result.estatisticas.cargaMaxima,
      min_load_kW: result.estatisticas.cargaMinima,
    },
    validation: {
      valid: result.valido,
      warnings: result.avisos,
      errors: result.erros,
    },
  };
}
