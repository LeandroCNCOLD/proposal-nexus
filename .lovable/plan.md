
## Objetivo

Hoje **Minha Carteira** (`/app/sdr/wallet`) mostra os leads como cards grandes empilhados (~250 px cada). Com 30 leads a página vira uma "folha gigante" e é difícil ter visão do funil. Vamos adicionar uma **visão Kanban** lado a lado, com cards enxutos, e botões de transferência integrados.

## O que muda na tela

### 1) Alternador "Lista / Kanban"
No topo da página, ao lado do contador de leads, dois botões:
- **Lista** — visão atual (mantida, sem regressão para quem prefere).
- **Kanban** — nova visão padrão (preferência salva em `localStorage`).

### 2) Colunas do Kanban
Uma coluna por etapa do funil do SDR, na ordem do processo:

```text
┌─────────────────┬───────────────────────┬──────────────────┬──────────────────────────┬─────────────┐
│ Não Contatado   │ Contatado –           │ Reunião          │ Em Negociação            │ Encerrados  │
│                 │ Aguardando Retorno    │ Agendada         │ com Closer (Vendedor)    │ (Fechado /  │
│                 │                       │                  │                          │  Perdido /  │
│                 │                       │                  │                          │  Kill)      │
└─────────────────┴───────────────────────┴──────────────────┴──────────────────────────┴─────────────┘
```

- A coluna **Reunião Agendada** agrupa leads com `meeting_scheduled = true` (mesmo que `sdr_status` esteja "Contatado").
- A coluna **Em Negociação com Closer** mostra os leads com `handoff_status = 'transferred'` (já passaram para vendedor) — útil para o SDR ver o que ele entregou e acompanhar.
- **Encerrados** vem colapsada por padrão (clica para expandir) — leads "frios" não poluem.

Cada coluna mostra: **título**, **contador de leads** e **soma do valor** (R$).

### 3) Card compacto (~90–110 px)
Mostra só o essencial:
```text
┌───────────────────────────────────────────────┐
│ • Temp ▪ #PROP-123                  R$ 45 mil │  ← linha 1: cor/temperatura + código + valor
│ Cliente Exemplo Ltda                          │  ← linha 2: nome do cliente (truncado)
│ 📞 (47) 9 9999-9999 · 👤 João                 │  ← linha 3: contato + responsável
│ ⏱ 5 dias  · 📅 prox: 12/06                    │  ← linha 4: lock + próximo contato
│ [Ligar] [⋯ menu]                              │  ← linha 5: ação principal + menu
└───────────────────────────────────────────────┘
```
Cor da borda esquerda = temperatura (Quente/Morno/Frio). Click no card abre a página de detalhe do lead.

Menu de ações (⋯) dentro do card:
- **Editar lead** (usa o diálogo criado anteriormente)
- **Transferir para outro SDR** — abre `TransferLeadDialog` (já existe)
- **Transferir para Vendedor (Closer)** — abre `TransferToSellerDialog` (já existe). **Disponível para qualquer SDR dono do lead**, não só gestores (antes só gestores viam o botão "Transferir").
- **Devolver ao banco**

### 4) Drag & drop entre colunas
Arrastar o card para outra coluna atualiza o `sdr_status`/`meeting_scheduled`/`handoff_status` correspondente:

| Coluna alvo | Efeito |
|---|---|
| Não Contatado | `sdr_status = 'Não Contatado'` |
| Contatado – Aguardando Retorno | `sdr_status = 'Contatado - Aguardando Retorno'` |
| Reunião Agendada | abre mini-modal "agendar reunião" (data + closer) e marca `meeting_scheduled=true`, `sdr_status='Reunião Agendada'` |
| Em Negociação com Closer | abre `TransferToSellerDialog` (não muda nada sozinho — exige escolher vendedor) |
| Encerrados | abre mini-modal pedindo motivo (Fechado / Perdido / Kill) |

Toda mudança via drag também registra na auditoria de edição do lead (mesma RPC `update_sdr_lead_fields` quando for campo simples) — ou seja, **histórico de etapa** já fica gravado.

### 5) Filtros rápidos no topo do Kanban
- Busca por texto (cliente / código / CNPJ)
- Temperatura (Quente · Morno · Frio · Todas)
- Esses filtros aplicam em todas as colunas.

## Detalhes técnicos

- **Biblioteca de drag & drop**: `@dnd-kit/core` + `@dnd-kit/sortable` (leve, acessível, padrão no ecossistema React/TanStack). Se ainda não estiver instalado, adicionar.
- **Arquivos novos**:
  - `src/components/sdr/WalletKanban.tsx` — container do Kanban (colunas + DnD context).
  - `src/components/sdr/WalletKanbanCard.tsx` — card compacto + menu de ações.
  - `src/components/sdr/MeetingScheduleQuickDialog.tsx` — mini-modal para "arrastei para Reunião Agendada".
  - `src/components/sdr/CloseLeadDialog.tsx` — mini-modal para "arrastei para Encerrados" (motivo: Fechado, Perdido, Kill + nota).
- **Arquivo alterado**:
  - `src/routes/app.sdr.wallet.tsx` — adiciona toggle Lista/Kanban, persiste preferência, monta `<WalletKanban />`. Mantém `<LeadCard />` no modo Lista.
- **Mutations**:
  - Drag → reusa `updatePipelineField(leadId, 'sdr_status', ...)` e/ou `update_sdr_lead_fields` (RPC) para também gravar no histórico.
  - Reaproveita `TransferLeadDialog` (SDR↔SDR) e `TransferToSellerDialog` (SDR→Vendedor) — nenhuma RPC nova.
- **Permissões**:
  - Qualquer SDR dono do lead pode transferir para vendedor (já permitido pela RPC `handoff_lead_to_seller`).
  - Transferência SDR→SDR continua restrita a gestores.
- **Performance**: usa as mesmas queries (`my-wallet`) — o Kanban é só uma renderização diferente do mesmo array, sem requisições extras.
- **Responsivo**: em telas estreitas (< 1024 px), o Kanban vira scroll horizontal (`overflow-x-auto`) com colunas de largura mínima de 280 px.

## Fora deste escopo (pode entrar depois)

- WIP limits por coluna.
- Visão Kanban para a página do gestor (`Carteiras`) — pode reaproveitar o mesmo componente depois.
- Métricas de tempo médio por coluna (cycle time).

## Resultado esperado

Em vez de rolar uma página gigante, o SDR vê o funil inteiro em uma tela, arrasta para mover etapas, e transfere para vendedor com 2 cliques direto do card.
