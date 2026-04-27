ALTER TABLE public.coldpro_equipment_models
ADD COLUMN IF NOT EXISTS commercial_description text,
ADD COLUMN IF NOT EXISTS commercial_features jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS commercial_description_source text;