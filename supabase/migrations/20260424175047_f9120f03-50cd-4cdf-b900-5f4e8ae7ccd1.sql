-- Metadados editáveis por processo (sobrepõe parsing do Nomus)
CREATE TABLE public.crm_process_meta (
  process_id uuid PRIMARY KEY REFERENCES public.nomus_processes(id) ON DELETE CASCADE,
  decisor text,
  interesse text,
  probabilidade_pct numeric,
  probabilidade_label text,
  projeto_estado text,
  segmento_override text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_process_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_process_meta_select ON public.crm_process_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY crm_process_meta_insert ON public.crm_process_meta FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY crm_process_meta_update ON public.crm_process_meta FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY crm_process_meta_delete ON public.crm_process_meta FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_crm_process_meta_updated BEFORE UPDATE ON public.crm_process_meta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vínculo manual processo <-> proposta (Nomus ou interna)
CREATE TABLE public.crm_process_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.nomus_processes(id) ON DELETE CASCADE,
  nomus_proposal_id uuid REFERENCES public.nomus_proposals(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (nomus_proposal_id IS NOT NULL OR proposal_id IS NOT NULL)
);
CREATE INDEX idx_cpp_process ON public.crm_process_proposals(process_id);
ALTER TABLE public.crm_process_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY cpp_select ON public.crm_process_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY cpp_insert ON public.crm_process_proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY cpp_update ON public.crm_process_proposals FOR UPDATE TO authenticated USING ((created_by = auth.uid()) OR has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));
CREATE POLICY cpp_delete ON public.crm_process_proposals FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- Follow-ups
CREATE TABLE public.crm_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.nomus_processes(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  done_at timestamptz,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_followups_process ON public.crm_followups(process_id);
CREATE INDEX idx_followups_pending ON public.crm_followups(process_id, scheduled_for) WHERE done_at IS NULL;
ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY followups_select ON public.crm_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY followups_insert ON public.crm_followups FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY followups_update ON public.crm_followups FOR UPDATE TO authenticated USING ((created_by = auth.uid()) OR has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));
CREATE POLICY followups_delete ON public.crm_followups FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_followups_updated BEFORE UPDATE ON public.crm_followups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notas
CREATE TABLE public.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.nomus_processes(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_process ON public.crm_notes(process_id, created_at DESC);
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_select ON public.crm_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY notes_insert ON public.crm_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY notes_update ON public.crm_notes FOR UPDATE TO authenticated USING ((created_by = auth.uid()) OR has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));
CREATE POLICY notes_delete ON public.crm_notes FOR DELETE TO authenticated USING ((created_by = auth.uid()) OR has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- Anexos locais
CREATE TABLE public.crm_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.nomus_processes(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attachments_process ON public.crm_attachments(process_id);
ALTER TABLE public.crm_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attach_select ON public.crm_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY attach_insert ON public.crm_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY attach_delete ON public.crm_attachments FOR DELETE TO authenticated USING ((uploaded_by = auth.uid()) OR has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role]));

-- Histórico de mudanças de etapa
CREATE TABLE public.crm_stage_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.nomus_processes(id) ON DELETE CASCADE,
  from_etapa text,
  to_etapa text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);
CREATE INDEX idx_stage_changes_process ON public.crm_stage_changes(process_id, changed_at DESC);
ALTER TABLE public.crm_stage_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY stage_changes_select ON public.crm_stage_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY stage_changes_insert ON public.crm_stage_changes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Bucket para anexos
INSERT INTO storage.buckets (id, name, public) VALUES ('crm-attachments', 'crm-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "crm_att_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'crm-attachments');
CREATE POLICY "crm_att_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'crm-attachments');
CREATE POLICY "crm_att_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'crm-attachments');