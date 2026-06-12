
-- 1) Coluna de contexto do SDR
ALTER TABLE public.sdr_leads ADD COLUMN IF NOT EXISTS handoff_notes text;

-- 2) RPC de transferência (assinatura nova, defaults preservam call sites antigos)
CREATE OR REPLACE FUNCTION public.handoff_lead_to_seller(
  _lead_id uuid,
  _seller_id uuid,
  _handoff_notes text DEFAULT NULL,
  _meeting_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_seller_name text;
  v_lead public.sdr_leads%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM public.sdr_leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;
  IF v_actor <> COALESCE(v_lead.sdr_id, v_actor) AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o SDR responsável ou um gestor pode transferir este lead';
  END IF;

  SELECT full_name INTO v_seller_name FROM public.profiles WHERE id = _seller_id;

  UPDATE public.sdr_leads SET
    handoff_status = 'transferred',                          -- ≡ pendente
    handoff_notes = COALESCE(_handoff_notes, handoff_notes),
    transferred_to_seller_id = _seller_id,
    transferred_to_seller_name = v_seller_name,
    transferred_at = now(),
    transferred_by = v_actor,
    closer_id = COALESCE(closer_id, _seller_id),
    closer_name = COALESCE(closer_name, v_seller_name),
    sdr_status = 'Em Negociação com Closer',
    locked_by_sdr_id = NULL, locked_by_sdr_name = NULL,
    locked_at = NULL, lock_expires_at = NULL,
    updated_at = now()
  WHERE id = _lead_id;

  IF _meeting_at IS NOT NULL THEN
    INSERT INTO public.crm_agenda (
      tipo, status, data_inicio, data_fim, duracao_min,
      client_name, sdr_nome, closer_nome,
      contato_cliente, email_cliente, telefone_cliente,
      observacoes, visibility
    ) VALUES (
      'reuniao', 'agendado', _meeting_at, _meeting_at + interval '60 minutes', 60,
      v_lead.client_name, v_lead.sdr_name, v_seller_name,
      v_lead.contact_name, v_lead.contact_email,
      COALESCE(v_lead.contact_mobile, v_lead.contact_phone),
      _handoff_notes, 'team'
    );
  END IF;
END;
$$;

-- 3) Trigger de notificação inclui handoff_notes
CREATE OR REPLACE FUNCTION public.notify_seller_on_handoff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_sdr_name text;
BEGIN
  IF NEW.handoff_status = 'transferred'
     AND (OLD.handoff_status IS DISTINCT FROM NEW.handoff_status)
     AND NEW.transferred_to_seller_id IS NOT NULL THEN
    SELECT COALESCE(p.full_name, NEW.transferred_by::text) INTO v_sdr_name
    FROM public.profiles p WHERE p.id = NEW.transferred_by;

    INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
    VALUES (
      NEW.transferred_to_seller_id, 'lead_handoff',
      'Novo lead recebido: ' || NEW.client_name,
      COALESCE('Transferido por ' || v_sdr_name, 'Lead transferido para você') ||
        CASE WHEN COALESCE(NEW.value,0) > 0 THEN ' · R$ ' || to_char(NEW.value, 'FM999G999G990D00') ELSE '' END,
      '/app/sdr/leads/' || NEW.id::text,
      jsonb_build_object(
        'lead_id', NEW.id, 'lead_code', NEW.lead_code,
        'sdr_id', NEW.transferred_by, 'sdr_name', v_sdr_name,
        'value', NEW.value, 'handoff_notes', NEW.handoff_notes
      )
    );
  END IF;
  RETURN NEW;
END; $$;

-- 4) Closer aceita o lead
CREATE OR REPLACE FUNCTION public.accept_handoff_lead(_lead_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_lead public.sdr_leads%ROWTYPE;
  v_closer_name text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_lead FROM public.sdr_leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;
  IF v_lead.transferred_to_seller_id IS DISTINCT FROM v_actor
     AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o closer destinatário pode aceitar este lead';
  END IF;

  SELECT full_name INTO v_closer_name FROM public.profiles WHERE id = v_actor;

  UPDATE public.sdr_leads SET
    handoff_status = 'aceito',
    updated_at = now()
  WHERE id = _lead_id;

  IF v_lead.transferred_by IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
    VALUES (
      v_lead.transferred_by, 'handoff_accepted',
      'Closer aceitou seu lead!',
      COALESCE(v_closer_name, 'O closer') || ' aceitou ' || v_lead.client_name ||
        ' e vai conduzir a negociação.',
      '/app/sdr/leads/' || v_lead.id::text,
      jsonb_build_object('lead_id', v_lead.id, 'closer_id', v_actor, 'closer_name', v_closer_name)
    );
  END IF;
END; $$;

-- 5) Closer pede mais informações (não muda status)
CREATE OR REPLACE FUNCTION public.request_handoff_info(_lead_id uuid, _question text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_lead public.sdr_leads%ROWTYPE;
  v_closer_name text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _question IS NULL OR btrim(_question) = '' THEN
    RAISE EXCEPTION 'Pergunta obrigatória';
  END IF;

  SELECT * INTO v_lead FROM public.sdr_leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;
  IF v_lead.transferred_to_seller_id IS DISTINCT FROM v_actor
     AND NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas o closer destinatário pode pedir mais informações';
  END IF;

  SELECT full_name INTO v_closer_name FROM public.profiles WHERE id = v_actor;

  IF v_lead.transferred_by IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
    VALUES (
      v_lead.transferred_by, 'handoff_info_request',
      COALESCE(v_closer_name, 'O closer') || ' tem uma dúvida sobre ' || v_lead.client_name,
      _question,
      '/app/sdr/leads/' || v_lead.id::text,
      jsonb_build_object('lead_id', v_lead.id, 'closer_id', v_actor,
                         'closer_name', v_closer_name, 'question', _question)
    );
  END IF;
END; $$;

-- 6) Histórico unificado (followups + tratativas) — últimos 5
CREATE OR REPLACE FUNCTION public.sdr_lead_history(_lead_id uuid)
RETURNS TABLE(fonte text, data timestamptz, resultado text, observacao text, autor text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  (
    SELECT 'followup'::text AS fonte,
           COALESCE(f.done_at, f.scheduled_at, f.created_at) AS data,
           CASE WHEN f.done_at IS NOT NULL THEN 'realizado' ELSE 'agendado' END AS resultado,
           f.note AS observacao,
           f.sdr_name AS autor
    FROM public.sdr_followups f
    WHERE f.lead_id = _lead_id
  )
  UNION ALL
  (
    SELECT 'tratativa'::text AS fonte,
           t.created_at AS data,
           COALESCE(t.channel, 'tratativa') AS resultado,
           t.body AS observacao,
           t.created_by_name AS autor
    FROM public.sdr_lead_tratativas t
    WHERE t.lead_id = _lead_id
  )
  ORDER BY data DESC NULLS LAST
  LIMIT 5;
$$;
