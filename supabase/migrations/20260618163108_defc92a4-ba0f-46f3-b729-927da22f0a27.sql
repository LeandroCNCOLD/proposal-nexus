CREATE OR REPLACE FUNCTION public.update_sdr_lead_fields(_lead_id uuid, _changes jsonb, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_lead public.sdr_leads%ROWTYPE;
  v_lead_json jsonb;
  v_key text;
  v_new text;
  v_old text;
  v_allowed text[] := ARRAY[
    'contact_name','contact_phone','contact_mobile','contact_email',
    'razao_social','cnpj','client_name','city','state',
    'proposal_title','proposal_desc','internal_note','next_step',
    'delivery_term','validity_days','expected_delivery','expected_closing',
    'expected_closing_date',
    'value','discount_pct'
  ];
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_lead FROM public.sdr_leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;

  IF NOT (
    v_lead.sdr_id = v_actor
    OR v_lead.locked_by_sdr_id = v_actor
    OR v_lead.transferred_to_seller_id = v_actor
    OR public.is_team_manager(v_actor)
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para editar este lead';
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;
  v_lead_json := to_jsonb(v_lead);

  FOR v_key, v_new IN SELECT * FROM jsonb_each_text(_changes) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      CONTINUE;
    END IF;
    v_old := v_lead_json->>v_key;
    IF COALESCE(v_old,'') IS DISTINCT FROM COALESCE(v_new,'') THEN
      EXECUTE format('UPDATE public.sdr_leads SET %I = $1::text::%s WHERE id = $2',
        v_key,
        CASE WHEN v_key IN ('validity_days') THEN 'integer'
             WHEN v_key IN ('expected_delivery','expected_closing','expected_closing_date') THEN 'date'
             WHEN v_key IN ('value','discount_pct') THEN 'numeric'
             ELSE 'text' END)
      USING NULLIF(v_new,''), _lead_id;

      INSERT INTO public.sdr_lead_edits(lead_id, edited_by, edited_by_name, field, old_value, new_value, reason)
      VALUES (_lead_id, v_actor, v_actor_name, v_key, v_old, NULLIF(v_new,''), _reason);
    END IF;
  END LOOP;
END;
$function$;