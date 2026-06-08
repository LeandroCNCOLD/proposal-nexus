
ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS handoff_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS transferred_to_seller_id uuid,
  ADD COLUMN IF NOT EXISTS transferred_to_seller_name text,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS transferred_by uuid,
  ADD COLUMN IF NOT EXISTS nomus_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS sdr_leads_transferred_to_idx
  ON public.sdr_leads(transferred_to_seller_id)
  WHERE handoff_status = 'transferred';

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
    updated_at = now()
  WHERE id = _lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_lead_nomus_updated(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  UPDATE public.sdr_leads
  SET nomus_updated_at = now(), updated_at = now()
  WHERE id = _lead_id
    AND (transferred_to_seller_id = v_actor OR public.is_team_manager(v_actor));
END;
$$;
