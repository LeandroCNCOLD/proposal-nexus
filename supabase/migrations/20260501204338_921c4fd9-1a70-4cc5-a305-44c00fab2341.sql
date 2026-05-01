
-- 1) Tabela de configurações globais do relatório ColdPro (singleton por org/empresa)
CREATE TABLE IF NOT EXISTS public.coldpro_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',
  company_name text NOT NULL DEFAULT 'CN ColdPro',
  logo_url text,
  primary_color text NOT NULL DEFAULT '#0d2438',
  secondary_color text NOT NULL DEFAULT '#1e6ea7',
  accent_color text NOT NULL DEFAULT '#1e6ea7',
  footer_text text DEFAULT 'CN ColdPro · Engenharia frigorífica',
  default_template text NOT NULL DEFAULT 'tecnico',
  show_watermark boolean NOT NULL DEFAULT false,
  watermark_text text DEFAULT 'PRELIMINAR',
  default_status text NOT NULL DEFAULT 'preliminar',
  default_responsible text DEFAULT 'Engenharia CN ColdPro',
  cover_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coldpro_report_settings_default_template_chk CHECK (default_template IN ('tecnico','comercial','resumido')),
  CONSTRAINT coldpro_report_settings_default_status_chk CHECK (default_status IN ('preliminar','em_analise','final')),
  CONSTRAINT coldpro_report_settings_scope_unique UNIQUE (scope)
);

CREATE TRIGGER set_updated_at_coldpro_report_settings
  BEFORE UPDATE ON public.coldpro_report_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.coldpro_report_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ColdPro report settings readable by authenticated"
  ON public.coldpro_report_settings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "ColdPro report settings manageable by managers"
  ON public.coldpro_report_settings FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'engenharia'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'gerente_comercial'::app_role,'diretoria'::app_role,'engenharia'::app_role]));

-- Linha singleton padrão
INSERT INTO public.coldpro_report_settings (scope) VALUES ('global')
ON CONFLICT (scope) DO NOTHING;

-- 2) Overrides por projeto (capa personalizada, template, marca d'água, status)
ALTER TABLE public.coldpro_projects
  ADD COLUMN IF NOT EXISTS report_template text,
  ADD COLUMN IF NOT EXISTS report_status text,
  ADD COLUMN IF NOT EXISTS report_watermark_enabled boolean,
  ADD COLUMN IF NOT EXISTS report_watermark_text text,
  ADD COLUMN IF NOT EXISTS cover_client_name text,
  ADD COLUMN IF NOT EXISTS cover_project_name text,
  ADD COLUMN IF NOT EXISTS cover_location text,
  ADD COLUMN IF NOT EXISTS cover_responsible text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS cover_notes text;

ALTER TABLE public.coldpro_projects
  DROP CONSTRAINT IF EXISTS coldpro_projects_report_template_chk;
ALTER TABLE public.coldpro_projects
  ADD CONSTRAINT coldpro_projects_report_template_chk
  CHECK (report_template IS NULL OR report_template IN ('tecnico','comercial','resumido'));

ALTER TABLE public.coldpro_projects
  DROP CONSTRAINT IF EXISTS coldpro_projects_report_status_chk;
ALTER TABLE public.coldpro_projects
  ADD CONSTRAINT coldpro_projects_report_status_chk
  CHECK (report_status IS NULL OR report_status IN ('preliminar','em_analise','final'));

-- 3) Bucket público para assets do relatório (logo, capa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('coldpro-report-assets', 'coldpro-report-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Acesso público para leitura (logo precisa ser servido em PDF/clientes)
CREATE POLICY "Coldpro report assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'coldpro-report-assets');

CREATE POLICY "Coldpro report assets manageable by authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'coldpro-report-assets');

CREATE POLICY "Coldpro report assets updatable by authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'coldpro-report-assets');

CREATE POLICY "Coldpro report assets deletable by authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'coldpro-report-assets');
