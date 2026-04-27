CREATE TABLE IF NOT EXISTS public.coldpro_refrigerant_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refrigerant text NOT NULL,
  reference_temperature_c numeric NOT NULL,
  liquid_density_kg_l numeric NOT NULL,
  source text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (refrigerant, reference_temperature_c)
);

ALTER TABLE public.coldpro_refrigerant_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coldpro_refrigerant_properties_select" ON public.coldpro_refrigerant_properties;
CREATE POLICY "coldpro_refrigerant_properties_select"
ON public.coldpro_refrigerant_properties
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "coldpro_refrigerant_properties_modify" ON public.coldpro_refrigerant_properties;
CREATE POLICY "coldpro_refrigerant_properties_modify"
ON public.coldpro_refrigerant_properties
FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

INSERT INTO public.coldpro_refrigerant_properties (refrigerant, reference_temperature_c, liquid_density_kg_l, source, notes)
VALUES
  ('R404A', -30, 1.20, 'Regra técnica informada', 'Densidade líquida aproximada para cálculo de carga técnica.'),
  ('R404A', -10, 1.10, 'Regra técnica informada', 'Densidade líquida aproximada para cálculo de carga técnica.'),
  ('R404A', 0, 1.05, 'Regra técnica informada', 'Densidade líquida aproximada para cálculo de carga técnica.')
ON CONFLICT (refrigerant, reference_temperature_c) DO UPDATE
SET liquid_density_kg_l = EXCLUDED.liquid_density_kg_l,
    source = EXCLUDED.source,
    notes = EXCLUDED.notes;

ALTER TABLE public.coldpro_equipment_condensers
  ADD COLUMN IF NOT EXISTS refrigerant_density_kg_l numeric,
  ADD COLUMN IF NOT EXISTS refrigerant_reference_temp_c numeric,
  ADD COLUMN IF NOT EXISTS refrigerant_occupancy_factor numeric,
  ADD COLUMN IF NOT EXISTS estimated_refrigerant_charge_kg numeric,
  ADD COLUMN IF NOT EXISTS estimated_refrigerant_charge_note text;

ALTER TABLE public.coldpro_equipment_evaporators
  ADD COLUMN IF NOT EXISTS refrigerant_density_kg_l numeric,
  ADD COLUMN IF NOT EXISTS refrigerant_reference_temp_c numeric,
  ADD COLUMN IF NOT EXISTS refrigerant_occupancy_factor numeric,
  ADD COLUMN IF NOT EXISTS estimated_refrigerant_charge_kg numeric,
  ADD COLUMN IF NOT EXISTS estimated_refrigerant_charge_note text,
  ADD COLUMN IF NOT EXISTS tube_external_area_m2 numeric,
  ADD COLUMN IF NOT EXISTS fin_area_multiplier numeric,
  ADD COLUMN IF NOT EXISTS estimated_exchange_area_m2 numeric,
  ADD COLUMN IF NOT EXISTS fin_efficiency_factor numeric,
  ADD COLUMN IF NOT EXISTS effective_exchange_area_m2 numeric;

