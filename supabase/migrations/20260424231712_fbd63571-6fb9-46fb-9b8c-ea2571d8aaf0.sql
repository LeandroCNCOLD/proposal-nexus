ALTER TABLE public.coldpro_products
ADD COLUMN IF NOT EXISTS protein_content_percent numeric,
ADD COLUMN IF NOT EXISTS fat_content_percent numeric,
ADD COLUMN IF NOT EXISTS carbohydrate_content_percent numeric,
ADD COLUMN IF NOT EXISTS fiber_content_percent numeric,
ADD COLUMN IF NOT EXISTS ash_content_percent numeric,
ADD COLUMN IF NOT EXISTS thermal_conductivity_w_m_k numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_0c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_5c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_10c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_15c_w_kg numeric,
ADD COLUMN IF NOT EXISTS respiration_rate_20c_w_kg numeric,
ADD COLUMN IF NOT EXISTS source_compiled_at date,
ADD COLUMN IF NOT EXISTS is_ashrae_reference boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS data_confidence text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_coldpro_products_category
ON public.coldpro_products (category);

CREATE INDEX IF NOT EXISTS idx_coldpro_products_ashrae_reference
ON public.coldpro_products (is_ashrae_reference);

CREATE INDEX IF NOT EXISTS idx_coldpro_products_name_trgm
ON public.coldpro_products USING btree (name);