ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS physical_model text,
ADD COLUMN IF NOT EXISTS spiral_turbulence_factor numeric,
ADD COLUMN IF NOT EXISTS block_exposure_factor numeric,
ADD COLUMN IF NOT EXISTS air_flow_method text,
ADD COLUMN IF NOT EXISTS suggested_air_method text;