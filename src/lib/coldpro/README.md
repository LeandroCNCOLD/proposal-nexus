# 🧊 ColdPro - Motor de Cálculo de Carga Térmica

Motor de cálculo profissional para túnel de congelamento baseado em padrões ASHRAE 2022.

## 📋 Características

✅ **Cálculo preciso de carga térmica** com 3 fases de congelamento  
✅ **Fator de congelamento específico** por tipo de produto  
✅ **Carga de respiração** para produtos vivos  
✅ **Infiltração, paredes, pessoas e equipamentos**  
✅ **Fator de segurança** automático (15%)  
✅ **Validação de dados** em tempo real  
✅ **Exportação para integração** com sistemas externos  

## 🚀 Uso Rápido

### 1. Importar o módulo

```typescript
import {
  calculateProductThermalLoad,
  calculateThermalLoad,
  normalizeEnvironmentResult,
  consolidateProjectResults,
} from "@/lib/coldpro";
```

### 2. Definir propriedades do produto

```typescript
const paoDQueijo = {
  productId: "pao-queijo-1",
  productName: "Pão de Queijo",
  tempInicial: 25,
  tempCongelamento: -2.83,
  tempFinal: -18,
  cpAT: 2.02,
  cpAP: 1.12,
  calorLatente: 146.42,
  fatorCongelamento: 0.72, // CRÍTICO!
  densidade: 1070,
};
```

### 3. Calcular carga

```typescript
const resultado = calculateProductThermalLoad(paoDQueijo, 1000, 1.9615);
console.log(`Carga total: ${resultado.Q_total_kW} kW`);
```

## 📁 Estrutura

```
coldpro/
├── physics/
│   └── productThermal.ts          # Cálculos termofísicos
├── engines/
│   └── tunnelEngine.ts            # Motor principal
├── core/
│   ├── environmentResultNormalizer.ts  # Normalização
│   └── projectResultConsolidator.ts    # Consolidação
├── index.ts                       # Exportações
├── example.ts                     # Exemplos de uso
└── README.md                      # Este arquivo
```

## 📐 Fórmulas

### Fase 1: Resfriamento
```
Q₁ = m × Cp_AT × (T_inicial - T_congelamento)
```

### Fase 2: Congelamento (CRÍTICO)
```
Q₂ = m × Cl × Fator_congelamento
```

### Fase 3: Subresfriamento
```
Q₃ = m × Cp_AP × (T_congelamento - T_final)
```

### Carga Total
```
Q_total = Q₁ + Q₂ + Q₃ + Q_respiração + Q_infiltração + Q_paredes + Q_pessoas + Q_equipamentos
```

## 🔧 Tipos

### ProductThermalProperties
Propriedades termofísicas de um produto

```typescript
interface ProductThermalProperties {
  productId: string;
  productName: string;
  tempInicial: number;
  tempCongelamento: number;
  tempFinal: number;
  cpAT: number;
  cpAP: number;
  calorLatente: number;
  fatorCongelamento: number;
  densidade: number;
  taxaRespiracao?: number;
}
```

### EnvironmentConfiguration
Configuração de um ambiente (câmara)

```typescript
interface EnvironmentConfiguration {
  environmentId: string;
  environmentName: string;
  product: ProductThermalProperties;
  massaPorTurno: number;
  tempoCongelamento: number;
  comprimento: number;
  largura: number;
  altura: number;
  tempCamara: number;
  tempExterna: number;
  umidadeRelativa: number;
  trocasAr: number;
  pessoasPorTurno: number;
  equipamentosAuxiliares: number;
}
```

## 📊 Exemplo Completo

```typescript
import { calculateThermalLoad, consolidateProjectResults } from "@/lib/coldpro";

// Definir produto
const produto = {
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

// Definir ambiente
const ambiente = {
  environmentId: "env-1",
  environmentName: "Câmara 1",
  product: produto,
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

// Calcular
const resultado = calculateThermalLoad(ambiente);
console.log(`Carga total: ${resultado.cargaComSeguranca} kW`);
```

## ✅ Validação

Todos os dados são validados automaticamente:

```typescript
import { validateProductProperties } from "@/lib/coldpro";

const erros = validateProductProperties(produto);
if (erros.length > 0) {
  console.error("Erros de validação:", erros);
}
```

## 🔗 Integração com Nomus

Exportar resultado para integração:

```typescript
import { consolidateProjectResults, exportForIntegration } from "@/lib/coldpro";

const projeto = consolidateProjectResults("proj-1", "Projeto", ambientes);
const dadosNomus = exportForIntegration(projeto);

// Enviar para Nomus API
await fetch("/api/nomus/thermal-loads", {
  method: "POST",
  body: JSON.stringify(dadosNomus),
});
```

## 📝 Notas Importantes

1. **Fator de Congelamento**: Cada tipo de produto tem um fator específico (0-1)
   - Frutas: 0,99
   - Carnes: 0,90
   - Panificados: 0,72
   - Óleos: 0,50

2. **Unidades**: Todas as unidades estão em SI
   - Temperatura: °C
   - Energia: kJ
   - Potência: kW
   - Densidade: kg/m³

3. **Fator de Segurança**: Aplicado automaticamente (15%)

4. **Validação**: Sempre validar dados antes de calcular

## 🐛 Troubleshooting

### Carga muito baixa?
- Verificar se `fatorCongelamento` está sendo aplicado
- Validar propriedades termofísicas do produto
- Confirmar unidades de entrada

### Carga muito alta?
- Verificar temperatura externa vs. câmara
- Validar dimensões da câmara
- Confirmar número de trocas de ar

## 📚 Referências

- ASHRAE Handbook 2022 - Refrigeration
- ISO 23045 - Thermal performance of refrigerated storage
- NBR 14175 - Câmaras frigoríficas

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- Documentação técnica: `/docs/coldpro/`
- Exemplos: `./example.ts`
- Testes: `./tests/`

---

**Versão:** 1.0.0  
**Data:** 27 de Abril de 2026  
**Baseado em:** ASHRAE 2022
