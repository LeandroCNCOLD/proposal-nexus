
# Plano definitivo: CRM espelhado em `/processos` do Nomus, com sync bidirecional

## O que ficou comprovado pelos probes ao vivo

| Capacidade Nomus | Status | Implicação |
|---|---|---|
| `GET /processos` lista todos os processos | ✅ funciona | Pull funciona em batch + paginação |
| `GET /processos/{id}` | ✅ devolve mesmos campos da listagem | Não há detalhe expandido — campo `descricao` é HTML livre, é onde o vendedor "fala" |
| `GET /processos/{id}/historico|eventos|comentarios` | ❌ 404 em todas variações | **Nomus não expõe histórico/timeline via API** |
| `GET /tiposProcesso` ou `/processos/tipos` | ❌ 404/400 | Tipos descobertos via `DISTINCT tipo` |
| `PUT /processos/{id}` com `{id, etapa}` | ✅ HTTP 200 | **Mover card e editar campos funciona** |
| `POST /processos` payload vazio | 400 (esperado) | Criar processo funciona com payload válido |
| Tipos reais hoje | `Funil de Vendas`, `OBRA`, `PROJETO`, `Antecipação`, `Tarefa de projeto`, `Projeto - Tarefa Analítica` | |

**Decisões que isso força:**
1. O CRM trabalha em cima do **módulo Processos** do Nomus, não num "CRM" separado.
2. O usuário **escolhe quais tipos** quer ver como funil ativo (multi-select). Default: `Funil de Vendas`.
3. Como o Nomus **não tem timeline/comentários nativos**, criamos uma **timeline LOCAL** rica (notas, atividades, mudanças de etapa) que vive 100% no nosso banco. O que sai de lá pro Nomus é refletido no campo `descricao` (apêndice) e no `proximoContato`.

---

## 1. Banco de dados

### Tabela espelho `nomus_processes`
Espelha 1:1 os campos retornados por `/processos`. Não inventa schema "ideal".

```text
nomus_processes
├── nomus_id text UNIQUE NOT NULL
├── nome text, pessoa text, descricao text (HTML)
├── tipo text                    -- discriminador
├── etapa text                   -- estágio livre
├── prioridade text, equipe text, origem text
├── responsavel text, reportador text
├── data_criacao date, data_hora_programada timestamptz, proximo_contato date
├── cliente_id uuid (FK opcional, resolvido por nome)
├── proposal_id uuid (FK opcional, vínculo automático ou manual)
├── raw jsonb                    -- payload bruto sempre preservado
├── synced_at timestamptz, last_pushed_at timestamptz
├── local_dirty boolean          -- marca quando alteração local ainda não foi enviada
└── created_at, updated_at
```

### Tabelas de enriquecimento local (não existem no Nomus)
```text
crm_notes              -- apontamentos textuais por processo (timeline rica)
crm_activities         -- tarefas, ligações, reuniões, visitas, e-mails (com agendamento + resultado)
crm_status_history     -- log automático de mudança de etapa (trigger)
crm_user_funnels       -- preferência por usuário: quais tipos quer ver no Kanban
crm_funnel_stages      -- cache de etapas conhecidas por tipo (descobertas via DISTINCT)
```

### Ajuste em tabela existente
- `proposals.process_id uuid` (FK para `nomus_processes.id`) — vincula proposta ao processo do funil.

### RLS (padrão do projeto)
- `SELECT`: todos autenticados
- `INSERT/UPDATE`: autenticados (`crm_notes`, `crm_activities`, `nomus_processes`)
- `DELETE`: apenas `gerente_comercial`, `diretoria`, `admin`
- Triggers: `set_updated_at` em todas; `log_process_stage_change` grava em `crm_status_history`.

---

## 2. Sincronização bidirecional Nomus ↔ Local

Arquivo: `src/integrations/nomus/process-sync.functions.ts`

### Pull (Nomus → Local)
- `pullNomusProcesses({ tipos?: string[] })` — paginado, faz upsert em `nomus_processes`. Roda no cron de 15min (já temos infra) **e** sob demanda via botão "Sincronizar".
- Sempre que processa, atualiza `crm_funnel_stages` com etapas novas descobertas para cada tipo.
- Resolve `cliente_id` por nome (`pessoa` → `clients.name`) e `proposal_id` se houver match por cliente + janela de data.

### Push (Local → Nomus) — **isso é o que faz o card mover dos dois lados**
- `pushProcessUpdate(processId, patch)` — faz `PUT /processos/{nomus_id}` com `{ id, ...patch }` (validado: PUT 200 confirmado).
- Disparado em 3 cenários:
  1. **Drag-and-drop no Kanban** → muda `etapa` → push imediato.
  2. **Edição inline de `descricao`, `proximoContato`, `prioridade`, `responsavel`** → debounce 1.5s → push.
  3. **Criação de nota** com flag "espelhar no Nomus" → apenda ao `descricao` HTML como bloco datado e faz push.
- `createProcessInNomus(payload)` — `POST /processos` para criar oportunidades novas a partir do nosso app.

### Conflito e dirty-tracking
- Cada `nomus_processes` tem `local_dirty` (alteração local pendente) e `synced_at` (último pull).
- Se o pull traz uma versão mais nova **e** `local_dirty=true`, mostra um banner de conflito no card (raro — em geral push é imediato).

