## Objetivo

Trazer para o detalhe da proposta (`/app/propostas/$id`) o mesmo conceito da **Minha Carteira** (Timeline rica + Tarefas + Agenda + Follow-up sincronizados), e criar uma **Minha Carteira (Vendas)** para vendedores/closers verem as propostas Nomus atribuídas a eles.

---

## 1. Detalhe da proposta — abas unificadas

Substituir o `<Tabs>` atual (Timeline / Versões / Tarefas-em breve) por **4 abas reais**, todas alimentando-se umas das outras:

### 1.1 Timeline unificada
Misturar em uma única lista ordenada por data:
- `proposal_timeline_events` (eventos manuais, status, IA)
- `proposal_send_events` (envios) → ícone Send
- `proposal_send_versions` (PDFs gerados) → ícone FileText
- `proposal_status_history` (mudanças de status) → ícone Badge
- `crm_agenda` ligadas à proposta → ícone Calendar
- `proposal_tasks` concluídas → ícone CheckCircle

Cada item: ícone + descrição curta + data/hora + autor (quando houver).

### 1.2 Aba Tarefas (funcional)
- Lista `proposal_tasks` da proposta atual (ordem: pendentes por due_date, depois concluídas).
- Form inline para criar (título, descrição opcional, due_date, priority, assignee — closers/vendedores via `get_team_members_by_role`).
- Checkbox para marcar como concluída → grava `completed_at` e insere evento na timeline.
- Editar/excluir respeitando policies já existentes.

### 1.3 Aba Agenda (nova)
- Lista `crm_agenda` onde `proposal_number = p.number` (vinculação por número da proposta; já existe coluna).
- Botão "Nova reunião" abre Dialog com: tipo, data/hora, duração, local/link, closer (auto-preenche com `nomus_seller_name`/closer atual), contato, observações.
- Ao salvar → insere em `crm_agenda` (aparece automaticamente em `/app/agenda`) e cria evento na timeline.
- Cada item mostra status (Agendado/Realizado/etc) e ações: Confirmar / Concluir / Cancelar.

### 1.4 Aba Follow-up
- Campos editáveis (mesmo padrão de Minha Carteira): `next_followup_at`, próximo passo (`commercial_notes` ou novo campo), temperatura, probabilidade.
- Botão "Registrar follow-up" insere evento na timeline e atualiza os campos.

Manter aba **Versões** acessível (mover para sub-seção dentro da Timeline ou em accordion separado abaixo).

---

## 2. Nova rota: Minha Carteira (Vendas)

**Arquivo**: `src/routes/app.vendas.carteira.tsx` (rota `/app/vendas/carteira`)

### Conteúdo
- Header: "Minha Carteira (Vendas)" + nome do vendedor + contadores (propostas abertas, valor total em pipeline, fechadas no mês, win rate).
- Lista de propostas onde o usuário logado é o vendedor responsável, agrupadas por status (Em elaboração / Enviada / Em negociação / Ganha / Perdida).
- Cada card: número, cliente, valor, temperatura, próximo follow-up, última atividade, botão "Abrir proposta".
- Filtros: período (presets + custom), status, temperatura, busca por cliente.

### Identificação do vendedor (match híbrido)
1. Se `profiles.nomus_seller_id` (nova coluna) preenchido → match por `nomus_proposals.vendedor_nomus_id`.
2. Senão → match por nome normalizado: `proposals.nomus_seller_name` ou `nomus_proposals.vendedor_nome` ≈ `profiles.full_name` (UPPER + trim).
3. Também incluir propostas onde `proposals.sales_owner_id = auth.uid()` (CN Cold internas).

Query consolidada: união de `proposals` (com join opcional em `nomus_proposals` quando `nomus_proposal_id` existe).

### Menu lateral
Adicionar item "Minha Carteira (Vendas)" em `AppShell.tsx` sob seção VENDAS (criar a seção se não existir) — visível para usuários com role `vendedor`, `gerente_comercial` ou `diretoria`.

---

## 3. Detalhes técnicos

### Migration (única)
1. `ALTER TABLE profiles ADD COLUMN nomus_seller_id text` (nullable) — para o mapeamento explícito futuro.
2. Garantir índices: `proposals(nomus_seller_name)`, `nomus_proposals(vendedor_nomus_id)`, `crm_agenda(proposal_number)` (esse último já existe? confirmar; criar se faltar).
3. Função helper `public.proposals_for_seller(_user_id uuid)` (SECURITY DEFINER, STABLE) que retorna IDs de propostas do vendedor (sales_owner_id OR match nomus). Simplifica RLS/queries.

### Componentes novos
- `src/components/proposal/ProposalTimelineUnified.tsx` — merge das 5 fontes em uma `ol`.
- `src/components/proposal/ProposalTasksTab.tsx` — CRUD de `proposal_tasks`.
- `src/components/proposal/ProposalAgendaTab.tsx` — lista + dialog de `crm_agenda`.
- `src/components/proposal/ProposalFollowupTab.tsx` — form de próximo passo.
- `src/components/vendas/SellerProposalCard.tsx` — card reutilizável.

### Hooks novos
- `src/hooks/use-proposal-tasks.ts`
- `src/hooks/use-proposal-agenda.ts` (lê `crm_agenda` filtrando por `proposal_number`)
- `src/hooks/use-seller-proposals.ts` (carteira do vendedor; usa a função SQL ou query híbrida)

### Sincronização entre telas
- Toda mutação invalida `['proposal-timeline', id]`, `['proposal-agenda', id]`, `['proposal-tasks', id]`, `['agenda']`, `['seller-wallet']`.
- Reunião criada na proposta → aparece em `/app/agenda` (mesma tabela `crm_agenda`).
- Tarefa atribuída ao vendedor logado → aparece em `seller-wallet` como contador "tarefas pendentes".

### Edits em arquivos existentes
- `src/routes/app.propostas.$id.index.tsx` — substituir bloco `<Tabs>` (linhas 461–518) pelos 4 componentes acima; remover `versions` da tabs e renderizar abaixo como bloco recolhível.
- `src/components/AppShell.tsx` — adicionar item de menu (verificar gating por role).
- `src/routeTree.gen.ts` — auto-regenerado pelo plugin (não editar).

---

## 4. Fora de escopo (não fazer agora)
- Tela de cadastro do mapeamento `nomus_seller_id` por usuário (a coluna fica, formulário fica para depois).
- Notificações push de tarefa/reunião nova.
- Mudanças nos módulos `coldpro`/`nomus` (erros pré-existentes não relacionados).
