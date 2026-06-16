CREATE TABLE IF NOT EXISTS public.crm_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  concorrente text,
  fonte text NOT NULL DEFAULT 'outro',
  cor text NOT NULL DEFAULT '#0F2D5E',
  icone text NOT NULL DEFAULT '📋',
  ativo boolean NOT NULL DEFAULT true,
  readonly boolean NOT NULL DEFAULT false,
  data_inicio date,
  data_fim date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campanhas TO authenticated;
GRANT ALL ON public.crm_campanhas TO service_role;

ALTER TABLE public.crm_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campanhas_select_authenticated" ON public.crm_campanhas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "campanhas_insert_managers" ON public.crm_campanhas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'gerente_comercial') OR
    public.has_role(auth.uid(),'diretoria')
  );

CREATE POLICY "campanhas_update_managers" ON public.crm_campanhas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'gerente_comercial') OR
    public.has_role(auth.uid(),'diretoria')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'gerente_comercial') OR
    public.has_role(auth.uid(),'diretoria')
  );

CREATE POLICY "campanhas_delete_managers" ON public.crm_campanhas
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'gerente_comercial') OR
    public.has_role(auth.uid(),'diretoria')
  );

DO $$ BEGIN
  ALTER TABLE public.sdr_leads
    ADD CONSTRAINT sdr_leads_campanha_fk
    FOREIGN KEY (campanha_id) REFERENCES public.crm_campanhas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_crm_campanhas_updated ON public.crm_campanhas;
CREATE TRIGGER trg_crm_campanhas_updated
  BEFORE UPDATE ON public.crm_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();