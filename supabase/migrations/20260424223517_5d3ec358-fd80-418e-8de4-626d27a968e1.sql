CREATE TABLE IF NOT EXISTS public.coldpro_refrigerants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  family text,
  composition text,
  description text,
  typical_applications text,
  safety_class text,
  ashrae_class text,
  gwp_ar6 numeric,
  odp_ar6 numeric,
  glide_k numeric,
  boiling_point_c numeric,
  critical_temperature_c numeric,
  liquid_density_kg_l numeric,
  reference_temperature_c numeric,
  oil_compatibility text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coldpro_refrigerants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coldpro_refrigerants_select ON public.coldpro_refrigerants;
DROP POLICY IF EXISTS coldpro_refrigerants_modify ON public.coldpro_refrigerants;

CREATE POLICY coldpro_refrigerants_select
ON public.coldpro_refrigerants
FOR SELECT
USING (true);

CREATE POLICY coldpro_refrigerants_modify
ON public.coldpro_refrigerants
FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

CREATE TABLE IF NOT EXISTS public.coldpro_equipment_model_refrigerants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_model_id uuid NOT NULL,
  refrigerant_id uuid NOT NULL REFERENCES public.coldpro_refrigerants(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  compatibility_notes text,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (equipment_model_id, refrigerant_id)
);

ALTER TABLE public.coldpro_equipment_model_refrigerants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coldpro_model_refrigerants_select ON public.coldpro_equipment_model_refrigerants;
DROP POLICY IF EXISTS coldpro_model_refrigerants_modify ON public.coldpro_equipment_model_refrigerants;

CREATE POLICY coldpro_model_refrigerants_select
ON public.coldpro_equipment_model_refrigerants
FOR SELECT
USING (true);

CREATE POLICY coldpro_model_refrigerants_modify
ON public.coldpro_equipment_model_refrigerants
FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::app_role, 'admin'::app_role, 'diretoria'::app_role]));

CREATE INDEX IF NOT EXISTS coldpro_model_refrigerants_model_idx
ON public.coldpro_equipment_model_refrigerants (equipment_model_id);

CREATE INDEX IF NOT EXISTS coldpro_model_refrigerants_refrigerant_idx
ON public.coldpro_equipment_model_refrigerants (refrigerant_id);

DROP TRIGGER IF EXISTS update_coldpro_refrigerants_updated_at ON public.coldpro_refrigerants;
CREATE TRIGGER update_coldpro_refrigerants_updated_at
BEFORE UPDATE ON public.coldpro_refrigerants
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.coldpro_refrigerants (
  code, name, family, composition, description, typical_applications, safety_class, ashrae_class,
  gwp_ar6, odp_ar6, glide_k, boiling_point_c, critical_temperature_c, liquid_density_kg_l,
  reference_temperature_c, oil_compatibility, notes
) VALUES
  ('R134a', 'R134a', 'HFC puro', '1,1,1,2-Tetrafluoroetano', 'Fluido HFC de componente único usado em aplicações de alta e média temperatura, com operação estável e sem glide relevante.', 'Climatizados, resfriados positivos, chillers e sistemas de média/alta temperatura.', 'A1', 'A1 — baixa toxicidade, não inflamável', 1430, 0, 0, -26.1, 101.1, 1.294, 0, 'Óleo POE; compatibilidade depende do compressor e do fabricante.', 'ODP zero; GWP elevado. Usar conforme projeto, legislação aplicável e recomendação do compressor.'),
  ('R404A', 'R404A', 'Mistura HFC quase azeotrópica', 'R125 / R143a / R134a', 'Mistura HFC tradicional para refrigeração comercial de média e baixa temperatura, com boa capacidade frigorífica e glide pequeno.', 'Baixa e média temperatura, congelados, câmaras frias, túneis e aplicações comerciais.', 'A1', 'A1 — baixa toxicidade, não inflamável', 3943, 0, 0.7, -46.5, 72.1, 1.049, 0, 'Óleo POE; seguir envelope do compressor e critérios de retorno de óleo.', 'ODP zero; GWP muito elevado. Carga deve ser controlada e alternativas de menor GWP podem ser avaliadas por projeto.'),
  ('R410A', 'R410A', 'Mistura HFC quase azeotrópica', 'R32 / R125', 'Mistura HFC de alta pressão, usada em sistemas de climatização e aplicações de alta/média temperatura com componentes compatíveis.', 'Climatização, resfriamento e equipamentos projetados para pressões de trabalho mais altas.', 'A1', 'A1 — baixa toxicidade, não inflamável', 1924, 0, 0.1, -51.6, 72.5, 1.062, 0, 'Óleo POE; requer componentes, válvulas e trocadores dimensionados para alta pressão.', 'Não substituir diretamente outros fluidos sem validação técnica de pressão, compressor, válvula e trocadores.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  family = EXCLUDED.family,
  composition = EXCLUDED.composition,
  description = EXCLUDED.description,
  typical_applications = EXCLUDED.typical_applications,
  safety_class = EXCLUDED.safety_class,
  ashrae_class = EXCLUDED.ashrae_class,
  gwp_ar6 = EXCLUDED.gwp_ar6,
  odp_ar6 = EXCLUDED.odp_ar6,
  glide_k = EXCLUDED.glide_k,
  boiling_point_c = EXCLUDED.boiling_point_c,
  critical_temperature_c = EXCLUDED.critical_temperature_c,
  liquid_density_kg_l = EXCLUDED.liquid_density_kg_l,
  reference_temperature_c = EXCLUDED.reference_temperature_c,
  oil_compatibility = EXCLUDED.oil_compatibility,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO public.coldpro_equipment_model_refrigerants (
  equipment_model_id, refrigerant_id, is_primary, compatibility_notes, source
)
SELECT m.id, r.id, true,
       'Fluido aceito conforme catálogo oficial do modelo.',
       'CATÁLOGO_OFICIAL_60Hz_2027-2029'
FROM public.coldpro_equipment_models m
JOIN public.coldpro_refrigerants r
  ON upper(replace(r.code, ' ', '')) = upper(replace(m.refrigerante, ' ', ''))
WHERE m.refrigerante IS NOT NULL
ON CONFLICT (equipment_model_id, refrigerant_id) DO UPDATE SET
  is_primary = EXCLUDED.is_primary,
  compatibility_notes = EXCLUDED.compatibility_notes,
  source = EXCLUDED.source;