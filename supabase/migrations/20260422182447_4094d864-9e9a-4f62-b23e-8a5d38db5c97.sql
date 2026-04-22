-- Catálogo da API Nomus: referência interna para desenvolvimento
CREATE TABLE IF NOT EXISTS public.nomus_api_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'GET',
  category TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'validated',
  record_type TEXT,
  observed_count INTEGER,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_payload JSONB,
  notes TEXT,
  tags TEXT[],
  is_used_in_app BOOLEAN NOT NULL DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_nomus_api_catalog_module_key ON public.nomus_api_catalog(module_key);
CREATE INDEX IF NOT EXISTS idx_nomus_api_catalog_category ON public.nomus_api_catalog(category);

ALTER TABLE public.nomus_api_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nomus_api_catalog_select"
  ON public.nomus_api_catalog
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "nomus_api_catalog_modify"
  ON public.nomus_api_catalog
  FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'diretoria'::app_role]));

CREATE TRIGGER trg_nomus_api_catalog_updated_at
  BEFORE UPDATE ON public.nomus_api_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();