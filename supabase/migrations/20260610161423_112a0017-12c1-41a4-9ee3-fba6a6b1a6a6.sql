
-- 1) claim_sdr_lead: limite 45 e contagem que ignora handoff/encerrados
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
  v_limit int := 45;
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
    AND COALESCE(locked_by_sdr_name, '') NOT ILIKE '🔒 Bloqueado pelo gestor%'
    AND COALESCE(handoff_status, 'open') <> 'transferred'
    AND COALESCE(sdr_status, '') NOT IN ('Fechado', 'Perdido (com motivo)', 'Kill / Arquivar');

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

-- 2) handoff_lead_to_seller: libera o lock ao transferir
CREATE OR REPLACE FUNCTION public.handoff_lead_to_seller(_lead_id uuid, _seller_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_seller_name text;
BEGIN
  SELECT sdr_id INTO v_owner FROM public.sdr_leads WHERE id = _lead_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;
  IF v_actor <> v_owner AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o SDR responsável ou um gestor pode transferir este lead';
  END IF;
  SELECT full_name INTO v_seller_name FROM public.profiles WHERE id = _seller_id;
  UPDATE public.sdr_leads SET
    handoff_status = 'transferred',
    transferred_to_seller_id = _seller_id,
    transferred_to_seller_name = v_seller_name,
    transferred_at = now(),
    transferred_by = v_actor,
    closer_id = COALESCE(closer_id, _seller_id),
    closer_name = COALESCE(closer_name, v_seller_name),
    -- libera a vaga na carteira do SDR; sdr_id permanece para crédito de conversão
    locked_by_sdr_id = NULL,
    locked_by_sdr_name = NULL,
    locked_at = NULL,
    lock_expires_at = NULL,
    updated_at = now()
  WHERE id = _lead_id;
END;
$$;

-- 3) close_sdr_lead: encerra (Fechado/Perdido/Kill) e libera a vaga
CREATE OR REPLACE FUNCTION public.close_sdr_lead(_lead_id uuid, _reason text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_locker uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _reason NOT IN ('Fechado', 'Perdido (com motivo)', 'Kill / Arquivar') THEN
    RAISE EXCEPTION 'Motivo inválido: %', _reason;
  END IF;

  SELECT sdr_id, locked_by_sdr_id INTO v_owner, v_locker
  FROM public.sdr_leads WHERE id = _lead_id;
  IF v_owner IS NULL AND v_locker IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_actor <> COALESCE(v_owner, v_locker)
     AND v_actor <> v_locker
     AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o SDR responsável ou um gestor pode encerrar este lead';
  END IF;

  UPDATE public.sdr_leads
  SET sdr_status = _reason,
      call_observation = COALESCE(NULLIF(_note, ''), call_observation),
      locked_by_sdr_id = NULL,
      locked_by_sdr_name = NULL,
      locked_at = NULL,
      lock_expires_at = NULL,
      updated_at = now()
  WHERE id = _lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_sdr_lead(uuid, text, text) TO authenticated;
