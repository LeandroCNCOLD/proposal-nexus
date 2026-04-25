CREATE TABLE public.coldpro_advanced_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.coldpro_projects(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES public.coldpro_environments(id) ON DELETE CASCADE,

  advanced_process_type TEXT NOT NULL DEFAULT 'none',

  product_name TEXT,
  product_mass_kg NUMERIC DEFAULT 0,
  chamber_volume_m3 NUMERIC DEFAULT 0,

  target_temperature_c NUMERIC,
  target_relative_humidity NUMERIC,
  process_time_h NUMERIC DEFAULT 0,
  technical_notes TEXT,

  external_temperature_c NUMERIC,
  external_relative_humidity NUMERIC,
  internal_temperature_c NUMERIC,
  internal_relative_humidity NUMERIC,
  air_changes_per_hour NUMERIC DEFAULT 0,

  product_initial_moisture NUMERIC,
  product_final_moisture NUMERIC,
  stabilization_time_h NUMERIC DEFAULT 0,

  ethylene_target_ppm NUMERIC,
  ethylene_exposure_time_h NUMERIC,
  ethylene_renewal_after_application BOOLEAN DEFAULT FALSE,

  co2_generation_rate_m3_kg_h NUMERIC,
  co2_limit_percent NUMERIC,
  external_co2_percent NUMERIC DEFAULT 0.04,
  storage_time_h NUMERIC DEFAULT 0,

  o2_target_percent NUMERIC,
  co2_target_percent NUMERIC,
  respiration_rate_w_kg NUMERIC DEFAULT 0,

  purge_airflow_m3_h NUMERIC,
  scrubber_enabled BOOLEAN DEFAULT FALSE,
  air_renewal_m3_h NUMERIC DEFAULT 0,

  calculation_result JSONB DEFAULT '{}'::jsonb,
  calculation_breakdown JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT coldpro_advanced_process_type_check CHECK (advanced_process_type IN (
    'none',
    'seed_humidity_control',
    'banana_ripening',
    'citrus_degreening',
    'potato_co2_control',
    'controlled_atmosphere',
    'ethylene_application',
    'ethylene_removal',
    'co2_scrubbing',
    'humidity_control'
  ))
);

CREATE INDEX idx_coldpro_advanced_processes_project_id ON public.coldpro_advanced_processes(project_id);
CREATE INDEX idx_coldpro_advanced_processes_environment_id ON public.coldpro_advanced_processes(environment_id);

ALTER TABLE public.coldpro_advanced_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ColdPro advanced processes"
ON public.coldpro_advanced_processes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create ColdPro advanced processes"
ON public.coldpro_advanced_processes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update ColdPro advanced processes"
ON public.coldpro_advanced_processes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete ColdPro advanced processes"
ON public.coldpro_advanced_processes
FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER set_coldpro_advanced_processes_updated_at
BEFORE UPDATE ON public.coldpro_advanced_processes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();