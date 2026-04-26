Plano para instalar e acoplar todos os sistemas de gráficos citados

1. Instalar bibliotecas de gráficos
- Manter `recharts`, que já está instalado.
- Adicionar `chart.js` e `react-chartjs-2`.
- Adicionar `echarts` e `echarts-for-react`.
- Adicionar `@nivo/*` necessário para pizza, barras, linhas e radar.
- Adicionar `@tremor/react` para componentes rápidos de dashboard.

2. Criar uma camada única de gráficos do sistema
- Criar componentes reutilizáveis para:
  - Pizza / rosca
  - Barras verticais
  - Barras horizontais
  - Linhas
  - Área
  - Radar
  - KPI cards
- Esses componentes usarão tokens visuais do projeto, sem cores fixas diretas nos componentes.

3. Criar uma página/área de demonstração de relatórios
- Adicionar uma seção em Relatórios com exemplos reais de cada ferramenta:
  - Recharts
  - Chart.js
  - ECharts
  - Nivo
  - Tremor
- A ideia é permitir comparar visualmente qual biblioteca fica melhor antes de padronizar o uso.

4. Preparar uso nos módulos existentes
- Deixar pronto para conectar gráficos a:
  - CRM / Funil
  - Propostas
  - Nomus
  - ColdPro
  - Vendas por período
  - Clientes por vendedor
  - Carga térmica por componente

5. Validação
- Rodar build para garantir que as bibliotecas são compatíveis com o projeto.
- Se alguma biblioteca não for compatível com o ambiente do app, remover essa dependência e deixar registrada a alternativa recomendada.

Detalhe técnico
- A implementação será feita sem mexer na estrutura base do TanStack Start.
- Os gráficos interativos ficarão no lado cliente.
- Para relatórios em PDF, manteremos a lógica atual separada e só integraremos gráficos exportáveis depois se necessário.

Resultado esperado
- O sistema ficará com as principais bibliotecas de gráficos instaladas.
- Você terá uma base pronta para escolher ou combinar tipos de gráfico nos relatórios.
- A recomendação final ainda deverá ser padronizar em 1 ou 2 bibliotecas para não deixar o sistema pesado demais.