ALTER TABLE public.coldpro_equipment_condensers
ADD COLUMN IF NOT EXISTS tube_outer_diameter_mm numeric,
ADD COLUMN IF NOT EXISTS tube_inner_diameter_mm numeric,
ADD COLUMN IF NOT EXISTS tube_wall_thickness_mm numeric,
ADD COLUMN IF NOT EXISTS tube_length_m numeric,
ADD COLUMN IF NOT EXISTS tube_count numeric,
ADD COLUMN IF NOT EXISTS calculated_internal_volume_l numeric,
ADD COLUMN IF NOT EXISTS air_throw_m numeric;

ALTER TABLE public.coldpro_equipment_evaporators
ADD COLUMN IF NOT EXISTS tube_outer_diameter_mm numeric,
ADD COLUMN IF NOT EXISTS tube_inner_diameter_mm numeric,
ADD COLUMN IF NOT EXISTS tube_wall_thickness_mm numeric,
ADD COLUMN IF NOT EXISTS tube_length_m numeric,
ADD COLUMN IF NOT EXISTS tube_count numeric,
ADD COLUMN IF NOT EXISTS calculated_internal_volume_l numeric,
ADD COLUMN IF NOT EXISTS air_throw_m numeric;

CREATE OR REPLACE FUNCTION public.coldpro_calculate_tube_volume_l(
  p_inner_diameter_mm numeric,
  p_tube_length_m numeric,
  p_tube_count numeric DEFAULT 1
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_inner_diameter_mm IS NULL OR p_tube_length_m IS NULL THEN NULL
    WHEN p_inner_diameter_mm <= 0 OR p_tube_length_m <= 0 THEN NULL
    ELSE round(((pi() * power((p_inner_diameter_mm / 1000.0) / 2.0, 2) * p_tube_length_m * COALESCE(NULLIF(p_tube_count, 0), 1)) * 1000.0)::numeric, 3)
  END;
$$;

CREATE OR REPLACE FUNCTION public.coldpro_set_condenser_tube_calculations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.tube_outer_diameter_mm := COALESCE(NEW.tube_outer_diameter_mm, NEW.tube_diameter_mm);
  NEW.tube_wall_thickness_mm := COALESCE(NEW.tube_wall_thickness_mm, NEW.tube_thickness_mm);

  IF NEW.tube_inner_diameter_mm IS NULL
     AND NEW.tube_outer_diameter_mm IS NOT NULL
     AND NEW.tube_wall_thickness_mm IS NOT NULL THEN
    NEW.tube_inner_diameter_mm := NEW.tube_outer_diameter_mm - (2 * NEW.tube_wall_thickness_mm);
  END IF;

  NEW.calculated_internal_volume_l := public.coldpro_calculate_tube_volume_l(
    NEW.tube_inner_diameter_mm,
    NEW.tube_length_m,
    NEW.tube_count
  );

  NEW.internal_volume_l := COALESCE(NEW.internal_volume_l, NEW.calculated_internal_volume_l);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.coldpro_set_evaporator_tube_calculations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.tube_outer_diameter_mm := COALESCE(NEW.tube_outer_diameter_mm, NEW.tube_diameter_mm);
  NEW.tube_wall_thickness_mm := COALESCE(NEW.tube_wall_thickness_mm, NEW.tube_thickness_mm);

  IF NEW.tube_inner_diameter_mm IS NULL
     AND NEW.tube_outer_diameter_mm IS NOT NULL
     AND NEW.tube_wall_thickness_mm IS NOT NULL THEN
    NEW.tube_inner_diameter_mm := NEW.tube_outer_diameter_mm - (2 * NEW.tube_wall_thickness_mm);
  END IF;

  NEW.calculated_internal_volume_l := public.coldpro_calculate_tube_volume_l(
    NEW.tube_inner_diameter_mm,
    NEW.tube_length_m,
    NEW.tube_count
  );

  NEW.internal_volume_l := COALESCE(NEW.internal_volume_l, NEW.calculated_internal_volume_l);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coldpro_condensers_tube_calculations ON public.coldpro_equipment_condensers;
CREATE TRIGGER coldpro_condensers_tube_calculations
BEFORE INSERT OR UPDATE ON public.coldpro_equipment_condensers
FOR EACH ROW
EXECUTE FUNCTION public.coldpro_set_condenser_tube_calculations();

DROP TRIGGER IF EXISTS coldpro_evaporators_tube_calculations ON public.coldpro_equipment_evaporators;
CREATE TRIGGER coldpro_evaporators_tube_calculations
BEFORE INSERT OR UPDATE ON public.coldpro_equipment_evaporators
FOR EACH ROW
EXECUTE FUNCTION public.coldpro_set_evaporator_tube_calculations();