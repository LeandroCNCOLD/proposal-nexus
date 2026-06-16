
-- 1. ai_insights SELECT
DROP POLICY IF EXISTS insights_select ON public.ai_insights;
CREATE POLICY insights_select ON public.ai_insights FOR SELECT
USING (
  proposal_id IS NULL AND public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role,'orcamentista'::app_role])
  OR (proposal_id IS NOT NULL AND public.can_access_proposal(proposal_id))
);

-- 2. crm_attachments SELECT
DROP POLICY IF EXISTS attach_select ON public.crm_attachments;
CREATE POLICY attach_select ON public.crm_attachments FOR SELECT
USING (uploaded_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- 3. crm_followups SELECT
DROP POLICY IF EXISTS followups_select ON public.crm_followups;
CREATE POLICY followups_select ON public.crm_followups FOR SELECT
USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- 4. crm_notes SELECT
DROP POLICY IF EXISTS notes_select ON public.crm_notes;
CREATE POLICY notes_select ON public.crm_notes FOR SELECT
USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- 5. outbound_sync_queue SELECT
DROP POLICY IF EXISTS outbound_sync_queue_select ON public.outbound_sync_queue;
CREATE POLICY outbound_sync_queue_select ON public.outbound_sync_queue FOR SELECT
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role]));

-- 6. proposal_document_assets SELECT
DROP POLICY IF EXISTS proposal_document_assets_select ON public.proposal_document_assets;
CREATE POLICY proposal_document_assets_select ON public.proposal_document_assets FOR SELECT
USING (public.can_access_proposal(proposal_id));

-- 7. proposal_send_events SELECT
DROP POLICY IF EXISTS send_events_select ON public.proposal_send_events;
CREATE POLICY send_events_select ON public.proposal_send_events FOR SELECT
USING (public.can_access_proposal(proposal_id));

-- 8. proposal_send_versions SELECT
DROP POLICY IF EXISTS send_versions_select ON public.proposal_send_versions;
CREATE POLICY send_versions_select ON public.proposal_send_versions FOR SELECT
USING (public.can_access_proposal(proposal_id));

-- 9. proposal_status_history SELECT
DROP POLICY IF EXISTS status_history_select ON public.proposal_status_history;
CREATE POLICY status_history_select ON public.proposal_status_history FOR SELECT
USING (public.can_access_proposal(proposal_id));

-- 10. sync_row_logs SELECT
DROP POLICY IF EXISTS sync_row_logs_select ON public.sync_row_logs;
CREATE POLICY sync_row_logs_select ON public.sync_row_logs FOR SELECT
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role]));

-- 11. coldpro_projects: restrict reads + writes to engineering/manager roles
DROP POLICY IF EXISTS "ColdPro projects readable by authenticated users" ON public.coldpro_projects;
DROP POLICY IF EXISTS "ColdPro projects creatable by authenticated users" ON public.coldpro_projects;
DROP POLICY IF EXISTS "ColdPro projects editable by authenticated users" ON public.coldpro_projects;

CREATE POLICY "ColdPro projects readable by engineering and managers" ON public.coldpro_projects
FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

CREATE POLICY "ColdPro projects creatable by engineering and managers" ON public.coldpro_projects
FOR INSERT WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

CREATE POLICY "ColdPro projects editable by engineering and managers" ON public.coldpro_projects
FOR UPDATE USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- 12. coldpro_environments: same scoping
DROP POLICY IF EXISTS "ColdPro environments readable through project" ON public.coldpro_environments;
DROP POLICY IF EXISTS "ColdPro environments creatable through project" ON public.coldpro_environments;
DROP POLICY IF EXISTS "ColdPro environments editable through project" ON public.coldpro_environments;

CREATE POLICY "ColdPro environments readable by engineering and managers" ON public.coldpro_environments
FOR SELECT USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

CREATE POLICY "ColdPro environments creatable by engineering and managers" ON public.coldpro_environments
FOR INSERT WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

CREATE POLICY "ColdPro environments editable by engineering and managers" ON public.coldpro_environments
FOR UPDATE USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'orcamentista'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- 13. Storage: scope proposal-pdfs reads to users who can access the proposal (first path segment = proposal_id)
DROP POLICY IF EXISTS proposal_pdfs_select ON storage.objects;
CREATE POLICY proposal_pdfs_select ON storage.objects FOR SELECT
USING (
  bucket_id = 'proposal-pdfs'
  AND public.can_access_proposal( (split_part(name, '/', 1))::uuid )
);

-- 14. Fix function search_path
ALTER FUNCTION public.calcular_temperatura_lead() SET search_path = public;
