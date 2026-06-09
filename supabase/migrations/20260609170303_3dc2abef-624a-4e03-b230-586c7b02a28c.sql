
-- Status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marketing_lead_status') THEN
    CREATE TYPE public.marketing_lead_status AS ENUM ('novo','em_analise','tentando_contato','qualificado','convertido','descartado');
  END IF;
END$$;

-- marketing_leads
CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code text NOT NULL UNIQUE,
  status public.marketing_lead_status NOT NULL DEFAULT 'novo',
  discard_reason text,
  contact_name text,
  client_name text,
  contact_email text,
  contact_phone text,
  city text,
  state text,
  segmento text,
  aplicacao text,
  mensagem text,
  origem text NOT NULL DEFAULT 'site',
  origem_detalhe jsonb,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  first_response_at timestamptz,
  qualified_at timestamptz,
  converted_at timestamptz,
  converted_to_sdr_lead_id uuid REFERENCES public.sdr_leads(id) ON DELETE SET NULL,
  internal_note text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_leads TO authenticated;
GRANT ALL ON public.marketing_leads TO service_role;
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_leads_select" ON public.marketing_leads FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role])
    OR assigned_to = auth.uid()
  );
CREATE POLICY "marketing_leads_insert" ON public.marketing_leads FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role])
  );
CREATE POLICY "marketing_leads_update" ON public.marketing_leads FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role])
    OR assigned_to = auth.uid()
  );
CREATE POLICY "marketing_leads_delete" ON public.marketing_leads FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role]));

CREATE INDEX IF NOT EXISTS idx_marketing_leads_status ON public.marketing_leads(status);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_received_at ON public.marketing_leads(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_assigned_to ON public.marketing_leads(assigned_to);

CREATE TRIGGER trg_marketing_leads_updated_at
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- marketing_lead_events
CREATE TABLE IF NOT EXISTS public.marketing_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketing_lead_events TO authenticated;
GRANT ALL ON public.marketing_lead_events TO service_role;
ALTER TABLE public.marketing_lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_events_select" ON public.marketing_lead_events FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role])
    OR EXISTS (SELECT 1 FROM public.marketing_leads ml WHERE ml.id = lead_id AND ml.assigned_to = auth.uid())
  );
CREATE POLICY "mkt_events_insert" ON public.marketing_lead_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_mkt_events_lead ON public.marketing_lead_events(lead_id, created_at DESC);

-- Score weights (singleton)
CREATE TABLE IF NOT EXISTS public.sdr_score_weights (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mkt_triado numeric NOT NULL DEFAULT 1,
  mkt_qualificado numeric NOT NULL DEFAULT 3,
  mkt_sla_bonus numeric NOT NULL DEFAULT 1,
  mkt_descarte_sem_motivo numeric NOT NULL DEFAULT -2,
  sdr_tratativa numeric NOT NULL DEFAULT 2,
  sdr_reuniao_agendada numeric NOT NULL DEFAULT 5,
  sdr_handoff_aceito numeric NOT NULL DEFAULT 10,
  sla_mkt_minutos integer NOT NULL DEFAULT 15,
  ranking_visivel_sdr boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
GRANT SELECT ON public.sdr_score_weights TO authenticated;
GRANT ALL ON public.sdr_score_weights TO service_role;
ALTER TABLE public.sdr_score_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score_weights_select" ON public.sdr_score_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "score_weights_update" ON public.sdr_score_weights FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role]));
CREATE POLICY "score_weights_insert" ON public.sdr_score_weights FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role]));

