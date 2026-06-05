
CREATE TABLE IF NOT EXISTS public.crm_closer_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  closer_nome text NOT NULL,
  mes date NOT NULL,
  meta_reunioes integer NOT NULL DEFAULT 0,
  meta_propostas integer NOT NULL DEFAULT 0,
  meta_ganhas integer NOT NULL DEFAULT 0,
  meta_receita numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closer_nome, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_closer_metas TO authenticated;
GRANT ALL ON public.crm_closer_metas TO service_role;

ALTER TABLE public.crm_closer_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_select_own_or_manager" ON public.crm_closer_metas
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role])
  );

CREATE POLICY "metas_insert_manager" ON public.crm_closer_metas
  FOR INSERT TO authenticated WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role])
    OR user_id = auth.uid()
  );

CREATE POLICY "metas_update_manager" ON public.crm_closer_metas
  FOR UPDATE TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role])
    OR user_id = auth.uid()
  );

CREATE POLICY "metas_delete_manager" ON public.crm_closer_metas
  FOR DELETE TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['gerente_comercial'::app_role,'diretoria'::app_role,'admin'::app_role])
  );

CREATE TRIGGER trg_crm_closer_metas_updated_at
  BEFORE UPDATE ON public.crm_closer_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
