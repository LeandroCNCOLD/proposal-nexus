ALTER TABLE public.coldpro_products
ADD COLUMN IF NOT EXISTS geometry_shape TEXT,
ADD COLUMN IF NOT EXISTS length_mm NUMERIC,
ADD COLUMN IF NOT EXISTS width_mm NUMERIC,
ADD COLUMN IF NOT EXISTS height_or_thickness_mm NUMERIC,
ADD COLUMN IF NOT EXISTS characteristic_thickness_mm NUMERIC,
ADD COLUMN IF NOT EXISTS approximate_volume_cm3 NUMERIC,
ADD COLUMN IF NOT EXISTS observations TEXT;

CREATE INDEX IF NOT EXISTS idx_coldpro_products_geometry_shape
ON public.coldpro_products (geometry_shape);

CREATE INDEX IF NOT EXISTS idx_coldpro_products_category_name
ON public.coldpro_products (category, name);