### Realtime no nosso app
- Habilitar Supabase Realtime em `nomus_processes` para que **dois usuários vendo o Kanban vejam o card mover** quando outro vendedor arrasta.

---

## 3. Multi-funil (escolha do usuário)

Pré-requisito do que você pediu — "deixa o usuário selecionar quais funis vai atuar".

- `crm_user_funnels(user_id, tipo, is_active, order)` armazena escolha por usuário.
- Onboarding inicial: ao abrir `/app/crm` pela primeira vez, mostra modal com **todos os tipos descobertos** no Nomus e marca `Funil de Vendas` como default.
- Header da página tem **tabs por funil ativo** (ex: `Funil de Vendas | Funil Pós-venda | OBRA`).
- Botão "Gerenciar funis" abre drawer com toggle de cada tipo + busca para encontrar funis novos descobertos depois.

---

## 4. Páginas e componentes

### `/app/crm` — Pipeline Kanban
- Tabs no topo = funis ativos do usuário.
- Cada tab renderiza um Kanban com **colunas dinâmicas vindas de `crm_funnel_stages`** para aquele `tipo` (não hardcoded — vem do que existe no Nomus).
- Cards mostram: `pessoa`, `nome`, `responsavel`, `prioridade` (badge colorido), dias na etapa, `proximoContato` com SLA, ícone se tem proposta vinculada.
- **Drag-and-drop** entre colunas → optimistic update → `pushProcessUpdate` → grava `crm_status_history`.
- Filtros: responsável, equipe, prioridade, busca por nome/pessoa.
- KPIs no header: total no funil, distribuição por etapa, tempo médio por etapa, propostas vinculadas.

### `/app/crm/$id` — Detalhe do processo
Layout 3 colunas:
- **Esquerda (sticky)**: dados do Nomus (pessoa, responsável, prioridade, dataCriacao, próximo contato), todos editáveis com push automático.
- **Centro — abas:**
  - **Timeline** — feed cronológico unificado: notas locais + atividades concluídas + mudanças de etapa + propostas geradas. **Esta é a "conversa" rica que falta no Nomus.**
  - **Descrição (Nomus)** — editor rich-text que edita o `descricao` HTML do processo. Push em debounce.
  - **Atividades** — agenda de tarefas/ligações/reuniões com botão "Concluir".
  - **Propostas vinculadas** — lista de `proposals` com `process_id = este`.
- **Direita**: ações rápidas (mudar etapa, agendar atividade, registrar nota, criar proposta vinculada, abrir cliente).

### Componentes novos
```text
src/components/crm/
├── CrmKanbanBoard.tsx        # Multi-tab + colunas dinâmicas
├── CrmKanbanCard.tsx
├── CrmFunnelManager.tsx      # Drawer de seleção de funis ativos
├── CrmProcessHeader.tsx
├── CrmTimeline.tsx           # Feed unificado
├── CrmNomusDescriptionEditor.tsx  # Edita descricao com push debounced
├── CrmActivityList.tsx + CrmActivityForm.tsx
├── CrmNotesPanel.tsx         # Notas locais (com toggle "espelhar no Nomus")
├── CrmStageBadge.tsx
└── CrmSlaIndicator.tsx
```

---

## 5. Integração dentro da Proposta

No detalhe `/app/propostas/$id`, painel lateral **"Processo / Funil"**:
- Se `proposal.process_id` existe: mostra etapa atual (com dropdown para mudar — espelha no Nomus), próximo contato, últimas 3 entradas da timeline, botões rápidos (nova nota, agendar atividade, abrir processo completo).
- Se não existe: CTA "Vincular a um processo do funil" com busca por cliente.
- Coluna SLA na listagem de propostas passa a usar `proximo_contato` do processo vinculado quando disponível, com fallback no `updated_at` atual.

---

## 6. Item de menu

`AppShell.tsx` ganha entrada **"Funil / CRM"** com ícone (entre Propostas e Tarefas).

---

## 7. Roteiro de entrega — 3 fases

**Fase 1 — Espelho + Kanban somente leitura**
- Migrations (`nomus_processes`, `crm_funnel_stages`, `crm_user_funnels`).
- `pullNomusProcesses` + cron de 15min.
- `/app/crm` com Kanban + tabs por funil + multi-select de funis.
- Item de menu.

**Fase 2 — Bidirecional + timeline rica**
- `crm_notes`, `crm_activities`, `crm_status_history` + RLS + triggers.
- `pushProcessUpdate` (drag-and-drop + edição inline).
- Página de detalhe `/app/crm/$id` com timeline unificada.
- Realtime no Kanban.

**Fase 3 — Integração proposta + criação a partir do app**
- `proposals.process_id` + painel lateral "Processo" no detalhe da proposta.
- `createProcessInNomus` (criar oportunidade do nosso app).
- SLA evoluído usando `proximo_contato`.

---

## Confirma e eu começo pela Fase 1?

Duas confirmações rápidas antes de codar:

1. **Aceita que a "timeline rica" (conversas, notas, atividades) vive só no nosso banco** e o que vai pro Nomus é apenas: mudança de etapa, edição de `descricao`, `proximoContato`, `prioridade` e `responsavel`? (Porque o Nomus não tem API de comentários — não há onde gravar a conversa lá.)

2. Quando alguém arrasta um card para "Ganha" (ou equivalente no funil), você quer que o sistema **automaticamente sugira/crie a proposta** no nosso app vinculada ao processo, ou esse vínculo é sempre manual?
