
-- Helper: can current user access a proposal (mirrors proposals_select)
CREATE OR REPLACE FUNCTION public.can_access_proposal(_proposal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = _proposal_id
      AND (
        p.sales_owner_id = auth.uid()
        OR p.technical_owner_id = auth.uid()
        OR p.created_by = auth.uid()
        OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role, 'diretoria'::app_role, 'admin'::app_role, 'orcamentista'::app_role])
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_proposal(uuid) TO authenticated, service_role;

-- proposal_items: tighten write check
DROP POLICY IF EXISTS items_all ON public.proposal_items;
CREATE POLICY items_select ON public.proposal_items
  FOR SELECT TO authenticated
  USING (public.can_access_proposal(proposal_id));
CREATE POLICY items_write ON public.proposal_items
  FOR ALL TO authenticated
  USING (public.can_access_proposal(proposal_id))
  WITH CHECK (public.can_access_proposal(proposal_id));

-- proposal_tables
DROP POLICY IF EXISTS proposal_tables_select_authenticated ON public.proposal_tables;
DROP POLICY IF EXISTS proposal_tables_insert_authenticated ON public.proposal_tables;
DROP POLICY IF EXISTS proposal_tables_update_authenticated ON public.proposal_tables;
DROP POLICY IF EXISTS proposal_tables_delete_authenticated ON public.proposal_tables;
CREATE POLICY proposal_tables_all ON public.proposal_tables
  FOR ALL TO authenticated
  USING (public.can_access_proposal(proposal_id))
  WITH CHECK (public.can_access_proposal(proposal_id));

-- proposal_competitors
DROP POLICY IF EXISTS prop_competitors_all ON public.proposal_competitors;
CREATE POLICY prop_competitors_all ON public.proposal_competitors
  FOR ALL TO authenticated
  USING (public.can_access_proposal(proposal_id))
  WITH CHECK (public.can_access_proposal(proposal_id));

-- proposal_timeline_events
DROP POLICY IF EXISTS timeline_all ON public.proposal_timeline_events;
CREATE POLICY timeline_all ON public.proposal_timeline_events
  FOR ALL TO authenticated
  USING (public.can_access_proposal(proposal_id))
  WITH CHECK (public.can_access_proposal(proposal_id));

-- proposal_versions
DROP POLICY IF EXISTS versions_all ON public.proposal_versions;
CREATE POLICY versions_all ON public.proposal_versions
  FOR ALL TO authenticated
  USING (public.can_access_proposal(proposal_id))
  WITH CHECK (public.can_access_proposal(proposal_id));

-- Nomus cost/margin data: restrict SELECT to privileged roles
DROP POLICY IF EXISTS nomus_pti_select ON public.nomus_price_table_items;
CREATE POLICY nomus_pti_select ON public.nomus_price_table_items
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role, 'engenharia'::app_role, 'orcamentista'::app_role]));

DROP POLICY IF EXISTS nomus_proposal_items_select ON public.nomus_proposal_items;
CREATE POLICY nomus_proposal_items_select ON public.nomus_proposal_items
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role, 'engenharia'::app_role, 'orcamentista'::app_role]));

DROP POLICY IF EXISTS nomus_proposals_select ON public.nomus_proposals;
CREATE POLICY nomus_proposals_select ON public.nomus_proposals
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente_comercial'::app_role, 'diretoria'::app_role, 'engenharia'::app_role, 'orcamentista'::app_role]));

-- Nomus sync log: admin/diretoria only
DROP POLICY IF EXISTS nomus_log_select ON public.nomus_sync_log;
CREATE POLICY nomus_log_select ON public.nomus_sync_log
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role]));

-- ColdPro catalog: require authentication (was public)
DROP POLICY IF EXISTS coldpro_boosters_select ON public.coldpro_booster_models;
CREATE POLICY coldpro_boosters_select ON public.coldpro_booster_models
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS coldpro_refrigerants_select ON public.coldpro_refrigerants;
CREATE POLICY coldpro_refrigerants_select ON public.coldpro_refrigerants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS coldpro_model_refrigerants_select ON public.coldpro_equipment_model_refrigerants;
CREATE POLICY coldpro_model_refrigerants_select ON public.coldpro_equipment_model_refrigerants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS coldpro_refrigerant_properties_select ON public.coldpro_refrigerant_properties;
CREATE POLICY coldpro_refrigerant_properties_select ON public.coldpro_refrigerant_properties
  FOR SELECT TO authenticated USING (true);
