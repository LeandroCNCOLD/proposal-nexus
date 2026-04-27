Plano de correção global ColdPro

Objetivo
Impedir que qualquer ambiente/processo ColdPro seja tratado como cálculo final válido quando parcelas obrigatórias estiverem zeradas ou ausentes, especialmente túneis/blast freezer com produto/processo zerado, infiltração zerada e degelo zerado.

Restrições respeitadas
- Não alterar fórmulas físicas já validadas.
- Não refazer o motor térmico.
- Não alterar layout global, sidebar, topbar, CSS global, backend estrutural ou banco.
- Atuar em validação, auditoria, status, bloqueio, consolidação, seleção e relatórios.

Implementação proposta

1. Criar uma auditoria global de consistência ColdPro
- Adicionar um módulo compartilhado em `src/modules/coldpro/core/` para classificar o cálculo com status técnico separado:
  - `VALID`
  - `WARNING`
  - `BLOCKED`
  - `INVALID_INPUT`
- A auditoria receberá ambiente, resultado, túnel, produtos, processos especiais e seleção.
- Ela retornará:
  - `technicalStatus`
  - `isBlocked`
  - `isPreliminary`
  - `criticalWarnings`
  - `warnings`
  - `blockers`
  - `displayApplicationLabel`

2. Regras globais de bloqueio para túneis/blast freezer
Aplicar para tipos equivalentes:
- `blast_freezer`
- `freezing_tunnel`
- `cooling_tunnel`
- `tunnel`
- `static_pallet`
- `static_cart`
- `continuous_belt`
- `spiral_girofreezer`
- `fluidized_bed`

Critérios:
- Massa de produto/processo deve ser > 0.
- Tempo de processo ou fluxo kg/h deve ser > 0.
- Temperatura de entrada e final devem estar informadas.
- Propriedades térmicas essenciais devem ser válidas.
- Carga de produto/processo deve ser > 0.

Se produto/processo estiver zerado:
- Status técnico = `BLOCKED` ou `INVALID_INPUT`.
- Nunca permitir status final `ADEQUADO`.
- Gerar bloqueio crítico:
  “Produto/processo zerado em túnel ou blast freezer. Carga térmica inválida.”

3. Regras para ambiente negativo, infiltração e degelo
- Se temperatura interna < 0°C e degelo = 0: gerar bloqueio/alerta crítico conforme auditoria atual, mantendo a mensagem:
  “Câmara negativa com degelo equivalente zerado; revisar umidade, infiltração e premissas de degelo.”
- Se ambiente negativo tiver porta/abertura/operação e infiltração = 0: gerar alerta crítico.
- Se porta = 0 e infiltração = 0 em ambiente negativo: gerar alerta:
  “Infiltração zerada em ambiente negativo. Validar portas, abertura e operação real.”
- Se realmente não houver porta operacional, exigir premissa/alerta:
  “Ambiente sem abertura operacional informada.”

4. Preservar regra de conservação para câmaras
- `cold_room` / `chilled_room`: produto pode ser zero quando for apenas conservação.
- `freezer_room` / armazenamento congelado: produto pode ser zero em conservação, mas degelo e infiltração entram na auditoria.
- Se houver produto cadastrado ou renovação/entrada de produto, validar que a carga de produto foi calculada.

5. Integrar a auditoria no motor e no resultado normalizado
Arquivos previstos:
- `src/modules/coldpro/core/validators.ts`
- `src/modules/coldpro/engines/tunnelEngine.ts`
- `src/features/coldpro/coldpro-calculation.engine.ts`
- `src/modules/coldpro/core/resultNormalizer.ts`
- `src/modules/coldpro/core/environmentResultNormalizer.ts`
- `src/modules/coldpro/core/projectResultConsolidator.ts`

Ajustes:
- O `tunnelEngine` continuará calculando as mesmas cargas, mas passará a classificar corretamente `missing_data`/`invalid_input` quando produto/processo obrigatório estiver incompleto.
- `calculateColdProLoad` adicionará alertas/bloqueios em `calculation_breakdown.validation_alerts` e `thermalCalculationResult`.
- `normalizeColdProResult` exporá `technicalStatus`, `isBlocked`, `isPreliminary` e warnings consolidados.
- `projectResultConsolidator` marcará o projeto como `WARNING` ou `BLOCKED` se qualquer ambiente crítico estiver bloqueado.

