
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

  INSERT INTO public.proposal_timeline_events (proposal_id, event_type, description, user_id, metadata)
  VALUES (
    _proposal_id,
    'transferencia'::timeline_event_type,
    format('Transferência (%s) por %s · para %s',
      _kind,
      COALESCE(v_actor_name,'gestor'),
      COALESCE(v_new_name, _new_user_id::text)
    ),
    v_actor,
    jsonb_build_object('kind', _kind, 'from_user_id', v_old, 'to_user_id', _new_user_id)
  );
END;
$$;
