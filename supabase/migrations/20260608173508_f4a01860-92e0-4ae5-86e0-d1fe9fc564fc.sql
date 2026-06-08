CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.sdr_leads(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_name text,
  type text NOT NULL CHECK (type IN ('ligacao','reuniao','email_whatsapp','tarefa')),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_min int,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','cancelada','reagendada')),
  outcome text,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_name text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  reschedule_of uuid REFERENCES public.crm_activities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- SELECT: assignado, criador, gestor, dono do lead, ou usuário envolvido no lead
CREATE POLICY "activities_select" ON public.crm_activities FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_team_manager(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.sdr_leads l
    WHERE l.id = crm_activities.lead_id
      AND (l.sdr_id = auth.uid() OR l.locked_by_sdr_id = auth.uid()
           OR l.transferred_to_seller_id = auth.uid() OR l.closer_id = auth.uid())
  )
);

-- INSERT: qualquer usuário autenticado pode criar (inclusive para outro)
CREATE POLICY "activities_insert" ON public.crm_activities FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE: criador, responsável ou gestor
CREATE POLICY "activities_update" ON public.crm_activities FOR UPDATE TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_team_manager(auth.uid())
);

-- DELETE: criador ou gestor
CREATE POLICY "activities_delete" ON public.crm_activities FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.is_team_manager(auth.uid()));

CREATE INDEX idx_crm_activities_assigned_scheduled ON public.crm_activities (assigned_to, scheduled_at);
CREATE INDEX idx_crm_activities_lead ON public.crm_activities (lead_id);
CREATE INDEX idx_crm_activities_status_scheduled ON public.crm_activities (status, scheduled_at);
CREATE INDEX idx_crm_activities_proposal ON public.crm_activities (proposal_id);

CREATE TRIGGER trg_crm_activities_updated_at
BEFORE UPDATE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notificação quando alguém cria atividade para outro usuário
CREATE OR REPLACE FUNCTION public.notify_activity_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> NEW.created_by THEN
    INSERT INTO public.user_notifications (user_id, type, title, body, link_to, metadata)
    VALUES (
      NEW.assigned_to,
      'activity_assigned',
      'Nova atividade: ' || NEW.title,
      COALESCE('Atribuído por ' || NEW.created_by_name, 'Atividade atribuída a você')
        || ' · ' || to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      CASE WHEN NEW.lead_id IS NOT NULL
           THEN '/app/sdr/leads/' || NEW.lead_id::text
           ELSE '/app/atividades' END,
      jsonb_build_object(
        'activity_id', NEW.id,
        'lead_id', NEW.lead_id,
        'type', NEW.type,
        'scheduled_at', NEW.scheduled_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_activity_assigned
AFTER INSERT ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.notify_activity_assigned();