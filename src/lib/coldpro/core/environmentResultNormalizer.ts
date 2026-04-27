/**
 * environmentResultNormalizer.ts
 * 
 * Normaliza e padroniza os resultados de cálculo por ambiente
 * Converte unidades, valida valores e estrutura dados para UI
 */

import { ThermalLoadBreakdown } from "./tunnelEngine";

export interface NormalizedEnvironmentResult {
  // Identificação
  environmentId: string;
  environmentName: string;

  // Cargas em kW (unidade padrão)
  cargas: {
    produto: {
      valor: number;
      unidade: "kW";
      descricao: string;
    };
    respiracao: {
      valor: number;
      unidade: "kW";
      descricao: string;
    };
    infiltracao: {
      valor: number;
      unidade: "kW";
      descricao: string;
    };
    paredes: {
      valor: number;
      unidade: "kW";
      descricao: string;
    };
    pessoas: {
      valor: number;
      unidade: "kW";
      descricao: string;
    };
    equipamentos: {
      valor: number;
      unidade: "kW";
      descricao: string;
    };
  };

  // Totais
  totais: {
    semSeguranca: {
      valor: number;
      unidade: "kW";
    };
    comSeguranca: {
      valor: number;
      unidade: "kW";
      percentualSeguranca: number;
    };
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
 * Normaliza os resultados de cálculo de carga térmica
 * 
 * @param breakdown Resultado bruto do cálculo
 * @param environmentId ID do ambiente
 * @param environmentName Nome do ambiente
 * @returns Resultado normalizado
 */
export function normalizeEnvironmentResult(
  breakdown: ThermalLoadBreakdown,
  environmentId: string,
  environmentName: string
): NormalizedEnvironmentResult {
  const avisos: string[] = [];
  const erros: string[] = [];
  let valido = true;

  // Validar valores
  if (breakdown.cargaProduto < 0) {
    erros.push("Carga do produto não pode ser negativa");
    valido = false;
  }

  if (breakdown.cargaTotalCamara <= 0) {
    erros.push("Carga total da câmara deve ser positiva");
    valido = false;
  }

  if (breakdown.cargaTotalCamara > 500) {
    avisos.push("Carga total muito alta (> 500 kW). Verificar dados de entrada.");
  }

  if (breakdown.cargaTotalCamara < 0.5) {
    avisos.push("Carga total muito baixa (< 0,5 kW). Verificar dados de entrada.");
  }

  // Validar fator de segurança
  if (breakdown.fatorSeguranca < 1.0 || breakdown.fatorSeguranca > 1.5) {
    avisos.push(
      `Fator de segurança fora do intervalo recomendado (1.0-1.5): ${breakdown.fatorSeguranca}`
    );
  }

  // Arredondar para 2 casas decimais
  const arredondar = (valor: number): number => {
    return Math.round(valor * 100) / 100;
  };

  return {
    environmentId,
    environmentName,

    cargas: {
      produto: {
        valor: arredondar(breakdown.cargaProduto),
        unidade: "kW",
        descricao: "Carga para congelamento do produto",
      },
      respiracao: {
        valor: arredondar(breakdown.cargaRespiracao),
        unidade: "kW",
        descricao: "Carga metabólica (produtos vivos)",
      },
      infiltracao: {
        valor: arredondar(breakdown.cargaInfiltracao),
        unidade: "kW",
        descricao: "Carga de ar quente infiltrado",
      },
      paredes: {
        valor: arredondar(breakdown.cargaParedes),
        unidade: "kW",
        descricao: "Carga por condução pelas paredes",
      },
      pessoas: {
        valor: arredondar(breakdown.cargaPessoas),
        unidade: "kW",
        descricao: "Carga de calor corporal",
      },
      equipamentos: {
        valor: arredondar(breakdown.cargaEquipamentos),
        unidade: "kW",
        descricao: "Carga de equipamentos auxiliares",
      },
    },

    totais: {
      semSeguranca: {
        valor: arredondar(breakdown.cargaTotalCamara),
        unidade: "kW",
      },
      comSeguranca: {
        valor: arredondar(breakdown.cargaComSeguranca),
        unidade: "kW",
        percentualSeguranca: Math.round(
          (breakdown.fatorSeguranca - 1) * 100
        ),
      },
    },

    valido,
    avisos,
    erros,

    timestamp: new Date().toISOString(),
    versao: "1.0.0",
  };
}

/**
 * Formata resultado normalizado para exibição
 */
export function formatNormalizedResult(
  result: NormalizedEnvironmentResult
): string {
  let output = `\n${"=".repeat(60)}\n`;
  output += `RESULTADO DE CÁLCULO DE CARGA TÉRMICA\n`;
  output += `Ambiente: ${result.environmentName}\n`;
  output += `Data: ${new Date(result.timestamp).toLocaleString("pt-BR")}\n`;
  output += `${"=".repeat(60)}\n\n`;

  // Cargas
  output += `CARGAS TÉRMICAS:\n`;
  output += `${"-".repeat(60)}\n`;
  output += `Produto:        ${result.cargas.produto.valor.toFixed(2)} ${result.cargas.produto.unidade}\n`;
  output += `Respiração:     ${result.cargas.respiracao.valor.toFixed(2)} ${result.cargas.respiracao.unidade}\n`;
  output += `Infiltração:    ${result.cargas.infiltracao.valor.toFixed(2)} ${result.cargas.infiltracao.unidade}\n`;
  output += `Paredes:        ${result.cargas.paredes.valor.toFixed(2)} ${result.cargas.paredes.unidade}\n`;
  output += `Pessoas:        ${result.cargas.pessoas.valor.toFixed(2)} ${result.cargas.pessoas.unidade}\n`;
  output += `Equipamentos:   ${result.cargas.equipamentos.valor.toFixed(2)} ${result.cargas.equipamentos.unidade}\n`;
  output += `${"-".repeat(60)}\n`;

  // Totais
  output += `TOTAIS:\n`;
  output += `Sem segurança:  ${result.totais.semSeguranca.valor.toFixed(2)} ${result.totais.semSeguranca.unidade}\n`;
  output += `Com segurança:  ${result.totais.comSeguranca.valor.toFixed(2)} ${result.totais.comSeguranca.unidade} (+${result.totais.comSeguranca.percentualSeguranca}%)\n`;
  output += `${"-".repeat(60)}\n`;

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

  output += `${"=".repeat(60)}\n\n`;

  return output;
}

/**
 * Valida se o resultado está dentro de limites aceitáveis
 */
export function validateNormalizedResult(
  result: NormalizedEnvironmentResult
): boolean {
  // Verificar se há erros
  if (result.erros.length > 0) {
    return false;
  }

  // Verificar se a carga total é positiva
  if (result.totais.semSeguranca.valor <= 0) {
    return false;
  }

  // Verificar se a carga do produto é a maior componente
  const cargaProduto = result.cargas.produto.valor;
  const cargaTotal = result.totais.semSeguranca.valor;

  if (cargaProduto < cargaTotal * 0.3) {
    console.warn(
      "Aviso: Carga do produto é menor que 30% da carga total. Verificar dados."
    );
  }

  return true;
}
