CREATE TABLE IF NOT EXISTS public.coldpro_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'insulation',
  thermal_conductivity_w_m_k numeric NOT NULL DEFAULT 0.025,
  density_kg_m3 numeric,
  default_thickness_mm numeric,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coldpro_surfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.coldpro_projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.coldpro_environments(id) ON DELETE CASCADE,
  surface_type text NOT NULL,
  label text NOT NULL,
  area_total_m2 numeric NOT NULL DEFAULT 0,
  area_glass_m2 numeric NOT NULL DEFAULT 0,
  area_door_m2 numeric NOT NULL DEFAULT 0,
  u_opaque_w_m2k numeric NOT NULL DEFAULT 0.25,
  u_door_w_m2k numeric NOT NULL DEFAULT 1.5,
  glass_type text NOT NULL DEFAULT 'none',
  solar_level text NOT NULL DEFAULT 'sem_sol',
  solar_factor numeric NOT NULL DEFAULT 0.75,
  external_temp_c numeric,
  soil_temp_c numeric,
  has_floor_insulation boolean NOT NULL DEFAULT true,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coldpro_surfaces_owner_check CHECK (project_id IS NOT NULL OR environment_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.coldpro_wall_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_id uuid NOT NULL REFERENCES public.coldpro_surfaces(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.coldpro_materials(id) ON DELETE SET NULL,
  material_name text NOT NULL,
  thickness_m numeric NOT NULL DEFAULT 0,
  thermal_conductivity_w_m_k numeric NOT NULL DEFAULT 0.025,
  layer_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coldpro_process_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.coldpro_projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.coldpro_environments(id) ON DELETE CASCADE,
  application_mode text NOT NULL DEFAULT 'cold_room_chilled',
  operation_mode text NOT NULL DEFAULT 'batch',
  product_id uuid REFERENCES public.coldpro_products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT 'Produto',
  product_category text,
  mass_kg numeric NOT NULL DEFAULT 0,
  production_kg_h numeric NOT NULL DEFAULT 0,
  batch_mass_kg numeric NOT NULL DEFAULT 0,
  batch_time_h numeric NOT NULL DEFAULT 24,
  inlet_temp_c numeric NOT NULL DEFAULT 20,
  outlet_temp_c numeric NOT NULL DEFAULT 0,
  freezing_temp_c numeric NOT NULL DEFAULT -1,
  cp_above_kj_kg_k numeric NOT NULL DEFAULT 3.6,
  cp_below_kj_kg_k numeric NOT NULL DEFAULT 1.9,
  latent_heat_kj_kg numeric NOT NULL DEFAULT 250,
  freezable_fraction numeric NOT NULL DEFAULT 0.75,
  specific_load_kj_kg numeric,
  retention_time_min numeric,
  product_thickness_m numeric,
  product_density_kg_m3 numeric,
  product_thermal_conductivity_w_m_k numeric,
  air_velocity_m_s numeric,
  air_temp_c numeric,
  pull_down_kw numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coldpro_process_owner_check CHECK (project_id IS NOT NULL OR environment_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.coldpro_infiltration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.coldpro_projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.coldpro_environments(id) ON DELETE CASCADE,
  altitude_m numeric NOT NULL DEFAULT 0,
  air_volume_infiltrated_m3_h numeric NOT NULL DEFAULT 0,
  door_openings_per_day numeric NOT NULL DEFAULT 0,
  door_area_m2 numeric NOT NULL DEFAULT 0,
  opening_factor numeric NOT NULL DEFAULT 1,
  air_renovation_m3_h numeric NOT NULL DEFAULT 0,
  external_temp_c numeric,
  internal_temp_c numeric,
  air_density_kg_m3 numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coldpro_infiltration_owner_check CHECK (project_id IS NOT NULL OR environment_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.coldpro_internal_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.coldpro_projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.coldpro_environments(id) ON DELETE CASCADE,
  people_quantity numeric NOT NULL DEFAULT 0,
  people_load_w numeric NOT NULL DEFAULT 350,
  people_use_factor numeric NOT NULL DEFAULT 1,
  lighting_w_m2 numeric NOT NULL DEFAULT 8,
  lighting_area_m2 numeric NOT NULL DEFAULT 0,
  lighting_use_factor numeric NOT NULL DEFAULT 1,
  motors_power_kw numeric NOT NULL DEFAULT 0,
  motors_use_factor numeric NOT NULL DEFAULT 1,
  packaging_mass_kg numeric NOT NULL DEFAULT 0,
  packaging_cp_kj_kg_k numeric NOT NULL DEFAULT 1.7,
  packaging_delta_t_k numeric NOT NULL DEFAULT 0,
  respiration_mass_kg numeric NOT NULL DEFAULT 0,
  respiration_rate_w_kg numeric NOT NULL DEFAULT 0,
  apply_respiration boolean NOT NULL DEFAULT false,
  pull_down_kw numeric NOT NULL DEFAULT 0,
  safety_factor numeric NOT NULL DEFAULT 1.1,
  defrost_factor numeric NOT NULL DEFAULT 1,
  fan_factor numeric NOT NULL DEFAULT 1,
  operational_factor numeric NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coldpro_internal_loads_owner_check CHECK (project_id IS NOT NULL OR environment_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.coldpro_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.coldpro_projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.coldpro_environments(id) ON DELETE SET NULL,
  result_id uuid REFERENCES public.coldpro_results(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Memória de cálculo ColdPro',
  calculation_memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_text text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coldpro_reports_owner_check CHECK (project_id IS NOT NULL OR environment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS coldpro_surfaces_project_idx ON public.coldpro_surfaces(project_id);
CREATE INDEX IF NOT EXISTS coldpro_surfaces_environment_idx ON public.coldpro_surfaces(environment_id);
CREATE INDEX IF NOT EXISTS coldpro_wall_compositions_surface_idx ON public.coldpro_wall_compositions(surface_id);
CREATE INDEX IF NOT EXISTS coldpro_process_project_idx ON public.coldpro_process_parameters(project_id);
CREATE INDEX IF NOT EXISTS coldpro_process_environment_idx ON public.coldpro_process_parameters(environment_id);
CREATE INDEX IF NOT EXISTS coldpro_infiltration_project_idx ON public.coldpro_infiltration(project_id);
CREATE INDEX IF NOT EXISTS coldpro_internal_loads_project_idx ON public.coldpro_internal_loads(project_id);
CREATE INDEX IF NOT EXISTS coldpro_reports_project_idx ON public.coldpro_reports(project_id);

ALTER TABLE public.coldpro_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_surfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_wall_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_process_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_infiltration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_internal_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coldpro_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY coldpro_materials_authenticated_access ON public.coldpro_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY coldpro_surfaces_authenticated_access ON public.coldpro_surfaces FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY coldpro_wall_compositions_authenticated_access ON public.coldpro_wall_compositions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY coldpro_process_parameters_authenticated_access ON public.coldpro_process_parameters FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY coldpro_infiltration_authenticated_access ON public.coldpro_infiltration FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY coldpro_internal_loads_authenticated_access ON public.coldpro_internal_loads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY coldpro_reports_authenticated_access ON public.coldpro_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_coldpro_materials_updated_at ON public.coldpro_materials;
CREATE TRIGGER update_coldpro_materials_updated_at BEFORE UPDATE ON public.coldpro_materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_coldpro_surfaces_updated_at ON public.coldpro_surfaces;
CREATE TRIGGER update_coldpro_surfaces_updated_at BEFORE UPDATE ON public.coldpro_surfaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_coldpro_wall_compositions_updated_at ON public.coldpro_wall_compositions;
CREATE TRIGGER update_coldpro_wall_compositions_updated_at BEFORE UPDATE ON public.coldpro_wall_compositions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_coldpro_process_parameters_updated_at ON public.coldpro_process_parameters;
CREATE TRIGGER update_coldpro_process_parameters_updated_at BEFORE UPDATE ON public.coldpro_process_parameters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_coldpro_infiltration_updated_at ON public.coldpro_infiltration;
CREATE TRIGGER update_coldpro_infiltration_updated_at BEFORE UPDATE ON public.coldpro_infiltration FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_coldpro_internal_loads_updated_at ON public.coldpro_internal_loads;
CREATE TRIGGER update_coldpro_internal_loads_updated_at BEFORE UPDATE ON public.coldpro_internal_loads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS update_coldpro_reports_updated_at ON public.coldpro_reports;
CREATE TRIGGER update_coldpro_reports_updated_at BEFORE UPDATE ON public.coldpro_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.coldpro_materials (name, category, thermal_conductivity_w_m_k, density_kg_m3, default_thickness_mm, notes)
VALUES
  ('PIR', 'insulation', 0.022, 40, 100, 'Poliisocianurato para painéis frigoríficos'),
  ('PU', 'insulation', 0.024, 38, 100, 'Poliuretano expandido'),
  ('EPS', 'insulation', 0.036, 20, 100, 'Poliestireno expandido'),
  ('Lã de rocha', 'insulation', 0.040, 64, 75, 'Isolamento mineral'),
  ('Concreto', 'structure', 1.750, 2400, 100, 'Camada estrutural')
ON CONFLICT DO NOTHING;