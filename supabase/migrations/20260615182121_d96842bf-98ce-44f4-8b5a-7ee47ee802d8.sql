
CREATE OR REPLACE FUNCTION public.agendar_followup_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias integer;
  v_nota text;
BEGIN
  IF NEW.result IS NULL OR NEW.pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    CASE sl.temperature
      WHEN 'Muito Quente' THEN 1
      WHEN 'Quente' THEN 2
      WHEN 'Morno' THEN 5
      WHEN 'Frio' THEN 10
      ELSE 7
    END,
    CASE
      WHEN NEW.result ILIKE 'Atendeu%' THEN 'Retorno após contato: ' || NEW.result
      ELSE 'Nova tentativa após: ' || NEW.result
    END
  INTO v_dias, v_nota
  FROM public.sdr_leads sl
  WHERE sl.id = NEW.pipeline_id;

  IF v_dias IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sdr_followups (
    lead_id, sdr_id, sdr_name, scheduled_at, note, created_by
  ) VALUES (
    NEW.pipeline_id,
    NEW.sdr_id,
    NEW.sdr_name,
    NOW() + (v_dias || ' days')::interval,
    v_nota,
    NEW.sdr_id
  );

  UPDATE public.sdr_leads
  SET next_contact_at = (NOW() + (v_dias || ' days')::interval)::date
  WHERE id = NEW.pipeline_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_call_logs_cadencia_auto ON public.crm_call_logs;
CREATE TRIGGER crm_call_logs_cadencia_auto
AFTER INSERT ON public.crm_call_logs
FOR EACH ROW
EXECUTE FUNCTION public.agendar_followup_automatico();
