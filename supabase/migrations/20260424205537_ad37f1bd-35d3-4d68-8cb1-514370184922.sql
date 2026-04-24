ALTER TABLE public.coldpro_equipment_models
ADD COLUMN IF NOT EXISTS plugin_image_paths text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS split_image_paths text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS biblock_image_paths text[] NOT NULL DEFAULT '{}';