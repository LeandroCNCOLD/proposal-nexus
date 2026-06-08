## Objetivo

Dar a admin, diretoria e gerente_comercial uma visão completa: abrir a carteira de qualquer vendedor/SDR, transferir itens entre pessoas, auditar tudo que o SDR fez, e ver na proposta a timeline unificada com todo o histórico.

## Quem terá acesso

`admin`, `diretoria`, `gerente_comercial`. Guard com `hasAnyRole([...])` no front e RLS no back (via `has_any_role`).

## Etapa 1 — Base de dados e RLS

- Tornar leitura de outros usuários explícita: a policy `profiles_select_own_or_manager` já existe (etapa anterior). Sem mudança.
- `proposals`: adicionar policy de SELECT/UPDATE para `admin/diretoria/gerente_comercial` se ainda não cobre transferência (verificar — provavelmente já cobre via `can_access_proposal`).
- `sdr_leads`: garantir UPDATE de `assigned_sdr_*` e `locked_by_sdr_*` por gestores.
- Função `transfer_proposal_owner(_proposal_id, _new_user_id, _kind)` (SECURITY DEFINER) que grava em `proposal_timeline_events` o evento `transferencia` (de→para, por quem).
- Função `transfer_sdr_lead(_lead_id, _new_sdr_user_id)` (SECURITY DEFINER) que reatribui e libera lock anterior.
- View leve `vw_seller_wallet_stats` opcional (pode ficar agregado no client) — pulamos por simplicidade.

## Etapa 2 — Rota "Gestão de Carteiras"

Nova rota `/app/gestao/carteiras` (apenas para os 3 papéis):

- Lista de vendedores (perfis com role `vendedor`) e SDRs (role `sdr`) com KPIs por pessoa: propostas abertas, valor em pipeline, ganhas no mês, leads ativos, último contato.
- Clicar em uma pessoa abre painel lateral / página `/app/gestao/carteiras/$userId` com:
  - Aba "Propostas": lista igual a `app.vendas.carteira` mas para aquele user_id.
  - Aba "Leads SDR": lista igual a `app.sdr.wallet` mas para aquele user_id.
  - Aba "Atividade": liga­ções (`crm_call_logs`), notas, mudanças de status (`proposal_status_history`, `crm_stage_changes`) e timeline da pessoa no período selecionado.
- Botão "Transferir" em cada item → dialog para escolher novo responsável, chama a função SQL e invalida queries.

## Etapa 3 — Auditoria SDR

Aba "Atividade" combina:
- `crm_call_logs` por `sdr_id`/`sdr_name`
- `crm_notes` criadas pela pessoa
- `proposal_timeline_events` cujo `created_by = user`
- `crm_stage_changes` por `changed_by`

Filtros: período (7/30/90 dias), tipo de evento, busca. Export CSV.

## Etapa 4 — Histórico completo na proposta

A página `app.propostas.$id.index.tsx` já tem `ProposalTimelineUnified`. Reforços:

- Garantir que a timeline mostre, além do que já mostra: ligações SDR (`crm_call_logs` ligadas via `lead_code`/`nomus_id`/`proposal_id`), mudanças de status (`proposal_status_history`), transferências, follow-ups, e envios de PDF.
- Cabeçalho "Atribuições": vendedor, técnico, SDR, com botão "Transferir" (gestores apenas).
- Painel "Última atividade" no topo do detalhe: quem fez, o quê, quando.

## Sidebar

Novo grupo "Gestão" visível só para gestores:
- "Carteiras da equipe" → `/app/gestao/carteiras`
- "Auditoria SDR" → `/app/gestao/auditoria-sdr` (página dedicada com mesma aba de atividade, escopo time)

## Detalhes técnicos

- Front: TanStack Router + Query, shadcn. Reaproveitar `useSellerProposals` parametrizando por `userId` (criar `useSellerProposalsFor(userId)`); o RPC `proposals_for_seller(_user_id)` já aceita um id arbitrário.
- Auditoria via queries diretas em `crm_call_logs`, `crm_notes`, `proposal_timeline_events`, filtrando por usuário e período. Sem nova tabela.
- Transferência: RPCs `transfer_proposal_owner` e `transfer_sdr_lead` com `has_any_role` interno. Lançam erro se chamador não for gestor.
- Sidebar usa `hasAnyRole(['admin','diretoria','gerente_comercial'])` para mostrar o grupo.

## Fora de escopo

- Não mexer no fluxo de auth.
- Não mexer nos erros pré-existentes de `coldpro`/`nomus` (não são causados por estas mudanças).
- Não criar novos buckets nem alterar templates.

## Ordem de entrega

1. Migration (policies + RPCs de transferência).
2. Hook `useSellerProposalsFor(userId)` + componentes reutilizáveis.
3. Rotas `/app/gestao/carteiras` e `/app/gestao/carteiras/$userId`.
4. Aba "Atividade" + rota `/app/gestao/auditoria-sdr`.
5. Reforço do detalhe da proposta (cabeçalho de atribuições + botão transferir + garantir timeline completa).
6. Sidebar.
