
-- crm_team_members: limitar leitura
DROP POLICY IF EXISTS crm_team_read ON public.crm_team_members;
CREATE POLICY crm_team_read_scoped ON public.crm_team_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretoria')
    OR public.has_role(auth.uid(), 'gerente_comercial')
  );

-- proposal_financial_history: limitar leitura aos que podem acessar a proposta
DROP POLICY IF EXISTS financial_history_select_authenticated ON public.proposal_financial_history;
CREATE POLICY financial_history_select_scoped ON public.proposal_financial_history
  FOR SELECT TO authenticated
  USING (public.can_access_proposal(proposal_id));

-- sdr_followups: limitar leitura ao dono, criador ou gerentes
DROP POLICY IF EXISTS sdr_followups_select_auth ON public.sdr_followups;
CREATE POLICY sdr_followups_select_scoped ON public.sdr_followups
  FOR SELECT TO authenticated
  USING (
    sdr_id = auth.uid()
    OR created_by = auth.uid()
    OR public.is_team_manager(auth.uid())
  );
