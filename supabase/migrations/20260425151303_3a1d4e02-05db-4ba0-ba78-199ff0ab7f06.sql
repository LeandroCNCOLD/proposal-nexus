ALTER TABLE public.coldpro_environments
ADD COLUMN IF NOT EXISTS air_changes_per_hour numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS fresh_air_m3_h numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS door_infiltration_m3_h numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS seed_mass_kg numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS seed_initial_moisture_percent numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS seed_final_moisture_percent numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS seed_stabilization_time_h numeric NOT NULL DEFAULT 0;