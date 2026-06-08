
-- Helper: managers
CREATE OR REPLACE FUNCTION public.is_team_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role])
$$;

-- Transfer a proposal (sales or technical owner)
CREATE OR REPLACE FUNCTION public.transfer_proposal_owner(_proposal_id uuid, _new_user_id uuid, _kind text DEFAULT 'sales')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old uuid;
  v_actor_name text;
  v_new_name text;
BEGIN
  IF NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Não autorizado a transferir propostas';
  END IF;
  IF _kind NOT IN ('sales','technical') THEN
    RAISE EXCEPTION 'Tipo inválido: %', _kind;
  END IF;

  IF _kind = 'sales' THEN
    SELECT sales_owner_id INTO v_old FROM public.proposals WHERE id = _proposal_id;
    UPDATE public.proposals SET sales_owner_id = _new_user_id, updated_at = now() WHERE id = _proposal_id;
  ELSE
    SELECT technical_owner_id INTO v_old FROM public.proposals WHERE id = _proposal_id;
    UPDATE public.proposals SET technical_owner_id = _new_user_id, updated_at = now() WHERE id = _proposal_id;
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;
  SELECT full_name INTO v_new_name FROM public.profiles WHERE id = _new_user_id;

  INSERT INTO public.proposal_timeline_events (proposal_id, event_type, title, description, created_by, metadata)
  VALUES (
    _proposal_id,
    'transferencia',
    CASE WHEN _kind = 'sales' THEN 'Transferência de vendedor' ELSE 'Transferência de responsável técnico' END,
    format('Por %s · de %s para %s', COALESCE(v_actor_name,'(gestor)'), COALESCE(v_old::text,'—'), COALESCE(v_new_name, _new_user_id::text)),
    v_actor,
    jsonb_build_object('kind', _kind, 'from_user_id', v_old, 'to_user_id', _new_user_id)
  );
END;
$$;

-- Transfer an SDR lead
CREATE OR REPLACE FUNCTION public.transfer_sdr_lead(_lead_id uuid, _new_sdr_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_new_name text;
BEGIN
  IF NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Não autorizado a transferir leads';
  END IF;
  SELECT full_name INTO v_new_name FROM public.profiles WHERE id = _new_sdr_id;
  UPDATE public.sdr_leads
  SET sdr_id = _new_sdr_id,
      sdr_name = COALESCE(v_new_name, sdr_name),
      locked_by_sdr_id = NULL,
      locked_by_sdr_name = NULL,
      locked_at = NULL,
      lock_expires_at = NULL,
      updated_at = now()
  WHERE id = _lead_id;
END;
$$;

-- Allow managers to update sdr_leads (transfer/edit) — adds a permissive UPDATE policy
DROP POLICY IF EXISTS sdr_leads_manager_update ON public.sdr_leads;
CREATE POLICY sdr_leads_manager_update ON public.sdr_leads
  FOR UPDATE TO authenticated
  USING (public.is_team_manager(auth.uid()))
  WITH CHECK (public.is_team_manager(auth.uid()));

-- Allow managers to read all sdr_leads
DROP POLICY IF EXISTS sdr_leads_manager_select ON public.sdr_leads;
CREATE POLICY sdr_leads_manager_select ON public.sdr_leads
  FOR SELECT TO authenticated
  USING (public.is_team_manager(auth.uid()) OR true);

-- Grant exec on new helpers
GRANT EXECUTE ON FUNCTION public.is_team_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_proposal_owner(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_sdr_lead(uuid, uuid) TO authenticated;
