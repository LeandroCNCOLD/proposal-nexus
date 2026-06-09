
CREATE TABLE public.marketing_remarketing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('sdr','marketing')),
  source_lead_id uuid NOT NULL,
  lead_code text,
  client_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  city text,
  state text,
  segmento text,
  mensagem text,
  reason text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_campanha','concluido','descartado')),
  campaign_name text,
  scheduled_for timestamptz,
  added_by uuid,
  added_by_name text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_lead_id)
);

CREATE INDEX marketing_remarketing_queue_status_idx ON public.marketing_remarketing_queue (status, created_at DESC);
CREATE INDEX marketing_remarketing_queue_source_idx ON public.marketing_remarketing_queue (source, source_lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_remarketing_queue TO authenticated;
GRANT ALL ON public.marketing_remarketing_queue TO service_role;

ALTER TABLE public.marketing_remarketing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marketing/gestores leem fila" ON public.marketing_remarketing_queue
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role]));

CREATE POLICY "Autor vê seu envio" ON public.marketing_remarketing_queue
  FOR SELECT TO authenticated
  USING (added_by = auth.uid());

CREATE POLICY "Autenticados inserem na fila" ON public.marketing_remarketing_queue
  FOR INSERT TO authenticated WITH CHECK (added_by = auth.uid());

CREATE POLICY "Marketing/gestores atualizam fila" ON public.marketing_remarketing_queue
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role]));

CREATE POLICY "Marketing/gestores removem fila" ON public.marketing_remarketing_queue
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role]));

CREATE TRIGGER trg_marketing_remarketing_queue_updated_at
  BEFORE UPDATE ON public.marketing_remarketing_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enqueue_remarketing(
  _source text,
  _lead_id uuid,
  _reason text DEFAULT NULL,
  _scheduled_for timestamptz DEFAULT NULL,
  _campaign text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _source NOT IN ('sdr','marketing') THEN RAISE EXCEPTION 'Origem inválida'; END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  IF _source = 'sdr' THEN
    INSERT INTO public.marketing_remarketing_queue (
      source, source_lead_id, lead_code, client_name, contact_name,
      contact_email, contact_phone, city, state, mensagem, reason,
      scheduled_for, campaign_name, added_by, added_by_name
    )
    SELECT 'sdr', sl.id, sl.lead_code, sl.client_name, sl.contact_name,
           sl.contact_email, COALESCE(sl.contact_mobile, sl.contact_phone), sl.city, sl.state,
           COALESCE(sl.internal_note, sl.proposal_desc), _reason,
           _scheduled_for, _campaign, v_actor, v_actor_name
    FROM public.sdr_leads sl
    WHERE sl.id = _lead_id
    ON CONFLICT (source, source_lead_id) DO UPDATE
      SET reason = COALESCE(EXCLUDED.reason, public.marketing_remarketing_queue.reason),
          status = 'pendente',
          scheduled_for = COALESCE(EXCLUDED.scheduled_for, public.marketing_remarketing_queue.scheduled_for),
          campaign_name = COALESCE(EXCLUDED.campaign_name, public.marketing_remarketing_queue.campaign_name),
          updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.marketing_remarketing_queue (
      source, source_lead_id, lead_code, client_name, contact_name,
      contact_email, contact_phone, city, state, segmento, mensagem, reason,
      scheduled_for, campaign_name, added_by, added_by_name
    )
    SELECT 'marketing', ml.id, ml.lead_code, ml.client_name, ml.contact_name,
           ml.contact_email, ml.contact_phone, ml.city, ml.state, ml.segmento, ml.mensagem,
           COALESCE(_reason, ml.discard_reason),
           _scheduled_for, _campaign, v_actor, v_actor_name
    FROM public.marketing_leads ml
    WHERE ml.id = _lead_id
    ON CONFLICT (source, source_lead_id) DO UPDATE
      SET reason = COALESCE(EXCLUDED.reason, public.marketing_remarketing_queue.reason),
          status = 'pendente',
          scheduled_for = COALESCE(EXCLUDED.scheduled_for, public.marketing_remarketing_queue.scheduled_for),
          campaign_name = COALESCE(EXCLUDED.campaign_name, public.marketing_remarketing_queue.campaign_name),
          updated_at = now()
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_remarketing(text, uuid, text, timestamptz, text) TO authenticated;
