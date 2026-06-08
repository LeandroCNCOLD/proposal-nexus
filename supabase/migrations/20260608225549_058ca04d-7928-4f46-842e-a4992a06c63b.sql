-- =========================================================================
-- ETAPA 1: Otimização segura de performance (sem VACUUM)
-- =========================================================================

-- 1) Remover índices duplicados
DROP INDEX IF EXISTS public.idx_nomus_proposals_vendedor;
DROP INDEX IF EXISTS public.idx_send_versions_proposal;
DROP INDEX IF EXISTS public.idx_proposals_sales_owner;

-- 2) Criar índices em FKs prioritárias

-- Propostas
CREATE INDEX IF NOT EXISTS idx_proposals_created_by           ON public.proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_proposals_technical_owner_id   ON public.proposals(technical_owner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_contact_id           ON public.proposals(contact_id);
CREATE INDEX IF NOT EXISTS idx_proposals_price_table_id       ON public.proposals(price_table_id);
CREATE INDEX IF NOT EXISTS idx_proposals_payment_term_id      ON public.proposals(payment_term_id);
CREATE INDEX IF NOT EXISTS idx_proposals_financial_preset_id  ON public.proposals(financial_preset_id);
CREATE INDEX IF NOT EXISTS idx_proposals_last_sync_run_id     ON public.proposals(last_sync_run_id);

-- Itens / timeline
CREATE INDEX IF NOT EXISTS idx_proposal_items_equipment_id        ON public.proposal_items(equipment_id);
CREATE INDEX IF NOT EXISTS idx_proposal_items_last_sync_run_id    ON public.proposal_items(last_sync_run_id);
CREATE INDEX IF NOT EXISTS idx_proposal_timeline_events_user_id   ON public.proposal_timeline_events(user_id);

-- Clientes / contatos
CREATE INDEX IF NOT EXISTS idx_clients_created_by              ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_last_sync_run_id        ON public.clients(last_sync_run_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id       ON public.client_contacts(client_id);

-- Nomus
CREATE INDEX IF NOT EXISTS idx_nomus_proposals_last_sync_run_id      ON public.nomus_proposals(last_sync_run_id);
CREATE INDEX IF NOT EXISTS idx_nomus_proposal_items_last_sync_run_id ON public.nomus_proposal_items(last_sync_run_id);

-- CRM / SDR
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_by       ON public.crm_activities(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_activities_completed_by     ON public.crm_activities(completed_by);
CREATE INDEX IF NOT EXISTS idx_crm_activities_reschedule_of    ON public.crm_activities(reschedule_of);
CREATE INDEX IF NOT EXISTS idx_sdr_lead_tratativas_created_by  ON public.sdr_lead_tratativas(created_by);

-- Auditoria / IA
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id          ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_by      ON public.ai_insights(created_by);

-- 3) Atualizar estatísticas
ANALYZE public.proposals;
ANALYZE public.proposal_items;
ANALYZE public.proposal_timeline_events;
ANALYZE public.clients;
ANALYZE public.client_contacts;
ANALYZE public.nomus_proposals;
ANALYZE public.nomus_proposal_items;
ANALYZE public.crm_activities;
ANALYZE public.audit_logs;