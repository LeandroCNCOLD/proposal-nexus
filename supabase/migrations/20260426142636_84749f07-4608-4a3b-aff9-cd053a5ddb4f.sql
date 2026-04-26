ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS air_temp_source TEXT DEFAULT 'environment';

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS calculation_warnings JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS missing_fields JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS calculation_breakdown JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS calculation_log JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS estimated_freezing_time_min NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS process_status TEXT;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS calculated_mass_kg_h NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS used_mass_kg_h NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS thermal_characteristic_dimension_m NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS distance_to_core_m NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS tunnel_product_load_kw NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS tunnel_packaging_load_kw NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS tunnel_internal_load_kw NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS tunnel_total_load_kw NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS tunnel_total_load_kcal_h NUMERIC;

ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS tunnel_total_load_tr NUMERIC;