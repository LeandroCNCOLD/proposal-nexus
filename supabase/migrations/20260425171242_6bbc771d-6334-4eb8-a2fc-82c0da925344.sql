-- Harden ColdPro RLS policies by replacing broad write policies with authenticated/role-aware policies.

DROP POLICY IF EXISTS coldpro_projects_auth ON public.coldpro_projects;
CREATE POLICY "ColdPro projects readable by authenticated users"
ON public.coldpro_projects
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "ColdPro projects creatable by authenticated users"
ON public.coldpro_projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ColdPro projects editable by authenticated users"
ON public.coldpro_projects
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ColdPro projects deletable by managers"
ON public.coldpro_projects
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','gerente_comercial','diretoria','admin']::public.app_role[]));

DROP POLICY IF EXISTS coldpro_env_auth ON public.coldpro_environments;
CREATE POLICY "ColdPro environments readable through project"
ON public.coldpro_environments
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_projects p WHERE p.id = coldpro_environments.coldpro_project_id));
CREATE POLICY "ColdPro environments creatable through project"
ON public.coldpro_environments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_projects p WHERE p.id = coldpro_environments.coldpro_project_id));
CREATE POLICY "ColdPro environments editable through project"
ON public.coldpro_environments
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_projects p WHERE p.id = coldpro_environments.coldpro_project_id))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_projects p WHERE p.id = coldpro_environments.coldpro_project_id));
CREATE POLICY "ColdPro environments deletable by managers"
ON public.coldpro_environments
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','gerente_comercial','diretoria','admin']::public.app_role[]) AND EXISTS (SELECT 1 FROM public.coldpro_projects p WHERE p.id = coldpro_environments.coldpro_project_id));

DROP POLICY IF EXISTS coldpro_env_products_auth ON public.coldpro_environment_products;
CREATE POLICY "ColdPro environment products accessible through environment"
ON public.coldpro_environment_products
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_environment_products.environment_id))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_environment_products.environment_id));

DROP POLICY IF EXISTS coldpro_tunnels_auth ON public.coldpro_tunnels;
CREATE POLICY "ColdPro tunnels accessible through environment"
ON public.coldpro_tunnels
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_tunnels.environment_id))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_tunnels.environment_id));

DROP POLICY IF EXISTS coldpro_results_auth ON public.coldpro_results;
CREATE POLICY "ColdPro results accessible through environment"
ON public.coldpro_results
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_results.environment_id))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_results.environment_id));

DROP POLICY IF EXISTS coldpro_equipment_selections_auth ON public.coldpro_equipment_selections;
CREATE POLICY "ColdPro equipment selections accessible through environment"
ON public.coldpro_equipment_selections
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_equipment_selections.environment_id))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coldpro_environments e JOIN public.coldpro_projects p ON p.id = e.coldpro_project_id WHERE e.id = coldpro_equipment_selections.environment_id));

DROP POLICY IF EXISTS coldpro_products_auth ON public.coldpro_products;
CREATE POLICY "ColdPro products readable by authenticated users"
ON public.coldpro_products
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "ColdPro products manageable by technical roles"
ON public.coldpro_products
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','admin']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','admin']::public.app_role[]));

DROP POLICY IF EXISTS coldpro_insulation_auth ON public.coldpro_insulation_materials;
CREATE POLICY "ColdPro insulation readable by authenticated users"
ON public.coldpro_insulation_materials
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "ColdPro insulation manageable by technical roles"
ON public.coldpro_insulation_materials
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','admin']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','admin']::public.app_role[]));

DROP POLICY IF EXISTS coldpro_equipment_catalog_auth ON public.coldpro_equipment_catalog;
CREATE POLICY "ColdPro equipment catalog readable by authenticated users"
ON public.coldpro_equipment_catalog
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY "ColdPro equipment catalog manageable by technical roles"
ON public.coldpro_equipment_catalog
FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','admin']::public.app_role[]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['engenharia','orcamentista','admin']::public.app_role[]));