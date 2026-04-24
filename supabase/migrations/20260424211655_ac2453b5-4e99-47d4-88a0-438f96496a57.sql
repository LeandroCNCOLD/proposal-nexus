ALTER TABLE public.coldpro_equipment_models
ADD COLUMN IF NOT EXISTS smart_description text,
ADD COLUMN IF NOT EXISTS recommended_applications text[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS application_summary text,
ADD COLUMN IF NOT EXISTS commercial_highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS technical_highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS description_confidence text,
ADD COLUMN IF NOT EXISTS description_source text;

CREATE INDEX IF NOT EXISTS idx_coldpro_models_recommended_applications
ON public.coldpro_equipment_models USING gin (recommended_applications);

CREATE INDEX IF NOT EXISTS idx_coldpro_models_description_confidence
ON public.coldpro_equipment_models(description_confidence);