6. Separar status térmico de status de equipamento
- A seleção pode informar “atende à carga calculada”, mas não poderá transformar cálculo bloqueado em final válido.
- Se cálculo estiver bloqueado:
  - `status_dimensionamento` não será `ADEQUADO` final.
  - `emissao_permitida` será `PRELIMINAR` ou `BLOQUEADA`.
  - O memorial exibirá que o resultado é preliminar/bloqueado.

7. Bloquear seleção automática final quando cálculo estiver bloqueado
Arquivo previsto:
- `src/features/coldpro/coldpro.functions.ts`
- `src/routes/app.coldpro.$id.tsx`

Comportamento:
- `autoSelectColdProEquipment` verificará o status técnico antes de salvar seleção final.
- Se bloqueado, não salvará seleção automática final e retornará alerta:
  “Seleção baseada em carga preliminar inválida/incompleta.”
- Na tela, o botão de seleção automática ficará desabilitado ou exibirá erro claro quando o cálculo estiver bloqueado.
- A pré-seleção automática pós-cálculo para blast freezer/túnel também respeitará esse bloqueio.

8. Corrigir nomenclatura exibida
- Criar mapeamento de label por tipo real:
  - `blast_freezer` → “Blast freezer”
  - `freezing_tunnel` / `tunnel` / equivalentes → “Túnel de congelamento”
  - `cooling_tunnel` → “Túnel de resfriamento”
  - `cold_room` → “Câmara fria”
  - `freezer_room` → “Câmara de congelados”
- Usar esse label em tela, relatório e PDF para impedir que blast freezer apareça como `cold_room`.

9. Atualizar relatório, memorial e PDF
Arquivos previstos:
- `src/components/coldpro/ColdProReport.tsx`
- `src/integrations/coldpro/coldproMemorialPdfLib.ts`
- componentes de resultado ColdPro que exibem auditoria/status

Comportamento:
- Quando houver bloqueio, exibir destaque visual de alerta/vermelho.
- Mostrar texto:
  “Resultado preliminar. Corrigir dados obrigatórios antes da emissão técnica.”
- No laudo final/PDF, impedir conclusão como `ADEQUADO` final quando `technicalStatus` for bloqueado.
- Incluir lista de bloqueios e warnings críticos no memorial.

10. Auditoria matemática adicional
Adicionar validações sem alterar fórmulas:
- Total requerido >= subtotal válido.
- Total requerido não pode ser menor que carga de produto/processo.
- Produto/processo não pode ser 0 em túnel/blast freezer.
- Se túnel/blast freezer e total < 10.000 kcal/h: warning, sem bloqueio automático:
  “Carga térmica baixa para túnel de congelamento. Validar massa, tempo e produto.”

11. Caso obrigatório “Túnel Rafa”
Validar com cenário:
- volume 67,54 m³
- temperatura interna -25°C
- ambiente externo 35°C
- tipo `blast_freezer`
- carga atual 4.200 kcal/h
- produto = 0
- infiltração = 0
- porta = 0
- degelo = 0

Resultado esperado após correção:
- Cálculo não aparece como `ADEQUADO` final.
- Status técnico = `BLOCKED`/`INVALID_INPUT`.
- Bloqueio por produto/processo zerado.
- Alerta de infiltração/porta.
- Alerta de degelo zerado em negativo.
- Relatório indica preliminar/bloqueado.
- Seleção CN 600 LT não valida o projeto como final.

12. Caso com produto correto
Criar teste/cenário local de validação com produto/processo preenchido para o mesmo túnel, buscando carga próxima de 17.000 kcal/h conforme premissas informadas.
Resultado esperado:
- Status térmico pode voltar para `VALID` ou `WARNING`.
- Seleção recalcula com carga real.
- Equipamento pequeno deixa de ser adequado se a capacidade for insuficiente.

Validação final
- Rodar busca por mensagens e status para garantir que `ADEQUADO` não sobrescreve cálculo bloqueado.
- Rodar typecheck.
- Rodar build.
- Retornar:
  1. arquivos alterados;
  2. regras globais implementadas;
  3. resultado Túnel Rafa antes/depois;
  4. warnings/bloqueios gerados;
  5. confirmação de que fórmulas físicas não foram alteradas;
  6. confirmação de typecheck/build.