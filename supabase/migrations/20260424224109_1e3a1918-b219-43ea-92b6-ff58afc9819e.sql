ALTER TABLE public.coldpro_equipment_performance_points
ADD COLUMN IF NOT EXISTS refrigerant text,
ADD COLUMN IF NOT EXISTS source_sheet text;

CREATE INDEX IF NOT EXISTS coldpro_perf_refrigerant_idx
ON public.coldpro_equipment_performance_points (equipment_model_id, refrigerant);

CREATE INDEX IF NOT EXISTS coldpro_perf_source_sheet_idx
ON public.coldpro_equipment_performance_points (source_sheet);