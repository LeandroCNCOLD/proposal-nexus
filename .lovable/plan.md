Plano para modernizar os gráficos do ColdPro sem alterar fórmulas de cálculo térmico nem módulos fora do ColdPro.

1. Criar base comum de gráficos ColdPro
- Usar Recharts, que já está instalado no projeto.
- Criar utilitários compartilhados para:
  - conversão kcal/h, kW e TR;
  - cálculo de percentuais;
  - formatação de tooltip;
  - agrupamento de fatias pequenas em “Outras menores”;
  - status técnico da sobra do equipamento.
- Manter cores usando tokens do tema existente (`--chart-*`, `--primary`, `--muted`, `--destructive`), sem cores fixas fora do design system.

2. Criar os novos componentes de gráficos do ambiente
Serão criados em `src/modules/coldpro/components/charts/`:
- `InteractiveLoadPieChart.tsx`
  - donut interativo com tooltip em kcal/h, kW, TR e percentual;
  - card lateral da fatia selecionada;
  - total no centro;
  - oculta valores zerados e agrupa fatias pequenas.
- `LoadRankingBarChart.tsx`
  - barras horizontais ordenadas;
  - alternância de unidade: kcal/h, kW e TR;
  - top 8 por padrão e botão “mostrar todos”.
- `LoadWaterfallChart.tsx`
  - cascata simulada com barras empilhadas/invisíveis: componentes, subtotal, segurança e total requerido.
- `EquipmentCapacityGauge.tsx`
  - gauge técnico da sobra: subdimensionado, atenção, adequado, alto, possível superdimensionamento.
- `CapacityComparisonChart.tsx`
  - comparação carga requerida x capacidade selecionada/instalada.
- `ThermalProfileLineChart.tsx`
  - perfil térmico do produto/túnel quando houver dados suficientes.
- `SimulationMatrixChart.tsx`
  - matriz/scatter de simulação operacional quando houver dados; caso contrário, mostra estado vazio técnico.

3. Aplicar na aba Resultado do Ambiente
- Substituir os gráficos atuais de distribuição e barras simples em `ColdProResultCard.tsx`.
- Layout sugerido:
  - KPIs no topo;
  - donut + barras ordenadas;
  - cascata + gauge;
  - comparativo de capacidade;
  - perfil térmico e matriz de simulação quando aplicável;
  - auditoria e IA logo abaixo.
- A aba Resultado continuará mostrando somente o ambiente selecionado.

4. Criar gráficos do Resultado Geral do Projeto
Criar também:
- `ProjectEnvironmentPieChart.tsx`
  - participação de cada ambiente na carga total;
  - clique destaca ambiente e mostra resumo;
  - botão para abrir ambiente se for viável com callback.
- `ProjectStackedLoadChart.tsx`
  - barras empilhadas por ambiente com transmissão, produto/processo, infiltração/umidade, internas, degelo/gelo e segurança.
- Reutilizar `InteractiveLoadPieChart`, `LoadRankingBarChart` e `CapacityComparisonChart` no escopo global.

5. Aplicar no Relatório Geral do Projeto
- Atualizar `ColdProProjectResultDashboard.tsx` para usar:
  - pizza por ambiente;
  - barras empilhadas por ambiente;
  - distribuição global por categoria;
  - ranking de ambientes por carga;
  - capacidade instalada x carga total.
- Manter o relatório geral separado do Resultado do Ambiente, acessado pelo botão “Gerar relatório geral” em “Ambientes do projeto”.

6. Aplicar também nos relatórios impressos/PDF
- Atualizar `ColdProReport.tsx` para incluir visualizações melhores no relatório consolidado impresso.
- Como impressão/PDF pode não capturar toda interação, os gráficos interativos serão renderizados de forma estática segura no print:
  - distribuição por ambiente;
  - composição por ambiente;
  - distribuição por categoria;
  - comparativo capacidade x carga;
  - gráficos por ambiente dentro de cada seção.
- Preservar tabelas e dados técnicos existentes, apenas melhorar a apresentação visual.

7. Melhorar contexto da IA com resumo dos gráficos
- Atualizar `aiTechnicalContextBuilder.ts` para incluir:
  - maior componente de carga;
  - percentual do maior componente;
  - distribuição por categoria;
  - status da sobra técnica;
  - divergências da auditoria;
  - ambiente dominante no consolidado geral.
- Garantir que a IA diferencie carga de produto direto de carga túnel/processo, sem dizer que produto está zerado quando há carga relevante no processo.

8. Ajustar normalizadores somente para visualização
- Atualizar `environmentResultNormalizer.ts`, `projectResultConsolidator.ts` e/ou `resultNormalizer.ts` apenas para expor dados de gráfico de forma estruturada.
- Não alterar fórmulas de cálculo térmico.
- Não mexer em CRM, Nomus, propostas, sincronização ou módulos fora do ColdPro.

9. Validação
- Rodar verificação TypeScript equivalente ao typecheck do projeto.
- Rodar build de produção.
- Conferir que:
  - não há categorias zeradas nos gráficos;
  - tooltips mostram kcal/h, kW, TR e percentual;
  - Resultado do Ambiente não mistura dados do projeto geral;
  - Resultado Geral mostra os ambientes consolidados;
  - relatórios impressos/PDF exibem gráficos/tabelas sem quebrar layout.

Critério final: dashboard de Resultado do Ambiente e Resultado Geral ficam mais profissionais, interativos e tecnicamente úteis, com gráficos adequados para distribuição, ranking, formação da carga, sobra técnica e capacidade requerida versus instalada.