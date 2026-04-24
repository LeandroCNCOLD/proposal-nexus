ALTER TABLE public.coldpro_environment_products
ADD COLUMN IF NOT EXISTS respiration_rate_0c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_5c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_10c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_15c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_20c_w_kg numeric;