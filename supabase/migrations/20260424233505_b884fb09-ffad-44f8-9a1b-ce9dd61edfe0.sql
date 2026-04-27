ALTER TABLE public.coldpro_products
ADD COLUMN IF NOT EXISTS thermal_conductivity_unfrozen_w_m_k numeric,
ADD COLUMN IF NOT EXISTS thermal_conductivity_frozen_w_m_k numeric,
ADD COLUMN IF NOT EXISTS frozen_water_fraction numeric,
ADD COLUMN IF NOT EXISTS freezable_water_content_percent numeric,
ADD COLUMN IF NOT EXISTS characteristic_thickness_m numeric,
ADD COLUMN IF NOT EXISTS default_convective_coefficient_w_m2_k numeric,
ADD COLUMN IF NOT EXISTS allow_phase_change boolean NOT NULL DEFAULT true;

UPDATE public.coldpro_products
SET thermal_conductivity_unfrozen_w_m_k = COALESCE(thermal_conductivity_unfrozen_w_m_k, thermal_conductivity_w_m_k)
WHERE thermal_conductivity_w_m_k IS NOT NULL;

ALTER TABLE public.coldpro_environment_products
ADD COLUMN IF NOT EXISTS density_kg_m3 numeric,
ADD COLUMN IF NOT EXISTS thermal_conductivity_unfrozen_w_m_k numeric,
ADD COLUMN IF NOT EXISTS thermal_conductivity_frozen_w_m_k numeric,
ADD COLUMN IF NOT EXISTS frozen_water_fraction numeric,
ADD COLUMN IF NOT EXISTS freezable_water_content_percent numeric,
ADD COLUMN IF NOT EXISTS characteristic_thickness_m numeric,
ADD COLUMN IF NOT EXISTS default_convective_coefficient_w_m2_k numeric,
ADD COLUMN IF NOT EXISTS allow_phase_change boolean NOT NULL DEFAULT true;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS density_kg_m3 numeric,
ADD COLUMN IF NOT EXISTS thermal_conductivity_frozen_w_m_k numeric,
ADD COLUMN IF NOT EXISTS convective_coefficient_w_m2_k numeric,
ADD COLUMN IF NOT EXISTS estimated_freezing_time_min numeric,
ADD COLUMN IF NOT EXISTS retention_status text,
ADD COLUMN IF NOT EXISTS recommended_airflow_m3_h numeric;