ALTER TABLE public.coldpro_environments
ADD COLUMN IF NOT EXISTS chamber_layout_type text DEFAULT 'industrial',
ADD COLUMN IF NOT EXISTS wall_count integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS module_count integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS west_face_insolation boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS construction_faces jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS total_panel_area_m2 numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_glass_area_m2 numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_door_area_m2 numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS construction_load_kcal_h numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_coldpro_environments_construction_faces
ON public.coldpro_environments USING GIN (construction_faces);