INSERT INTO public.sdr_score_weights (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Triggers
CREATE OR REPLACE FUNCTION public.marketing_lead_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.marketing_lead_events (lead_id, event_type, payload)
  VALUES (NEW.id, 'criado', jsonb_build_object('origem', NEW.origem, 'origem_detalhe', NEW.origem_detalhe));

  INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
  SELECT ur.user_id, 'marketing_lead_new',
    'Novo lead de marketing: ' || COALESCE(NEW.client_name, NEW.contact_name, 'sem nome'),
    'Origem: ' || NEW.origem || COALESCE(' · ' || NEW.city || '/' || NEW.state, ''),
    '/app/marketing/leads/' || NEW.id::text,
    jsonb_build_object('lead_id', NEW.id, 'origem', NEW.origem)
  FROM public.user_roles ur
  WHERE ur.role = ANY(ARRAY['marketing'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]);
  RETURN NEW;
END$$;

CREATE TRIGGER trg_marketing_lead_after_insert
  AFTER INSERT ON public.marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.marketing_lead_after_insert();

CREATE OR REPLACE FUNCTION public.marketing_lead_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_actor_name text;
BEGIN
  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.marketing_lead_events (lead_id, event_type, actor_id, actor_name, payload)
    VALUES (NEW.id, 'mudou_status', v_actor, v_actor_name,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
    IF NEW.status = 'qualificado' AND NEW.qualified_at IS NULL THEN
      NEW.qualified_at := now();
    END IF;
  END IF;
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.marketing_lead_events (lead_id, event_type, actor_id, actor_name, payload)
    VALUES (NEW.id, 'atribuido', v_actor, v_actor_name,
      jsonb_build_object('from', OLD.assigned_to, 'to', NEW.assigned_to));
    NEW.assigned_at := now();
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
      VALUES (NEW.assigned_to, 'marketing_lead_assigned',
        'Lead de marketing atribuído: ' || COALESCE(NEW.client_name, NEW.contact_name, 'sem nome'),
        'Trate o quanto antes para SLA.',
        '/app/marketing/leads/' || NEW.id::text,
        jsonb_build_object('lead_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_marketing_lead_before_update
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.marketing_lead_before_update();

-- RPCs
CREATE OR REPLACE FUNCTION public.mark_marketing_lead_first_response(_lead_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.marketing_leads
  SET first_response_at = COALESCE(first_response_at, now()), updated_at = now()
  WHERE id = _lead_id;
END$$;

CREATE OR REPLACE FUNCTION public.assign_marketing_lead(_lead_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role,'marketing'::app_role])) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir lead';
  END IF;
  UPDATE public.marketing_leads SET assigned_to = _user_id, updated_at = now() WHERE id = _lead_id;
END$$;

CREATE OR REPLACE FUNCTION public.discard_marketing_lead(_lead_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Motivo de descarte obrigatório';
  END IF;
  UPDATE public.marketing_leads
  SET status = 'descartado', discard_reason = _reason, updated_at = now()
  WHERE id = _lead_id;
END$$;

CREATE OR REPLACE FUNCTION public.convert_marketing_lead_to_sdr(_lead_id uuid, _sdr_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ml record;
  v_new_sdr_id uuid;
  v_sdr_name text;
  v_lead_code text;
  v_attempt int := 0;
  v_d text := to_char(now(), 'YYYYMMDD');
BEGIN
  SELECT * INTO v_ml FROM public.marketing_leads WHERE id = _lead_id FOR UPDATE;
  IF v_ml.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;
  IF v_ml.status = 'convertido' THEN RAISE EXCEPTION 'Lead já convertido'; END IF;

  IF _sdr_id IS NOT NULL THEN
    SELECT full_name INTO v_sdr_name FROM public.profiles WHERE id = _sdr_id;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_lead_code := 'SITE-' || v_d || '-' || lpad(floor(random()*9000+1000)::text, 4, '0');
    BEGIN
      INSERT INTO public.sdr_leads (
        lead_code, client_name, razao_social, contact_name, contact_email,
        contact_phone, contact_mobile, city, state, value, sdr_status, temperature,
        origem, priority_level, priority, origem_detalhe, internal_note, received_at,
        sdr_id, sdr_name
      ) VALUES (
        v_lead_code, COALESCE(v_ml.client_name, v_ml.contact_name, 'Sem nome'),
        v_ml.client_name, v_ml.contact_name, v_ml.contact_email,
        v_ml.contact_phone, v_ml.contact_phone, v_ml.city, v_ml.state, 0,
        'Não Contatado', 'Quente', v_ml.origem, 0, 'Alta',
        v_ml.origem_detalhe,
        concat_ws(E'\n\n',
          CASE WHEN v_ml.segmento IS NOT NULL THEN 'Segmento: ' || v_ml.segmento END,
          CASE WHEN v_ml.aplicacao IS NOT NULL THEN 'Aplicação: ' || v_ml.aplicacao END,
          CASE WHEN v_ml.mensagem IS NOT NULL THEN 'Mensagem do site:' || E'\n' || v_ml.mensagem END,
          'Convertido do lead de marketing ' || v_ml.lead_code
        ),
        now(), _sdr_id, v_sdr_name
      )
      RETURNING id INTO v_new_sdr_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 4 THEN RAISE; END IF;
    END;
  END LOOP;

  UPDATE public.marketing_leads
  SET status = 'convertido', converted_at = now(), converted_to_sdr_lead_id = v_new_sdr_id, updated_at = now()
  WHERE id = _lead_id;

  INSERT INTO public.marketing_lead_events (lead_id, event_type, actor_id, payload)
  VALUES (_lead_id, 'convertido', auth.uid(),
    jsonb_build_object('sdr_lead_id', v_new_sdr_id, 'sdr_id', _sdr_id));

  RETURN v_new_sdr_id;
END$$;
