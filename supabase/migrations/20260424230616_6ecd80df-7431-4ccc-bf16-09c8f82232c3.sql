ALTER TABLE public.coldpro_equipment_selections
ADD COLUMN IF NOT EXISTS equipment_model_id uuid,
ADD COLUMN IF NOT EXISTS refrigerant text,
ADD COLUMN IF NOT EXISTS total_power_kw numeric,
ADD COLUMN IF NOT EXISTS cop numeric,
ADD COLUMN IF NOT EXISTS selection_method text NOT NULL DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS curve_temperature_room_c numeric,
ADD COLUMN IF NOT EXISTS curve_evaporation_temp_c numeric,
ADD COLUMN IF NOT EXISTS curve_condensation_temp_c numeric,
ADD COLUMN IF NOT EXISTS curve_polynomial_r2 numeric,
ADD COLUMN IF NOT EXISTS curve_interpolated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS curve_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_coldpro_equipment_selections_model_id
ON public.coldpro_equipment_selections (equipment_model_id);

CREATE INDEX IF NOT EXISTS idx_coldpro_equipment_selections_method
ON public.coldpro_equipment_selections (selection_method);