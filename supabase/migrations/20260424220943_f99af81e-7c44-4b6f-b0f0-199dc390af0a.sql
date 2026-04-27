ALTER TABLE public.coldpro_equipment_condensers
  ADD COLUMN IF NOT EXISTS rows numeric,
  ADD COLUMN IF NOT EXISTS tubes_per_row numeric,
  ADD COLUMN IF NOT EXISTS total_tubes numeric,
  ADD COLUMN IF NOT EXISTS circuits numeric,
  ADD COLUMN IF NOT EXISTS tubes_per_circuit numeric,
  ADD COLUMN IF NOT EXISTS fin_spacing_mm numeric,
  ADD COLUMN IF NOT EXISTS tube_length_mm numeric,
  ADD COLUMN IF NOT EXISTS total_tube_length_m numeric,
  ADD COLUMN IF NOT EXISTS volume_correction_factor numeric,
  ADD COLUMN IF NOT EXISTS corrected_internal_volume_l numeric,
  ADD COLUMN IF NOT EXISTS occupancy_factor numeric,
  ADD COLUMN IF NOT EXISTS occupied_internal_volume_l numeric;

ALTER TABLE public.coldpro_equipment_evaporators
  ADD COLUMN IF NOT EXISTS rows numeric,
  ADD COLUMN IF NOT EXISTS tubes_per_row numeric,
  ADD COLUMN IF NOT EXISTS total_tubes numeric,
  ADD COLUMN IF NOT EXISTS circuits numeric,
  ADD COLUMN IF NOT EXISTS tubes_per_circuit numeric,
  ADD COLUMN IF NOT EXISTS fin_spacing_mm numeric,
  ADD COLUMN IF NOT EXISTS tube_length_mm numeric,
  ADD COLUMN IF NOT EXISTS total_tube_length_m numeric,
  ADD COLUMN IF NOT EXISTS volume_correction_factor numeric,
  ADD COLUMN IF NOT EXISTS corrected_internal_volume_l numeric,
  ADD COLUMN IF NOT EXISTS occupancy_factor numeric,
  ADD COLUMN IF NOT EXISTS occupied_internal_volume_l numeric;

