
# Plano: Handoff SDR → Closer mais inteligente

Hoje o repasse é 100% manual via `TransferToSellerDialog` → RPC `handoff_lead_to_seller`. Vamos fechar os 4 gaps principais sem quebrar o fluxo manual existente.

## 1. Gatilho automático: "reunião marcada" sugere handoff

Quando o SDR registra uma ligação em `crm_call_logs` com `meeting_booked = true` (ou muda a temperatura para "Quente"/"Muito Quente"), o sistema deve **propor o handoff** ao final do `CallLogDrawer`:

- Após salvar a call log, abre um modal: "Reunião marcada — transferir lead para um vendedor agora?"
- Lista vendedores (já temos `useTeamRoster("vendedor")`).
- Sugere o vendedor com **menos leads em aberto** (round-robin assistido — ver §4). SDR pode trocar.
- Confirma → chama `handoff_lead_to_seller` existente.
- "Pular" mantém o lead na carteira do SDR.

Não automatizamos sem confirmação — o SDR sempre vê e aprova.

## 2. Notificação para o Closer

Criar tabela `user_notifications` simples e disparar um registro no momento do handoff.

- Trigger `AFTER UPDATE` em `sdr_leads` quando `handoff_status` muda para `'transferred'`: insere notificação para `transferred_to_seller_id`.
- Componente `NotificationBell` no `AppShell` (badge com contagem de não lidas, popover com a lista, clique → vai para `/app/sdr/leads/$id`).
- Hook `useNotifications` com realtime (`supabase.channel`) para atualizar em tempo real.

## 3. Timeline unificada Lead ↔ Proposta

Quando o closer abrir o lead recebido (ou a proposta vinculada), ele precisa ver TUDO que o SDR fez antes.

- Componente `LeadHistoryTimeline` que consolida e ordena por data:
  - `crm_call_logs` do lead (todas as ligações + resultado + observação)
  - `sdr_followups` do lead
  - Mudanças de `sdr_status` / `temperature` (já temos `crm_stage_changes` para CRM; criar análogo `sdr_lead_events` se necessário, ou derivar do `updated_at`)
  - Evento "Transferido para closer X em DD/MM"
- Adicionar essa timeline em:
  - `/app/sdr/leads/$id` (aba "Histórico")
  - `/app/propostas/$id` (quando a proposta tem `lead_id` cruzado via `v_proposal_lead_matches`, mostrar o histórico SDR acima da timeline da proposta)

## 4. Distribuição round-robin assistida

Já que o handoff é manual, ajudamos o SDR a escolher de forma justa:

- No `TransferToSellerDialog`, ao lado de cada vendedor mostrar: "X leads ativos" (count em `sdr_leads` onde `transferred_to_seller_id = vendedor` e status ≠ Fechado/Perdido).
- Botão "Sugerir automaticamente" → seleciona o vendedor com menor carga ativa.
- Gestor (`is_team_manager`) pode forçar manual sem ver a sugestão.

## 5. Página do closer: "Leads recebidos hoje"

- Em `/app/agenda` (landing do vendedor) adicionar bloco no topo: "Novos leads do SDR" usando `HandoffLeadsForSeller` já existente, mas com badge "novo" para leads transferidos < 24h e ainda não abertos pelo closer.
- Adicionar coluna `first_opened_by_seller_at` em `sdr_leads` para marcar quando o closer viu pela primeira vez.

---

## Detalhes técnicos

**Banco (uma migration):**
- `ALTER TABLE sdr_leads ADD COLUMN first_opened_by_seller_at timestamptz`
- `CREATE TABLE user_notifications (id, user_id, type, title, body, link_to, read_at, created_at)` + GRANTs + RLS (usuário só vê as suas)
- `CREATE TRIGGER` em `sdr_leads` AFTER UPDATE OF handoff_status → INSERT em `user_notifications` quando vira `'transferred'`
- `CREATE TABLE sdr_lead_events (id, lead_id, event_type, description, payload jsonb, created_by, created_at)` para timeline (opcional — pode-se derivar tudo de tabelas existentes)
- Opcional: função RPC `suggest_seller_for_handoff()` que retorna o vendedor com menor carga.

**Frontend:**
- `src/hooks/use-notifications.ts` (com realtime)
- `src/components/NotificationBell.tsx` no header do `AppShell`
- `src/components/sdr/LeadHistoryTimeline.tsx`
- Atualizar `CallLogDrawer.tsx` para abrir `TransferToSellerDialog` após `meeting_booked = true`
- Atualizar `TransferToSellerDialog.tsx` para mostrar carga por vendedor + botão "sugerir"
- Marcar `first_opened_by_seller_at` em loader/efeito da rota `/app/sdr/leads/$id` quando o usuário logado é o `transferred_to_seller_id`
- Adicionar bloco "Novos leads recebidos" em `/app/agenda`
- Adicionar aba "Histórico SDR" em `/app/sdr/leads/$id` e seção em `/app/propostas/$id` para leads vinculados

**Sem mudanças em:** fluxo manual atual (`handoff_lead_to_seller`), banco de propostas, carteira do SDR — tudo continua funcionando como hoje, só ganha automação opcional e visibilidade.

---

Posso ajustar escopo (ex.: fazer só §1 + §2 primeiro, deixar timeline e round-robin para depois) — me diga se quer assim ou tudo de uma vez.
