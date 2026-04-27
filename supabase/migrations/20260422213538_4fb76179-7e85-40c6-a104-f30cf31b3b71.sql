-- proposal_documents: 1:1 com proposals
CREATE TABLE public.proposal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE REFERENCES public.proposals(id) ON DELETE CASCADE,
  template_version text NOT NULL DEFAULT 'cn-cold-v1',
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  solution_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  warranty_text jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  attached_pdf_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  manually_edited_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  auto_filled_at timestamptz,
  last_edited_by uuid,
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_documents_proposal_id ON public.proposal_documents(proposal_id);

ALTER TABLE public.proposal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_documents_select"
  ON public.proposal_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "proposal_documents_insert"
  ON public.proposal_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.created_by = auth.uid())
      OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin','engenharia']::app_role[])
    )
  );

CREATE POLICY "proposal_documents_update"
  ON public.proposal_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.created_by = auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin','engenharia']::app_role[])
  );

CREATE POLICY "proposal_documents_delete"
  ON public.proposal_documents FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','diretoria']::app_role[]));

CREATE TRIGGER trg_proposal_documents_updated_at
  BEFORE UPDATE ON public.proposal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- proposal_document_assets
CREATE TABLE public.proposal_document_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text,
  kind text NOT NULL CHECK (kind IN ('cover-photo','inline-image','attached-pdf')),
  size_bytes bigint,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_document_assets_proposal_id ON public.proposal_document_assets(proposal_id);

ALTER TABLE public.proposal_document_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_document_assets_select"
  ON public.proposal_document_assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "proposal_document_assets_insert"
  ON public.proposal_document_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND p.created_by = auth.uid())
      OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial','diretoria','admin','engenharia']::app_role[])
    )
  );

CREATE POLICY "proposal_document_assets_delete"
  ON public.proposal_document_assets FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','diretoria']::app_role[])
  );

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-pdfs', 'proposal-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "proposal_pdfs_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'proposal-pdfs');

CREATE POLICY "proposal_pdfs_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'proposal-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "proposal_pdfs_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'proposal-pdfs' AND auth.uid() IS NOT NULL);

CREATE POLICY "proposal_pdfs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'proposal-pdfs'
    AND public.has_any_role(auth.uid(), ARRAY['admin','diretoria']::app_role[])
  );