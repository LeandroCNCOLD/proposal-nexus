ALTER TABLE public.coldpro_products
ADD COLUMN IF NOT EXISTS specific_heat_above_kj_kg_k numeric,
ADD COLUMN IF NOT EXISTS specific_heat_below_kj_kg_k numeric,
ADD COLUMN IF NOT EXISTS latent_heat_kj_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_0c_mw_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_5c_mw_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_10c_mw_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_15c_mw_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_20c_mw_kg numeric,
ADD COLUMN IF NOT EXISTS notes text;