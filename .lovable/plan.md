## Objetivo

Reorganizar a navegação do sistema em 5 grupos claros (SDR | Vendas | Relatórios | Operação | Sistema), com Cobertura de Carteira aparecendo em SDR e em Relatórios, e criar uma página consolidada `/app/sdr/relatorios` reunindo as métricas de pré-venda.

## 1. Sidebar — nova estrutura (`src/components/AppShell.tsx`)

Reordenar e reagrupar os itens já existentes. Nada é removido, só remanejado:

**SDR — Pré-Venda**
- Banco de Leads
- Minha Carteira
- War Room — Reunião Diária
- Hot Leads
- Scripts de Ligação
- Cobertura de Carteira *(atalho)*
- Relatórios SDR *(nova rota)*
- Desempenho dos SDRs

**Vendas**
- Minha Carteira (Vendas)
- Funil / CRM
- Propostas
- Pedidos & NF
- Agenda
- Tarefas & Follow-up
- Minhas Atividades
- Desempenho dos Closers

**Relatórios** *(novo grupo)*
- Dashboard Geral
- Relatórios (geral)
- Cobertura de Carteira *(entrada principal)*
- Desempenho dos SDRs
- Desempenho dos Closers
- Relatórios SDR

**Operação**
- Dashboard (home `/app`)
- Gestão de Atividades
- Clientes, Concorrentes, Equipamentos
- ColdPro, Produtos Ashrae, Catálogo ColdPro

**Sistema**
- Aprovações
- Templates de Proposta
- Integração Nomus
- Catálogo API Nomus
- Configurações

**Gestão** (mantida, só para admin/diretoria/gerente_comercial): Carteiras da equipe, Auditoria SDR, Alertas de Tentativas, Usuários.

Observação: itens duplicados entre grupos (Cobertura, Desempenho SDR/Closers) usam o mesmo `to`, então o highlight de rota ativa continua funcionando.

## 2. Nova rota `/app/sdr/relatorios` consolidada

Arquivo: `src/routes/app.sdr.relatorios.tsx`

Página com abas reunindo o que já existe + um resumo:

- **Visão Geral** — KPIs do SDR (leads ativos, contatados na semana, taxa de cobertura, hot leads abertos) puxando dos services já existentes (`services-cobertura`, hot deals, sdr performance).
- **Cobertura** — embute `<CoberturaCarteira />`.
- **Desempenho SDRs** — embute o conteúdo da página atual `app.sdr.sdr-performance.tsx`.
- **Hot Leads** — embute lista de `app.sdr.hot-deals.tsx`.
- **Funil de Pré-Venda** — distribuição de leads por `sdr_status` (gráfico simples a partir de `sdr_leads`).

Implementação: extrair o conteúdo das páginas existentes para componentes reutilizáveis caso ainda estejam inline, ou simplesmente importar o componente já exportado. Sem alteração nas páginas originais — elas continuam acessíveis.

## 3. Detalhes técnicos

- Apenas `AppShell.tsx` é editado para a sidebar.
- Nova rota: `src/routes/app.sdr.relatorios.tsx` usando `createFileRoute("/app/sdr/relatorios")`, layout com `Tabs` do shadcn.
- Reaproveita componentes existentes: `CoberturaCarteira` (`src/modules/crm/components/CoberturaCarteira.tsx`), e o que já estiver exportado de `app.sdr.sdr-performance.tsx` / `app.sdr.hot-deals.tsx`. Se o conteúdo dessas rotas só existir como `component` interno, crio um componente irmão `*.view.tsx` exportado e a rota passa a renderizá-lo (sem mudar a URL ou comportamento).
- `routeTree.gen.ts` é regenerado automaticamente.

## 4. Fora de escopo

- Não mexer em lógica de negócio, RLS, ou banco.
- Não renomear rotas existentes (URLs continuam iguais).
- Não criar novos relatórios além da consolidação acima.
