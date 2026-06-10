DROP POLICY IF EXISTS "lembretes_all" ON public.crm_agenda_lembretes;

CREATE POLICY "lembretes_select"
ON public.crm_agenda_lembretes
FOR SELECT
TO authenticated
USING (
  is_team_manager(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.crm_agenda a
    WHERE a.id = crm_agenda_lembretes.agenda_id
      AND (
        a.visibility = 'shared'
        OR EXISTS (
          SELECT 1 FROM public.sdr_leads l
          WHERE l.id = a.pipeline_id
            AND (l.sdr_id = auth.uid()
              OR l.locked_by_sdr_id = auth.uid()
              OR l.closer_id = auth.uid()
              OR l.transferred_to_seller_id = auth.uid())
        )
      )
  )
);

CREATE POLICY "lembretes_manager_write"
ON public.crm_agenda_lembretes
FOR ALL
TO authenticated
USING (is_team_manager(auth.uid()))
WITH CHECK (is_team_manager(auth.uid()));

DROP POLICY IF EXISTS "cobertura_hist_all" ON public.crm_cobertura_historico;

CREATE POLICY "cobertura_hist_select"
ON public.crm_cobertura_historico
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "cobertura_hist_manager_write"
ON public.crm_cobertura_historico
FOR ALL
TO authenticated
USING (
  is_team_manager(auth.uid())
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role])
)
WITH CHECK (
  is_team_manager(auth.uid())
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role])
);

DROP POLICY IF EXISTS "sdr_leads_select" ON public.sdr_leads;

CREATE POLICY "sdr_leads_select"
ON public.sdr_leads
FOR SELECT
TO authenticated
USING (
  sdr_id = auth.uid()
  OR locked_by_sdr_id = auth.uid()
  OR closer_id = auth.uid()
  OR transferred_to_seller_id = auth.uid()
  OR is_team_manager(auth.uid())
  OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role])
  OR (
    has_any_role(auth.uid(), ARRAY['sdr'::app_role])
    AND sdr_id IS NULL
  )
);

DROP POLICY IF EXISTS "Coldpro report assets manageable by authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Coldpro report assets updatable by authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Coldpro report assets deletable by authenticated" ON storage.objects;

CREATE POLICY "coldpro_report_assets_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'coldpro-report-assets'
  AND has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'diretoria'::app_role, 'admin'::app_role])
);

CREATE POLICY "coldpro_report_assets_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'coldpro-report-assets'
  AND has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'diretoria'::app_role, 'admin'::app_role])
)
WITH CHECK (
  bucket_id = 'coldpro-report-assets'
  AND has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'diretoria'::app_role, 'admin'::app_role])
);

CREATE POLICY "coldpro_report_assets_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'coldpro-report-assets'
  AND has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'diretoria'::app_role, 'admin'::app_role])
);

DROP POLICY IF EXISTS "crm_att_select" ON storage.objects;
DROP POLICY IF EXISTS "crm_att_insert" ON storage.objects;
DROP POLICY IF EXISTS "crm_att_delete" ON storage.objects;

CREATE POLICY "crm_att_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'crm-attachments'
  AND (
    owner = auth.uid()
    OR is_team_manager(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role])
  )
);

CREATE POLICY "crm_att_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'crm-attachments'
  AND owner = auth.uid()
);

CREATE POLICY "crm_att_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'crm-attachments'
  AND (
    owner = auth.uid()
    OR is_team_manager(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role])
  )
);

DROP POLICY IF EXISTS "proposal_files_select" ON storage.objects;
DROP POLICY IF EXISTS "proposal_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "proposal_files_update" ON storage.objects;

CREATE POLICY "proposal_files_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proposal-files'
  AND (
    owner = auth.uid()
    OR is_team_manager(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role, 'orcamentista'::app_role])
  )
);

CREATE POLICY "proposal_files_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proposal-files'
  AND owner = auth.uid()
);

CREATE POLICY "proposal_files_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'proposal-files'
  AND (
    owner = auth.uid()
    OR is_team_manager(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role])
  )
)
WITH CHECK (
  bucket_id = 'proposal-files'
  AND (
    owner = auth.uid()
    OR is_team_manager(auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role, 'gerente_comercial'::app_role])
  )
);