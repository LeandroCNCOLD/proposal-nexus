
CREATE OR REPLACE FUNCTION public.claim_sdr_lead(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_lead record;
  v_my_locks int;
  v_limit int := 30;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_lead FROM public.sdr_leads WHERE id = _lead_id FOR UPDATE;
  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;

  IF v_lead.locked_by_sdr_id IS NOT NULL
     AND v_lead.locked_by_sdr_id <> v_actor
     AND COALESCE(v_lead.lock_expires_at, now()) > now() THEN
    IF v_lead.locked_by_sdr_name ILIKE '🔒 Bloqueado pelo gestor%' THEN
      RAISE EXCEPTION 'Lead bloqueado pelo gestor';
    END IF;
    RAISE EXCEPTION 'Lead já está na carteira de outro SDR';
  END IF;

  SELECT COUNT(*) INTO v_my_locks
  FROM public.sdr_leads
  WHERE locked_by_sdr_id = v_actor
    AND COALESCE(lock_expires_at, now()) > now()
    AND COALESCE(locked_by_sdr_name, '') NOT ILIKE '🔒 Bloqueado pelo gestor%';

  IF v_my_locks >= v_limit AND v_lead.locked_by_sdr_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Limite de % leads na carteira atingido', v_limit;
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;
  v_actor_name := COALESCE(v_actor_name, 'SDR');

  UPDATE public.sdr_leads
  SET locked_by_sdr_id = v_actor,
      locked_by_sdr_name = v_actor_name,
      locked_at = now(),
      lock_expires_at = now() + interval '7 days',
      sdr_id = COALESCE(sdr_id, v_actor),
      sdr_name = COALESCE(sdr_name, v_actor_name),
      updated_at = now()
  WHERE id = _lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_sdr_lead(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT locked_by_sdr_id INTO v_owner FROM public.sdr_leads WHERE id = _lead_id;
  IF v_owner IS NULL THEN RETURN; END IF;

  IF v_owner <> v_actor AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o dono do lock ou um gestor pode devolver';
  END IF;

  UPDATE public.sdr_leads
  SET locked_by_sdr_id = NULL,
      locked_by_sdr_name = NULL,
      locked_at = NULL,
      lock_expires_at = NULL,
      updated_at = now()
  WHERE id = _lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_sdr_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_sdr_lead(uuid) TO authenticated;
