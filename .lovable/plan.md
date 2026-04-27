Vou executar a etapa completa mantendo o escopo restrito ao ColdPro e sem trocar o motor de cálculo. Como já existe uma primeira implantação parcial, a etapa será consolidar, tipar e completar o que falta para bater exatamente com o contrato solicitado.

1. Consolidar registry oficial
- Reescrever `src/modules/coldpro/core/calculationMethodRegistry.ts` no formato solicitado:
  - `ColdProCalculationMethodStatus`
  - `ColdProCalculationMethodArea`
  - `ColdProCalculationMethodDefinition`
  - `COLDPRO_CALCULATION_METHODS`
  - `getColdProCalculationMethod`
  - `listColdProCalculationMethods`
- Ajustar os nomes para `packagingContinuous` e `packagingBatch`, mantendo compatibilidade de leitura onde necessário.
- Incluir todos os métodos: transmissão, produto, carga contínua, batelada, embalagem, infiltração, cargas internas, vazão, velocidade, h convectivo, tempo até núcleo e seleção.

2. Consolidar comparação ASHRAE x ColdPro
- Reescrever `src/modules/coldpro/core/ashraeComparison.ts` com:
  - `AshraeColdProComparison`
  - `ASHRAE_COLDPRO_COMPARISONS`
  - `compareColdProFormulaWithAshrae`
  - `listAshraeColdProComparisons`
  - `getHighPriorityAshraeActions`
- Manter alias de compatibilidade se algum ponto já estiver importando `listAshraeComparisons`.

3. Completar método oficial no tunnelEngine
- Importar o registry direto no `tunnelEngine.ts`.
- Registrar em `calculationBreakdown.calculationMethod` os objetos oficiais:
  - `productEnergy`
  - `productLoad`
  - `packaging`
  - `airflow`
  - `airVelocity`
  - `convectiveCoefficient`
  - `freezingTime`
- Adicionar em `calculationLog`:
  - `methodRegistryVersion: "ashrae-comparison-v1.0.0"`
  - `methodsUsed` com nomes dos métodos utilizados.
- Preservar fórmulas atuais de produto, vazão, velocidade, h e tempo.

4. Corrigir embalagem em batelada de forma completa
- Implementar resolução oficial da massa de embalagem em batch com prioridade:
  1. `packagingMassKgBatch`
  2. `packagingMassKg`
  3. `packagingMassPerPalletKg × numberOfPallets`
  4. `trayMassPerCartKg × numberOfCarts`
  5. zero com warning
- Retornar no resultado/breakdown:
  - `packagingMassBatchKg`
  - `packagingLoadMethod: "continuous_mass_flow" | "batch_total_mass"`
  - fonte da massa usada.
- Manter compatibilidade com `packagingMassKgH` como fallback, sem quebrar dados antigos.

5. Preparar infiltração psicrométrica com fallback seguro
- No cálculo geral ColdPro, usar o método atual como padrão.
- Criar/ajustar função psicrométrica em local permitido (`thermal-calculations.ts` ou `coldpro-calculation.engine.ts`) para calcular por entalpia quando houver dados completos:
  - temperatura/UR externa
  - temperatura/UR interna
  - vazão de infiltração
  - densidade do ar
- Quando dados faltarem, retornar o cálculo simples e warning técnico.
- Registrar `methodUsed`, parcelas e warnings no breakdown.

6. Registrar método no cálculo geral
- Em `src/features/coldpro/coldpro-calculation.engine.ts`, incluir no `calculation_breakdown`:
  - `calculationMethod` com métodos oficiais de transmissão, produto, embalagem, infiltração, internas, túnel e seleção.
  - comparação ASHRAE x ColdPro.
  - origem do túnel como `calculateTunnelEngine`.
- Garantir que o cálculo geral apenas consome o resultado do `tunnelEngine` para túnel, sem recalcular fórmulas paralelas.

7. Atualizar normalizadores e consolidador
- Adicionar `buildCalculationMethodSummary(result)` em `resultNormalizer.ts`.
- Normalizar:
  - `calculationMethod`
  - `engineVersion`
  - `calculatedAt`
  - `ashraeComparisonWarnings`
  - `methodLimitations`
- Propagar no `projectResultConsolidator.ts` um resumo consolidado de métodos/limitações/warnings.

8. Exibir “Método de cálculo utilizado”
- Completar a seção já iniciada em:
  - `ColdProResultCard.tsx`
  - `ColdProReport.tsx`
  - componentes de resultado se aplicável.
- Mostrar cards/accordion com:
  - fórmula
  - status
  - método usado
  - limitações de infiltração, vazão e tempo até núcleo.
- Evitar mudanças no layout geral, apenas adicionar seção técnica.

9. Atualizar PDF/memorial
- Ajustar `ColdProMemorialPdf.tsx` e/ou `coldproMemorialPdfLib.ts` para renderizar a seção “Metodologia de cálculo”.
- Exibir:
  - transmissão `Q = U × A × ΔT`
  - produto sensível/latente/sensível abaixo
  - contínuo por kg/h
  - batelada por massa total/tempo
  - vazão por balanço térmico sensível
  - velocidade por área livre
  - tempo tipo Plank/ASHRAE com limitação
  - seleção por carga requerida e curva real
  - `engine_version`, `calculated_at` e fonte `calculateTunnelEngine` quando existir.
- Não recalcular nada no PDF; apenas renderizar o breakdown salvo.

10. Atualizar contexto da IA técnica
- Em `aiTechnicalContextBuilder.ts`, adicionar `ashraeMethodContext` com:
  - métodos usados
  - limitações
  - comparações
  - ações prioritárias.
- Ajustar o prompt para a IA:
  - não chamar método oficial de errado;
  - tratar infiltração simples como método simplificado permitido;
  - sempre mencionar limitação do tempo até núcleo;
  - alertar massa de embalagem ausente em batelada quando ocorrer.

11. Testes e validação
- Expandir `tunnelEngine.test.ts` com os testes obrigatórios:
  - registry existe;
  - ações ASHRAE prioritárias;
  - embalagem contínua;
  - embalagem batch;
  - método no breakdown;
  - fallback psicrométrico;
  - summary de método.
- Rodar:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

Critérios de aceite cobertos
- Métodos oficiais documentados e tipados.
- Comparação ASHRAE x ColdPro implementada.
- Fórmulas corretas preservadas.
- Embalagem em batelada corrigida.
- Infiltração psicrométrica preparada sem remover método simples.
- Breakdown, tela, relatório, PDF e IA passam a carregar metodologia e limitações.
- Testes, typecheck e build validados.