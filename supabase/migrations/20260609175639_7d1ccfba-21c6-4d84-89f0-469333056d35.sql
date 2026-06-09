
ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS locked_by_sdr_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_by_sdr_name text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_marketing_leads_locked_by ON public.marketing_leads(locked_by_sdr_id) WHERE locked_by_sdr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_leads_lock_expires ON public.marketing_leads(lock_expires_at) WHERE lock_expires_at IS NOT NULL;

-- Atualiza policy de SELECT pra incluir quem tem lock
DROP POLICY IF EXISTS marketing_leads_select ON public.marketing_leads;
CREATE POLICY marketing_leads_select ON public.marketing_leads
  FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role,'sdr'::app_role])
    OR assigned_to = auth.uid()
    OR locked_by_sdr_id = auth.uid()
  );

-- Atualiza policy de UPDATE pra permitir dono do lock editar
DROP POLICY IF EXISTS marketing_leads_update ON public.marketing_leads;
CREATE POLICY marketing_leads_update ON public.marketing_leads
  FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role])
    OR assigned_to = auth.uid()
    OR (locked_by_sdr_id = auth.uid() AND COALESCE(lock_expires_at, now()) > now())
  );

-- claim
CREATE OR REPLACE FUNCTION public.claim_marketing_lead(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_lead record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_lead FROM public.marketing_leads WHERE id = _lead_id FOR UPDATE;
  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;

  IF v_lead.locked_by_sdr_id IS NOT NULL
     AND v_lead.locked_by_sdr_id <> v_actor
     AND COALESCE(v_lead.lock_expires_at, now()) > now() THEN
    RAISE EXCEPTION 'Lead já está na carteira de outro SDR';
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  UPDATE public.marketing_leads
  SET locked_by_sdr_id = v_actor,
      locked_by_sdr_name = v_actor_name,
      locked_at = now(),
      lock_expires_at = now() + interval '7 days',
      assigned_to = COALESCE(assigned_to, v_actor),
      assigned_at = COALESCE(assigned_at, now()),
      updated_at = now()
  WHERE id = _lead_id;
END;
$$;

-- release
CREATE OR REPLACE FUNCTION public.release_marketing_lead(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_owner uuid;
BEGIN
  SELECT locked_by_sdr_id INTO v_owner FROM public.marketing_leads WHERE id = _lead_id;
  IF v_owner IS NULL THEN RETURN; END IF;
  IF v_owner <> v_actor AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o dono do lock ou um gestor pode liberar';
  END IF;
  UPDATE public.marketing_leads
  SET locked_by_sdr_id = NULL,
      locked_by_sdr_name = NULL,
      locked_at = NULL,
      lock_expires_at = NULL,
      updated_at = now()
  WHERE id = _lead_id;
END;
$$;

-- renew
CREATE OR REPLACE FUNCTION public.renew_marketing_lead_lock(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_owner uuid;
BEGIN
  SELECT locked_by_sdr_id INTO v_owner FROM public.marketing_leads WHERE id = _lead_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Lead não está bloqueado'; END IF;
  IF v_owner <> v_actor AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o dono do lock pode renovar';
  END IF;
  UPDATE public.marketing_leads
  SET lock_expires_at = GREATEST(COALESCE(lock_expires_at, now()), now()) + interval '7 days',
      updated_at = now()
  WHERE id = _lead_id;
END;
$$;

-- atualiza release_expired_locks pra também processar marketing
CREATE OR REPLACE FUNCTION public.release_expired_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sdr_leads
  SET locked_by_sdr_id = NULL, locked_by_sdr_name = NULL, locked_at = NULL, lock_expires_at = NULL
  WHERE lock_expires_at < now() AND locked_by_sdr_id IS NOT NULL;

  UPDATE public.marketing_leads
  SET locked_by_sdr_id = NULL, locked_by_sdr_name = NULL, locked_at = NULL, lock_expires_at = NULL
  WHERE lock_expires_at < now() AND locked_by_sdr_id IS NOT NULL;
END;
$$;
