
CREATE TABLE public.sdr_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sdr_leads(id) ON DELETE CASCADE,
  sdr_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sdr_name text,
  scheduled_at timestamptz NOT NULL,
  note text,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sdr_followups_pending ON public.sdr_followups (sdr_id, scheduled_at) WHERE done_at IS NULL;
CREATE INDEX idx_sdr_followups_lead ON public.sdr_followups (lead_id);
CREATE INDEX idx_sdr_followups_overdue ON public.sdr_followups (scheduled_at) WHERE done_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_followups TO authenticated;
GRANT ALL ON public.sdr_followups TO service_role;

ALTER TABLE public.sdr_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdr_followups_select_auth" ON public.sdr_followups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sdr_followups_insert_self_or_mgr" ON public.sdr_followups
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by = auth.uid() OR public.is_team_manager(auth.uid()))
  );

CREATE POLICY "sdr_followups_update_self_or_mgr" ON public.sdr_followups
  FOR UPDATE TO authenticated
  USING (sdr_id = auth.uid() OR created_by = auth.uid() OR public.is_team_manager(auth.uid()))
  WITH CHECK (sdr_id = auth.uid() OR created_by = auth.uid() OR public.is_team_manager(auth.uid()));

CREATE POLICY "sdr_followups_delete_mgr" ON public.sdr_followups
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_team_manager(auth.uid()));

CREATE TRIGGER trg_sdr_followups_updated_at
  BEFORE UPDATE ON public.sdr_followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
