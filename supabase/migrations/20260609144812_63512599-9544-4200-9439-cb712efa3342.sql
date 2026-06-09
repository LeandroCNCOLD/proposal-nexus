
ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS origem_detalhe jsonb,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sdr_leads_unassigned_priority
  ON public.sdr_leads (priority, received_at)
  WHERE sdr_id IS NULL;

CREATE OR REPLACE FUNCTION public.suggest_sdr_for_assignment()
RETURNS TABLE(user_id uuid, full_name text, email text, active_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH sdrs AS (
    SELECT p.id AS user_id, p.full_name, p.email
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'sdr'::app_role
  )
  SELECT
    s.user_id, s.full_name, s.email,
    COALESCE((
      SELECT count(*) FROM public.sdr_leads sl
      WHERE sl.sdr_id = s.user_id
        AND sl.sdr_status NOT IN ('Kill / Arquivar','Fechado','Perdido (com motivo)')
    ), 0) AS active_count
  FROM sdrs s
  ORDER BY active_count ASC, s.full_name NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.assign_lead_to_sdr(_lead_id uuid, _sdr_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sdr_name text;
  v_client text;
BEGIN
  IF NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas gestores podem distribuir leads';
  END IF;

  SELECT full_name INTO v_sdr_name FROM public.profiles WHERE id = _sdr_id;
  SELECT client_name INTO v_client FROM public.sdr_leads WHERE id = _lead_id;

  UPDATE public.sdr_leads
  SET sdr_id = _sdr_id,
      sdr_name = COALESCE(v_sdr_name, sdr_name),
      priority = CASE WHEN priority = 0 THEN 1 ELSE priority END,
      updated_at = now()
  WHERE id = _lead_id;

  INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
  VALUES (
    _sdr_id,
    'lead_assigned',
    'Novo lead atribuído: ' || COALESCE(v_client, 'sem nome'),
    'Você recebeu um lead novo do site/inbound. Responda o quanto antes.',
    '/app/sdr/leads/' || _lead_id::text,
    jsonb_build_object('lead_id', _lead_id, 'assigned_by', v_actor)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_managers_on_inbound_lead()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.priority = 0 AND NEW.sdr_id IS NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
    SELECT
      ur.user_id,
      'inbound_lead',
      'Novo lead do site: ' || COALESCE(NEW.client_name, NEW.razao_social, 'sem nome'),
      'Aguardando distribuição · ' || COALESCE(NEW.contact_name, '') ||
        CASE WHEN NEW.city IS NOT NULL THEN ' · ' || NEW.city || '/' || COALESCE(NEW.state,'') ELSE '' END,
      '/app/sdr/wallet',
      jsonb_build_object('lead_id', NEW.id, 'origem', NEW.origem, 'origem_detalhe', NEW.origem_detalhe)
    FROM public.user_roles ur
    WHERE ur.role IN ('gerente_comercial'::app_role, 'diretoria'::app_role, 'admin'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_managers_on_inbound_lead ON public.sdr_leads;
CREATE TRIGGER trg_notify_managers_on_inbound_lead
AFTER INSERT ON public.sdr_leads
FOR EACH ROW EXECUTE FUNCTION public.notify_managers_on_inbound_lead();
