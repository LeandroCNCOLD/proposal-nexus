
CREATE TABLE public.sdr_lead_tratativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sdr_leads(id) ON DELETE CASCADE,
  body text NOT NULL,
  channel text,
  storage_path text,
  file_name text,
  file_mime text,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sdr_lead_tratativas_lead ON public.sdr_lead_tratativas(lead_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_lead_tratativas TO authenticated;
GRANT ALL ON public.sdr_lead_tratativas TO service_role;

ALTER TABLE public.sdr_lead_tratativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tratativas_select" ON public.sdr_lead_tratativas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tratativas_insert" ON public.sdr_lead_tratativas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "tratativas_update" ON public.sdr_lead_tratativas
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role]));

CREATE POLICY "tratativas_delete" ON public.sdr_lead_tratativas
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'diretoria'::app_role,'gerente_comercial'::app_role]));

CREATE TRIGGER trg_sdr_lead_tratativas_updated_at
  BEFORE UPDATE ON public.sdr_lead_tratativas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