CREATE OR REPLACE FUNCTION public.coldpro_refrigerant_density_nearest(p_refrigerant text, p_temperature_c numeric)
RETURNS TABLE(reference_temperature_c numeric, liquid_density_kg_l numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT rp.reference_temperature_c, rp.liquid_density_kg_l
  FROM public.coldpro_refrigerant_properties rp
  WHERE upper(replace(rp.refrigerant, ' ', '')) = upper(replace(COALESCE(p_refrigerant, ''), ' ', ''))
  ORDER BY abs(rp.reference_temperature_c - COALESCE(p_temperature_c, rp.reference_temperature_c)) ASC,
           rp.reference_temperature_c DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.coldpro_default_fin_multiplier(p_fin_spacing_mm numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_fin_spacing_mm IS NULL THEN NULL
    WHEN p_fin_spacing_mm <= 2.10 THEN 16
    WHEN p_fin_spacing_mm <= 3.60 THEN 14
    WHEN p_fin_spacing_mm <= 5.00 THEN 12
    WHEN p_fin_spacing_mm <= 7.00 THEN 10
    ELSE 8
  END;
$$;

CREATE OR REPLACE FUNCTION public.coldpro_set_condenser_coil_calculations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parse jsonb;
  v_refrigerant text;
  v_density record;
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
  NEW.occupancy_factor := COALESCE(NEW.occupancy_factor, 0.80);
  NEW.occupied_internal_volume_l := CASE WHEN NEW.occupancy_factor IS NOT NULL THEN round((NEW.corrected_internal_volume_l * NEW.occupancy_factor)::numeric, 3) ELSE NULL END;

  SELECT m.refrigerante INTO v_refrigerant
  FROM public.coldpro_equipment_models m
  WHERE m.id = NEW.equipment_model_id;

  NEW.refrigerant_reference_temp_c := COALESCE(NEW.refrigerant_reference_temp_c, 0);
  SELECT * INTO v_density
  FROM public.coldpro_refrigerant_density_nearest(v_refrigerant, NEW.refrigerant_reference_temp_c);

  NEW.refrigerant_density_kg_l := COALESCE(NEW.refrigerant_density_kg_l, v_density.liquid_density_kg_l);
  NEW.refrigerant_reference_temp_c := COALESCE(v_density.reference_temperature_c, NEW.refrigerant_reference_temp_c);
  NEW.refrigerant_occupancy_factor := COALESCE(NEW.refrigerant_occupancy_factor, 0.80);

  NEW.estimated_refrigerant_charge_kg := CASE
    WHEN NEW.corrected_internal_volume_l IS NOT NULL AND NEW.refrigerant_density_kg_l IS NOT NULL AND NEW.refrigerant_occupancy_factor IS NOT NULL
      THEN round((NEW.corrected_internal_volume_l * NEW.refrigerant_density_kg_l * NEW.refrigerant_occupancy_factor)::numeric, 3)
    ELSE NULL
  END;
  NEW.estimated_refrigerant_charge_note := CASE
    WHEN NEW.estimated_refrigerant_charge_kg IS NOT NULL THEN 'Condensador a ar: m = volume interno corrigido × densidade líquida × fator de ocupação 0,80. Valor aproximado; não substitui carga final ajustada em campo.'
    ELSE NEW.estimated_refrigerant_charge_note
  END;

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
  v_refrigerant text;
  v_reference_temp numeric;
  v_density record;
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
  NEW.occupancy_factor := COALESCE(NEW.occupancy_factor, 0.30);
  NEW.occupied_internal_volume_l := CASE WHEN NEW.occupancy_factor IS NOT NULL THEN round((NEW.corrected_internal_volume_l * NEW.occupancy_factor)::numeric, 3) ELSE NULL END;

  SELECT m.refrigerante, avg(p.evaporation_temp_c)
  INTO v_refrigerant, v_reference_temp
  FROM public.coldpro_equipment_models m
  LEFT JOIN public.coldpro_equipment_performance_points p ON p.equipment_model_id = m.id
  WHERE m.id = NEW.equipment_model_id
  GROUP BY m.refrigerante;

  NEW.refrigerant_reference_temp_c := COALESCE(NEW.refrigerant_reference_temp_c, v_reference_temp, -10);
  SELECT * INTO v_density
  FROM public.coldpro_refrigerant_density_nearest(v_refrigerant, NEW.refrigerant_reference_temp_c);

  NEW.refrigerant_density_kg_l := COALESCE(NEW.refrigerant_density_kg_l, v_density.liquid_density_kg_l);
  NEW.refrigerant_reference_temp_c := COALESCE(v_density.reference_temperature_c, NEW.refrigerant_reference_temp_c);
  NEW.refrigerant_occupancy_factor := COALESCE(NEW.refrigerant_occupancy_factor, 0.30);

  NEW.estimated_refrigerant_charge_kg := CASE
    WHEN NEW.corrected_internal_volume_l IS NOT NULL AND NEW.refrigerant_density_kg_l IS NOT NULL AND NEW.refrigerant_occupancy_factor IS NOT NULL
      THEN round((NEW.corrected_internal_volume_l * NEW.refrigerant_density_kg_l * NEW.refrigerant_occupancy_factor)::numeric, 3)
    ELSE NULL
  END;
  NEW.estimated_refrigerant_charge_note := CASE
    WHEN NEW.estimated_refrigerant_charge_kg IS NOT NULL THEN 'Evaporador DX: m = volume interno corrigido × densidade líquida × fator de ocupação 0,30. Valor aproximado; não substitui carga final ajustada em campo.'
    ELSE NEW.estimated_refrigerant_charge_note
  END;

  NEW.tube_external_area_m2 := CASE
    WHEN NEW.tube_outer_diameter_mm IS NOT NULL AND NEW.total_tube_length_m IS NOT NULL
      THEN round((pi() * (NEW.tube_outer_diameter_mm / 1000.0) * NEW.total_tube_length_m)::numeric, 3)
    ELSE NULL
  END;
  NEW.fin_area_multiplier := COALESCE(NEW.fin_area_multiplier, public.coldpro_default_fin_multiplier(NEW.fin_spacing_mm));
  NEW.estimated_exchange_area_m2 := CASE
    WHEN NEW.tube_external_area_m2 IS NOT NULL AND NEW.fin_area_multiplier IS NOT NULL
      THEN round((NEW.tube_external_area_m2 * NEW.fin_area_multiplier)::numeric, 3)
    ELSE NULL
  END;
  NEW.effective_exchange_area_m2 := CASE
    WHEN NEW.estimated_exchange_area_m2 IS NOT NULL AND NEW.fin_efficiency_factor IS NOT NULL
      THEN round((NEW.estimated_exchange_area_m2 * NEW.fin_efficiency_factor)::numeric, 3)
    ELSE NULL
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coldpro_condenser_coil_calculations ON public.coldpro_equipment_condensers;
CREATE TRIGGER coldpro_condenser_coil_calculations
BEFORE INSERT OR UPDATE OF condenser_model, tube_diameter_mm, tube_thickness_mm, tube_outer_diameter_mm, tube_wall_thickness_mm, tube_inner_diameter_mm, rows, tubes_per_row, total_tubes, circuits, fin_spacing_mm, tube_length_mm, tube_length_m, tube_count, total_tube_length_m, volume_correction_factor, occupancy_factor, refrigerant_density_kg_l, refrigerant_reference_temp_c, refrigerant_occupancy_factor
ON public.coldpro_equipment_condensers
FOR EACH ROW
EXECUTE FUNCTION public.coldpro_set_condenser_coil_calculations();

DROP TRIGGER IF EXISTS coldpro_evaporator_coil_calculations ON public.coldpro_equipment_evaporators;
CREATE TRIGGER coldpro_evaporator_coil_calculations
BEFORE INSERT OR UPDATE OF evaporator_model, tube_diameter_mm, tube_thickness_mm, tube_outer_diameter_mm, tube_wall_thickness_mm, tube_inner_diameter_mm, rows, tubes_per_row, total_tubes, circuits, fin_spacing_mm, tube_length_mm, tube_length_m, tube_count, total_tube_length_m, volume_correction_factor, occupancy_factor, refrigerant_density_kg_l, refrigerant_reference_temp_c, refrigerant_occupancy_factor, fin_area_multiplier, fin_efficiency_factor
ON public.coldpro_equipment_evaporators
FOR EACH ROW
EXECUTE FUNCTION public.coldpro_set_evaporator_coil_calculations();

UPDATE public.coldpro_equipment_condensers
SET condenser_model = condenser_model,
    refrigerant_occupancy_factor = COALESCE(refrigerant_occupancy_factor, 0.80),
    volume_correction_factor = COALESCE(volume_correction_factor, 1.10)
WHERE condenser_model IS NOT NULL
  AND condenser_model <> '-';

UPDATE public.coldpro_equipment_evaporators
SET evaporator_model = evaporator_model,
    refrigerant_occupancy_factor = COALESCE(refrigerant_occupancy_factor, 0.30),
    volume_correction_factor = COALESCE(volume_correction_factor, 1.10)
WHERE evaporator_model IS NOT NULL
  AND evaporator_model <> '-';