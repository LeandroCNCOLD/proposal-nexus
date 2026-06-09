-- Restaura visibilidade do Banco de Leads para SDRs/vendedores.
DROP POLICY IF EXISTS sdr_leads_select ON public.sdr_leads;

CREATE POLICY sdr_leads_select ON public.sdr_leads
  FOR SELECT TO authenticated
  USING (
    sdr_id = auth.uid()
    OR locked_by_sdr_id = auth.uid()
    OR closer_id = auth.uid()
    OR transferred_to_seller_id = auth.uid()
    OR public.is_team_manager(auth.uid())
    OR public.has_any_role(
         auth.uid(),
         ARRAY['admin','diretoria','gerente_comercial','sdr','vendedor','orcamentista','marketing']::app_role[]
       )
  );