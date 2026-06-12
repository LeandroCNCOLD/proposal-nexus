CREATE OR REPLACE FUNCTION public.calcular_temperatura_lead()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Não recalcular leads encerrados
  IF NEW.sdr_status IN (
    'Fechado', 'Perdido (com motivo)', 'Kill / Arquivar'
  ) THEN
    RETURN NEW;
  END IF;

  -- Status CRM tem prioridade sobre dias
  IF NEW.sdr_status = 'Quente - Alta Chance de Fechamento' THEN
    NEW.temperature := 'Muito Quente';
  ELSIF NEW.sdr_status IN (
    'Em Negociação com Closer',
    'Reunião Realizada'
  ) THEN
    NEW.temperature := 'Quente';
  ELSIF NEW.sdr_status = 'Reunião Agendada' THEN
    NEW.temperature := 'Quente';
  -- Dias sem contato
  ELSIF NEW.last_contact_at IS NULL THEN
    NEW.temperature := 'Frio';
  ELSIF NEW.last_contact_at < CURRENT_DATE - INTERVAL '30 days' THEN
    NEW.temperature := 'Frio';
  ELSIF NEW.last_contact_at < CURRENT_DATE - INTERVAL '10 days' THEN
    NEW.temperature := 'Morno';
  ELSE
    NEW.temperature := 'Morno';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER sdr_leads_temperatura_auto
BEFORE UPDATE ON public.sdr_leads
FOR EACH ROW 
WHEN (
  OLD.sdr_status IS DISTINCT FROM NEW.sdr_status
  OR OLD.last_contact_at IS DISTINCT FROM NEW.last_contact_at
)
EXECUTE FUNCTION public.calcular_temperatura_lead();