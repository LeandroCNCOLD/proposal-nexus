Plano para corrigir definitivamente a modelagem de latente dos produtos ColdPro

1. Padronizar o contrato térmico do produto em kJ
- Atualizar `src/modules/coldpro/physics/productThermal.ts` para aceitar e retornar explicitamente:
  - `cpAboveKJkgK`
  - `cpBelowKJkgK`
  - `latentHeatKJkg`
  - `latentMode: "effective" | "full"`
  - `latentEffectiveKJkg`
- Manter os campos antigos em kcal no retorno para compatibilidade, mas fazer o cálculo principal em kJ e só converter para kcal no final.

2. Implementar `latentMode` sem dupla redução
- Regra central:
  - `latentMode = "effective"`: usar `latentHeatKJkg` diretamente como latente efetivo.
  - `latentMode = "full"`: usar `latentHeatKJkg × frozenWaterFraction`.
- Default/retrocompatibilidade:
  - se não vier `latentMode`, assumir `"effective"`.
  - se existir `latentHeatKJkg` e também `frozenWaterFraction`, continuar assumindo `"effective"`, ou seja, não multiplicar novamente pela fração.
  - só aplicar a fração quando `latentMode` vier explicitamente como `"full"`.
- `latentResidualFactor` não será aplicado no modo `effective`; para não quebrar chamadas antigas, ele pode continuar existindo no input/breakdown, mas não reduzirá o latente efetivo padrão.

3. Corrigir normalização de unidades
- Atualizar `src/modules/coldpro/core/unitNormalizer.ts` para enriquecer a normalização com:
  - `latentMode`
  - `cpAboveKJkgK`
  - `cpBelowKJkgK`
  - `latentHeatKJkg`
- Garantir que kcal → kJ aconteça uma única vez (`× 4,1868`).
- Evitar que `normalizeThermalProperties` faça conversão em cima de valor já convertido.
- Preservar `normalizeProductForKcalEngine` para compatibilidade, mas alimentar o motor preferencialmente com o pacote em kJ.

4. Ajustar adapters de entrada
- Atualizar:
  - `src/modules/coldpro/adapters/databaseToTunnelInput.ts`
  - `src/modules/coldpro/adapters/formToTunnelInput.ts`
- Passar ao motor os campos em kJ e o `latentMode` normalizado.
- Manter campos em kcal também quando necessário para compatibilidade com código existente, sem criar dupla conversão.

5. Atualizar o motor de túnel/breakdown sem alterar UI
- Ajustar `src/modules/coldpro/engines/tunnelEngine.ts` para usar a nova saída de `calculateProductSpecificEnergy`.
- Enriquecer `calculationBreakdown.productEnergy` com os campos obrigatórios:
  - `cpAboveKJkgK`
  - `cpBelowKJkgK`
  - `latentHeatKJkg` original
  - `frozenWaterFraction`
  - `latentMode`
  - `latentEffectiveKJkg`
  - `sensibleAboveKJkg`
  - `latentKJkg`
  - `sensibleBelowKJkg`
  - `totalKJkg`
- Não alterar layout, telas ou componentes de UI nesta etapa.

6. Validações e warnings
- Adicionar warning quando `finalTemp < freezingPoint` e `latentEffectiveKJkg < 80`:
  - `Calor latente baixo para congelamento. Verificar base do produto.`
- Adicionar warning quando `frozenWaterFraction < 0,4`:
  - `Fração congelável baixa. Validar origem do dado.`
- Manter os alertas existentes, ajustando-os para olhar o latente efetivo em kJ quando aplicável.

7. Caso de teste obrigatório
- Atualizar/adicionar teste em `src/modules/coldpro/engines/tunnelEngine.test.ts` com produto tipo pão de queijo:
  - `cpAbove ≈ 2,0 kJ/kgK`
  - `cpBelow ≈ 1,1 kJ/kgK`
  - `latent ≈ 140 kJ/kg`
  - `latentMode` omitido ou `effective`
  - `frozenWaterFraction` preenchido
- Validar que a energia específica fica aproximadamente em `200–220 kJ/kg`, equivalente a `48–52 kcal/kg`.
- Validar explicitamente que o latente retornado no breakdown é próximo de `140 kJ/kg`, não `140 × frozenWaterFraction`.
- Adicionar também um teste com `latentMode: "full"` para confirmar que somente nesse modo a fração é aplicada.

8. Garantias finais
- Executar:
  - `bun run test`
  - `bunx tsc --noEmit`
  - `bun run build`
- Retornar ao final:
  - arquivos alterados
  - diff/resumo das funções críticas
  - validação numérica do caso pão de queijo
  - confirmação explícita de que o latente não está mais sendo reduzido duas vezes

Arquivos previstos para alteração
- `src/modules/coldpro/physics/productThermal.ts`
- `src/modules/coldpro/core/unitNormalizer.ts`
- `src/modules/coldpro/adapters/databaseToTunnelInput.ts`
- `src/modules/coldpro/adapters/formToTunnelInput.ts`
- `src/modules/coldpro/types/tunnelEngine.types.ts`
- `src/modules/coldpro/engines/tunnelEngine.ts`
- `src/modules/coldpro/engines/tunnelEngine.test.ts`