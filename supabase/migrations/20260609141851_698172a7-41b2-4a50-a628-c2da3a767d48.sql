
-- =========================================================
-- Tighten RLS across CRM, sales leads and Nomus financial tables
-- =========================================================

-- Helper roles used below
-- managers/admin = admin, diretoria, gerente_comercial
-- financial-capable = admin, diretoria, gerente_comercial, administrativo

-- ---------- crm_agenda ----------
DROP POLICY IF EXISTS agenda_all ON public.crm_agenda;
CREATE POLICY crm_agenda_select ON public.crm_agenda
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.sdr_leads l
      WHERE l.id = crm_agenda.pipeline_id
        AND (l.sdr_id = auth.uid()
             OR l.locked_by_sdr_id = auth.uid()
             OR l.closer_id = auth.uid()
             OR l.transferred_to_seller_id = auth.uid())
    )
  );
CREATE POLICY crm_agenda_write ON public.crm_agenda
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.sdr_leads l
      WHERE l.id = crm_agenda.pipeline_id
        AND (l.sdr_id = auth.uid()
             OR l.locked_by_sdr_id = auth.uid()
             OR l.closer_id = auth.uid()
             OR l.transferred_to_seller_id = auth.uid())
    )
  );
CREATE POLICY crm_agenda_update ON public.crm_agenda
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.sdr_leads l
      WHERE l.id = crm_agenda.pipeline_id
        AND (l.sdr_id = auth.uid()
             OR l.locked_by_sdr_id = auth.uid()
             OR l.closer_id = auth.uid()
             OR l.transferred_to_seller_id = auth.uid())
    )
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.sdr_leads l
      WHERE l.id = crm_agenda.pipeline_id
        AND (l.sdr_id = auth.uid()
             OR l.locked_by_sdr_id = auth.uid()
             OR l.closer_id = auth.uid()
             OR l.transferred_to_seller_id = auth.uid())
    )
  );
CREATE POLICY crm_agenda_delete ON public.crm_agenda
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[]));

-- ---------- crm_call_logs ----------
DROP POLICY IF EXISTS crm_call_logs_all ON public.crm_call_logs;
CREATE POLICY crm_call_logs_select ON public.crm_call_logs
  FOR SELECT TO authenticated
  USING (
    sdr_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  );
CREATE POLICY crm_call_logs_insert ON public.crm_call_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    sdr_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  );
CREATE POLICY crm_call_logs_update ON public.crm_call_logs
  FOR UPDATE TO authenticated
  USING (
    sdr_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  )
  WITH CHECK (
    sdr_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  );
CREATE POLICY crm_call_logs_delete ON public.crm_call_logs
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[]));

-- ---------- crm_weekly_reviews ----------
DROP POLICY IF EXISTS crm_weekly_all ON public.crm_weekly_reviews;
CREATE POLICY crm_weekly_reviews_manage ON public.crm_weekly_reviews
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[]));

-- ---------- nomus_invoices ----------
DROP POLICY IF EXISTS nomus_invoices_select ON public.nomus_invoices;
CREATE POLICY nomus_invoices_select ON public.nomus_invoices
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial','administrativo']::app_role[]));

-- ---------- nomus_receivables ----------
DROP POLICY IF EXISTS nomus_receivables_select ON public.nomus_receivables;
CREATE POLICY nomus_receivables_select ON public.nomus_receivables
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial','administrativo']::app_role[]));

-- ---------- nomus_pedidos ----------
DROP POLICY IF EXISTS nomus_pedidos_select ON public.nomus_pedidos;
CREATE POLICY nomus_pedidos_select ON public.nomus_pedidos
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial','administrativo','orcamentista']::app_role[]));

-- ---------- nomus_pedido_items ----------
DROP POLICY IF EXISTS nomus_pedido_items_select ON public.nomus_pedido_items;
CREATE POLICY nomus_pedido_items_select ON public.nomus_pedido_items
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial','administrativo','orcamentista']::app_role[]));

-- ---------- nomus_representatives ----------
DROP POLICY IF EXISTS nomus_representatives_select ON public.nomus_representatives;
CREATE POLICY nomus_representatives_select ON public.nomus_representatives
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[]));

-- ---------- nomus_sellers ----------
DROP POLICY IF EXISTS nomus_sellers_select ON public.nomus_sellers;
CREATE POLICY nomus_sellers_select ON public.nomus_sellers
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[]));

-- ---------- sdr_lead_tratativas ----------
DROP POLICY IF EXISTS tratativas_select ON public.sdr_lead_tratativas;
CREATE POLICY tratativas_select ON public.sdr_lead_tratativas
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.sdr_leads l
      WHERE l.id = sdr_lead_tratativas.lead_id
        AND (l.sdr_id = auth.uid()
             OR l.locked_by_sdr_id = auth.uid()
             OR l.closer_id = auth.uid()
             OR l.transferred_to_seller_id = auth.uid())
    )
  );

-- ---------- sdr_leads ----------
DROP POLICY IF EXISTS crm_pipeline_select ON public.sdr_leads;
DROP POLICY IF EXISTS crm_pipeline_insert ON public.sdr_leads;
DROP POLICY IF EXISTS crm_pipeline_update ON public.sdr_leads;
DROP POLICY IF EXISTS crm_pipeline_delete ON public.sdr_leads;
DROP POLICY IF EXISTS sdr_leads_manager_select ON public.sdr_leads;

CREATE POLICY sdr_leads_select ON public.sdr_leads
  FOR SELECT TO authenticated
  USING (
    sdr_id = auth.uid()
    OR locked_by_sdr_id = auth.uid()
    OR closer_id = auth.uid()
    OR transferred_to_seller_id = auth.uid()
    OR public.is_team_manager(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  );
CREATE POLICY sdr_leads_insert ON public.sdr_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
  );
CREATE POLICY sdr_leads_update ON public.sdr_leads
  FOR UPDATE TO authenticated
  USING (
    sdr_id = auth.uid()
    OR locked_by_sdr_id = auth.uid()
    OR closer_id = auth.uid()
    OR transferred_to_seller_id = auth.uid()
    OR public.is_team_manager(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  )
  WITH CHECK (
    sdr_id = auth.uid()
    OR locked_by_sdr_id = auth.uid()
    OR closer_id = auth.uid()
    OR transferred_to_seller_id = auth.uid()
    OR public.is_team_manager(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  );
CREATE POLICY sdr_leads_delete ON public.sdr_leads
  FOR DELETE TO authenticated
  USING (
    public.is_team_manager(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria','gerente_comercial']::app_role[])
  );

-- ---------- Views: enforce caller's RLS ----------
ALTER VIEW public.crm_cobertura_carteira SET (security_invoker = true);
ALTER VIEW public.crm_cobertura_por_sdr SET (security_invoker = true);

-- ---------- Realtime channel authorization ----------
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_can_read_own_topic ON realtime.messages;
CREATE POLICY authenticated_can_read_own_topic ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (realtime.topic() = 'notifications:' || auth.uid()::text)
    OR (realtime.topic() = auth.uid()::text)
  );

DROP POLICY IF EXISTS authenticated_can_publish_own_topic ON realtime.messages;
CREATE POLICY authenticated_can_publish_own_topic ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (realtime.topic() = 'notifications:' || auth.uid()::text)
    OR (realtime.topic() = auth.uid()::text)
  );
