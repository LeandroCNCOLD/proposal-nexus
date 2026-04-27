ALTER TABLE public.coldpro_tunnels
ADD COLUMN IF NOT EXISTS air_density_kg_m3 NUMERIC DEFAULT 1.2;