CREATE OR REPLACE FUNCTION public.coldpro_parse_coil_model(p_model text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_text text;
  v_rows numeric;
  v_tubes_per_row numeric;
  v_circuits numeric;
  v_fin_spacing_mm numeric;
  v_tube_length_mm numeric;
BEGIN
  IF p_model IS NULL OR btrim(p_model) = '' OR btrim(p_model) = '-' THEN
    RETURN '{}'::jsonb;
  END IF;

  v_text := upper(p_model);
  v_text := replace(v_text, ',', '.');

  SELECT (m)[1]::numeric, (m)[2]::numeric
  INTO v_rows, v_tubes_per_row
  FROM regexp_matches(v_text, '([0-9]+(?:\.[0-9]+)?)\s*X\s*([0-9]+(?:\.[0-9]+)?)') AS m
  LIMIT 1;

  SELECT (m)[1]::numeric
  INTO v_circuits
  FROM regexp_matches(v_text, '([0-9]+(?:\.[0-9]+)?)\s*CIRCUITO') AS m
  LIMIT 1;

  SELECT (m)[1]::numeric
  INTO v_fin_spacing_mm
  FROM regexp_matches(v_text, 'ESPA[ÇC]AMENTO\s*([0-9]+(?:\.[0-9]+)?)\s*MM') AS m
  LIMIT 1;

  SELECT (m)[1]::numeric
  INTO v_tube_length_mm
  FROM regexp_matches(v_text, '-\s*([0-9]+(?:\.[0-9]+)?)\s*MM\s*$') AS m
  LIMIT 1;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'tubes_per_row', v_tubes_per_row,
    'total_tubes', CASE WHEN v_rows IS NOT NULL AND v_tubes_per_row IS NOT NULL THEN v_rows * v_tubes_per_row ELSE NULL END,
    'circuits', v_circuits,
    'tubes_per_circuit', CASE WHEN v_rows IS NOT NULL AND v_tubes_per_row IS NOT NULL AND v_circuits IS NOT NULL AND v_circuits <> 0 THEN (v_rows * v_tubes_per_row) / v_circuits ELSE NULL END,
    'fin_spacing_mm', v_fin_spacing_mm,
    'tube_length_mm', v_tube_length_mm,
    'tube_length_m', CASE WHEN v_tube_length_mm IS NOT NULL THEN v_tube_length_mm / 1000.0 ELSE NULL END,
    'total_tube_length_m', CASE WHEN v_rows IS NOT NULL AND v_tubes_per_row IS NOT NULL AND v_tube_length_mm IS NOT NULL THEN (v_rows * v_tubes_per_row * v_tube_length_mm) / 1000.0 ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.coldpro_calculate_coil_volume_l(
  p_inner_diameter_mm numeric,
  p_total_tube_length_m numeric,
  p_correction_factor numeric DEFAULT 1.10
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_inner_diameter_mm IS NULL OR p_total_tube_length_m IS NULL THEN NULL
    WHEN p_inner_diameter_mm <= 0 OR p_total_tube_length_m <= 0 THEN NULL
    ELSE round((pi() * power((p_inner_diameter_mm / 1000.0), 2) / 4.0 * p_total_tube_length_m * 1000.0 * COALESCE(NULLIF(p_correction_factor, 0), 1.10))::numeric, 3)
  END;
$$;

CREATE OR REPLACE FUNCTION public.coldpro_set_condenser_coil_calculations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parse jsonb;
BEGIN
  v_parse := public.coldpro_parse_coil_model(NEW.condenser_model);

  NEW.rows := COALESCE(NEW.rows, NULLIF(v_parse->>'rows', '')::numeric);
  NEW.tubes_per_row := COALESCE(NEW.tubes_per_row, NULLIF(v_parse->>'tubes_per_row', '')::numeric);
  NEW.total_tubes := COALESCE(NEW.total_tubes, NULLIF(v_parse->>'total_tubes', '')::numeric);
  NEW.circuits := COALESCE(NEW.circuits, NULLIF(v_parse->>'circuits', '')::numeric);
  NEW.tubes_per_circuit := COALESCE(NEW.tubes_per_circuit, NULLIF(v_parse->>'tubes_per_circuit', '')::numeric);
  NEW.fin_spacing_mm := COALESCE(NEW.fin_spacing_mm, NULLIF(v_parse->>'fin_spacing_mm', '')::numeric);
  NEW.tube_length_mm := COALESCE(NEW.tube_length_mm, NULLIF(v_parse->>'tube_length_mm', '')::numeric);
  NEW.tube_length_m := COALESCE(NEW.tube_length_m, NULLIF(v_parse->>'tube_length_m', '')::numeric);
  NEW.tube_count := COALESCE(NEW.tube_count, NEW.total_tubes);
  NEW.total_tube_length_m := COALESCE(NEW.total_tube_length_m, NULLIF(v_parse->>'total_tube_length_m', '')::numeric, NEW.tube_count * NEW.tube_length_m);

  NEW.tube_outer_diameter_mm := COALESCE(NEW.tube_outer_diameter_mm, NEW.tube_diameter_mm);
  NEW.tube_wall_thickness_mm := COALESCE(NEW.tube_wall_thickness_mm, NEW.tube_thickness_mm);

  IF NEW.tube_inner_diameter_mm IS NULL
     AND NEW.tube_outer_diameter_mm IS NOT NULL
     AND NEW.tube_wall_thickness_mm IS NOT NULL THEN
    NEW.tube_inner_diameter_mm := NEW.tube_outer_diameter_mm - (2 * NEW.tube_wall_thickness_mm);
  END IF;

  NEW.volume_correction_factor := COALESCE(NEW.volume_correction_factor, 1.10);
  NEW.calculated_internal_volume_l := public.coldpro_calculate_tube_volume_l(NEW.tube_inner_diameter_mm, NEW.tube_length_m, NEW.tube_count);
  NEW.corrected_internal_volume_l := public.coldpro_calculate_coil_volume_l(NEW.tube_inner_diameter_mm, NEW.total_tube_length_m, NEW.volume_correction_factor);
  NEW.internal_volume_l := COALESCE(NEW.internal_volume_l, NEW.corrected_internal_volume_l, NEW.calculated_internal_volume_l);
  NEW.occupied_internal_volume_l := CASE WHEN NEW.occupancy_factor IS NOT NULL THEN round((NEW.corrected_internal_volume_l * NEW.occupancy_factor)::numeric, 3) ELSE NULL END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.coldpro_set_evaporator_coil_calculations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parse jsonb;
BEGIN
  v_parse := public.coldpro_parse_coil_model(NEW.evaporator_model);

  NEW.rows := COALESCE(NEW.rows, NULLIF(v_parse->>'rows', '')::numeric);
  NEW.tubes_per_row := COALESCE(NEW.tubes_per_row, NULLIF(v_parse->>'tubes_per_row', '')::numeric);
  NEW.total_tubes := COALESCE(NEW.total_tubes, NULLIF(v_parse->>'total_tubes', '')::numeric);
  NEW.circuits := COALESCE(NEW.circuits, NULLIF(v_parse->>'circuits', '')::numeric);
  NEW.tubes_per_circuit := COALESCE(NEW.tubes_per_circuit, NULLIF(v_parse->>'tubes_per_circuit', '')::numeric);
  NEW.fin_spacing_mm := COALESCE(NEW.fin_spacing_mm, NULLIF(v_parse->>'fin_spacing_mm', '')::numeric);
  NEW.tube_length_mm := COALESCE(NEW.tube_length_mm, NULLIF(v_parse->>'tube_length_mm', '')::numeric);
  NEW.tube_length_m := COALESCE(NEW.tube_length_m, NULLIF(v_parse->>'tube_length_m', '')::numeric);
  NEW.tube_count := COALESCE(NEW.tube_count, NEW.total_tubes);
  NEW.total_tube_length_m := COALESCE(NEW.total_tube_length_m, NULLIF(v_parse->>'total_tube_length_m', '')::numeric, NEW.tube_count * NEW.tube_length_m);

  NEW.tube_outer_diameter_mm := COALESCE(NEW.tube_outer_diameter_mm, NEW.tube_diameter_mm);
  NEW.tube_wall_thickness_mm := COALESCE(NEW.tube_wall_thickness_mm, NEW.tube_thickness_mm);

  IF NEW.tube_inner_diameter_mm IS NULL
     AND NEW.tube_outer_diameter_mm IS NOT NULL
     AND NEW.tube_wall_thickness_mm IS NOT NULL THEN
    NEW.tube_inner_diameter_mm := NEW.tube_outer_diameter_mm - (2 * NEW.tube_wall_thickness_mm);
  END IF;

  NEW.volume_correction_factor := COALESCE(NEW.volume_correction_factor, 1.10);
  NEW.calculated_internal_volume_l := public.coldpro_calculate_tube_volume_l(NEW.tube_inner_diameter_mm, NEW.tube_length_m, NEW.tube_count);
  NEW.corrected_internal_volume_l := public.coldpro_calculate_coil_volume_l(NEW.tube_inner_diameter_mm, NEW.total_tube_length_m, NEW.volume_correction_factor);
  NEW.internal_volume_l := COALESCE(NEW.internal_volume_l, NEW.corrected_internal_volume_l, NEW.calculated_internal_volume_l);
  NEW.occupied_internal_volume_l := CASE WHEN NEW.occupancy_factor IS NOT NULL THEN round((NEW.corrected_internal_volume_l * NEW.occupancy_factor)::numeric, 3) ELSE NULL END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coldpro_condenser_coil_calculations ON public.coldpro_equipment_condensers;
CREATE TRIGGER coldpro_condenser_coil_calculations
BEFORE INSERT OR UPDATE OF condenser_model, tube_diameter_mm, tube_thickness_mm, tube_outer_diameter_mm, tube_wall_thickness_mm, tube_inner_diameter_mm, rows, tubes_per_row, total_tubes, circuits, fin_spacing_mm, tube_length_mm, tube_length_m, tube_count, total_tube_length_m, volume_correction_factor, occupancy_factor
ON public.coldpro_equipment_condensers
FOR EACH ROW
EXECUTE FUNCTION public.coldpro_set_condenser_coil_calculations();

DROP TRIGGER IF EXISTS coldpro_evaporator_coil_calculations ON public.coldpro_equipment_evaporators;
CREATE TRIGGER coldpro_evaporator_coil_calculations
BEFORE INSERT OR UPDATE OF evaporator_model, tube_diameter_mm, tube_thickness_mm, tube_outer_diameter_mm, tube_wall_thickness_mm, tube_inner_diameter_mm, rows, tubes_per_row, total_tubes, circuits, fin_spacing_mm, tube_length_mm, tube_length_m, tube_count, total_tube_length_m, volume_correction_factor, occupancy_factor
ON public.coldpro_equipment_evaporators
FOR EACH ROW
EXECUTE FUNCTION public.coldpro_set_evaporator_coil_calculations();