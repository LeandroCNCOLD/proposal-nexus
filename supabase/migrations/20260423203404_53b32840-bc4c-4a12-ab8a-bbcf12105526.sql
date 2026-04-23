-- 1) Nova tabela proposal_tables
CREATE TABLE public.proposal_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  type text NOT NULL,
  title text,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, page_id)
);

CREATE INDEX idx_proposal_tables_proposal ON public.proposal_tables(proposal_id);

ALTER TABLE public.proposal_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_tables_select"
ON public.proposal_tables
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "proposal_tables_insert"
ON public.proposal_tables
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_tables.proposal_id AND p.created_by = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role, 'diretoria'::app_role, 'admin'::app_role, 'engenharia'::app_role])
  )
);

CREATE POLICY "proposal_tables_update"
ON public.proposal_tables
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_tables.proposal_id AND p.created_by = auth.uid())
  OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role, 'diretoria'::app_role, 'admin'::app_role, 'engenharia'::app_role])
);

CREATE POLICY "proposal_tables_delete"
ON public.proposal_tables
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_tables.proposal_id AND p.created_by = auth.uid())
  OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role, 'diretoria'::app_role, 'admin'::app_role])
);

CREATE TRIGGER trg_proposal_tables_updated_at
BEFORE UPDATE ON public.proposal_tables
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 2) document_snapshot em proposal_send_versions
ALTER TABLE public.proposal_send_versions
ADD COLUMN IF NOT EXISTS document_snapshot jsonb;