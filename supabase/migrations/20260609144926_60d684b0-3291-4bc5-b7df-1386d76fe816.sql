
ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS priority_level smallint NOT NULL DEFAULT 5;

DROP INDEX IF EXISTS public.idx_sdr_leads_unassigned_priority;
CREATE INDEX IF NOT EXISTS idx_sdr_leads_unassigned_priority_level
  ON public.sdr_leads (priority_level, received_at)
  WHERE sdr_id IS NULL;

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
      priority_level = CASE WHEN priority_level = 0 THEN 1 ELSE priority_level END,
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
  IF NEW.priority_level = 0 AND NEW.sdr_id IS NULL THEN
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
