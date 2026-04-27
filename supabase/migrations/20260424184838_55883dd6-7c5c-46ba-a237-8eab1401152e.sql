-- =========================================================
-- IMPORTAÇÕES (auditoria)
-- =========================================================
CREATE TABLE public.coldpro_catalog_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  sheet_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  models_created INTEGER NOT NULL DEFAULT 0,
  models_updated INTEGER NOT NULL DEFAULT 0,
  performance_points_created INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | success | error
  error_message TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_by UUID,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.coldpro_catalog_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.coldpro_catalog_imports(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | imported | skipped | error
  error_message TEXT,
  equipment_model_id UUID,
  performance_point_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coldpro_import_rows_import ON public.coldpro_catalog_import_rows(import_id);

-- =========================================================
-- MODELOS DE EQUIPAMENTO
-- =========================================================
CREATE TABLE public.coldpro_equipment_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo TEXT NOT NULL,
  linha TEXT,                     -- HT / MT / LT
  designacao_hp TEXT,
  gabinete TEXT,
  tipo_gabinete TEXT,
  refrigerante TEXT,
  gwp_ar6 NUMERIC,
  odp_ar6 NUMERIC,
  tipo_degelo TEXT,
  application_type TEXT,          -- cold_room / freezer / tunnel ...
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  source_import_id UUID REFERENCES public.coldpro_catalog_imports(id) ON DELETE SET NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (modelo, refrigerante, gabinete)
);

CREATE INDEX idx_coldpro_models_modelo ON public.coldpro_equipment_models(modelo);
CREATE INDEX idx_coldpro_models_linha ON public.coldpro_equipment_models(linha);

-- =========================================================
-- COMPRESSORES
-- =========================================================
CREATE TABLE public.coldpro_equipment_compressors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_model_id UUID NOT NULL REFERENCES public.coldpro_equipment_models(id) ON DELETE CASCADE,
  copeland TEXT,
  bitzer TEXT,
  danfoss_bock TEXT,
  dorin TEXT,
  copeland_secondary TEXT,
  bitzer_secondary TEXT,
  danfoss_secondary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipment_model_id)
);

-- =========================================================
-- CONDENSADOR
-- =========================================================
CREATE TABLE public.coldpro_equipment_condensers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_model_id UUID NOT NULL REFERENCES public.coldpro_equipment_models(id) ON DELETE CASCADE,
  condenser_model TEXT,
  tube_diameter_in NUMERIC,
  tube_diameter_mm NUMERIC,
  tube_thickness_mm NUMERIC,
  geometry TEXT,
  internal_volume_l NUMERIC,
  fan_model TEXT,
  airflow_m3_h NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipment_model_id)
);

-- =========================================================
-- EVAPORADOR
-- =========================================================
CREATE TABLE public.coldpro_equipment_evaporators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_model_id UUID NOT NULL REFERENCES public.coldpro_equipment_models(id) ON DELETE CASCADE,
  evaporator_model TEXT,
  reheating TEXT,
  tube_diameter_in NUMERIC,
  tube_diameter_mm NUMERIC,
  tube_thickness_mm NUMERIC,
  geometry TEXT,
  internal_volume_l NUMERIC,
  surface_area_m2 NUMERIC,
  evaporator_quantity NUMERIC,
  fan_model TEXT,
  airflow_m3_h NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipment_model_id)
);

-- =========================================================
-- PONTOS DE PERFORMANCE (curva real)
-- =========================================================
CREATE TABLE public.coldpro_equipment_performance_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_model_id UUID NOT NULL REFERENCES public.coldpro_equipment_models(id) ON DELETE CASCADE,
  source_import_id UUID REFERENCES public.coldpro_catalog_imports(id) ON DELETE SET NULL,

  -- Condições operacionais
  temperature_room_c NUMERIC,
  humidity_room_percent NUMERIC,
  evaporation_temp_c NUMERIC,
  condensation_temp_c NUMERIC,
  external_temp_c NUMERIC,
  external_humidity_percent NUMERIC,
  altitude_m NUMERIC,

  -- Capacidades
  evaporator_capacity_kcal_h NUMERIC,
  compressor_capacity_kcal_h NUMERIC,
  heat_rejection_kcal_h NUMERIC,

  -- Termodinâmica
  mass_flow_kg_h NUMERIC,
  mass_flow_kg_s NUMERIC,
  enthalpy_difference_kj_kg NUMERIC,
  total_superheat_k NUMERIC,
  useful_superheat_k NUMERIC,
  subcooling_k NUMERIC,
  additional_subcooling_k NUMERIC,

  -- Potências
  compressor_power_kw NUMERIC,
  fan_power_kw NUMERIC,
  total_power_kw NUMERIC,
  cop NUMERIC,
  cop_carnot NUMERIC,
  global_cop NUMERIC,

  -- Elétricos
  voltage TEXT,
  compressor_current_a NUMERIC,
  fan_current_a NUMERIC,
  estimated_current_a NUMERIC,
  starting_current_a NUMERIC,

  -- Carga e dreno
  fluid_charge_kg NUMERIC,
  drain_water_l_h NUMERIC,
  drain_diameter TEXT,
  drain_quantity NUMERIC,

  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coldpro_perf_model ON public.coldpro_equipment_performance_points(equipment_model_id);
CREATE INDEX idx_coldpro_perf_evap ON public.coldpro_equipment_performance_points(evaporation_temp_c);
CREATE INDEX idx_coldpro_perf_cond ON public.coldpro_equipment_performance_points(condensation_temp_c);
CREATE INDEX idx_coldpro_perf_room ON public.coldpro_equipment_performance_points(temperature_room_c);

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.coldpro_catalog_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_catalog_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_equipment_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_equipment_compressors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_equipment_condensers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_equipment_evaporators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_equipment_performance_points ENABLE ROW LEVEL SECURITY;

-- Imports: select para todos auth, modify para engenharia/admin/diretoria
CREATE POLICY "coldpro_imports_select" ON public.coldpro_catalog_imports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coldpro_imports_modify" ON public.coldpro_catalog_imports
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

CREATE POLICY "coldpro_import_rows_select" ON public.coldpro_catalog_import_rows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coldpro_import_rows_modify" ON public.coldpro_catalog_import_rows
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

-- Modelos e relacionados: leitura geral, escrita por engenharia/admin
CREATE POLICY "coldpro_models_select" ON public.coldpro_equipment_models
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coldpro_models_modify" ON public.coldpro_equipment_models
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

CREATE POLICY "coldpro_compressors_select" ON public.coldpro_equipment_compressors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coldpro_compressors_modify" ON public.coldpro_equipment_compressors
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

CREATE POLICY "coldpro_condensers_select" ON public.coldpro_equipment_condensers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coldpro_condensers_modify" ON public.coldpro_equipment_condensers
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

CREATE POLICY "coldpro_evaporators_select" ON public.coldpro_equipment_evaporators
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coldpro_evaporators_modify" ON public.coldpro_equipment_evaporators
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

CREATE POLICY "coldpro_perf_select" ON public.coldpro_equipment_performance_points
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coldpro_perf_modify" ON public.coldpro_equipment_performance_points
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

-- Triggers updated_at
CREATE TRIGGER set_updated_at_coldpro_models
  BEFORE UPDATE ON public.coldpro_equipment_models
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();