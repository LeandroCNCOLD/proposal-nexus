ALTER TABLE public.coldpro_tunnels
  ADD COLUMN IF NOT EXISTS process_type text NOT NULL DEFAULT 'continuous_individual_freezing',
  ADD COLUMN IF NOT EXISTS arrangement_type text NOT NULL DEFAULT 'individual_exposed',
  ADD COLUMN IF NOT EXISTS product_length_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_width_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_thickness_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_weight_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pallet_length_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pallet_width_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pallet_height_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pallet_mass_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS number_of_pallets numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS batch_time_h numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS layers_count numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boxes_count numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tray_spacing_m numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS package_type text NULL,
  ADD COLUMN IF NOT EXISTS air_exposure_factor numeric NULL,
  ADD COLUMN IF NOT EXISTS thermal_penetration_factor numeric NULL,
  ADD COLUMN IF NOT EXISTS airflow_m3_h numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convective_coefficient_manual_w_m2_k numeric NULL,
  ADD COLUMN IF NOT EXISTS convective_coefficient_effective_w_m2_k numeric NULL,
  ADD COLUMN IF NOT EXISTS thermal_characteristic_dimension_m numeric NULL,
  ADD COLUMN IF NOT EXISTS distance_to_core_m numeric NULL;

UPDATE public.coldpro_tunnels
SET
  product_thickness_m = CASE WHEN COALESCE(product_thickness_m, 0) <= 0 AND COALESCE(product_thickness_mm, 0) > 0 THEN product_thickness_mm / 1000.0 ELSE product_thickness_m END,
  unit_weight_kg = CASE WHEN COALESCE(unit_weight_kg, 0) <= 0 AND COALESCE(product_unit_weight_kg, 0) > 0 THEN product_unit_weight_kg ELSE unit_weight_kg END,
  batch_time_h = CASE WHEN COALESCE(batch_time_h, 0) <= 0 AND COALESCE(process_time_min, 0) > 0 THEN process_time_min / 60.0 ELSE batch_time_h END,
  process_type = CASE
    WHEN operation_mode = 'batch' THEN 'static_pallet_freezing'
    ELSE 'continuous_individual_freezing'
  END,
  arrangement_type = CASE
    WHEN operation_mode = 'batch' THEN 'pallet_block'
    ELSE 'individual_exposed'
  END
WHERE process_type IS NULL OR process_type = 'continuous_individual_freezing';

CREATE INDEX IF NOT EXISTS idx_coldpro_tunnels_process_type ON public.coldpro_tunnels(process_type);
CREATE INDEX IF NOT EXISTS idx_coldpro_tunnels_arrangement_type ON public.coldpro_tunnels(arrangement_type);