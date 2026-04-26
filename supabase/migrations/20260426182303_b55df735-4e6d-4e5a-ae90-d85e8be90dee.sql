ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS suggested_air_temp_c numeric,
ADD COLUMN IF NOT EXISTS suggested_air_approach_k numeric;