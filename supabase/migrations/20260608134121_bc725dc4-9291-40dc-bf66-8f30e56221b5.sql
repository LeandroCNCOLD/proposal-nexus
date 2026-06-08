
-- Restrict modify-all policies to authenticated role
DROP POLICY IF EXISTS coldpro_boosters_modify ON public.coldpro_booster_models;
CREATE POLICY coldpro_boosters_modify ON public.coldpro_booster_models
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS coldpro_model_refrigerants_modify ON public.coldpro_equipment_model_refrigerants;
CREATE POLICY coldpro_model_refrigerants_modify ON public.coldpro_equipment_model_refrigerants
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS coldpro_refrigerant_properties_modify ON public.coldpro_refrigerant_properties;
CREATE POLICY coldpro_refrigerant_properties_modify ON public.coldpro_refrigerant_properties
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]));

DROP POLICY IF EXISTS coldpro_refrigerants_modify ON public.coldpro_refrigerants;
CREATE POLICY coldpro_refrigerants_modify ON public.coldpro_refrigerants
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['engenharia'::app_role,'admin'::app_role,'diretoria'::app_role]));

-- Climate cache: restrict reads to authenticated
DROP POLICY IF EXISTS climate_cache_select_all ON public.coldpro_climate_cache;
CREATE POLICY climate_cache_select_authenticated ON public.coldpro_climate_cache
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

-- Profiles: restrict select to own profile + access managers
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_own_or_manager ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id = auth.uid() OR can_manage_user_access(auth.uid()));
