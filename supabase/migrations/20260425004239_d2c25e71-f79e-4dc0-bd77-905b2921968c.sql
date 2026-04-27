CREATE TABLE IF NOT EXISTS public.coldpro_thermal_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name text NOT NULL,
  category text NOT NULL,
  thermal_conductivity_w_mk numeric(8,5) NOT NULL,
  density_kg_m3 numeric(8,2),
  min_temp_c numeric(6,2),
  max_temp_c numeric(6,2),
  typical_thickness_mm integer,
  is_insulation boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coldpro_thermal_materials_name_key UNIQUE (material_name),
  CONSTRAINT coldpro_thermal_materials_conductivity_positive CHECK (thermal_conductivity_w_mk > 0)
);

ALTER TABLE public.coldpro_thermal_materials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coldpro_thermal_materials'
      AND policyname = 'coldpro_thermal_materials_auth'
  ) THEN
    CREATE POLICY "coldpro_thermal_materials_auth"
    ON public.coldpro_thermal_materials
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_updated_at_coldpro_thermal_materials ON public.coldpro_thermal_materials;
CREATE TRIGGER set_updated_at_coldpro_thermal_materials
BEFORE UPDATE ON public.coldpro_thermal_materials
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_coldpro_thermal_materials_category
ON public.coldpro_thermal_materials(category, material_name);

INSERT INTO public.coldpro_thermal_materials
(material_name, category, thermal_conductivity_w_mk, density_kg_m3, min_temp_c, max_temp_c, typical_thickness_mm, is_insulation, notes)
VALUES
('EPS (Poliestireno Expandido)', 'insulation', 0.03600, 20, -50, 75, 100, true, 'Baixo custo, menor performance térmica'),
('XPS (Poliestireno Extrudado)', 'insulation', 0.03000, 35, -50, 75, 100, true, 'Maior resistência mecânica que EPS'),
('PUR (Poliuretano)', 'insulation', 0.02200, 40, -200, 120, 100, true, 'Excelente isolamento térmico'),
('PIR (Poliisocianurato)', 'insulation', 0.02100, 45, -200, 140, 100, true, 'Melhor que PUR em alta temperatura'),
('Lã de vidro', 'insulation', 0.04000, 15, -50, 250, 50, true, 'Uso geral, baixa densidade'),
('Lã de rocha', 'insulation', 0.03800, 80, -50, 600, 50, true, 'Alta resistência térmica'),
('Isopor de alta densidade', 'insulation', 0.03300, 30, -50, 75, 100, true, 'Versão mais densa do EPS'),
('Painel isotérmico PUR', 'panel', 0.02200, 40, -200, 120, 100, true, 'Padrão industrial CN Cold'),
('Painel isotérmico PIR', 'panel', 0.02100, 45, -200, 140, 100, true, 'Alta performance'),
('Painel isotérmico EPS', 'panel', 0.03600, 20, -50, 75, 100, true, 'Mais barato, menos eficiente'),
('Concreto', 'structure', 1.75000, 2400, null, null, 100, false, null),
('Cimento', 'structure', 1.40000, 2000, null, null, 50, false, null),
('Bloco de concreto', 'structure', 1.10000, 1800, null, null, 140, false, null),
('Tijolo cerâmico', 'structure', 0.72000, 1600, null, null, 140, false, null),
('Aço carbono', 'structure', 50.00000, 7850, null, null, 1, false, null),
('Alumínio', 'structure', 205.00000, 2700, null, null, 1, false, null),
('Madeira', 'structure', 0.13000, 600, null, null, 20, false, null)
ON CONFLICT (material_name) DO UPDATE SET
  category = EXCLUDED.category,
  thermal_conductivity_w_mk = EXCLUDED.thermal_conductivity_w_mk,
  density_kg_m3 = EXCLUDED.density_kg_m3,
  min_temp_c = EXCLUDED.min_temp_c,
  max_temp_c = EXCLUDED.max_temp_c,
  typical_thickness_mm = EXCLUDED.typical_thickness_mm,
  is_insulation = EXCLUDED.is_insulation,
  notes = EXCLUDED.notes,
  updated_at = now();