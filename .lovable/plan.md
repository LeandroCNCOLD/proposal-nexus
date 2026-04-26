## Plano de implementação — Resultado ColdPro

Vou alterar somente o módulo ColdPro e priorizar a correção técnica da leitura da IA antes de ampliar a camada visual.

### 1. Criar a camada central de resultado normalizado
- Criar `src/modules/coldpro/core/resultNormalizer.ts` com `normalizeColdProResult(rawResult, selection?, environment?, products?)`.
- Consolidar em uma estrutura única:
  - resumo executivo: carga requerida, kW, TR, subtotal, segurança, status e sobra;
  - distribuição por componente: transmissão, produto direto, túnel/processo, embalagem, respiração, infiltração, internas, gelo/degelo, outros e segurança;
  - grupos técnicos: transmissão, produto + processo, ar/umidade, cargas internas, gelo/degelo, segurança;
  - validação de túnel;
  - seleção de equipamento;
  - auditoria de consistência.
- Regra crítica: `tunnelProcessKcalH` será tratado como parte de `productsAndProcessKcalH`, nunca como ausência automática de produto.
- Se `productKcalH = 0` e `tunnelProcessKcalH > 0`, o sistema mostrará alerta de classificação, não erro grave.
- Se equipamento selecionado tiver capacidade total > 0 e a auditoria/curva indicar capacidade corrigida 0, marcar divergência crítica.

### 2. Criar auditoria de consistência técnica
- Criar `ResultConsistencyAudit.tsx`.
- Exibir fechamento matemático:
  - soma dos componentes;
  - subtotal validado;
  - segurança;
  - total requerido;
  - diferença em kcal/h e %.
- Alertar claramente sobre:
  - soma dos componentes diferente do subtotal;
  - produto direto zerado com carga em túnel/processo;
  - carga relevante em “Outros”;
  - capacidade corrigida zerada com equipamento selecionado;
  - sobra negativa;
  - possível superdimensionamento.

### 3. Criar gráficos técnicos da aba Resultado
Usar `recharts`, que já existe no projeto.

Componentes novos em `src/modules/coldpro/components/results/`:
- `LoadDistributionPieChart.tsx`
  - donut/pizza por grupos: ambiente, produto + túnel/processo, ar/umidade, internas, gelo/degelo, segurança e outros.
- `LoadBreakdownBarChart.tsx`
  - barras ordenadas do maior para o menor: transmissão, produto, túnel/processo, embalagem, respiração, infiltração, pessoas, iluminação, motores, ventiladores, degelo, gelo, outros e segurança.
- `EquipmentCapacityChart.tsx`
  - comparação visual entre carga requerida, capacidade selecionada e sobra técnica.
- `TunnelValidationCharts.tsx`
  - tempo estimado vs disponível;
  - h base vs h efetivo;
  - vazão estimada vs informada;
  - cards de velocidade, exposição, penetração e dimensão térmica.
- `TemperatureProfileLineChart.tsx`
  - perfil térmico quando houver dados suficientes; caso contrário, card explicando quais dados faltam.
- Bloco visual de gelo/degelo dentro do resultado, com cards e barra de risco.

### 4. Reestruturar a aba Resultado em dashboard
- Atualizar `ColdProResultCard.tsx` para receber também `selection`, `environment` e produtos do ambiente.
- Organizar a tela na sequência:
  1. resumo executivo;
  2. gráficos principais;
  3. auditoria de consistência;
  4. validação térmica do túnel;
  5. seleção de equipamentos;
  6. gelo, umidade e degelo;
  7. tabelas técnicas recolhidas.
- Adicionar toggles/filtros:
  - visualização resumida;
  - visualização detalhada;
  - mostrar auditoria;
  - mostrar gráficos;
  - mostrar IA;
  - mostrar tabelas.
- Deixar tabelas longas em accordions/recolhidas para melhorar leitura.

### 5. Corrigir a IA técnica com contexto estruturado
- Criar `src/modules/coldpro/core/aiTechnicalContextBuilder.ts` com `buildColdProAIContext(normalizedResult)`.
- Atualizar `coldpro-memorial.functions.ts` para gerar o prompt interno a partir do resultado normalizado, e não de texto solto.
- Novo comportamento obrigatório da IA:
  - usar apenas dados estruturados;
  - não inventar valores;
  - não afirmar ausência de carga de produto se existir carga em túnel/processo;
  - diferenciar “produto direto zerado” de “produto calculado como túnel/processo”;
  - tratar divergência de classificação como alerta, não como erro matemático automático.
- Estrutura da resposta da IA:
  1. conclusão executiva;
  2. principais cargas;
  3. validação do túnel;
  4. seleção de equipamentos;
  5. recomendações práticas.

### 6. Criar painel de IA por ação objetiva
- Criar `ColdProAIInsightPanel.tsx`.
- Substituir a IA livre por botões objetivos:
  - Auditar dimensionamento;
  - Explicar maiores cargas;
  - Validar seleção de equipamento;
  - Analisar túnel;
  - Analisar gelo e degelo;
  - Gerar recomendações comerciais;
  - Gerar laudo técnico completo.
- Cada botão enviará uma solicitação específica junto com o contexto técnico normalizado.
- Se `hasCriticalDivergence = true`, exibir aviso antes do laudo final: “Há divergências críticas. Revise antes de emitir laudo final.”

### 7. Melhorar memorial/relatório
- Atualizar `ColdProReport.tsx` para usar o normalizador nos ambientes.
- Incluir no memorial visual:
  - gráfico de cargas por componente;
  - gráfico de capacidade requerida vs selecionada;
  - auditoria de consistência;
  - observação correta sobre túnel/processo;
  - status do equipamento e do túnel.
- Corrigir texto técnico para evitar “Produto = 0, erro grave” quando houver carga em túnel/processo.
- Manter ações existentes: gerar PDF, gerar resumo para proposta, imprimir e enviar para proposta.

### 8. Ajustar PDF do memorial
- Atualizar `coldproMemorialPdfLib.ts` para refletir a auditoria nova e a classificação correta de produto/túnel/processo.
- Incluir seções textuais e, quando viável no PDF atual, gráficos simples desenhados com a própria biblioteca de PDF.
- Garantir que o laudo final não herde a contradição de produto zerado quando o túnel/processo está calculado.

### 9. Validação final
- Rodar typecheck e build ao final.
- Corrigir eventuais erros de tipagem/importação.
- Conferir os critérios de aceite:
  - donut/pizza presente;
  - barras por componente;
  - capacidade requerida vs selecionada;
  - validação visual do túnel;
  - bloco de gelo/degelo claro;
  - auditoria de consistência;
  - IA usando contexto estruturado;
  - IA sem contradição sobre produto/túnel;
  - tabelas longas recolhidas;
  - typecheck e build passando.

## Observação técnica
A implementação será feita sem alterar CRM, Nomus, propostas, sincronização ou módulos fora do ColdPro. As mudanças principais ficarão em `src/components/coldpro`, `src/modules/coldpro` e `src/integrations/coldpro`.