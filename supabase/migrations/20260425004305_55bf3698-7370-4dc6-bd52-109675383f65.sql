DROP POLICY IF EXISTS "coldpro_thermal_materials_auth" ON public.coldpro_thermal_materials;
DROP POLICY IF EXISTS "coldpro_thermal_materials_read" ON public.coldpro_thermal_materials;
DROP POLICY IF EXISTS "coldpro_thermal_materials_insert_engineering" ON public.coldpro_thermal_materials;
DROP POLICY IF EXISTS "coldpro_thermal_materials_update_engineering" ON public.coldpro_thermal_materials;
DROP POLICY IF EXISTS "coldpro_thermal_materials_delete_admin" ON public.coldpro_thermal_materials;

CREATE POLICY "coldpro_thermal_materials_read"
ON public.coldpro_thermal_materials
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "coldpro_thermal_materials_insert_engineering"
ON public.coldpro_thermal_materials
FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::public.app_role, 'diretoria'::public.app_role, 'admin'::public.app_role]));

CREATE POLICY "coldpro_thermal_materials_update_engineering"
ON public.coldpro_thermal_materials
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['engenharia'::public.app_role, 'diretoria'::public.app_role, 'admin'::public.app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia'::public.app_role, 'diretoria'::public.app_role, 'admin'::public.app_role]));

CREATE POLICY "coldpro_thermal_materials_delete_admin"
ON public.coldpro_thermal_materials
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['diretoria'::public.app_role, 'admin'::public.app_role]));