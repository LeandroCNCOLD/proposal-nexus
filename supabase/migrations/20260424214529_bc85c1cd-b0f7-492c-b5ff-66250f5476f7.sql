ALTER TABLE public.coldpro_equipment_condensers
ADD COLUMN IF NOT EXISTS air_application_height_m numeric,
ADD COLUMN IF NOT EXISTS fan_diameter_mm numeric,
ADD COLUMN IF NOT EXISTS complementary_source text,
ADD COLUMN IF NOT EXISTS complementary_source_sheet text;

ALTER TABLE public.coldpro_equipment_evaporators
ADD COLUMN IF NOT EXISTS air_application_height_m numeric,
ADD COLUMN IF NOT EXISTS fan_diameter_mm numeric,
ADD COLUMN IF NOT EXISTS complementary_source text,
ADD COLUMN IF NOT EXISTS complementary_source_sheet text;

CREATE TABLE IF NOT EXISTS public.coldpro_booster_models (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo text NOT NULL UNIQUE,
  fan_description text,
  fan_diameter_mm numeric,
  airflow_m3_h numeric,
  air_throw_m numeric,
  air_application_height_m numeric,
  voltage_220_1f_available boolean NOT NULL DEFAULT false,
  voltage_220_3f_available boolean NOT NULL DEFAULT false,
  voltage_380_3f_available boolean NOT NULL DEFAULT false,
  absorbed_power_kw numeric,
  current_220_1f_a numeric,
  current_220_3f_a numeric,
  current_380_3f_a numeric,
  source_sheet text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coldpro_booster_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coldpro_boosters_select ON public.coldpro_booster_models;
CREATE POLICY coldpro_boosters_select
ON public.coldpro_booster_models
FOR SELECT
USING (true);

DROP POLICY IF EXISTS coldpro_boosters_modify ON public.coldpro_booster_models;
CREATE POLICY coldpro_boosters_modify
ON public.coldpro_booster_models
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

DROP TRIGGER IF EXISTS set_coldpro_booster_models_updated_at ON public.coldpro_booster_models;
CREATE TRIGGER set_coldpro_booster_models_updated_at
BEFORE UPDATE ON public.coldpro_booster_models
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();