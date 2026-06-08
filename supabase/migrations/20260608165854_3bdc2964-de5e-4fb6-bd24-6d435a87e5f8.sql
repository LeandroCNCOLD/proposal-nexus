
-- 1) Coluna para marcar quando o closer abriu o lead pela primeira vez
ALTER TABLE public.sdr_leads
  ADD COLUMN IF NOT EXISTS first_opened_by_seller_at timestamptz;

-- 2) Tabela de notificações in-app
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link_to     text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
  ON public.user_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS user_notifications_user_idx
  ON public.user_notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.user_notifications;
CREATE POLICY "Users can read own notifications"
  ON public.user_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can mark own notifications" ON public.user_notifications;
CREATE POLICY "Users can mark own notifications"
  ON public.user_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.user_notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.user_notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Inserts são feitos por triggers SECURITY DEFINER, então nenhuma policy de INSERT para usuários.

-- 3) Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- 4) Trigger: ao transferir lead → notifica o vendedor
CREATE OR REPLACE FUNCTION public.notify_seller_on_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sdr_name text;
BEGIN
  IF NEW.handoff_status = 'transferred'
     AND (OLD.handoff_status IS DISTINCT FROM NEW.handoff_status)
     AND NEW.transferred_to_seller_id IS NOT NULL THEN
    SELECT COALESCE(p.full_name, NEW.transferred_by::text)
      INTO v_sdr_name
    FROM public.profiles p WHERE p.id = NEW.transferred_by;

    INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
    VALUES (
      NEW.transferred_to_seller_id,
      'lead_handoff',
      'Novo lead recebido: ' || NEW.client_name,
      COALESCE('Transferido por ' || v_sdr_name, 'Lead transferido para você') ||
        CASE WHEN NEW.value > 0 THEN ' · R$ ' || to_char(NEW.value, 'FM999G999G990D00') ELSE '' END,
      '/app/sdr/leads/' || NEW.id::text,
      jsonb_build_object(
        'lead_id', NEW.id,
        'lead_code', NEW.lead_code,
        'sdr_id', NEW.transferred_by,
        'sdr_name', v_sdr_name,
        'value', NEW.value
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_handoff ON public.sdr_leads;
CREATE TRIGGER trg_notify_seller_on_handoff
  AFTER UPDATE OF handoff_status ON public.sdr_leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_seller_on_handoff();

-- 5) Função: sugerir vendedor com menor carga ativa
CREATE OR REPLACE FUNCTION public.suggest_seller_for_handoff()
RETURNS TABLE(user_id uuid, full_name text, email text, active_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH sellers AS (
    SELECT p.id AS user_id, p.full_name, p.email
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'vendedor'::app_role
  )
  SELECT
    s.user_id,
    s.full_name,
    s.email,
    COALESCE((
      SELECT count(*) FROM public.sdr_leads sl
      WHERE sl.transferred_to_seller_id = s.user_id
        AND sl.handoff_status = 'transferred'
        AND sl.sdr_status NOT IN ('Kill / Arquivar','Fechado','Perdido (com motivo)')
    ), 0) AS active_count
  FROM sellers s
  ORDER BY active_count ASC, s.full_name NULLS LAST;
$$;

-- 6) Função para o closer registrar a 1ª abertura do lead
CREATE OR REPLACE FUNCTION public.mark_lead_opened_by_seller(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.sdr_leads
  SET first_opened_by_seller_at = now()
  WHERE id = _lead_id
    AND transferred_to_seller_id = auth.uid()
    AND first_opened_by_seller_at IS NULL;
END;
$$;
