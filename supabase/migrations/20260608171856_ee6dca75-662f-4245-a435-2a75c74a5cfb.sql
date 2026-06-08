
-- Audit table for lead field edits
CREATE TABLE public.sdr_lead_edits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.sdr_leads(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  edited_by uuid REFERENCES auth.users(id),
  edited_by_name text,
  reason text,
  reverted_from_edit_id uuid REFERENCES public.sdr_lead_edits(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_sdr_lead_edits_lead ON public.sdr_lead_edits(lead_id, created_at DESC);

GRANT SELECT, INSERT ON public.sdr_lead_edits TO authenticated;
GRANT ALL ON public.sdr_lead_edits TO service_role;

ALTER TABLE public.sdr_lead_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_edits_select" ON public.sdr_lead_edits
FOR SELECT TO authenticated
USING (
  public.is_team_manager(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.sdr_leads l
    WHERE l.id = sdr_lead_edits.lead_id
      AND (l.sdr_id = auth.uid()
           OR l.locked_by_sdr_id = auth.uid()
           OR l.transferred_to_seller_id = auth.uid())
  )
);

-- Insert only via SECURITY DEFINER function (block direct inserts from clients)
CREATE POLICY "lead_edits_insert_blocked" ON public.sdr_lead_edits
FOR INSERT TO authenticated WITH CHECK (false);

-- Editable field whitelist + audit log
CREATE OR REPLACE FUNCTION public.update_sdr_lead_fields(_lead_id uuid, _changes jsonb, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_lead record;
  v_key text;
  v_new text;
  v_old text;
  v_allowed text[] := ARRAY[
    'contact_name','contact_phone','contact_mobile','contact_email',
    'razao_social','cnpj','client_name','city','state',
    'proposal_title','proposal_desc','internal_note','next_step',
    'delivery_term','validity_days','expected_delivery','expected_closing',
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

  FOR v_key, v_new IN
    SELECT key, CASE WHEN jsonb_typeof(value) = 'null' THEN NULL ELSE value #>> '{}' END
    FROM jsonb_each(_changes)
  LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT ($1).%I::text', v_key) INTO v_old USING v_lead;

    IF v_old IS NOT DISTINCT FROM v_new THEN
      CONTINUE;
    END IF;

    EXECUTE format('UPDATE public.sdr_leads SET %I = $1, updated_at = now() WHERE id = $2', v_key)
      USING v_new, _lead_id;

    INSERT INTO public.sdr_lead_edits (lead_id, field, old_value, new_value, edited_by, edited_by_name, reason)
    VALUES (_lead_id, v_key, v_old, v_new, v_actor, v_actor_name, _reason);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_sdr_lead_fields(uuid, jsonb, text) TO authenticated;

-- Revert a specific edit (managers only)
CREATE OR REPLACE FUNCTION public.revert_sdr_lead_edit(_edit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_edit record;
  v_current text;
BEGIN
  IF NOT public.is_team_manager(v_actor) THEN
    RAISE EXCEPTION 'Apenas gestores podem reverter edições';
  END IF;

  SELECT * INTO v_edit FROM public.sdr_lead_edits WHERE id = _edit_id;
  IF v_edit.id IS NULL THEN RAISE EXCEPTION 'Edição não encontrada'; END IF;

  EXECUTE format('SELECT %I::text FROM public.sdr_leads WHERE id = $1', v_edit.field)
    INTO v_current USING v_edit.lead_id;

  EXECUTE format('UPDATE public.sdr_leads SET %I = $1, updated_at = now() WHERE id = $2', v_edit.field)
    USING v_edit.old_value, v_edit.lead_id;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.sdr_lead_edits (lead_id, field, old_value, new_value, edited_by, edited_by_name, reason, reverted_from_edit_id)
  VALUES (v_edit.lead_id, v_edit.field, v_current, v_edit.old_value, v_actor, v_actor_name,
          'Reversão da edição ' || _edit_id::text, _edit_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_sdr_lead_edit(uuid) TO authenticated;
